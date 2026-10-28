import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,rk4,specificEnergy,propagateFragments} from '../orbital-physics.js';
import {circularOrbit} from '../orbits.js';
test('RK4 circular orbit closes and conserves energy',()=>{
 const initial=initialState(550,51.6),period=circularOrbit(550).periodS;let state=initial;
 for(let i=0;i<1000;i++)state=rk4(state,period/1000);
 assert.ok(Math.hypot(...state.slice(0,3).map((v,i)=>v-initial[i]))<.001);
 assert.ok(Math.abs(specificEnergy(state)/specificEnergy(initial)-1)<1e-8);
});
test('zero velocity spread coincides; nonzero spread separates reproducibly',()=>{
 const config={count:3,steps:20,step_s:30};const zero=propagateFragments({...config,sigma_m_s:0});
 assert.deepEqual([...zero.frames.at(-1).slice(0,3)],[...zero.frames.at(-1).slice(3,6)]);
 const cloud=propagateFragments({...config,sigma_m_s:10});assert.notDeepEqual([...cloud.frames.at(-1).slice(0,3)],[...cloud.frames.at(-1).slice(3,6)]);
 assert.deepEqual(cloud,propagateFragments({...config,sigma_m_s:10}));assert.ok(cloud.max_relative_energy_error<1e-6);
});
test('fragment computation rejects unbounded workloads',()=>{for(const config of [{count:1001},{steps:481},{sigma_m_s:NaN},{altitude:0}])assert.throws(()=>propagateFragments(config));});
