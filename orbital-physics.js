import {EARTH_RADIUS_KM,EARTH_MU,orbitPosition,TAU,circularOrbit} from './orbits.js';
import {randomStream,normal} from './random.js';
export function derivative(state){const r=Math.hypot(state[0],state[1],state[2]),factor=-EARTH_MU/r**3;return [state[3],state[4],state[5],factor*state[0],factor*state[1],factor*state[2]];}
export function rk4(state,dt){const a=derivative(state),b=derivative(state.map((x,i)=>x+dt*a[i]/2)),c=derivative(state.map((x,i)=>x+dt*b[i]/2)),d=derivative(state.map((x,i)=>x+dt*c[i]));return state.map((x,i)=>x+dt*(a[i]+2*b[i]+2*c[i]+d[i])/6);}
export function specificEnergy(state){return(state[3]**2+state[4]**2+state[5]**2)/2-EARTH_MU/Math.hypot(...state.slice(0,3));}
export function initialState(altitude,inclination,phase=.6,node=.4){const radius=EARTH_RADIUS_KM+altitude,speed=Math.sqrt(EARTH_MU/radius);return [...orbitPosition(radius,inclination,node,phase),...orbitPosition(speed,inclination,node,phase+Math.PI/2)];}
export function propagateFragments({altitude=550,inclination=51.6,count=200,sigma_m_s=10,seed=20261028,steps=240,step_s=30}={}){
 if(!Number.isInteger(count)||count<1||count>1000||!Number.isInteger(steps)||steps<1||steps>480||!Number.isFinite(sigma_m_s)||sigma_m_s<0||sigma_m_s>100||!Number.isFinite(step_s)||step_s<=0||step_s>60||!Number.isFinite(altitude)||altitude<160||altitude>2000||!Number.isFinite(inclination)||inclination<0||inclination>180)throw new Error('Propagation parameters exceed the bounded experiment limits.');
 const rng=randomStream(seed),parent=initialState(altitude,inclination),states=Array.from({length:count},()=>parent.map((v,i)=>v+(i>=3?normal(rng)*sigma_m_s/1000:0))),energies=states.map(specificEnergy),frames=[],alive=Array(count).fill(true);let worst=0;
 for(let step=0;step<=steps;step++){
  const positions=new Float32Array(count*3);
  for(let i=0;i<count;i++){
   if(step&&alive[i])states[i]=rk4(states[i],step_s);
   if(Math.hypot(...states[i].slice(0,3))<EARTH_RADIUS_KM)alive[i]=false;
   if(alive[i]){positions.set(states[i].slice(0,3).map(x=>x/EARTH_RADIUS_KM),i*3);worst=Math.max(worst,Math.abs((specificEnergy(states[i])-energies[i])/energies[i]));}
  }
  frames.push(positions);
 }
 return {frames,count,steps,step_s,duration_s:steps*step_s,remaining:alive.filter(Boolean).length,max_relative_energy_error:worst,model:'Two-body gravity, RK4. Assumed isotropic velocity offsets; no calibrated breakup, drag, J2 or avoidance.'};
}
