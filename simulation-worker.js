import {simulateScenario} from './population-model.js';
self.onmessage=({data})=>{try{postMessage(simulateScenario(data));}catch(error){postMessage({error:error.message});}};
