import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { shapeForBlock } from '/src/features/viewer/geometry.ts';
import { REFERENCE_CAMERA } from '/src/fixtures/campus/reference-layout.ts';

const key = (x,y,z) => x+','+y+','+z;
const full = s => s.supported && s.opacity === 1 && s.boxes.length === 1 && s.boxes[0].min.every(v=>v===0) && s.boxes[0].max.every(v=>v===1);
/** Global material batches; only opaque full-cell adjacency may remove faces. */
export function buildCampusGeometry(blocks, origin = [0,0,0]) {
  const shapes = blocks.map(shapeForBlock);
  const occupied = new Set(blocks.filter((_,i)=>full(shapes[i])).map(b=>key(b.pos.x,b.pos.y,b.pos.z)));
  const transparentCells=new Map(blocks.filter((_,i)=>shapes[i].opacity<1&&shapes[i].boxes.length===1&&shapes[i].boxes[0].min.every(v=>v===0)&&shapes[i].boxes[0].max.every(v=>v===1)).map(b=>[key(b.pos.x,b.pos.y,b.pos.z),b.id]));
  const batches = new Map(); const visible = new Set();
  blocks.forEach((block,index)=>{
    const shape=shapes[index], pos=[block.pos.x,block.pos.y,block.pos.z];
    for(const box of shape.boxes) for(let axis=0;axis<3;axis++) for(const sign of [-1,1]) {
      const neighbor=[...pos]; neighbor[axis]+=sign;
      if(full(shape) && occupied.has(key(...neighbor))) continue;
      if(shape.opacity<1&&shape.boxes.length===1&&shape.boxes[0].min.every(v=>v===0)&&shape.boxes[0].max.every(v=>v===1)&&transparentCells.get(key(...neighbor))===block.id)continue;
      const color=shape.axis === ['x','y','z'][axis] ? 0xc6ab76 : box.color ?? shape.color;
      const surface=block.id==='minecraft:gold_block'?'gold':block.id.includes('glass')?'glass':block.id.endsWith('_leaves')?'foliage':/quartz|white_concrete/.test(block.id)?'quartz':/lantern|glowstone|shroomlight/.test(block.id)?'light':'plain';
      const id=[color,shape.opacity,shape.supported,surface].join(':');
      let batch=batches.get(id);
      if(!batch){batch={color,opacity:shape.opacity,supported:shape.supported,surface,positions:[],normals:[],colors:[],uids:[]};batches.set(id,batch);}
      const u=(axis+1)%3,v=(axis+2)%3;
      const corners=[[0,0],[1,0],[1,1],[0,1]].map(([a,b])=>{
        const p=[...box.min]; p[axis]=sign>0?box.max[axis]:box.min[axis]; p[u]=a?box.max[u]:box.min[u];p[v]=b?box.max[v]:box.min[v];
        return p.map((n,j)=>n+pos[j]-origin[j]);
      });
      const normal=[0,0,0]; normal[axis]=sign;
      for(const i of sign>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]) {batch.positions.push(...corners[i]);batch.normals.push(...normal);const grain=.90+.1*(Math.sin(pos[0]*12.99+pos[1]*78.2+pos[2]*37.7)*43758.5%1+1)/2;batch.colors.push(grain,grain,grain);}
      batch.uids.push(block.uid,block.uid);visible.add(block.uid);
    }
  });
  const group=new THREE.Group();
  for(const batch of batches.values()) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(batch.colors,3));
    geometry.computeBoundingSphere();
    const material=new THREE.MeshStandardMaterial({color:batch.surface==='gold'?0xffaa04:batch.color,vertexColors:true,roughness:batch.surface==='gold'?.48:batch.opacity<1?.2:.84,metalness:batch.surface==='gold'?.08:batch.opacity<1?.08:.03,transparent:batch.opacity<1,opacity:batch.surface==='glass'?Math.max(.86,batch.opacity):batch.opacity,depthWrite:batch.opacity===1,wireframe:!batch.supported});
    if(batch.surface==='gold'){material.emissive.setHex(0xffa000);material.emissiveIntensity=.08;}
    if(batch.surface==='light'){material.emissive.setHex(0xff8a20);material.emissiveIntensity=2.4;}
    if(batch.surface!=='plain'){
      material.onBeforeCompile=shader=>{
        shader.uniforms.voxelOrigin={value:new THREE.Vector3(...origin)};
        shader.vertexShader='varying vec3 vVoxelPosition; varying vec3 vVoxelNormal; uniform vec3 voxelOrigin;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvVoxelPosition=position+voxelOrigin; vVoxelNormal=normal;');
        shader.fragmentShader='varying vec3 vVoxelPosition; varying vec3 vVoxelNormal;\n'+shader.fragmentShader;
        const strength=batch.surface==='gold'?'0.32':batch.surface==='glass'?'0.48':'0.07';
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          vec3 vn=abs(vVoxelNormal); vec2 uv=vn.y>.5?vVoxelPosition.xz:vn.x>.5?vVoxelPosition.zy:vVoxelPosition.xy;
          vec2 cell=fract(uv); float edge=min(min(cell.x,1.-cell.x),min(cell.y,1.-cell.y));
          float inset=smoothstep(.012,.045,edge);
          diffuseColor.rgb*=mix(1.-${strength},1.,inset);
          diffuseColor.rgb*=.96+.04*sin(floor(uv.x)*17.3+floor(uv.y)*23.7);
        `);
        // Original per-block glazing detail, anchored to the canonical grid (not extra mullion geometry).
        if(batch.surface==='glass')shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          vec3 glassNormal=abs(vVoxelNormal);vec2 glassUv=glassNormal.y>.5?vVoxelPosition.xz:glassNormal.x>.5?vVoxelPosition.zy:vVoxelPosition.xy;
          vec2 glassCell=fract(glassUv);float paneNoise=fract(sin(dot(floor(glassUv),vec2(37.2,91.7)))*43758.5453);
          float verticalEdge=1.-smoothstep(.018,.055,min(glassCell.x,1.-glassCell.x));
          float reflection=1.-smoothstep(.018,.07,abs(glassCell.x-glassCell.y*.38-.28));
          diffuseColor.rgb*=.94+.14*paneNoise;
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.42,.58),verticalEdge*.35+reflection*.04);
        `);
        if(batch.surface==='foliage')shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          vec3 leafNormal=abs(vVoxelNormal);vec2 leafUv=leafNormal.y>.5?vVoxelPosition.xz:leafNormal.x>.5?vVoxelPosition.zy:vVoxelPosition.xy;
          float leafNoise=fract(sin(dot(floor(leafUv*8.),vec2(91.7,273.3)))*43758.5453);
          diffuseColor.rgb*=.72+.42*step(.35,leafNoise);
        `);
        // Original warm pixel pattern on actual canonical light faces; no invented light blocks.
        if(batch.surface==='light')shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          vec3 lightNormal=abs(vVoxelNormal);vec2 lightUv=lightNormal.y>.5?vVoxelPosition.xz:lightNormal.x>.5?vVoxelPosition.zy:vVoxelPosition.xy;
          vec2 lightCell=fract(lightUv);float lightEdge=min(min(lightCell.x,1.-lightCell.x),min(lightCell.y,1.-lightCell.y));
          float lightNoise=fract(sin(dot(floor(lightUv*8.),vec2(127.1,311.7)))*43758.5453);
          totalEmissiveRadiance*=mix(.18,1.,smoothstep(.04,.16,lightEdge))*(.65+.6*step(.4,lightNoise));
        `);
      };
      material.customProgramCacheKey=()=>batch.surface;
    }
    const mesh=new THREE.Mesh(geometry,material);mesh.userData.uids=batch.uids;mesh.userData.visibleCellCount=new Set(batch.uids).size;mesh.castShadow=batch.opacity===1;mesh.receiveShadow=true;group.add(mesh);
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

/** World-coordinate camera contract; pure projection helpers never modify canonical cells. */
export function validCampusCamera(c){return !!c&&['perspective','orthographic'].includes(c.projection)&&[c.yaw,c.pitch,c.fov,c.distance,c.span,...(Array.isArray(c.target)?c.target:[])].every(Number.isFinite)&&c.target?.length===3&&c.pitch>=-90&&c.pitch<=90&&c.fov>=10&&c.fov<=100&&c.distance>0&&c.span>0;}
function cameraFrom(c,aspect=1.5,origin=[0,0,0]){
 const camera=c.projection==='orthographic'?new THREE.OrthographicCamera(-c.span*aspect/2,c.span*aspect/2,c.span/2,-c.span/2,.1,30000):new THREE.PerspectiveCamera(c.fov,aspect,.1,30000);
 const yaw=THREE.MathUtils.degToRad(c.yaw),pitch=THREE.MathUtils.degToRad(c.pitch),target=new THREE.Vector3(...c.target).sub(new THREE.Vector3(...origin));
 camera.position.copy(target).add(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(c.distance));camera.lookAt(target);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();return camera;
}
export function projectCampusLandmarks(c,landmarks){
 if(!validCampusCamera(c))throw new Error('Invalid campus camera');const camera=cameraFrom(c);
 return landmarks.map(l=>{const p=new THREE.Vector3(...l.world).project(camera),pixel=[(p.x+1)*768,(1-p.y)*512];return {...l,pixel,errorPixels:Math.hypot(pixel[0]-l.reference[0],pixel[1]-l.reference[1]),inFrame:Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&p.z>=-1&&p.z<=1};});
}
/** Fit framing at fixed yaw/pitch: orientation must be matched visually before layout calibration. */
export function calibrateCampusCamera(landmarks,initial){
 if(landmarks.length<3)throw new Error('At least three landmarks required');
 let best={...initial,target:[...initial.target]},score=c=>Math.sqrt(projectCampusLandmarks(c,landmarks).reduce((sum,l)=>sum+l.errorPixels*l.errorPixels,0)/landmarks.length),error=score(best);
 const steps=[12,8,120,25,25,25];
 for(let scale=0;scale<8;scale++)for(let iteration=0;iteration<16;iteration++){
  let changed=false;
  for(let axis=2;axis<6;axis++)for(const sign of [-1,1]){const next={...best,target:[...best.target]},delta=steps[axis]*Math.pow(.55,scale)*sign;
   if(axis===0)next.yaw+=delta;else if(axis===1)next.pitch=Math.max(5,Math.min(85,next.pitch+delta));else if(axis===2){if(next.projection==='orthographic')next.span=Math.max(10,next.span+delta);else next.distance=Math.max(10,next.distance+delta);}else next.target[axis-3]+=delta;
   const candidate=score(next);if(candidate<error){best=next;error=candidate;changed=true;}
  }if(!changed)break;
 }
 return {camera:best,rmsePixels:error,landmarks:projectCampusLandmarks(best,landmarks)};
}

export function createCampusViewer(host,blocks,onSelect,onCamera,options={}) {
  const bounds=new THREE.Box3(); for(const b of blocks){bounds.expandByPoint(new THREE.Vector3(b.pos.x,b.pos.y,b.pos.z));bounds.expandByPoint(new THREE.Vector3(b.pos.x+1,b.pos.y+1,b.pos.z+1));}
  if(bounds.isEmpty())bounds.set(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,2,1));
  const center=bounds.getCenter(new THREE.Vector3());
  const origin=center.toArray(),group=buildCampusGeometry(blocks,origin),byUid=new Map(blocks.map(b=>[b.uid,b]));
  const scene=new THREE.Scene();scene.background=new THREE.Color(options.background??0xa8d7ee);scene.add(group);
  scene.add(new THREE.HemisphereLight(0xe8f7ff,options.ocean===false?0x596876:0x3b5540,options.ocean===false?1.35:1.55));
  if(options.ocean===false){const fill=new THREE.DirectionalLight(0xd7edff,.65);fill.position.set(120,100,170);scene.add(fill);}
  const sun=new THREE.DirectionalLight(0xfff1d2,options.ocean===false?2.6:3.2);sun.position.set(-140,220,options.ocean===false?-160:120);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const size=bounds.getSize(new THREE.Vector3()),shadowExtent=options.ocean===false?Math.max(40,Math.max(size.x,size.y,size.z)*.8):260;sun.shadow.camera.left=-shadowExtent;sun.shadow.camera.right=shadowExtent;sun.shadow.camera.top=shadowExtent;sun.shadow.camera.bottom=-shadowExtent;sun.shadow.camera.near=1;sun.shadow.camera.far=650;sun.shadow.normalBias=options.ocean===false?.04:.35;sun.shadow.bias=-.00015;scene.add(sun);
  let backLight;
  if(options.ocean===false){backLight=new THREE.DirectionalLight(0xfff3df,1.8);backLight.position.set(110,160,180);backLight.castShadow=false;backLight.shadow.mapSize.set(2048,2048);Object.assign(backLight.shadow.camera,{left:-shadowExtent,right:shadowExtent,top:shadowExtent,bottom:-shadowExtent,near:1,far:650});backLight.shadow.normalBias=.04;backLight.shadow.bias=-.00015;scene.add(backLight);}
  // Explicit presentation ocean: no decorative architecture or landscape is substituted for block data.
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshStandardMaterial({color:0x087caa,roughness:.38,metalness:.25}));
  ocean.rotation.x=-Math.PI/2;ocean.position.y=-4.5-origin[1];ocean.receiveShadow=true;ocean.visible=options.ocean!==false;scene.add(ocean);
  ocean.material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vOcean;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOcean=position;');shader.fragmentShader='varying vec3 vOcean;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat wave=sin(vOcean.x*1.9+sin(vOcean.y*.9))*sin(vOcean.y*2.3+cos(vOcean.x*.6)); diffuseColor.rgb*=.91+.09*wave;');};
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1,1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=options.ocean===false?1.35:1.12;
  const canvas=renderer.domElement;canvas.className='campus-canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label',options.label??'完整園區 3D 總覽');canvas.setAttribute('role','application');canvas.style.touchAction='none';canvas.style.width='100%';canvas.style.height='100%';canvas.style.display='block';host.append(canvas);
  let camera=new THREE.PerspectiveCamera(30,1,.1,10000);const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=1;controls.maxPolarAngle=Math.PI*.98;controls.listenToKeyEvents(canvas);
  const outline=new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1.02,1.02,1.02)),0xffd36d);outline.visible=false;scene.add(outline);
  // BoxHelper copies its geometry; dispose the temporary source immediately.
  outline.object.geometry.dispose();outline.object.material.dispose();
  let disposed=false,frame=0,lastPreset='reference',manual=false;
  function readCamera(){const delta=camera.position.clone().sub(controls.target),distance=delta.length();return {projection:camera.isOrthographicCamera?'orthographic':'perspective',yaw:THREE.MathUtils.radToDeg(Math.atan2(delta.x,delta.z)),pitch:THREE.MathUtils.radToDeg(Math.asin(delta.y/distance)),fov:camera.isPerspectiveCamera?camera.fov:30,distance,span:camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom:2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),target:controls.target.clone().add(new THREE.Vector3(...origin)).toArray()};}
  function setCamera(c){if(!validCampusCamera(c))throw new Error('Invalid campus camera');manual=true;const aspect=Math.max(host.clientWidth,1)/Math.max(host.clientHeight,1);camera=cameraFrom(c,aspect,origin);controls.object=camera;controls.target.copy(new THREE.Vector3(...c.target).sub(new THREE.Vector3(...origin)));controls.update();render();}
  function render(){if(disposed||frame)return;frame=globalThis.requestAnimationFrame(()=>{frame=0;if(disposed)return;renderer.render(scene,camera);canvas.dataset.camera=JSON.stringify(readCamera());onCamera?.(readCamera());canvas.dataset.rendererStats=JSON.stringify({visibleCells:group.userData.visibleCells,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls});});}
  function fit(p=lastPreset){
    lastPreset=p;if(p==='reference'&&blocks.length>500000){setCamera(REFERENCE_CAMERA);return;}if(!camera.isPerspectiveCamera){camera=new THREE.PerspectiveCamera(30,Math.max(host.clientWidth,1)/Math.max(host.clientHeight,1),.1,10000);controls.object=camera;}
    const direction=new THREE.Vector3(...(p==='reference'?[.42,1.05,1.6]:p==='top'?[0,1,.001]:p==='front'?[0,.12,1]:p==='side'?[1,.12,0]:[1,.8,1])).normalize();
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
    distance*=1.055;controls.target.copy(target);camera.position.copy(target).addScaledVector(direction,distance);
    camera.near=Math.max(.05,distance/10000);camera.far=Math.max(1000,distance*5);camera.updateProjectionMatrix();controls.update();render();
  }
  function resize(){const width=Math.max(host.clientWidth,1),height=Math.max(host.clientHeight,1);renderer.setSize(width,height,false);if(camera.isOrthographicCamera){const half=(camera.top-camera.bottom)/2;camera.left=-half*width/height;camera.right=half*width/height;}else camera.aspect=width/height;camera.updateProjectionMatrix();if(!manual)fit();else render();}
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
  return {camera:readCamera,setCamera,project(landmarks){return projectCampusLandmarks(readCamera(),landmarks);},preset(p){manual=false;fit(p);},select(uid){const b=byUid.get(uid);outline.visible=!!b;if(b){outline.position.set(b.pos.x+.5-origin[0],b.pos.y+.5-origin[1],b.pos.z+.5-origin[2]);}render();},dispose(){if(disposed)return;disposed=true;globalThis.cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('change',render);controls.removeEventListener('start',start);controls.dispose();for(const [name,fn] of [['pointerdown',pointerDown],['pointermove',pointerMove],['pointerup',pointerUp],['pointercancel',cancel],['keydown',keyboard],['webglcontextlost',lost],['webglcontextrestored',restored]])canvas.removeEventListener(name,fn);disposeCampusGeometry(group);ocean.geometry.dispose();ocean.material.dispose();sun.shadow.dispose();backLight?.shadow.dispose();outline.geometry.dispose();outline.material.dispose();renderer.dispose();canvas.remove();}};
}
