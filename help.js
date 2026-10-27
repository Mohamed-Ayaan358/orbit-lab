// Hover, keyboard-focus and tap help. Text stays available to screen readers.
export function setupHelp(){
 const bubble=document.createElement('div');bubble.id='term-help-bubble';bubble.className='term-help-bubble';bubble.setAttribute('role','tooltip');bubble.hidden=true;document.body.append(bubble);
 let active=null,pinned=false;
 function hide(){if(active)active.removeAttribute('aria-describedby');active=null;pinned=false;bubble.hidden=true;}
 function show(button,pin=false){active?.removeAttribute('aria-describedby');active=button;pinned=pin;bubble.textContent=button.dataset.help;bubble.hidden=false;button.setAttribute('aria-describedby',bubble.id);const r=button.getBoundingClientRect();bubble.style.maxWidth=Math.min(320,innerWidth-28)+'px';const b=bubble.getBoundingClientRect();bubble.style.left=Math.max(14,Math.min(innerWidth-b.width-14,r.left))+'px';bubble.style.top=(r.bottom+b.height+12<innerHeight?r.bottom+8:Math.max(10,r.top-b.height-8))+'px';}
 document.querySelectorAll('[data-help]').forEach(button=>{
  button.addEventListener('pointerenter',()=>{if(!pinned)show(button);});button.addEventListener('focus',()=>show(button));
  button.addEventListener('pointerleave',()=>{if(!pinned&&document.activeElement!==button)hide();});button.addEventListener('blur',()=>{if(!pinned)hide();});
  button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(active===button&&pinned)hide();else show(button,true);});
 });
 document.addEventListener('pointerdown',event=>{if(!event.target.closest('[data-help]')&&!bubble.contains(event.target))hide();});document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});addEventListener('resize',hide);document.addEventListener('scroll',hide,true);
}
