import test from 'node:test';import assert from 'node:assert/strict';
import {randomStream,poisson,binomial,fragmentCount,quantile} from '../random.js';
test('browser random streams reproduce by seed',()=>{const a=randomStream(42),b=randomStream(42);for(let i=0;i<100;i++)assert.equal(a(),b());});
test('preview count distributions preserve approximate means',()=>{for(const model of ['poisson','negative_binomial','lognormal']){const rng=randomStream(3);let sum=0;for(let i=0;i<30000;i++){const n=fragmentCount(rng,model,60,5,.8);assert.ok(Number.isInteger(n)&&n>=0);sum+=n;}assert.ok(Math.abs(sum/30000-60)<1);}});
test('zero event counts and probability extremes remain exact',()=>{const rng=randomStream(7);assert.equal(poisson(rng,0),0);assert.equal(binomial(rng,500,0),0);assert.equal(binomial(rng,500,1),500);assert.equal(fragmentCount(rng,'poisson',60,5,.8,0),0);});
test('quantiles interpolate, do not mutate input',()=>{const a=[5,1,3];assert.equal(quantile(a,.5),3);assert.deepEqual(a,[5,1,3]);});
