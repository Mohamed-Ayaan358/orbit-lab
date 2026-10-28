import {propagateFragments} from './orbital-physics.js';
self.onmessage=({data})=>{try{const result=propagateFragments(data);postMessage(result,result.frames.map(f=>f.buffer));}catch(error){postMessage({error:error.message});}};
