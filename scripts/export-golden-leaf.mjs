import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import console from 'node:console';
import {createServer} from 'vite';

const server=await createServer({server:{middlewareMode:true}});
try {
 const {createGoldenLeafProject}=await server.ssrLoadModule('/src/fixtures/buildings/golden-leaf.ts');
 const {importProject}=await server.ssrLoadModule('/src/core/model.ts');
 const {inventory}=await server.ssrLoadModule('/src/features/build/model.ts');
 const project=createGoldenLeafProject(),min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
 for(const b of project.blocks)for(const axis of ['x','y','z']){min[axis]=Math.min(min[axis],b.pos[axis]);max[axis]=Math.max(max[axis],b.pos[axis]);}
 const dimensions=Object.fromEntries(['x','y','z'].map(a=>[a,max[a]-min[a]+1]));
 assert.equal(min.y,0);assert.equal(max.y,99);assert(dimensions.y<=100);
 const file='outputs/buildings/golden-leaf-tower-100.json';await mkdir('outputs/buildings',{recursive:true});
 await writeFile(file,JSON.stringify(project),'utf8');const bytes=await readFile(file);
 assert.deepEqual(importProject(bytes.toString('utf8')),project);
 const materials=inventory(project);assert.notEqual(materials.totalInventoryItems,null);
 const lights={};for(const b of project.blocks.filter(b=>b.id==='minecraft:glowstone'))lights[b.category]=(lights[b.category]??0)+1;
 const report={project:project.id,revision:project.designRevision,file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),bounds:{min,max,dimensions},cells:project.blocks.length,inventoryItems:materials.totalInventoryItems,materials:materials.items.length,logicalStructures:project.logicalStructures.length,slabs:project.blocks.filter(b=>b.id.endsWith('_slab')).length,glowstoneByCategory:lights,registryAndRoundtrip:'passed',visualAcceptance:'see reference comparison audit; no exact-match claim',minecraftAcceptance:'not tested',paidGenerationsSubmitted:0};
 await writeFile('evidence/golden-leaf-100-export.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await server.close();}
