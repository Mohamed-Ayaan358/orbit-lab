// Hypothetical debris-collision exposure for a test satellite held in orbit.
// D is a total toy population, not a geometric density or conjunction result.
import {quantile} from './random.js';
export function collisionProxy(history,coefficient,startYear=0){
 const n=history[0].length,hazard=Array(n).fill(0),rows=[];
 for(let year=0;year<history.length;year++){
  if(year>startYear)for(let i=0;i<n;i++)hazard[i]+=coefficient*history[year-1][i]/1e6;
  const p=hazard.map(h=>-Math.expm1(-h));
  rows.push({year,mean:p.reduce((a,b)=>a+b,0)/n,low:quantile(p,.025),high:quantile(p,.975)});
 }
 return {label:'Hypothetical debris-collision probability proxy',start_year:startYear,formula:'1 - exp(-sum(kappa * D_previous_year / 1e6))',scope:'A test satellite held in orbit; no geometry, cross-section, covariance, avoidance or actual mission-specific probability.',trajectory:rows};
}
