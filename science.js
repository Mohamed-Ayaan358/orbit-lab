import * as THREE from 'three';
const $=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:3});
export function setupScience(world,{plot,apiRequest,getCatalog}){
 let worker=null,cloud=null,experiment=null,startTime=0;
 function clear(){if(cloud){world.scene.remove(cloud);cloud.geometry.dispose();cloud.material.dispose();cloud=null;}experiment=null;}
 function fragments(count){
  if(worker)worker.terminate();clear();$('fragment-run').disabled=true;
  const altitude=Number($('fragment-altitude').value),inclination=Number($('fragment-inclination').value),sigma=Number($('fragment-kick').value);
  $('physics-status').textContent='Calculating the debris paths on your device…';
  worker=new Worker(new URL('./fragment-worker.js',import.meta.url),{type:'module'});
  const fail=message=>{$('physics-status').textContent=message;$('fragment-run').disabled=false;worker?.terminate();worker=null;};
  worker.onerror=()=>fail('Fragment worker failed. Try a smaller sample.');
  worker.onmessage=({data})=>{
   if(data.error){fail(data.error);return;}
   experiment=data;startTime=world.time();const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(data.frames[0].slice(),3));
   cloud=new THREE.Points(geo,new THREE.PointsMaterial({color:0xffc17d,size:.013,depthWrite:false}));cloud.frustumCulled=false;world.scene.add(cloud);
   const rows=data.frames.filter((_,i)=>i%8===0).map((frame,i)=>{let low=Infinity,high=-Infinity;for(let j=0;j<frame.length;j+=3){const r=Math.hypot(frame[j],frame[j+1],frame[j+2]);if(r>0){low=Math.min(low,(r-1)*6378.137);high=Math.max(high,(r-1)*6378.137);}}return {x:i*8*data.step_s/60,y:(low+high)/2,low,high};});
   plot('chart-orbit-spread',rows,{type:'line',band:true,xLabel:'Minutes since breakup',yLabel:'Altitude (km)',title:'Minimum and maximum altitude of the illustrated fragment sample'});
   $('physics-status').textContent=`Drawing ${data.count} example pieces for two simulated hours. Watch the globe and the height graph below. Their starting-speed spread is an assumed ${sigma} m/s; this is not a real breakup. Turn off the 6× height display to compare with tracked dots.`;
   $('fragment-run').disabled=false;worker.terminate();worker=null;
  };
  worker.postMessage({altitude,inclination,sigma_m_s:sigma,count:Math.min(500,Math.max(1,count??Number($('fragment-count').value))),steps:240,step_s:30});
 }
 $('fragment-run').addEventListener('click',()=>fragments());$('fragment-clear').addEventListener('click',()=>{clear();$('physics-status').textContent='Fragment layer cleared.';});
 $('screen-run').addEventListener('click',async()=>{
  $('screen-run').disabled=true;$('screen-status').textContent='Checking example positions from the tracking list…';
  try{
   const catalog=getCatalog();if(!catalog)throw new Error('Wait for the catalog to load.');
   const result=await apiRequest('/screen',{altitude:Number($('fragment-altitude').value),inclination:Number($('fragment-inclination').value),raan:.4,phase:.6,reference_utc:new Date(catalog.reference).toISOString(),epoch_seconds:Math.min(604800,world.time()),hours:2,step_s:120,limit:200,group:'debris'});
   $('screen-status').textContent=`Checked ${result.screened_objects} debris objects every ${result.sample_spacing_seconds} seconds for ${result.hours} hours. The table below lists the closest sampled gaps. Objects may pass closer between checks; these are not collision chances.`;
   const body=$('screen-results');body.replaceChildren();for(const row of result.closest_sampled_approaches.slice(0,5)){const tr=document.createElement('tr');for(const value of [row.catalog_id,row.name,fmt(row.sampled_distance_km),row.time_utc.replace('T',' ').slice(0,19)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}
  }catch(error){$('screen-status').textContent=error.message;}finally{$('screen-run').disabled=false;}
 });
 $('encounter-run').addEventListener('click',async()=>{
  $('encounter-run').disabled=true;
  try{
   for(const id of ['miss-distance','position-sigma','combined-radius'])if(!$(id).checkValidity())throw new Error('Check the encounter input limits.');
   const sigma=Number($('position-sigma').value),result=await apiRequest('/encounter-probability',{miss_x_m:Number($('miss-distance').value),miss_y_m:0,cov_xx_m2:sigma**2,cov_xy_m2:0,cov_yy_m2:sigma**2,radius_m:Number($('combined-radius').value)});
   $('encounter-status').textContent=`Example collision chance: ${(result.probability*100).toPrecision(4)}%. This uses the gap, size and position uncertainty you entered—not the actual risk for your satellite.`;
  }catch(error){$('encounter-status').textContent=error.message;}finally{$('encounter-run').disabled=false;}
 });
 Promise.all([fetch('./data/science/mocat-reference.json').then(r=>r.json()),fetch('./data/science/spark-benchmark.json').then(r=>r.json())]).then(([mocat,benchmark])=>{
  const rows=mocat.years.map((year,i)=>({x:year,y:mocat.totals.N[i],theory:mocat.totals.S[i]}));
  plot('chart-mocat',rows,{type:'line',xLabel:'Model years',yLabel:'Synthetic objects',title:'MOCAT-pySSEM synthetic reference: fragments and active satellites',theoryLabel:'Active satellites',valueLabel:'Debris pieces',seriesLabel:'Debris pieces'});
  $('mocat-caption').textContent='The separate MOCAT-pySSEM model starts with 100 satellites and 300 debris pieces, with no new launches. Falling lines mean objects are leaving those groups. This is a saved test using made-up inputs, not a real-world forecast.';
  const body=$('benchmark-results');for(const row of benchmark.measurements){const tr=document.createElement('tr');for(const value of [fmt(row.summary.runs),row.master==='local[1]'?'1 worker':'2 workers',`${row.compute_write_read_seconds.toFixed(2)} s`]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}
 }).catch(error=>{$('mocat-caption').textContent=`Reference results unavailable: ${error.message}`;});
 return {fragments,tick(dt,time){if(!cloud||!experiment)return;const step=Math.min(experiment.steps,Math.max(0,(time-startTime)/experiment.step_s)),a=Math.floor(step),b=Math.min(a+1,experiment.steps),fraction=step-a,attr=cloud.geometry.getAttribute('position');for(let i=0;i<attr.array.length;i++)attr.array[i]=experiment.frames[a][i]*(1-fraction)+experiment.frames[b][i]*fraction;attr.needsUpdate=true;}};
}
