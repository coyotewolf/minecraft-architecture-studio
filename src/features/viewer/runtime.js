import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const modelStates = new WeakMap();
const defaultProjection = Object.freeze({ visible: true, opacity: 1, offsetY: 0 });
function projectionMap(entries) {
  const result = new Map();
  for (const entry of entries) {
    if (typeof entry.uid !== 'string' || typeof entry.visible !== 'boolean' ||
        !Number.isFinite(entry.opacity) || entry.opacity < 0 || entry.opacity > 1 || !Number.isFinite(entry.offsetY)) {
      throw new Error('Invalid viewer projection');
    }
    result.set(entry.uid, { visible: entry.visible, opacity: entry.opacity, offsetY: entry.offsetY });
  }
  return result;
}
function chunkKey(pos) { return [Math.floor(pos.x / 16), Math.floor(pos.y / 16), Math.floor(pos.z / 16)].join(','); }
function hitUid(hit) { return hit?.object.userData.uids?.[hit.instanceId] ?? null; }
function makeChunk(records, origin) {
  const batches = new Map();
  for (const { block, shape, projection } of records) {
    const opacity = shape.opacity * projection.opacity;
    if (!projection.visible || opacity === 0) continue;
    for (const part of shape.boxes) {
      const key = JSON.stringify([part.min, part.max, part.color ?? shape.color, shape.color, shape.axis ?? null, opacity, shape.supported]);
      let batch = batches.get(key);
      if (!batch) { batch = { part, shape, opacity, entries: [] }; batches.set(key, batch); }
      batch.entries.push({ block, offsetY: projection.offsetY });
    }
  }
  const meshes = [];
  for (const { part, shape, opacity, entries } of batches.values()) {
    const size = part.max.map((value, axis) => value - part.min[axis]);
    const geometry = new THREE.BoxGeometry(...size);
    const makeMaterial = color => new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity === 1, wireframe: !shape.supported });
    let material;
    if (shape.axis) {
      const ends = shape.axis === 'x' ? [0, 1] : shape.axis === 'y' ? [2, 3] : [4, 5];
      material = Array.from({ length: 6 }, (_, index) => makeMaterial(ends.includes(index) ? 0xc6ab76 : shape.color));
    } else material = makeMaterial(part.color ?? shape.color);
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
    mesh.userData.uids = [];
    const matrix = new THREE.Matrix4();
    entries.forEach(({ block, offsetY }, index) => {
      matrix.makeTranslation(
        block.pos.x + (part.min[0] + part.max[0]) / 2 - origin[0],
        block.pos.y + (part.min[1] + part.max[1]) / 2 + offsetY - origin[1],
        block.pos.z + (part.min[2] + part.max[2]) / 2 - origin[2]);
      mesh.setMatrixAt(index, matrix); mesh.userData.uids.push(block.uid);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    meshes.push(mesh);
  }
  return meshes;
}

/** Chunk-local updates are shared by live model edits and view-only projections. */
export function updateModelGroup(group, blocks, shapes, entries) {
  const state = modelStates.get(group);
  if (!state) throw new Error('Unknown model group');
  if (blocks.length !== shapes.length) throw new Error('Block and shape counts differ');
  const proposed = entries === undefined ? state.projection : projectionMap(entries);
  const projection = new Map();
  const buckets = new Map();
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i], shape = shapes[i];
    const view = proposed.get(block.uid) ?? defaultProjection;
    if (proposed.has(block.uid)) projection.set(block.uid, view);
    const key = chunkKey(block.pos);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ block, shape, projection: view });
  }
  const next = new Map(); const created = [];
  try {
    for (const [key, records] of buckets) {
      records.sort((a, b) => a.block.uid < b.block.uid ? -1 : a.block.uid > b.block.uid ? 1 : 0);
      const signature = JSON.stringify(records);
      const previous = state.chunks.get(key);
      if (previous?.signature === signature) next.set(key, previous);
      else {
        const meshes = makeChunk(records, state.origin); created.push(...meshes);
        next.set(key, { signature, meshes });
      }
    }
  } catch (error) {
    for (const mesh of created) disposeGroup(mesh);
    throw error;
  }
  for (const [key, chunk] of state.chunks) {
    if (next.get(key) !== chunk) for (const mesh of chunk.meshes) { group.remove(mesh); disposeGroup(mesh); }
  }
  for (const mesh of created) group.add(mesh);
  state.chunks = next; state.blocks = blocks; state.shapes = shapes; state.projection = projection;
  group.updateMatrixWorld(true);
  return group;
}

/** Every instance stores its exact canonical UID, including all shape parts. */
export function buildModelGroup(blocks, shapes, origin = [0, 0, 0], projection = []) {
  const group = new THREE.Group();
  modelStates.set(group, { origin: [...origin], chunks: new Map(), projection: new Map(), blocks: [], shapes: [] });
  return updateModelGroup(group, blocks, shapes, projection);
}
export function pickModel(group, origin, direction) {
  const ray = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction).normalize());
  const hit = ray.intersectObjects(group.children, false)[0];
  const uid = hitUid(hit);
  return uid === null ? null : { uid, point: hit.point.toArray(), normal: hit.face.normal.toArray() };
}
export function disposeGroup(group) {
  const geometries = new Set(), materials = new Set();
  group.traverse(object => {
    if (object.geometry && !geometries.has(object.geometry)) { geometries.add(object.geometry); object.geometry.dispose(); }
    if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!materials.has(material)) { materials.add(material); material.dispose(); }
    }
    if (object.isInstancedMesh) object.dispose();
    modelStates.delete(object);
  });
}

export function createViewer(host, blocks, shapes, onSelect, onError = () => {}) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setClearColor(0x172125);
  const canvas=renderer.domElement;
  canvas.className='viewer-canvas'; canvas.tabIndex=0; canvas.setAttribute('aria-label','3D 方塊模型');
  canvas.setAttribute('aria-describedby','viewer-help');
  host.appendChild(canvas);
  const scene=new THREE.Scene();
  const bounds=new THREE.Box3();
  for(const b of blocks){bounds.expandByPoint(new THREE.Vector3(b.pos.x,b.pos.y,b.pos.z));bounds.expandByPoint(new THREE.Vector3(b.pos.x+1,b.pos.y+1,b.pos.z+1));}
  if(bounds.isEmpty())bounds.set(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,2,1));
  const origin=bounds.getCenter(new THREE.Vector3());
  const extent=bounds.getSize(new THREE.Vector3());
  const model=buildModelGroup(blocks,shapes,origin.toArray());scene.add(model); let modelCenter=new THREE.Vector3(); let workY=0; let previewGroup=null;
  scene.add(new THREE.AmbientLight(0xffffff,1.6));
  const sun=new THREE.DirectionalLight(0xffefcf,2.4);sun.position.set(10,18,12);scene.add(sun);
  const gridSize=Math.max(12,Math.ceil(Math.max(extent.x,extent.z))+4);
  const grid=new THREE.GridHelper(gridSize,Math.min(gridSize,80),0x57706b,0x2d4145);
  grid.position.y=bounds.min.y-origin.y-0.015;scene.add(grid);
  const camera=new THREE.PerspectiveCamera(40,1,0.05,2000);
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=false;controls.minDistance=0.8;controls.maxPolarAngle=Math.PI-0.01;
  const selection=new THREE.Box3Helper(new THREE.Box3(),0xdff5b2);selection.visible=false;scene.add(selection);
  let lookup=new Map(blocks.map(b=>[b.uid,b])); let selectedUid=null;
  let disposed=false; let viewPreset='isometric'; let userNavigated=false; let fittedTarget=new THREE.Vector3(); let fittedSize=extent.clone();
  function render(){if(disposed)return;renderer.render(scene,camera);let visibleInstances=0;for(const mesh of model.children)visibleInstances+=mesh.count;canvas.dataset.rendererStats=JSON.stringify({drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,triangles:renderer.info.render.triangles,visibleInstances});canvas.dataset.camera=JSON.stringify({position:camera.position.toArray(),target:controls.target.toArray(),origin:origin.toArray(),fov:camera.fov,aspect:camera.aspect});}
  function updateProjectedBounds(){
    bounds.makeEmpty();
    const projection=modelStates.get(model).projection;
    for(const b of lookup.values()){
      const view=projection.get(b.uid)??defaultProjection;
      if(!view.visible||view.opacity===0)continue;
      bounds.expandByPoint(new THREE.Vector3(b.pos.x,b.pos.y+view.offsetY,b.pos.z));
      bounds.expandByPoint(new THREE.Vector3(b.pos.x+1,b.pos.y+1+view.offsetY,b.pos.z+1));
    }
    if(bounds.isEmpty())bounds.set(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,2,1));
    bounds.getSize(extent);modelCenter=bounds.getCenter(new THREE.Vector3()).sub(origin);
  }
  function updateSelection(){
    const b=lookup.get(selectedUid),view=modelStates.get(model).projection.get(selectedUid)??defaultProjection;
    selection.visible=!!b&&view.visible&&view.opacity>0;
    if(selection.visible)selection.box.set(new THREE.Vector3(b.pos.x,b.pos.y+view.offsetY,b.pos.z).sub(origin),new THREE.Vector3(b.pos.x+1,b.pos.y+1+view.offsetY,b.pos.z+1).sub(origin));
  }
  function fit(preset='isometric',target=modelCenter,size=extent){
    viewPreset=preset; userNavigated=false; fittedTarget=target.clone(); fittedSize=size.clone();
    const directions={isometric:[1,0.8,1.2],top:[0,1,0.00001],front:[0,0,-1],back:[0,0,1],left:[-1,0,0],right:[1,0,0]};
    const radius=Math.max(1,size.length()/2),halfFov=THREE.MathUtils.degToRad(camera.fov/2);
    const limitingFov=Math.min(halfFov,Math.atan(Math.tan(halfFov)*camera.aspect));
    const distance=radius/Math.sin(limitingFov)*1.12;
    camera.far=Math.max(2000,distance*10);camera.updateProjectionMatrix();
    controls.maxDistance=Math.max(200,distance*5);controls.target.copy(target);
    camera.position.copy(target).add(new THREE.Vector3(...directions[preset]).normalize().multiplyScalar(distance));
    camera.up.set(0,1,0);controls.update();render();
  }
  function resize(){const r=host.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height));camera.aspect=Math.max(1,r.width)/Math.max(1,r.height);camera.updateProjectionMatrix();if(!userNavigated)fit(viewPreset,fittedTarget,fittedSize);else render();}
  const observer=new ResizeObserver(resize);observer.observe(host);
  controls.addEventListener('change',render);
  const pointers=new Map();let gesture=false;
  const onDown=e=>{userNavigated=true;canvas.focus({preventScroll:true});if(pointers.size===0)gesture=false;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,button:e.button});if(pointers.size>1)gesture=true;};
  const onMove=e=>{const start=pointers.get(e.pointerId);if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)gesture=true;};
  function dispatchPick(ray){const hit=ray.intersectObjects(model.children,false)[0];if(hit){const block=lookup.get(hitUid(hit));onSelect(block.uid,{uid:block.uid,pos:block.pos,normal:{x:hit.face.normal.x,y:hit.face.normal.y,z:hit.face.normal.z}});return;}const plane=new THREE.Plane(new THREE.Vector3(0,1,0),origin.y-workY);const point=ray.ray.intersectPlane(plane,new THREE.Vector3());if(point){onSelect(null,{uid:null,pos:{x:Math.floor(point.x+origin.x),y:workY,z:Math.floor(point.z+origin.z)},normal:{x:0,y:1,z:0}});}else onSelect(null,null);}
  const onUp=e=>{const start=pointers.get(e.pointerId);const choose=start&&start.button===0&&!gesture&&pointers.size===1&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<=5;pointers.delete(e.pointerId);if(!choose)return;const r=canvas.getBoundingClientRect();const pointer=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);dispatchPick(ray);};
  const onCancel=e=>{pointers.delete(e.pointerId);gesture=true;};
  const onKey=e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home','Escape','Enter',' '].includes(e.key))return;
    e.preventDefault();if(e.key==='Enter'||e.key===' '){const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);dispatchPick(ray);return;}userNavigated=true;if(e.key==='Home'){fit();return;}if(e.key==='Escape'){onSelect(null);return;}
    const offset=camera.position.clone().sub(controls.target);
    if(e.key==='+'||e.key==='='||e.key==='-'){offset.multiplyScalar(e.key==='-'?1.15:1/1.15);offset.clampLength(controls.minDistance,controls.maxDistance);}
    else if(e.shiftKey){const d=offset.length()*0.04;const shift=new THREE.Vector3(e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0,e.key==='ArrowUp'?d:e.key==='ArrowDown'?-d:0,0).applyQuaternion(camera.quaternion);controls.target.add(shift);}
    else {const spherical=new THREE.Spherical().setFromVector3(offset);spherical.theta+=(e.key==='ArrowLeft'?0.12:e.key==='ArrowRight'?-0.12:0);spherical.phi+=(e.key==='ArrowUp'?-0.12:e.key==='ArrowDown'?0.12:0);spherical.makeSafe();offset.setFromSpherical(spherical);}
    camera.position.copy(controls.target).add(offset);controls.update();render();
  };
  canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onCancel);canvas.addEventListener('keydown',onKey);
  const onContextLost=e=>{e.preventDefault();canvas.dataset.contextLost='true';onError('顯示資源已中斷，請重新載入示範模型，或重新整理頁面。');};
  const onContextRestored=()=>{delete canvas.dataset.contextLost;onError('');render();};
  const onWheel=()=>{userNavigated=true;};
  canvas.addEventListener('wheel',onWheel,{passive:true});canvas.addEventListener('webglcontextlost',onContextLost);canvas.addEventListener('webglcontextrestored',onContextRestored);
  resize();fit();
  return {
    preset: p=>fit(p), reset:()=>fit(),
    workPlane:y=>{workY=y;grid.position.y=y-origin.y-0.015;render();},
    updateModel:(nextBlocks,nextShapes)=>{
      updateModelGroup(model,nextBlocks,nextShapes);
      lookup=new Map(nextBlocks.map(b=>[b.uid,b]));
      updateProjectedBounds();updateSelection();render();
    },
    preview:(records,recordShapes,valid)=>{
      if(previewGroup){scene.remove(previewGroup);disposeGroup(previewGroup);previewGroup=null;}
      if(records.length){previewGroup=buildModelGroup(records,recordShapes,origin.toArray());previewGroup.traverse(o=>{if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.color.setHex(valid?0x8fffb0:0xff6677);m.transparent=true;m.opacity=0.55;m.depthWrite=false;m.polygonOffset=true;m.polygonOffsetFactor=-2;}}});scene.add(previewGroup);}render();
    },
    setProjection:entries=>{const state=modelStates.get(model);updateModelGroup(model,state.blocks,state.shapes,entries);updateProjectedBounds();updateSelection();render();},
    focus:uid=>{const b=lookup.get(uid),view=modelStates.get(model).projection.get(uid)??defaultProjection;if(b&&view.visible&&view.opacity>0)fit('isometric',new THREE.Vector3(b.pos.x+0.5,b.pos.y+0.5+view.offsetY,b.pos.z+0.5).sub(origin),new THREE.Vector3(2,2,2));},
    select:uid=>{selectedUid=uid;updateSelection();render();},
    dispose:()=>{disposed=true;observer.disconnect();controls.removeEventListener('change',render);controls.dispose();canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onCancel);canvas.removeEventListener('keydown',onKey);canvas.removeEventListener('wheel',onWheel);canvas.removeEventListener('webglcontextlost',onContextLost);canvas.removeEventListener('webglcontextrestored',onContextRestored);disposeGroup(scene);renderer.dispose();renderer.forceContextLoss();canvas.remove();},
  };
}
