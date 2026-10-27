import {randomStream,poisson,binomial,fragmentCount,quantile,histogram} from './random.js';
import {collisionProxy} from './risk.js';
export function simulateScenario(cfg,comparison=true){
 const numeric=['initial_satellites','initial_debris','annual_launches','disposal','collision_coefficient','fragment_mean','dispersion','cv','years','runs','seed','event_year'];
 if(numeric.some(k=>!Number.isFinite(cfg[k])))throw new Error('All simulation parameters must be finite numbers.');
 if(cfg.runs<20||cfg.years<1||cfg.initial_satellites<0||cfg.initial_debris<0||cfg.disposal<0||cfg.disposal>1||cfg.fragment_mean<1||cfg.dispersion<=0||cfg.cv<=0||cfg.annual_launches<0||cfg.collision_coefficient<0)throw new Error('Simulation parameters are outside the allowed range.');
 if(!['poisson','negative_binomial','lognormal'].includes(cfg.distribution)||!['none','satellite_launch','abstract_asat'].includes(cfg.event_type))throw new Error('Unknown scenario model.');
 const rng=randomStream(cfg.seed),R=cfg.runs;
 if(R>2000||cfg.years>100||R*cfg.years>100000)throw new Error('Browser preview supports up to 2,000 runs and 100,000 run-years. Use the Python backend for larger jobs.');
 let S=Array(R).fill(cfg.initial_satellites),D=Array(R).fill(cfg.initial_debris),trajectory=[],newCounts=[],collisions=[],eventCounts=Array(R).fill(0),eventApplied=false;
 const history=[];const summarize=year=>{history.push(D.slice());trajectory.push({year,low:quantile(D,.025),median:quantile(D,.5),high:quantile(D,.975),satellites:quantile(S,.5)});};
 summarize(0);
 for(let year=1;year<=cfg.years;year++){
  let totalFragments=0,totalCollisions=0;
  for(let i=0;i<R;i++){
   const launch=poisson(rng,cfg.annual_launches),retired=binomial(rng,S[i],.08),failed=binomial(rng,retired,1-cfg.disposal),decay=binomial(rng,D[i],.02);
   let s=S[i]+launch-retired,d=D[i]-decay+failed;
   const c=Math.min(s,d,poisson(rng,cfg.collision_coefficient*s*d/1e6));
   let f=fragmentCount(rng,cfg.distribution,cfg.fragment_mean,cfg.dispersion,cfg.cv,c);
   s-=c;d+=f-c;
   if(year===cfg.event_year&&cfg.event_type!=='none'){
    if(cfg.event_type==='satellite_launch'){eventApplied=true;s++;}
    else if(s>0){eventApplied=true;eventCounts[i]=fragmentCount(rng,cfg.distribution,cfg.fragment_mean,cfg.dispersion,cfg.cv);s--;d+=eventCounts[i];f+=eventCounts[i];}
   }
   if(s+d>1e8)throw new Error('Population exceeded the 100-million-object teaching-model limit. Reduce scale or fragmentation.');
   S[i]=s;D[i]=d;totalFragments+=f;totalCollisions+=c;
  }
  newCounts.push(totalFragments/R);collisions.push(totalCollisions/R);summarize(year);
 }
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,variance=a=>{const m=mean(a);return a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1);};
 const demo=Array.from({length:2000},()=>fragmentCount(rng,cfg.distribution,cfg.fragment_mean,cfg.dispersion,cfg.cv));
 const output={config:cfg,engine:'Browser worker (large-count approximation)',data_kind:'synthetic conditional scenario',trajectory,
 final:{mean:mean(D),median:quantile(D,.5),std:Math.sqrt(variance(D)),low:quantile(D,.025),high:quantile(D,.975)},
 histogram:histogram(D),fragment_histogram:histogram(demo),fragment_summary:{sample_mean:mean(demo),sample_variance:variance(demo),model_mean:cfg.fragment_mean,model_variance:cfg.distribution==='poisson'?cfg.fragment_mean:cfg.distribution==='negative_binomial'?cfg.fragment_mean+cfg.fragment_mean**2/cfg.dispersion:(cfg.fragment_mean*cfg.cv)**2},
 event:{type:cfg.event_type,applied:eventApplied,year:cfg.event_year,mean_new_debris:mean(eventCounts),low:quantile(eventCounts,.025),high:quantile(eventCounts,.975)},run_count:R,row_count:R*(cfg.years+1),seed:cfg.seed,annual_fragments:newCounts,annual_collisions:collisions,
 assumptions:['Large Poisson counts and binomial draws above n=100 use rounded Normal approximations.','Use Python for exact Poisson / Binomial / Negative Binomial draws.','Lognormal sums use moment matching in both engines.','No weapon dynamics or physical fragmentation calibration.']};
 output.collision_proxy=collisionProxy(history,cfg.collision_coefficient,cfg.event_type==='satellite_launch'?cfg.event_year:0);
 if(comparison&&cfg.event_type==='abstract_asat'){
  const baseline=simulateScenario({...cfg,event_type:'none'},false);
  output.counterfactual={label:'Same assumptions, no extra breakup',trajectory:baseline.trajectory,collision_proxy:baseline.collision_proxy,
   final_debris_mean:baseline.final.mean,mean_final_delta:output.final.mean-baseline.final.mean,
   secondary_collisions_delta:output.annual_collisions.reduce((a,b)=>a+b,0)-baseline.annual_collisions.reduce((a,b)=>a+b,0),
   secondary_fragments_delta:output.annual_fragments.reduce((a,b)=>a+b,0)-output.event.mean_new_debris-baseline.annual_fragments.reduce((a,b)=>a+b,0)};
 }
 return output;
}
