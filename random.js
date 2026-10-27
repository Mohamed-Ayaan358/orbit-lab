// Deterministic random stream for the browser teaching preview.
export function randomStream(seed){let state=seed>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export function normal(rng){return Math.sqrt(-2*Math.log(Math.max(1e-12,rng())))*Math.cos(2*Math.PI*rng());}
export function poisson(rng,mean){
 if(mean<=0)return 0;
 if(mean<30){const stop=Math.exp(-mean);let product=1,n=0;do{n++;product*=rng();}while(product>stop);return n-1;}
 // Large-count browser approximation; exact draws are available in the Python engine.
 return Math.max(0,Math.round(mean+Math.sqrt(mean)*normal(rng)));
}
export function binomial(rng,n,p){
 if(n<=0||p<=0)return 0;if(p>=1)return n;
 if(n<=100){let x=0;for(let i=0;i<n;i++)if(rng()<p)x++;return x;}
 return Math.min(n,Math.max(0,Math.round(n*p+Math.sqrt(n*p*(1-p))*normal(rng))));
}
export function gamma(rng,shape){
 if(shape<1)return gamma(rng,shape+1)*Math.pow(Math.max(1e-12,rng()),1/shape);
 const d=shape-1/3,c=1/Math.sqrt(9*d);
 for(;;){const x=normal(rng),v=Math.pow(1+c*x,3);if(v<=0)continue;const u=rng();if(u<1-.0331*x**4||Math.log(u)<.5*x*x+d*(1-v+Math.log(v)))return d*v;}
}
export function fragmentCount(rng,model,mean,dispersion=5,cv=.8,events=1){
 if(!events)return 0;
 if(model==='poisson')return poisson(rng,events*mean);
 if(model==='negative_binomial')return poisson(rng,gamma(rng,events*dispersion)*mean/dispersion);
 const mu=events*mean,sigma2=Math.log1p(cv*cv/events);
 return Math.max(0,Math.round(Math.exp(Math.log(mu)-sigma2/2+Math.sqrt(sigma2)*normal(rng))));
}
export function quantile(values,p){const a=Array.from(values).sort((a,b)=>a-b),i=(a.length-1)*p,lo=Math.floor(i);return a[lo]+(a[Math.min(lo+1,a.length-1)]-a[lo])*(i-lo);}
export function histogram(values,bins=30){let min=Math.min(...values),max=Math.max(...values);if(min===max){min-=.5;max+=.5;}const width=(max-min)/bins,counts=new Array(bins).fill(0);for(const v of values)counts[Math.min(bins-1,Math.floor((v-min)/width))]++;return counts.map((count,i)=>({x0:min+i*width,x1:min+(i+1)*width,count}));}
