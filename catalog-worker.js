import {json2satrec,propagate,gstime} from './vendor/satellite/satellite.es.js';
const R=6378.137;
let records=[],reference=0,gst=0,initializing=false;
self.onmessage=async ({data})=>{
 try {
  if(data.type==='load'){
   if(initializing)return;initializing=true;
   const manifest=await (await fetch('./data/catalog/manifest.json')).json();
   const groups=manifest.groups.filter(g=>g.file);
   const downloads=await Promise.all(groups.map(async group=>({group,rows:await (await fetch(group.file)).json()})));
   const seen=new Set();
   for(const {group,rows} of downloads)for(const row of rows){
    if(seen.has(row.NORAD_CAT_ID))continue;seen.add(row.NORAD_CAT_ID);
    try{records.push({row,kind:group.group==='active'?'active':'debris',rec:json2satrec(row)});}catch{/* Report exclusions below. */}
   }
   reference=Date.parse(groups[0].retrieved_utc);gst=gstime(new Date(reference));
   postMessage({type:'loaded',manifest,reference,count:records.length,active:records.filter(r=>r.kind==='active').length,debris:records.filter(r=>r.kind==='debris').length,excluded:seen.size-records.length});
  }
  if(data.type==='positions'){
   const selection=records.filter(r=>data.group==='all'||r.kind===data.group);
   const count=Math.min(data.limit,selection.length),positions=new Float32Array(count*3),colors=new Float32Array(count*3);
   let valid=0;const date=new Date(reference+data.time*1000),c=Math.cos(gst),s=Math.sin(gst);
   // Even selection across the whole list, not a prefix of a constellation.
   for(let n=0;n<count;n++){
    const r=selection[Math.floor(n*selection.length/count)],result=propagate(r.rec,date);
    const p=result?.position;
    if(p&&Number.isFinite(p.x)&&Math.hypot(p.x,p.y,p.z)>R){
     const x=p.x/R,y=p.z/R,z=-p.y/R;
     positions.set([c*x-s*z,y,s*x+c*z],n*3);valid++;
    }
    colors.set(r.kind==='active'?[.35,.65,1]:[1,.48,.24],n*3);
   }
   postMessage({type:'positions',positions,colors,valid,total:selection.length,drawn:count,time:data.time},[positions.buffer,colors.buffer]);
  }
 }catch(error){postMessage({type:'error',message:error.message});}
};
