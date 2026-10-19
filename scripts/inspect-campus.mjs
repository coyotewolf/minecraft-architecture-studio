import console from 'node:console';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true}});
try {const {createCampus}=await server.ssrLoadModule('/src/fixtures/campus/index.ts');const c=createCampus();console.log(JSON.stringify({districts:c.districts.map(d=>({id:d.id,count:d.project.blocks.length,title:d.title})),count:c.blocks.length,items:c.totalItems,ids:[...new Set(c.blocks.map(b=>b.id))]},null,2));}finally{await server.close();}
