import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCampusGeometry } from '../campus/overview-runtime.js';

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
function hitUid(hit) { return hit?.object.userData.uids?.[hit.object.isInstancedMesh?hit.instanceId:hit.faceIndex] ?? null; }
/** Original procedural surface grain; no Minecraft texture assets are redistributed. */
function surfaceTexture(){
  const bytes=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4;const noise=((x*13+y*7+x*y*3)%17);const c=230+noise;bytes.set([c,c,c,255],i);}
  const t=new THREE.DataTexture(bytes,16,16);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.needsUpdate=true;return t;
}
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
    const makeMaterial = color => new THREE.MeshStandardMaterial({ color, roughness:opacity<1?0.28:0.85,metalness:0.03,map:opacity===1&&shape.supported?surfaceTexture():null,transparent: opacity < 1, opacity, depthWrite: opacity === 1, wireframe: !shape.supported });
    let material;
    if (shape.axis) {
      const ends = shape.axis === 'x' ? [0, 1] : shape.axis === 'y' ? [2, 3] : [4, 5];
      material = Array.from({ length: 6 }, (_, index) => makeMaterial(ends.includes(index) ? 0xc6ab76 : shape.color));
    } else material = makeMaterial(part.color ?? shape.color);
    const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
    mesh.castShadow=opacity===1;mesh.receiveShadow=true;
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

/** Whole buildings use exposed-face batches; view offsets stay in temporary render records. */
function updateLargeModel(group,state,blocks,shapes,entries){
  const proposed=entries===undefined?state.projection:projectionMap(entries),projection=new Map();
  for(const [uid,v] of proposed)if(!v.visible||v.opacity!==1||v.offsetY!==0)projection.set(uid,v);
  if(state.blocks===blocks&&state.largeReady&&projection.size===state.projection.size&&[...projection].every(([uid,v])=>{const old=state.projection.get(uid);return old&&v.visible===old.visible&&v.opacity===old.opacity&&v.offsetY===old.offsetY;}))return group;
  const batches=new Map(),created=[];
  for(const block of blocks){const view=projection.get(block.uid)??defaultProjection;if(!view.visible||view.opacity===0)continue;const key=view.opacity+':'+view.offsetY;let batch=batches.get(key);if(!batch){batch={opacity:view.opacity,blocks:[]};batches.set(key,batch);}batch.blocks.push(view.offsetY?{...block,pos:{...block.pos,y:block.pos.y+view.offsetY}}:block);}
  try{for(const batch of batches.values()){const built=buildCampusGeometry(batch.blocks,state.origin);for(const mesh of [...built.children]){mesh.material.opacity*=batch.opacity;mesh.material.transparent=mesh.material.opacity<1;mesh.material.depthWrite=mesh.material.opacity===1;created.push(mesh);}}}catch(error){for(const mesh of created)disposeGroup(mesh);throw error;}
  for(const child of [...group.children]){group.remove(child);disposeGroup(child);}for(const mesh of created)group.add(mesh);
  state.blocks=blocks;state.shapes=shapes;state.projection=projection;state.largeReady=true;state.chunks.clear();group.updateMatrixWorld(true);return group;
}
/** Chunk-local updates are shared by live model edits and view-only projections. */
export function updateModelGroup(group, blocks, shapes, entries) {
  const state = modelStates.get(group);
  if (!state) throw new Error('Unknown model group');
  if (blocks.length !== shapes.length) throw new Error('Block and shape counts differ');
  if(state.large||blocks.length>50000){state.large=true;return updateLargeModel(group,state,blocks,shapes,entries);}
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
      if (!materials.has(material)) { materials.add(material); material.map?.dispose();material.dispose(); }
    }
    if (object.isInstancedMesh) object.dispose();
    modelStates.delete(object);
  });
}

export function createViewer(host, blocks, shapes, onSelect, onError = () => {}, onDrag, onBoxSelection) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setClearColor(0x15232b);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=blocks.length<10000;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
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
  scene.add(new THREE.HemisphereLight(0xd8efff,0x556052,2.1));
  const sun=new THREE.DirectionalLight(0xffefd5,3.2);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-0.0005;sun.shadow.normalBias=0.04;scene.add(sun);scene.add(sun.target);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShadowMaterial({opacity:0.24}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  // Canonical bounds own the shadow receiver: slicing/ghosting must not move terrain.
  // Scale a single plane rather than allocating geometry on every model edit.
  function updateShadowHelpers(records){
    const canonical=new THREE.Box3();
    for(const b of records){canonical.expandByPoint(new THREE.Vector3(b.pos.x,b.pos.y,b.pos.z));canonical.expandByPoint(new THREE.Vector3(b.pos.x+1,b.pos.y+1,b.pos.z+1));}
    if(canonical.isEmpty())canonical.set(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,2,1));
    const size=canonical.getSize(new THREE.Vector3()),center=canonical.getCenter(new THREE.Vector3()).sub(origin);
    ground.position.set(center.x,canonical.min.y-origin.y-0.02,center.z);
    ground.scale.set(Math.max(100,size.x*3),Math.max(100,size.z*3),1);
    const span=Math.max(20,size.length()),distance=Math.max(50,span*2);
    sun.target.position.copy(center);sun.target.updateMatrixWorld();
    sun.position.copy(center).add(new THREE.Vector3(-25,40,18).normalize().multiplyScalar(distance));
    Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:0.5,far:distance+span*2});
    sun.shadow.camera.updateProjectionMatrix();sun.shadow.needsUpdate=true;
  }
  updateShadowHelpers(blocks);
  const gridSize=Math.max(12,Math.ceil(Math.max(extent.x,extent.z))+4);
  const grid=new THREE.GridHelper(gridSize,Math.min(gridSize,24),0x3c5b60,0x243a42);
  grid.position.y=bounds.min.y-origin.y-0.015;scene.add(grid);
  const camera=new THREE.PerspectiveCamera(40,1,0.05,2000);
  const controls=new OrbitControls(camera,canvas);
  controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.ROTATE,RIGHT:null};
  controls.enableDamping=false;controls.minDistance=0.8;controls.maxPolarAngle=Math.PI-0.01;
  // One line batch for up to 5,000 selected cells, including projected/exploded Y.
  const selectionGeometry=new THREE.BufferGeometry();
  const selectionPositions=new THREE.BufferAttribute(new Float32Array(5000*24*3),3);
  selectionPositions.setUsage(THREE.DynamicDrawUsage);selectionGeometry.setAttribute('position',selectionPositions);
  const selection=new THREE.LineSegments(selectionGeometry,new THREE.LineBasicMaterial({color:0xdff5b2,depthTest:false,transparent:true,opacity:0.9}));
  selection.renderOrder=2;selection.frustumCulled=false;selection.visible=false;scene.add(selection);
  let lookup=new Map(blocks.map(b=>[b.uid,b])); let selectedUids=new Set(); let editingEnabled=true; let directDrag=true;
  let disposed=false; let viewPreset='isometric'; let userNavigated=false; let fittedTarget=new THREE.Vector3(); let fittedSize=extent.clone();
  let pendingFrame=null;
  function render(){if(disposed||pendingFrame!==null)return;pendingFrame=window.requestAnimationFrame(()=>{pendingFrame=null;if(disposed)return;paint();});}
  function paint(){if(disposed)return;updateGizmo();renderer.render(scene,camera);let visibleInstances=0;for(const mesh of model.children)visibleInstances+=mesh.isInstancedMesh?mesh.count:mesh.userData.visibleCellCount??0;canvas.dataset.rendererStats=JSON.stringify({drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,triangles:renderer.info.render.triangles,visibleInstances});canvas.dataset.camera=JSON.stringify({position:camera.position.toArray(),target:controls.target.toArray(),origin:origin.toArray(),fov:camera.fov,aspect:camera.aspect});}
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
    const projection=modelStates.get(model).projection;let vertex=0;
    for(const uid of selectedUids){
      const b=lookup.get(uid),view=projection.get(uid)??defaultProjection;
      if(!b||!view.visible||view.opacity===0)continue;
      if(vertex>=5000*24)break;
      const base=[b.pos.x-origin.x,b.pos.y+view.offsetY-origin.y,b.pos.z-origin.z];
      for(let axis=0;axis<3;axis++)for(let first=0;first<2;first++)for(let second=0;second<2;second++){
        const start=[...base];start[(axis+1)%3]+=first;start[(axis+2)%3]+=second;
        selectionPositions.setXYZ(vertex++,...start);start[axis]+=1;selectionPositions.setXYZ(vertex++,...start);
      }
    }
    selectionGeometry.setDrawRange(0,vertex);selectionPositions.needsUpdate=true;selection.visible=vertex>0;
    canvas.dataset.selectionCount=String(selectedUids.size);canvas.dataset.visibleSelectionCount=String(vertex/24);
  }
  // Screen-sized world-axis handles remain usable at every zoom and follow view offsets.
  const gizmo=new THREE.Group();scene.add(gizmo);const axisHandles=[];
  for(const [axis,color] of [['x',0xff6868],['y',0x80e77a],['z',0x70b7ff]]){
    const direction=new THREE.Vector3();direction[axis]=1;
    const arrow=new THREE.ArrowHelper(direction,new THREE.Vector3(),1,color,0.22,0.12);
    arrow.line.material.depthTest=false;arrow.cone.material.depthTest=false;
    arrow.line.renderOrder=10;arrow.cone.renderOrder=10;gizmo.add(arrow);
    const labelCanvas=host.ownerDocument.createElement('canvas');labelCanvas.width=64;labelCanvas.height=64;
    const context=labelCanvas.getContext('2d');context.font='bold 44px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillStyle='#'+color.toString(16);context.fillText(axis.toUpperCase(),32,32);
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas),depthTest:false,transparent:true}));label.renderOrder=11;gizmo.add(label);axisHandles.push({axis,arrow,label});
  }
  let gizmoScreen=[];
  function screenPoint(point,r=canvas.getBoundingClientRect()){const p=point.clone().project(camera);return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2,z:p.z};}
  function updateGizmo(){
    const box=new THREE.Box3(),projection=modelStates.get(model).projection;
    for(const uid of selectedUids){const b=lookup.get(uid),v=projection.get(uid)??defaultProjection;if(!b||!v.visible||v.opacity===0)continue;box.expandByPoint(new THREE.Vector3(b.pos.x,b.pos.y+v.offsetY,b.pos.z).sub(origin));box.expandByPoint(new THREE.Vector3(b.pos.x+1,b.pos.y+v.offsetY+1,b.pos.z+1).sub(origin));}
    gizmo.visible=editingEnabled&&!!onDrag&&!box.isEmpty();gizmoScreen=[];
    if(gizmo.visible){
      box.getCenter(gizmo.position);if(drag?.active)gizmo.position.add(new THREE.Vector3(drag.delta.x,drag.delta.y,drag.delta.z));
      const depth=-gizmo.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
      gizmo.visible=depth>camera.near;
      const units=2*Math.max(camera.near,depth)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,canvas.clientHeight),length=units*88;
      const start=screenPoint(gizmo.position);
      for(const handle of axisHandles){handle.arrow.setLength(length,length*0.22,length*0.12);const end=gizmo.position.clone();end[handle.axis]+=length;const tip=screenPoint(end);const pixels=Math.hypot(tip.x-start.x,tip.y-start.y);handle.arrow.visible=pixels>=10;handle.label.visible=handle.arrow.visible;handle.label.position.set(0,0,0);handle.label.position[handle.axis]=length*1.16;handle.label.scale.setScalar(length*0.3); if(gizmo.visible&&handle.arrow.visible)gizmoScreen.push({axis:handle.axis,start,tip,x:start.x+(tip.x-start.x)*0.8,y:start.y+(tip.y-start.y)*0.8,unitsPerPixel:units});}
    }
    canvas.dataset.gizmoHandles=JSON.stringify(gizmoScreen);
  }
  function pickAxis(e){updateGizmo();let best=null,distance=12;
    for(const h of gizmoScreen){const dx=h.tip.x-h.start.x,dy=h.tip.y-h.start.y,len=dx*dx+dy*dy,t=((e.clientX-h.start.x)*dx+(e.clientY-h.start.y)*dy)/len;if(t<0.22||t>1.12)continue;const d=Math.hypot(e.clientX-h.start.x-Math.min(1,t)*dx,e.clientY-h.start.y-Math.min(1,t)*dy);if(d<distance){best=h;distance=d;}}
    return best;
  }
  function fit(preset='isometric',target=modelCenter,size=extent){
    viewPreset=preset; userNavigated=false; fittedTarget=target.clone(); fittedSize=size.clone();
    const directions={isometric:[1,0.8,1.2],top:[0,1,0.00001],front:[0,0,-1],back:[0,0,1],left:[-1,0,0],right:[1,0,0]};
    const halfFov=THREE.MathUtils.degToRad(camera.fov/2),direction=new THREE.Vector3(...directions[preset]).normalize();
    const forward=direction.clone().negate(),right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,forward).normalize();
    let distance=2;for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){const corner=new THREE.Vector3(size.x*x,size.y*y,size.z*z);distance=Math.max(distance,Math.abs(corner.dot(right))/(Math.tan(halfFov)*camera.aspect)+corner.dot(direction),Math.abs(corner.dot(up))/Math.tan(halfFov)+corner.dot(direction));}distance*=1.16;
    camera.far=Math.max(2000,distance*10);camera.updateProjectionMatrix();
    controls.maxDistance=Math.max(200,distance*5);controls.target.copy(target);
    camera.position.copy(target).add(new THREE.Vector3(...directions[preset]).normalize().multiplyScalar(distance));
    camera.up.set(0,1,0);controls.update();render();
  }
  function resize(){const r=host.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height));camera.aspect=Math.max(1,r.width)/Math.max(1,r.height);camera.updateProjectionMatrix();if(!userNavigated)fit(viewPreset,fittedTarget,fittedSize);else render();}
  const observer=new ResizeObserver(resize);observer.observe(host);
  controls.addEventListener('change',render);
  const pointers=new Map();let gesture=false;let drag=null;let dragFrame=null;let marquee=null;
  const marqueeElement=host.ownerDocument.createElement('div');Object.assign(marqueeElement.style,{position:'fixed',pointerEvents:'none',zIndex:'30',display:'none',boxSizing:'border-box'});host.appendChild(marqueeElement);
  canvas.dataset.boxSelection='idle';
  function pointerRay(e){
    const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/Math.max(1,r.width)*2-1,-(e.clientY-r.top)/Math.max(1,r.height)*2+1),camera);return ray;
  }
  function emitDragPreview(){
    dragFrame=null;if(!drag?.active)return;
    const delta=drag.delta;
    if(delta.x===drag.emitted.x&&delta.y===drag.emitted.y&&delta.z===drag.emitted.z)return;
    drag.emitted={...delta};onDrag?.({...delta},'preview');
  }
  function finishDrag(phase){
    if(!drag)return;
    const ended=drag;drag=null;canvas.dataset.dragState='idle';delete canvas.dataset.dragDelta;
    if(dragFrame!==null){window.cancelAnimationFrame(dragFrame);dragFrame=null;}
    pointers.clear();gesture=true;controls.enabled=ended.controlsEnabled;canvas.style.cursor='';
    if(canvas.hasPointerCapture(ended.pointerId))canvas.releasePointerCapture(ended.pointerId);
    if(ended.active)onDrag?.({...ended.delta},phase);render();
  }
  function updateDrag(e){
    if(!drag||drag.pointerId!==e.pointerId)return;
    if(!drag.active&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5)return;
    drag.active=true;
    let delta;
    if(drag.axis){const h=drag.axis,dx=h.tip.x-h.start.x,dy=h.tip.y-h.start.y;const amount=Math.round(((e.clientX-drag.startX)*dx+(e.clientY-drag.startY)*dy)/(dx*dx+dy*dy)*h.worldLength);delta={x:0,y:0,z:0};delta[h.axis]=amount;}
    else if(drag.vertical)delta={x:0,y:Math.round((drag.startY-e.clientY)*drag.unitsPerPixel),z:0};
    else{
      const point=pointerRay(e).ray.intersectPlane(drag.plane,new THREE.Vector3());if(!point)return;
      delta={x:Math.round(point.x-drag.start.x),y:0,z:Math.round(point.z-drag.start.z)};
    }
    if(!Number.isSafeInteger(delta.x)||!Number.isSafeInteger(delta.y)||!Number.isSafeInteger(delta.z))return;
    drag.delta=delta;render();canvas.dataset.dragDelta=JSON.stringify(delta);if(dragFrame===null)dragFrame=window.requestAnimationFrame(emitDragPreview);
  }
  function finishMarquee(cancel=false){
    if(!marquee)return false;const ended=marquee;marquee=null;marqueeElement.style.display='none';canvas.dataset.boxSelection='idle';controls.enabled=ended.controlsEnabled;
    if(canvas.hasPointerCapture(ended.pointerId))canvas.releasePointerCapture(ended.pointerId);
    if(!cancel&&ended.active){
      const minX=Math.min(ended.x,ended.endX),maxX=Math.max(ended.x,ended.endX),minY=Math.min(ended.y,ended.endY),maxY=Math.max(ended.y,ended.endY),crossing=ended.endX<ended.x,uids=[];
      const projection=modelStates.get(model).projection,rect=canvas.getBoundingClientRect();
      const projected=new THREE.Vector3(),viewProjection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      // Deliberately selects through depth; only explicitly hidden/zero-opacity cells are excluded.
      for(const b of lookup.values()){
        const v=projection.get(b.uid)??defaultProjection;if(!v.visible||v.opacity===0)continue;
        let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,front=false,behind=false;
        for(const x of [0,1])for(const y of [0,1])for(const z of [0,1]){projected.set(b.pos.x+x-origin.x,b.pos.y+y+v.offsetY-origin.y,b.pos.z+z-origin.z).applyMatrix4(viewProjection);const px=rect.left+(projected.x+1)*rect.width/2,py=rect.top+(1-projected.y)*rect.height/2;if(projected.z>=-1&&projected.z<=1)front=true;else behind=true;left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);}
        if(!front)continue;
        const match=crossing?right>=minX&&left<=maxX&&bottom>=minY&&top<=maxY:!behind&&left>=minX&&right<=maxX&&top>=minY&&bottom<=maxY;
        if(match)uids.push(b.uid);
      }
      onBoxSelection?.(uids,ended.additive);
    }
    return true;
  }
  const onDown=e=>{
    canvas.focus({preventScroll:true});
    if(drag||marquee){e.preventDefault();e.stopImmediatePropagation();return;}
    if(e.pointerType!=='touch'&&e.button===2){const ray=pointerRay(e),hit=ray.intersectObjects(model.children,false)[0];if(hit&&!selectedUids.has(hitUid(hit)))dispatchPick(ray,false,true);return;}
    if(e.pointerType!=='touch'&&e.button===0){
      const ray=pointerRay(e),hit=ray.intersectObjects(model.children,false)[0],additive=e.ctrlKey||e.metaKey;
      const axis=editingEnabled&&onDrag&&!additive?pickAxis(e):null;
      if(editingEnabled&&onDrag&&!additive&&(axis||(directDrag&&hit&&selectedUids.has(hitUid(hit))))){
        const point=axis?gizmo.position.clone():hit.point.clone(),depth=Math.max(0.01,-point.clone().applyMatrix4(camera.matrixWorldInverse).z);
        if(axis)axis.worldLength=axis.unitsPerPixel*88;
        drag={pointerId:e.pointerId,start:point,startX:e.clientX,startY:e.clientY,active:false,axis,vertical:e.shiftKey,
          plane:new THREE.Plane(new THREE.Vector3(0,1,0),-point.y),
          unitsPerPixel:2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,canvas.clientHeight),
          delta:{x:0,y:0,z:0},emitted:{x:0,y:0,z:0},controlsEnabled:controls.enabled};
        canvas.dataset.dragState=axis?axis.axis:drag.vertical?'y':'xz';controls.enabled=false;canvas.style.cursor='grabbing';canvas.setPointerCapture(e.pointerId);
      }else{
        marquee={pointerId:e.pointerId,x:e.clientX,y:e.clientY,endX:e.clientX,endY:e.clientY,active:false,blank:!hit,additive,controlsEnabled:controls.enabled};controls.enabled=false;canvas.setPointerCapture(e.pointerId);
      }
      e.preventDefault();e.stopImmediatePropagation();return;
    }
    userNavigated=true;if(pointers.size===0)gesture=false;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,button:e.button});if(pointers.size>1)gesture=true;
  };
  const onMove=e=>{
    if(drag){updateDrag(e);e.preventDefault();e.stopImmediatePropagation();return;}
    if(marquee){
      if(e.pointerId!==marquee.pointerId)return;
      marquee.endX=e.clientX;marquee.endY=e.clientY;
      if(Math.hypot(e.clientX-marquee.x,e.clientY-marquee.y)>=5)marquee.active=true;
      if(marquee.active&&marquee.blank&&editingEnabled&&onBoxSelection){const crossing=e.clientX<marquee.x;Object.assign(marqueeElement.style,{display:'block',left:Math.min(marquee.x,e.clientX)+'px',top:Math.min(marquee.y,e.clientY)+'px',width:Math.abs(e.clientX-marquee.x)+'px',height:Math.abs(e.clientY-marquee.y)+'px',border:crossing?'1px dashed #6be5a1':'1px solid #73bcff',background:crossing?'#4ac98e26':'#429cff26'});canvas.dataset.boxSelection=JSON.stringify({mode:crossing?'crossing':'window',start:[marquee.x,marquee.y],end:[e.clientX,e.clientY],additive:marquee.additive});}
      e.preventDefault();e.stopImmediatePropagation();return;
    }
    const start=pointers.get(e.pointerId);if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>=5)gesture=true;
  };
  function dispatchPick(ray,additive=false,context=false){
    const hit=ray.intersectObjects(model.children,false)[0];
    if(hit){const block=lookup.get(hitUid(hit));if(block){onSelect(block.uid,{uid:block.uid,pos:block.pos,normal:{x:hit.face.normal.x,y:hit.face.normal.y,z:hit.face.normal.z},additive,context});return;}}
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),origin.y-workY);const point=ray.ray.intersectPlane(plane,new THREE.Vector3());
    if(point){onSelect(null,{uid:null,pos:{x:Math.floor(point.x+origin.x),y:workY,z:Math.floor(point.z+origin.z)},normal:{x:0,y:1,z:0},additive,context});}else onSelect(null,null);
  }
  const onUp=e=>{
    if(drag){e.preventDefault();e.stopImmediatePropagation();if(e.pointerId===drag.pointerId){updateDrag(e);const click=!drag.active,axis=drag.axis;finishDrag('commit');if(click&&!axis)dispatchPick(pointerRay(e));}return;}
    if(marquee){e.preventDefault();e.stopImmediatePropagation();if(e.pointerId!==marquee.pointerId)return;const click=!marquee.active,additive=marquee.additive;finishMarquee(!marquee.blank||!editingEnabled);if(click)dispatchPick(pointerRay(e),editingEnabled&&additive);return;}
    const start=pointers.get(e.pointerId);const choose=start&&start.button===0&&!gesture&&pointers.size===1&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<5;
    pointers.delete(e.pointerId);if(choose)dispatchPick(pointerRay(e),editingEnabled&&(e.ctrlKey||e.metaKey));
  };
  const onCancel=e=>{if(drag&&e.pointerId===drag.pointerId){e.stopImmediatePropagation();finishDrag('cancel');}if(marquee&&e.pointerId===marquee.pointerId)finishMarquee(true);pointers.delete(e.pointerId);gesture=true;};
  const onKey=e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home','Escape','Enter',' '].includes(e.key))return;
    e.preventDefault();if(marquee){if(e.key==='Escape')finishMarquee(true);return;}if(drag){if(e.key==='Escape')finishDrag('cancel');return;}if(e.key==='Enter'||e.key===' '){const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);dispatchPick(ray,editingEnabled&&(e.shiftKey||e.ctrlKey||e.metaKey));return;}userNavigated=true;if(e.key==='Home'){fit();return;}if(e.key==='Escape'){onSelect(null);return;}
    const offset=camera.position.clone().sub(controls.target);
    if(e.key==='+'||e.key==='='||e.key==='-'){offset.multiplyScalar(e.key==='-'?1.15:1/1.15);offset.clampLength(controls.minDistance,controls.maxDistance);}
    else if(e.shiftKey){const d=offset.length()*0.04;const shift=new THREE.Vector3(e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0,e.key==='ArrowUp'?d:e.key==='ArrowDown'?-d:0,0).applyQuaternion(camera.quaternion);controls.target.add(shift);}
    else {const spherical=new THREE.Spherical().setFromVector3(offset);spherical.theta+=(e.key==='ArrowLeft'?0.12:e.key==='ArrowRight'?-0.12:0);spherical.phi+=(e.key==='ArrowUp'?-0.12:e.key==='ArrowDown'?0.12:0);spherical.makeSafe();offset.setFromSpherical(spherical);}
    camera.position.copy(controls.target).add(offset);controls.update();render();
  };
  canvas.addEventListener('pointerdown',onDown,true);canvas.addEventListener('pointermove',onMove,true);canvas.addEventListener('pointerup',onUp,true);canvas.addEventListener('pointercancel',onCancel,true);canvas.addEventListener('lostpointercapture',onCancel,true);canvas.addEventListener('keydown',onKey);
  const onContextLost=e=>{finishDrag('cancel');finishMarquee(true);e.preventDefault();canvas.dataset.contextLost='true';onError('顯示資源已中斷，請重新載入示範模型，或重新整理頁面。');};
  const onContextRestored=()=>{delete canvas.dataset.contextLost;onError('');render();};
  const onWheel=()=>{userNavigated=true;};
  canvas.addEventListener('wheel',onWheel,{passive:true});canvas.addEventListener('webglcontextlost',onContextLost);canvas.addEventListener('webglcontextrestored',onContextRestored);
  canvas.dataset.dragState='idle';canvas.dataset.directDrag=String(directDrag);updateSelection();resize();fit();
  return {
    preset: p=>fit(p), reset:()=>fit(),
    framePreview:()=>{if(!previewGroup)return;const box=new THREE.Box3().setFromObject(previewGroup);if(!box.isEmpty())fit('isometric',box.getCenter(new THREE.Vector3()),box.getSize(new THREE.Vector3()));},
    workPlane:y=>{workY=y;grid.position.y=y-origin.y-0.015;render();},
    updateModel:(nextBlocks,nextShapes)=>{
      renderer.shadowMap.enabled=nextBlocks.length<10000;
      updateModelGroup(model,nextBlocks,nextShapes);
      updateShadowHelpers(nextBlocks);
      lookup=new Map(nextBlocks.map(b=>[b.uid,b]));
      updateProjectedBounds();updateSelection();render();
    },
    preview:(records,recordShapes,valid)=>{
      if(previewGroup){scene.remove(previewGroup);disposeGroup(previewGroup);previewGroup=null;}
      if(records.length){previewGroup=buildModelGroup(records,recordShapes,origin.toArray());previewGroup.traverse(o=>{if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.color.setHex(valid?0x8fffb0:0xff6677);m.transparent=true;m.opacity=0.55;m.depthWrite=false;m.polygonOffset=true;m.polygonOffsetFactor=-2;}}});scene.add(previewGroup);}render();
    },
    setProjection:entries=>{const state=modelStates.get(model);updateModelGroup(model,state.blocks,state.shapes,entries);updateProjectedBounds();updateSelection();render();},
    focus:uid=>{const b=lookup.get(uid),view=modelStates.get(model).projection.get(uid)??defaultProjection;if(b&&view.visible&&view.opacity>0)fit('isometric',new THREE.Vector3(b.pos.x+0.5,b.pos.y+0.5+view.offsetY,b.pos.z+0.5).sub(origin),new THREE.Vector3(2,2,2));},
    select:uid=>{selectedUids=new Set(uid===null?[]:[uid]);updateSelection();render();},
    selectMany:uids=>{selectedUids=new Set(uids);updateSelection();render();},
    cancelDrag:()=>{const active=!!drag||!!marquee;finishDrag('cancel');finishMarquee(true);return active;},
    setDragMode:enabled=>{directDrag=enabled;canvas.dataset.directDrag=String(enabled);if(!enabled)finishDrag('cancel');},
    setEditingEnabled:enabled=>{editingEnabled=enabled;if(!enabled){finishDrag('cancel');finishMarquee(true);}render();},
    dispose:()=>{finishDrag('cancel');finishMarquee(true);marqueeElement.remove();disposed=true;if(pendingFrame!==null){window.cancelAnimationFrame(pendingFrame);pendingFrame=null;}observer.disconnect();controls.removeEventListener('change',render);controls.dispose();canvas.removeEventListener('pointerdown',onDown,true);canvas.removeEventListener('pointermove',onMove,true);canvas.removeEventListener('pointerup',onUp,true);canvas.removeEventListener('pointercancel',onCancel,true);canvas.removeEventListener('lostpointercapture',onCancel,true);canvas.removeEventListener('keydown',onKey);canvas.removeEventListener('wheel',onWheel);canvas.removeEventListener('webglcontextlost',onContextLost);canvas.removeEventListener('webglcontextrestored',onContextRestored);disposeGroup(scene);sun.shadow.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();},
  };
}
