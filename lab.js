import * as THREE from 'three';
import {setupScience} from './science.js';
import {setupHelp} from './help.js';
import {randomStream,poisson,histogram} from './random.js';
import {orbitPosition,displayRadius,circularOrbit,TAU} from './orbits.js';
const $=id=>document.getElementById(id),number=x=>Number(x).toLocaleString(undefined,{maximumFractionDigits:Math.abs(Number(x))<1?4:2});
const NS='http://www.w3.org/2000/svg';
function element(tag,attributes={},text){const node=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attributes))node.setAttribute(k,v);if(text!==undefined)node.textContent=text;return node;}
const compact=x=>Math.abs(x)>=1000?Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(x):Number(x.toPrecision(3)).toString();
function plot(id,rows,{type='bars',xLabel,yLabel,title,band=false,color='#78b8ff',reference=null,yCap=null,valueLabel='typical result',theoryLabel='without extra breakup',seriesLabel=null,comparisonDashed=false,signed=false}={}){
 const host=$(id),width=Math.max(270,host.getBoundingClientRect().width),height=255,m={l:66,r:16,t:16,b:54};host.replaceChildren();
 const svg=element('svg',{viewBox:`0 0 ${width} ${height}`,role:'img',tabindex:0,'aria-label':title+'; use left and right arrow keys to explore values'});svg.append(element('title',{},title));host.append(svg);
 let xmin=Math.min(...rows.map(r=>r.x0??r.x)),xmax=Math.max(...rows.map(r=>r.x1??r.x)),ymax=Math.max(...rows.flatMap(r=>[r.y??r.count??0,r.high??0,r.theory??0]));
 let ymin=signed?Math.min(0,...rows.map(r=>r.y??0)):0;
 if(xmin===xmax)xmax=xmin+1;ymax=Math.max(0,ymax);if(signed){const pad=(ymax-ymin||1)*.08;ymax+=pad;ymin-=pad;}else ymax=ymax>0?ymax*1.08:1;if(yCap!==null)ymax=Math.min(yCap,ymax);
 const x=v=>m.l+(v-xmin)/(xmax-xmin)*(width-m.l-m.r),y=v=>height-m.b-(v-ymin)/(ymax-ymin)*(height-m.b-m.t);
 svg.append(element('rect',{x:m.l,y:m.t,width:width-m.l-m.r,height:height-m.t-m.b,class:'chart-frame'}));
 const ticks=width<400?3:5;
 for(let i=0;i<=ticks;i++){let v=xmin+(xmax-xmin)*i/ticks;svg.append(element('text',{x:x(v),y:height-m.b+20,'text-anchor':i===0?'start':i===ticks?'end':'middle'},compact(v)));}
 const yTicks=signed?[ymin,0,ymax]:Array.from({length:5},(_,i)=>ymin+(ymax-ymin)*i/4);
 for(const v of yTicks){svg.append(element('text',{x:m.l-9,y:y(v)+4,'text-anchor':'end'},compact(v)));}
 svg.append(element('text',{x:(m.l+width-m.r)/2,y:height-7,'text-anchor':'middle',class:'axis-title'},xLabel));
 svg.append(element('text',{transform:`translate(14 ${(height+m.t-m.b)/2}) rotate(-90)`,'text-anchor':'middle',class:'axis-title'},yLabel));
 const clip='clip-'+id,defs=element('defs'),cp=element('clipPath',{id:clip});cp.append(element('rect',{x:m.l,y:m.t,width:width-m.l-m.r,height:height-m.t-m.b}));defs.append(cp);svg.append(defs);const marks=element('g',{'clip-path':`url(#${clip})`});svg.append(marks);
 if(signed)marks.append(element('line',{x1:m.l,x2:width-m.r,y1:y(0),y2:y(0),stroke:'#91a7b7','stroke-dasharray':'3 4'}));
 if(band){const path=rows.map((r,i)=>`${i?'L':'M'}${x(r.x)},${y(r.high)}`).join(' ')+rows.slice().reverse().map(r=>`L${x(r.x)},${y(r.low)}`).join(' ')+'Z';marks.append(element('path',{d:path,fill:color,opacity:'.14'}));}
 if(type==='bars')for(const r of rows)marks.append(element('rect',{x:x(r.x0),y:y(r.count??r.y),width:Math.max(.5,x(r.x1)-x(r.x0)-1),height:y(0)-y(r.count??r.y),fill:color,opacity:'.65'}));
 else marks.append(element('path',{d:rows.map((r,i)=>`${i?'L':'M'}${x(r.x)},${y(r.y)}`).join(' '),fill:'none',stroke:color,'stroke-width':3}));
 if(rows.some(r=>r.theory!==undefined))marks.append(element('path',{d:rows.map((r,i)=>`${i?'L':'M'}${x(r.x)},${y(r.theory)}`).join(' '),fill:'none',stroke:'#ffbc7a','stroke-width':2,...(comparisonDashed?{'stroke-dasharray':'7 6'}:{})}));
 if(reference!==null&&reference>=xmin&&reference<=xmax)marks.append(element('line',{x1:x(reference),x2:x(reference),y1:m.t,y2:height-m.b,stroke:'#ffbc7a','stroke-dasharray':'4 4'}));
 const tip=document.createElement('div');tip.className='chart-tip';tip.id=id+'-values';tip.setAttribute('aria-live','polite');tip.textContent='Hover or tap for values. Keyboard: focus the graph and use ← →.';svg.setAttribute('aria-describedby',tip.id);host.append(tip);
 if(seriesLabel){const legend=document.createElement('div');legend.className='chart-legend';for(const [label,tone,dashed] of [[seriesLabel,color,false],...(rows.some(r=>r.theory!==undefined)?[[theoryLabel,'#ffbc7a',comparisonDashed]]:[])]){const item=document.createElement('span'),swatch=document.createElement('i');swatch.style.borderColor=tone;if(dashed)swatch.style.borderTopStyle='dashed';swatch.setAttribute('aria-hidden','true');item.append(swatch,document.createTextNode(label));legend.append(item);}host.prepend(legend);}
 const guide=element('line',{y1:m.t,y2:height-m.b,stroke:'#b8f6d4',visibility:'hidden'});marks.append(guide);
 let activeIndex=0;
 function inspect(row){guide.setAttribute('x1',x(row.x??(row.x0+row.x1)/2));guide.setAttribute('x2',x(row.x??(row.x0+row.x1)/2));guide.setAttribute('visibility','visible');tip.textContent=type==='bars'?`${xLabel}: ${number(row.x0)}–${number(row.x1)} · ${yLabel}: ${number(row.count??row.y)}`:`${xLabel}: ${number(row.x)} · ${valueLabel}: ${number(row.y)}${band?` · shaded range: ${number(row.low)}–${number(row.high)}`:''}${row.theory!==undefined?` · ${theoryLabel}: ${number(row.theory)}`:''}`;}
 function point(event){const rect=svg.getBoundingClientRect(),px=(event.clientX-rect.left)/rect.width*width,value=xmin+Math.max(0,Math.min(1,(px-m.l)/(width-m.l-m.r)))*(xmax-xmin);activeIndex=rows.reduce((best,r,i)=>Math.abs((r.x??(r.x0+r.x1)/2)-value)<Math.abs((rows[best].x??(rows[best].x0+rows[best].x1)/2)-value)?i:best,0);inspect(rows[activeIndex]);}
 svg.addEventListener('pointermove',point);svg.addEventListener('pointerdown',point);svg.addEventListener('focus',()=>inspect(rows[activeIndex]));svg.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();activeIndex=event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,activeIndex+(event.key==='ArrowRight'?1:-1)));inspect(rows[activeIndex]);});
}
export async function setupLab(world){
 let result=null,presets={},teaching=null,catalogInfo=null,apiBase='',simWorker=null,catalogWorker=null,catalogPoints=null,catalogPending=false,catalogLast=0,catalogTargets=null,catalogStart=null,catalogBlend=0,scenarioPoints=null,breakupAge=999;
 const science=setupScience(world,{plot,getCatalog:()=>catalogInfo,apiRequest:async(path,body)=>{if(!apiBase)throw new Error('Choose a calculation server in What if? first.');return requestAPI('/api/'+($('backend-token').value?'':'preview/')+path.replace(/^\//,''),body);}});
 setupHelp();
 const catalogGeometry=new THREE.BufferGeometry();
 const catalogMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
 uniforms:{markerSize:{value:Number($('marker-size').value)},pixelRatio:{value:Math.min(devicePixelRatio,2)}},
 vertexShader:`attribute float aActive;uniform float markerSize;uniform float pixelRatio;varying float vActive;
 void main(){vActive=aActive;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=(aActive>.5?markerSize:2.2)*pixelRatio;}`,
 fragmentShader:`varying float vActive;void main(){vec2 p=gl_PointCoord*2.0-1.0;
 if(vActive>.5){float d=abs(p.x)+abs(p.y);if(d>1.0)discard;gl_FragColor=vec4(mix(vec3(.12,.8,1.0),vec3(.75,1.0,1.0),step(.72,d)),1.0);}
 else{if(dot(p,p)>1.0)discard;gl_FragColor=vec4(1.0,.42,.12,.85);}
 #include <colorspace_fragment>
 }`});
 catalogPoints=new THREE.Points(catalogGeometry,catalogMaterial);world.scene.add(catalogPoints);
 $('marker-size').addEventListener('input',()=>{catalogMaterial.uniforms.markerSize.value=Number($('marker-size').value);$('marker-size-label').value=$('marker-size').value+' px';});
 function tab(name){document.querySelectorAll('[data-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===name)));for(const id of ['missions','population','models','science'])$('panel-'+id).hidden=id!==name;}
 document.querySelectorAll('[data-panel]').forEach(button=>button.addEventListener('click',()=>tab(button.dataset.panel)));
 function redraw(){if(!result||!teaching)return;
 const t=result.trajectory;
 plot('chart-growth',t.map(r=>({x:r.year,y:r.median,low:r.low,high:r.high})),{type:'line',band:true,xLabel:'Years from the start',yLabel:'Debris pieces',title:'Synthetic debris median and middle 95 percent of runs',reference:result.event.applied?result.event.year:null});
 plot('chart-final',result.histogram,{xLabel:'Debris pieces at the end',yLabel:'Number of futures',title:'Distribution of final-year debris populations'});
 plot('chart-fragments',result.fragment_histogram,{xLabel:'Pieces from one breakup',yLabel:'Number of breakups',title:'Fragment counts from 2000 hypothetical breakup draws',color:'#ffbc7a'});
 const rate=result.config.annual_launches/12,rand=randomStream(20261027),means=Array.from({length:2000},()=>Array.from({length:12},()=>poisson(rand,rate)).reduce((a,b)=>a+b,0)/12),se=Math.sqrt(rate/12);
 const rows=histogram(means,24).map(r=>{const center=(r.x0+r.x1)/2;return {...r,count:undefined,y:r.count/(2000*(r.x1-r.x0)),theory:se>0?Math.exp(-.5*((center-rate)/se)**2)/(se*Math.sqrt(2*Math.PI)):0,x:center};});
 plot('chart-normal',rows,{xLabel:'Mean launches / month',yLabel:'Density',title:'Normal approximation for 2000 independent twelve-month sample means',theoryLabel:'Normal density'});
 const proxy=result.collision_proxy;
 if(proxy){
 const baselineRisk=result.counterfactual?.collision_proxy?.trajectory;
 const riskRows=proxy.trajectory.filter(r=>r.year>=proxy.start_year).map(r=>({x:r.year-proxy.start_year,y:r.mean*100,low:r.low*100,high:r.high*100,...(baselineRisk?{theory:baselineRisk[r.year].mean*100}:{})}));
 plot('chart-risk',riskRows,{type:'line',band:true,yCap:100,valueLabel:'average chance (%)',xLabel:'Years after the example begins',yLabel:'Probability (%)',title:'Model-only probability of at least one debris collision for a test satellite',color:'#b8f6d4',seriesLabel:'Average example chance',comparisonDashed:true});
 const end=riskRows.at(-1);$('risk-caption').textContent=`After ${end.x} years, the average assumed chance is ${number(end.y)}%. Shading shows variation across simulations. This is not a real risk estimate for your satellite.`;
 }
 if(result.counterfactual){
 const base=result.counterfactual;
 plot('chart-feedback',t.map((r,i)=>({x:r.year,y:r.median,theory:base.trajectory[i].median,low:r.low,high:r.high})),{type:'line',band:true,xLabel:'Years from the start',yLabel:'Debris pieces',title:'Generic breakup scenario versus no-extra-breakup baseline',color:'#df9bff',seriesLabel:'With extra breakup',comparisonDashed:true,reference:result.event.applied?result.event.year:null});
 const finalDifference=t.at(-1).median-base.trajectory.at(-1).median,baselineEnd=base.trajectory.at(-1).median,relative=baselineEnd?Math.abs(finalDifference)/baselineEnd*100:null;
 const nearlyOverlap=t.every((row,i)=>Math.abs(row.median-base.trajectory[i].median)/Math.max(1,base.trajectory[i].median)<.01);
 $('feedback-caption').textContent=`${nearlyOverlap?'The two paths nearly overlap. ':''}At the end: ${number(Math.abs(finalDifference))} ${finalDifference>=0?'more':'fewer'} pieces in the typical breakup result${relative!==null?' ('+number(relative)+'% difference)':''}. Small or negative differences can come from random draws and model dynamics; they do not show that breakups help.`;
 plot('chart-difference',t.map((row,i)=>({x:row.year,y:row.median-base.trajectory[i].median})),{type:'line',signed:true,xLabel:'Years from the start',yLabel:'Difference in pieces',title:'Difference between the two simulated middle results; zero means equal counts',valueLabel:'with minus without breakup',color:'#df9bff'});
 $('feedback-details').hidden=false;
 const signed=n=>(n>=0?'+':'')+number(n);
 $('feedback-summary').textContent=`Initial breakup: ${number(result.event.mean_new_debris)} new pieces on average. Average final-count difference: ${signed(base.mean_final_delta)} pieces. Difference in later collisions: ${signed(base.secondary_collisions_delta)}. Difference in later fragments: ${signed(base.secondary_fragments_delta)}. These compare random simulations, not measured real-world effects.`;
 }else{
 $('chart-feedback').replaceChildren();const note=document.createElement('div');note.className='chart-empty';note.textContent='Choose a satellite breakup in Missions, or an extra breakup in What if?, to compare the two outcomes.';$('chart-feedback').append(note);$('feedback-caption').textContent='Debris does not replicate by itself. Later collisions create more fragments; the model also removes debris over time.';$('feedback-summary').textContent='';$('feedback-details').hidden=true;$('chart-difference').replaceChildren();
 }

 }
 new ResizeObserver(()=>redraw()).observe($('chart-growth'));
 $('feedback-details').addEventListener('toggle',()=>{if($('feedback-details').open)redraw();});
 function showResult(out){
 result=out;$('population-year').max=out.config.years;$('population-year').value=Math.min(Number($('population-year').value),out.config.years);
 $('result-caption').textContent=`${number(out.run_count)} possible futures · ${out.config.years} years · calculated with ${out.engine}. These are made-up scenarios under your assumptions.`;
 const fields=[['Average final count',out.final.mean,'Add the final debris counts from every simulated future and divide by the number of futures. Technical term: mean.'],['Middle final count',out.final.median,'Half the futures end above this count and half below. Technical term: median.'],['How much endings vary',out.final.std,'A larger number means the final counts are more spread out. This is the standard deviation of simulated endings, not a prediction error.'],['New pieces from extra breakup',out.event.mean_new_debris,'The average number of pieces added by the one extra breakup. This excludes later collision fragments. Without an extra breakup this stays zero.']];
 $('result-stats').replaceChildren(...fields.map(([label,value,definition])=>{const div=document.createElement('div'),span=document.createElement('span'),strong=document.createElement('strong');span.textContent=label;const help=document.createElement('button');help.type='button';help.className='term-help help-icon';help.dataset.help=definition;help.setAttribute('aria-label','Explain '+label);help.textContent='ⓘ';span.append(help);strong.textContent=number(value);div.append(span,strong);return div;}));
 const fs=out.fragment_summary;$('fragment-caption').textContent=`Assumed average: ${number(fs.model_mean)} pieces per breakup. The 2,000 random examples averaged ${number(fs.sample_mean)} pieces. This uses your ${out.config.distribution==='negative_binomial'?'Negative Binomial':out.config.distribution==='lognormal'?'Lognormal':'Poisson'} setting, not a measurement of a real breakup.`;
 redraw();drawScenario();
 }
 function drawScenario(){
 if(!result)return;const year=Number($('population-year').value);$('population-year-label').value=year;
 const row=result.trajectory[year],s=Math.round(row.satellites),d=Math.round(row.median);
 $('population-summary').textContent=`Simulated year ${year}: middle counts of ${number(s)} satellites and ${number(d)} debris pieces. Purple dots show only a sample of these made-up objects.`;
 if(scenarioPoints){world.scene.remove(scenarioPoints);scenarioPoints.geometry.dispose();scenarioPoints.material.dispose();}
 const n=Math.min(8000,s+d),positions=new Float32Array(n*3);let state=91234;const random=()=>{state=Math.imul(state,1664525)+1013904223|0;return(state>>>0)/4294967296;};
 for(let i=0;i<n;i++){const altitude=300+random()*1400,inc=random()*180,node=random()*TAU,phase=random()*TAU;positions.set(orbitPosition(displayRadius(altitude,$('spread').checked),inc,node,phase),i*3);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));scenarioPoints=new THREE.Points(geo,new THREE.PointsMaterial({color:0xdf9bff,size:.012,transparent:true,opacity:.65}));world.scene.add(scenarioPoints);setLayer();
 }
 function setLayer(){catalogPoints.visible=$('population-layer').value==='catalog';if(scenarioPoints)scenarioPoints.visible=$('population-layer').value==='scenario';}
 function requestPositions(){if(!catalogInfo||catalogPending)return;catalogPending=true;catalogWorker.postMessage({type:'positions',time:world.time(),group:$('catalog-group').value,limit:Number($('catalog-limit').value)});}
 catalogWorker=new Worker(new URL('./catalog-worker.js',import.meta.url),{type:'module'});
 catalogWorker.onmessage=({data})=>{
 if(data.type==='loaded'){
  catalogInfo=data;$('catalog-status').textContent=`${number(data.count)} tracked objects loaded: ${number(data.active)} satellites and ${number(data.debris)} debris pieces. List saved ${new Date(data.reference).toISOString().slice(0,16).replace('T',' ')} UTC.`;
  $('catalog-limit').max=data.count;$('catalog-limit-label').value=number($('catalog-limit').value);
  const prov=$('catalog-provenance');for(const group of data.manifest.groups){const p=document.createElement('p'),link=document.createElement('a');link.href=group.source;link.target='_blank';link.rel='noreferrer';link.textContent=group.group;p.append(link,document.createTextNode(` · ${group.count??0} records · element epochs ${group.epoch_min??'unavailable'} through ${group.epoch_max??'unavailable'}`));prov.append(p);}requestPositions();
 }else if(data.type==='positions'){
  catalogPending=false;catalogLast=performance.now();catalogBlend=0;const prior=catalogGeometry.getAttribute('position');catalogStart=prior&&prior.array.length===data.positions.length?prior.array.slice():data.positions.slice();catalogTargets=data.positions;
  catalogGeometry.setAttribute('position',new THREE.BufferAttribute(catalogStart.slice(),3));catalogGeometry.setAttribute('color',new THREE.BufferAttribute(data.colors,3));catalogGeometry.setAttribute('aActive',new THREE.BufferAttribute(Float32Array.from({length:data.colors.length/3},(_,i)=>data.colors[i*3]<.9?1:0),1));catalogGeometry.computeBoundingSphere();
  $('catalog-drawn').textContent=`Showing ${number(data.valid)} of ${number(data.total)} tracked objects. ${number(data.drawn-data.valid)} requested positions could not be drawn. Positions follow the saved list and the scene’s clock.`;
 }else if(data.type==='error'){catalogPending=false;$('catalog-status').textContent=`Catalog unavailable: ${data.message}. Synthetic scenarios still work.`;}
 };
 catalogWorker.onerror=()=>{$('catalog-status').textContent='Catalog worker failed. Synthetic scenarios still work.';catalogPending=false;};
 catalogWorker.postMessage({type:'load'});
 $('catalog-limit').addEventListener('input',()=>{$('catalog-limit-label').value=number($('catalog-limit').value);});
 $('catalog-limit').addEventListener('change',requestPositions);$('catalog-group').addEventListener('change',requestPositions);
 $('catalog-all').addEventListener('click',()=>{if(catalogInfo){$('catalog-limit').value=catalogInfo.count;$('catalog-limit-label').value=number(catalogInfo.count);requestPositions();}});
 $('population-layer').addEventListener('change',setLayer);$('population-year').addEventListener('input',drawScenario);$('spread').addEventListener('change',drawScenario);
 function config(){
 const ids=['model-launches','model-disposal','model-collision','fragment-mean','model-dispersion','model-cv','model-years','model-runs','model-seed','event-year'];
 for(const id of ids)if(!$(id).checkValidity()){const details=$(id).closest('details');if(details)details.open=true;$(id).reportValidity();throw new Error('Check scenario parameter limits.');}
 const scale=Number($('population-scale').value),fromCatalog=$('baseline').value==='catalog';if(fromCatalog&&!catalogInfo)throw new Error('Wait for the catalog to load before using its counts.');
 const cfg={initial_satellites:(fromCatalog?catalogInfo.active:600)*scale,initial_debris:(fromCatalog?catalogInfo.debris:1400)*scale,
 annual_launches:Number($('model-launches').value),disposal:Number($('model-disposal').value)/100,collision_coefficient:Number($('model-collision').value),
 fragment_mean:Number($('fragment-mean').value),distribution:$('count-model').value,dispersion:Number($('model-dispersion').value),cv:Number($('model-cv').value),
 years:Number($('model-years').value),runs:Number($('model-runs').value),seed:Number($('model-seed').value),event_type:$('model-event').value,event_year:Number($('event-year').value)};
 if(cfg.event_type!=='none'&&cfg.event_year>cfg.years)throw new Error('Event year must be within the scenario horizon.');
 if(!Number.isInteger(cfg.runs)||!Number.isInteger(cfg.years)||!Number.isInteger(cfg.seed)||!Number.isInteger(cfg.event_year))throw new Error('Runs, years, seed and event year must be integers.');
 return cfg;
 }
 async function run(){
 if($('run-model').disabled)return;
 try{
 const cfg=config();$('run-model').disabled=true;$('breakup').disabled=true;$('model-status').textContent=`Running ${number(cfg.runs)} futures with ${apiBase?'Python':'browser preview'}…`;
 let out;
 if(apiBase){
 if($('backend-token').value){let job=await requestAPI('/api/jobs',cfg);const deadline=Date.now()+120000;while(['queued','running'].includes(job.status)){if(Date.now()>deadline)throw new Error('Job is still running. Retry later; the server retains the job result.');await new Promise(resolve=>setTimeout(resolve,700));job=await requestAPI('/api/jobs/'+job.id);$('model-status').textContent=`Python job ${job.status}…`;}if(job.status!=='completed')throw new Error(job.error||'Job failed');out=job.result;}
 else out=await requestAPI('/api/preview',cfg);
 }
 else{
  if(simWorker)simWorker.terminate();simWorker=new Worker(new URL('./simulation-worker.js',import.meta.url),{type:'module'});
  out=await new Promise((resolve,reject)=>{simWorker.onmessage=({data})=>data.error?reject(new Error(data.error)):resolve(data);simWorker.onerror=e=>reject(new Error(e.message||'Simulation worker failed'));simWorker.postMessage(cfg);});simWorker.terminate();simWorker=null;
 }
 showResult(out);$('model-status').textContent=`Computed ${number(out.run_count)} possible futures. Graphs updated. The extra breakup adds ${number(out.event.mean_new_debris)} pieces on average.`;
 if(out.event.type==='abstract_asat'&&out.event.applied){breakupAge=0;science.fragments(Math.min(500,Math.round(out.event.mean_new_debris))); $('population-layer').value='scenario';$('population-year').value=out.event.year;drawScenario();}
 }catch(error){$('model-status').textContent=`Could not run: ${error.message}. Graphs retain the previous successful result.`;}
 finally{$('run-model').disabled=false;$('breakup').disabled=false;document.dispatchEvent(new Event('orbit:analysis-complete'));}
 }
 $('run-model').addEventListener('click',()=>run());
 document.addEventListener('orbit:deployed',async event=>{
  while($('run-model').disabled)await new Promise(resolve=>document.addEventListener('orbit:analysis-complete',resolve,{once:true}));
  $('model-event').value='satellite_launch';$('event-year').value=1;
  $('deployment-analysis').hidden=false;$('deployment-risk-link').hidden=false;
  $('deployment-analysis').textContent=`${event.detail.name} deployed. Updating the example collision-chance graph using your current assumptions…`;
  await run();
  $('deployment-analysis').textContent=$('model-status').textContent.startsWith('Could not run')?`Deployment succeeded; probability analysis failed: ${$('model-status').textContent}`:`${event.detail.name}: probability graphs updated below. This example uses overall debris counts, not this satellite’s height or tilt.`;
 });
 function modelFields(){const model=$('count-model').value;$('dispersion-field').hidden=model!=='negative_binomial';$('cv-field').hidden=model!=='lognormal';}
 $('count-model').addEventListener('change',modelFields);modelFields();
 $('mission-type').addEventListener('change',()=>{const event=$('mission-type').value==='abstract_asat';$('mission-form').hidden=event;$('breakup').hidden=!event;$('mode-note').hidden=!event;});
 $('breakup').addEventListener('click',()=>{$('model-event').value='abstract_asat';tab('models');run();});
 async function requestAPI(path,body){
 const headers={'Content-Type':'application/json'};if($('backend-token').value)headers.Authorization='Bearer '+$('backend-token').value;
 const response=await fetch(apiBase+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});const data=await response.json();if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail));return data;
 }
 async function connect(base){
 const parsed=new URL(base);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('Use an HTTP(S) base URL without credentials.');
 const url=parsed.href.replace(/\/$/,'');const response=await fetch(url+'/api/health',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error(`Health check returned ${response.status}`);const health=await response.json();if(health.status!=='ok')throw new Error('This is not an Orbit Lab API.');apiBase=url;$('backend-status').textContent=`Connected to ${url} · ${health.engine}. Scenario runs now use Python. ${$('backend-token').value?'Larger private jobs enabled.':'Public limit: 500 futures over 30 years. Everyone shares a request limit.'}`;
 }
 $('backend-connect').addEventListener('click',async()=>{try{await connect($('backend-url').value);}catch(e){apiBase='';$('backend-status').textContent=`Could not connect: ${e.message}. You can still calculate on your device.`;}});
 $('backend-disconnect').addEventListener('click',()=>{apiBase='';$('backend-status').textContent='Calculating on your device. Large counts use an approximation.';});
 $('export-results').addEventListener('click',()=>{if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='orbit-lab-scenario.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 try{
 [presets,teaching]=await Promise.all([fetch('./data/presets.json').then(r=>r.json()),fetch('./data/teaching-statistics.json').then(r=>r.json())]);
 for(const [key,value] of Object.entries(presets)){const option=document.createElement('option');option.value=key;option.textContent=`${value.config.annual_launches} launches/yr · ${Math.round(value.config.disposal*100)}% cleanup · collision setting ${value.config.collision_coefficient}`;$('saved-scenario').append(option);}
 $('saved-scenario').value='120_0.9_0.4';showResult(presets[$('saved-scenario').value]);
 $('saved-scenario').addEventListener('change',()=>{const out=presets[$('saved-scenario').value],cfg=out.config;$('model-launches').value=cfg.annual_launches;$('model-disposal').value=cfg.disposal*100;$('model-collision').value=cfg.collision_coefficient;$('count-model').value='poisson';$('fragment-mean').value=60;$('model-years').value=30;$('model-runs').value=500;$('model-seed').value=cfg.seed;$('model-event').value='none';$('baseline').value='teaching';$('population-scale').value='1';modelFields();showResult(out);$('model-status').textContent='Loaded saved Python scenario.';});
 }catch(error){$('model-status').textContent=`Saved scenarios unavailable: ${error.message}`;}
 if(['127.0.0.1','localhost'].includes(location.hostname)&&location.port==='8000'){try{$('backend-url').value=location.origin;await connect(location.origin);}catch{/* Static preview works independently. */}}
 try{const hosted=await fetch('./data/backend.json').then(r=>r.json());if(!apiBase&&hosted.url){$('backend-url').value=hosted.url;await connect(hosted.url);}}catch{/* The browser worker stays usable when hosting is unavailable. */}
 setLayer();
 return {tick(dt,time){
 science.tick(dt,time);
 if(catalogInfo&&catalogPoints.visible&&!catalogPending&&performance.now()-catalogLast>1000)requestPositions();
 if(catalogTargets){catalogBlend=Math.min(1,catalogBlend+dt*2);const attr=catalogGeometry.getAttribute('position');if(attr){for(let i=0;i<attr.array.length;i++)attr.array[i]=catalogStart[i]+(catalogTargets[i]-catalogStart[i])*catalogBlend;attr.needsUpdate=true;}}
 if(scenarioPoints&&scenarioPoints.visible&&dt>0)scenarioPoints.rotation.y+=dt*.045;
 const label=`${world.missionCount()} missions · ${catalogPoints.visible?number(catalogTargets?catalogTargets.length/3:0)+' tracked dots':scenarioPoints?.visible?'simulated objects':'your missions only'}`;if($('scene-count').textContent!==label)$('scene-count').textContent=label;
 }, getResult:()=>result};
}
