import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { shapeForBlock } from '../viewer/geometry.ts';

const key = (x,y,z) => x+','+y+','+z;
const full = s => s.supported && s.opacity === 1 && s.boxes.length === 1 && s.boxes[0].min.every(v=>v===0) && s.boxes[0].max.every(v=>v===1);
/** Global material batches; only opaque full-cell adjacency may remove faces. */
export function buildCampusGeometry(blocks, origin = [0,0,0]) {
  const shapes = blocks.map(shapeForBlock);
  const occupied = new Set(blocks.filter((_,i)=>full(shapes[i])).map(b=>key(b.pos.x,b.pos.y,b.pos.z)));
  const batches = new Map(); const visible = new Set();
  blocks.forEach((block,index)=>{
    const shape=shapes[index], pos=[block.pos.x,block.pos.y,block.pos.z];
    for(const box of shape.boxes) for(let axis=0;axis<3;axis++) for(const sign of [-1,1]) {
      const neighbor=[...pos]; neighbor[axis]+=sign;
      if(full(shape) && occupied.has(key(...neighbor))) continue;
      const color=shape.axis === ['x','y','z'][axis] ? 0xc6ab76 : box.color ?? shape.color;
      const id=[color,shape.opacity,shape.supported].join(':');
      let batch=batches.get(id);
      if(!batch){batch={color,opacity:shape.opacity,supported:shape.supported,positions:[],normals:[],uids:[]};batches.set(id,batch);}
      const u=(axis+1)%3,v=(axis+2)%3;
      const corners=[[0,0],[1,0],[1,1],[0,1]].map(([a,b])=>{
        const p=[...box.min]; p[axis]=sign>0?box.max[axis]:box.min[axis]; p[u]=a?box.max[u]:box.min[u];p[v]=b?box.max[v]:box.min[v];
        return p.map((n,j)=>n+pos[j]-origin[j]);
      });
      const normal=[0,0,0]; normal[axis]=sign;
      for(const i of sign>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]) {batch.positions.push(...corners[i]);batch.normals.push(...normal);}
      batch.uids.push(block.uid,block.uid);visible.add(block.uid);
    }
  });
  const group=new THREE.Group();
  for(const batch of batches.values()) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));
    geometry.computeBoundingSphere();
    const material=new THREE.MeshStandardMaterial({color:batch.color,roughness:.8,metalness:.03,transparent:batch.opacity<1,opacity:batch.opacity,depthWrite:batch.opacity===1,wireframe:!batch.supported});
    const mesh=new THREE.Mesh(geometry,material);mesh.userData.uids=batch.uids;group.add(mesh);
  }
  group.userData.visibleCells=visible.size;group.userData.triangles=[...batches.values()].reduce((n,b)=>n+b.uids.length,0);
  group.updateMatrixWorld(true);return group;
}
export function pickCampus(group, origin, direction) {
  const ray=new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction).normalize());
  const hit=ray.intersectObjects(group.children,false)[0];
  return hit?.object.userData.uids[hit.faceIndex] ?? null;
}
export function disposeCampusGeometry(group) {
  for(const mesh of group.children){mesh.geometry.dispose();mesh.material.dispose();}
}

export function createCampusViewer(host,blocks,onSelect) {
  const bounds=new THREE.Box3(); for(const b of blocks){bounds.expandByPoint(new THREE.Vector3(b.pos.x,b.pos.y,b.pos.z));bounds.expandByPoint(new THREE.Vector3(b.pos.x+1,b.pos.y+1,b.pos.z+1));}
  if(bounds.isEmpty())bounds.set(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,2,1));
  const center=bounds.getCenter(new THREE.Vector3());
  const origin=center.toArray(),group=buildCampusGeometry(blocks,origin),byUid=new Map(blocks.map(b=>[b.uid,b]));
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x111b21);scene.add(group);
  scene.add(new THREE.HemisphereLight(0xe0f5ff,0x546052,2.6));const sun=new THREE.DirectionalLight(0xffe8c0,3);sun.position.set(70,160,90);scene.add(sun);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;
  const canvas=renderer.domElement;canvas.className='campus-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label','完整園區 3D 總覽');canvas.setAttribute('role','application');canvas.style.touchAction='none';canvas.style.width='100%';canvas.style.height='100%';canvas.style.display='block';host.append(canvas);
  const camera=new THREE.PerspectiveCamera(42,1,.1,10000);const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.98;controls.listenToKeyEvents(canvas);
  const outline=new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1.02,1.02,1.02)),0xffd36d);outline.visible=false;scene.add(outline);
  // BoxHelper copies its geometry; dispose the temporary source immediately.
  outline.object.geometry.dispose();outline.object.material.dispose();
  let disposed=false,frame=0,lastPreset='iso',manual=false;
  function render(){if(disposed||frame)return;frame=globalThis.requestAnimationFrame(()=>{frame=0;if(disposed)return;renderer.render(scene,camera);canvas.dataset.rendererStats=JSON.stringify({visibleCells:group.userData.visibleCells,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls});});}
  function fit(p=lastPreset){
    lastPreset=p;
    const direction=new THREE.Vector3(...(p==='top'?[0,1,.001]:p==='front'?[0,.12,1]:p==='side'?[1,.12,0]:[1,.8,1])).normalize();
    camera.position.copy(direction);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    const rotation=new THREE.Matrix4().extractRotation(camera.matrixWorldInverse),v=new THREE.Vector3();
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    // Fit actual occupied cells: the roof-height corners of a whole-campus AABB are mostly empty sky.
    for(const block of blocks){v.set(block.pos.x+.5-origin[0],block.pos.y+.5-origin[1],block.pos.z+.5-origin[2]).applyMatrix4(rotation);minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}
    const midX=blocks.length?(minX+maxX)/2:0,midY=blocks.length?(minY+maxY)/2:0;
    const target=new THREE.Vector3(midX,midY,0).applyMatrix4(rotation.clone().invert());
    const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),radius=Math.sqrt(3)/2;
    let distance=3;
    for(const block of blocks){
      v.set(block.pos.x+.5-origin[0],block.pos.y+.5-origin[1],block.pos.z+.5-origin[2]).applyMatrix4(rotation);
      // A unit cell lies inside a radius sqrt(3)/2 sphere, including its nearest depth edge.
      distance=Math.max(distance,(Math.abs(v.x-midX)+radius)/(tangent*camera.aspect)+v.z+radius,(Math.abs(v.y-midY)+radius)/tangent+v.z+radius);
    }
    distance*=1.1;controls.target.copy(target);camera.position.copy(target).addScaledVector(direction,distance);
    camera.near=Math.max(.05,distance/10000);camera.far=Math.max(1000,distance*5);camera.updateProjectionMatrix();controls.update();render();
  }
  function resize(){const width=Math.max(host.clientWidth,1),height=Math.max(host.clientHeight,1);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(!manual)fit();else render();}
  const observer=new globalThis.ResizeObserver(resize);observer.observe(host);
  controls.addEventListener('change',render);const start=()=>{manual=true;};controls.addEventListener('start',start);
  function pick(x,y){camera.updateMatrixWorld(true);const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);const hit=ray.intersectObjects(group.children,false)[0];onSelect(hit?.object.userData.uids[hit.faceIndex]??null);}
  const pointers=new Set();let down=null;
  const pointerDown=e=>{pointers.add(e.pointerId);if(pointers.size===1)down={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};else if(down)down.moved=true;};
  const pointerMove=e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.moved=true;};
  const pointerUp=e=>{if(down&&down.id===e.pointerId&&!down.moved&&pointers.size===1&&e.button===0)pick(e.clientX,e.clientY);pointers.delete(e.pointerId);down=null;};
  const cancel=e=>{pointers.delete(e.pointerId);down=null;};
  const keyboard=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const r=canvas.getBoundingClientRect();pick(r.left+r.width/2,r.top+r.height/2);}else if(e.key==='Home'){e.preventDefault();manual=false;fit();}};
  const lost=e=>{e.preventDefault();canvas.dataset.contextState='lost';};const restored=()=>{canvas.dataset.contextState='ready';render();};
  for(const [name,fn] of [['pointerdown',pointerDown],['pointermove',pointerMove],['pointerup',pointerUp],['pointercancel',cancel],['keydown',keyboard],['webglcontextlost',lost],['webglcontextrestored',restored]])canvas.addEventListener(name,fn);
  resize();
  return {preset(p){manual=false;fit(p);},select(uid){const b=byUid.get(uid);outline.visible=!!b;if(b){outline.position.set(b.pos.x+.5-origin[0],b.pos.y+.5-origin[1],b.pos.z+.5-origin[2]);}render();},dispose(){if(disposed)return;disposed=true;globalThis.cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('change',render);controls.removeEventListener('start',start);controls.dispose();for(const [name,fn] of [['pointerdown',pointerDown],['pointermove',pointerMove],['pointerup',pointerUp],['pointercancel',cancel],['keydown',keyboard],['webglcontextlost',lost],['webglcontextrestored',restored]])canvas.removeEventListener(name,fn);disposeCampusGeometry(group);outline.geometry.dispose();outline.material.dispose();renderer.dispose();canvas.remove();}};
}
