// Delegated help supports both static controls and updated result summaries.
export function setupHelp(){
 const bubble=document.createElement('div');bubble.id='term-help-bubble';bubble.className='term-help-bubble';bubble.setAttribute('role','tooltip');bubble.hidden=true;document.body.append(bubble);
 let active=null,pinned=false;
 function hide(){if(active)active.removeAttribute('aria-describedby');active=null;pinned=false;bubble.hidden=true;}
 function show(button,pin=false){active?.removeAttribute('aria-describedby');active=button;pinned=pin;bubble.textContent=button.dataset.help;bubble.hidden=false;button.setAttribute('aria-describedby',bubble.id);const r=button.getBoundingClientRect();bubble.style.maxWidth=Math.min(320,innerWidth-28)+'px';const b=bubble.getBoundingClientRect();bubble.style.left=Math.max(14,Math.min(innerWidth-b.width-14,r.left))+'px';bubble.style.top=(r.bottom+b.height+12<innerHeight?r.bottom+8:Math.max(10,r.top-b.height-8))+'px';}
 const button=event=>event.target.closest?.('[data-help]');
 document.addEventListener('pointerover',event=>{const b=button(event);if(b&&!pinned)show(b);});
 document.addEventListener('pointerout',event=>{const b=button(event);if(b&&!b.contains(event.relatedTarget)&&!pinned&&document.activeElement!==b)hide();});
 document.addEventListener('focusin',event=>{const b=button(event);if(b)show(b);});
 document.addEventListener('focusout',event=>{if(button(event)&&!pinned)hide();});
 document.addEventListener('click',event=>{const b=button(event);if(!b)return;event.preventDefault();if(active===b&&pinned)hide();else show(b,true);});
 document.addEventListener('pointerdown',event=>{if(!button(event)&&!bubble.contains(event.target))hide();});document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});addEventListener('resize',hide);document.addEventListener('scroll',hide,true);
}
