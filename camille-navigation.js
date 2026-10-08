(()=>{'use strict';
const instagram='https://www.instagram.com/camille.acosta.photography';
const icon='<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.8" cy="6.3" r="1" fill="currentColor" stroke="none"/></svg>';
function init(){
 const header=document.querySelector('.unified-header,.studio-header,.mini-header');if(!header)return;
 let button=header.querySelector('.unified-menu');
 if(!button){button=document.createElement('button');button.type='button';button.className='unified-menu';button.innerHTML='<span></span><span></span><span></span>';header.appendChild(button)}
 const existing=header.querySelector('.unified-nav');
 const links=existing?Array.from(existing.querySelectorAll('a')).filter(a=>!a.classList.contains('camille-instagram')).map(a=>a.cloneNode(true)):[];
 if(!links.length){[['Home','index.html'],['Portfolio','portfolio.html'],['FAQ','index.html#faq'],['Client Login','client.html'],['Book a Session','booking.html']].forEach(([label,href])=>{const a=document.createElement('a');a.textContent=label;a.href=href;if(label==='Client Login')a.className='client-login-link';if(label==='Book a Session')a.className='unified-book';links.push(a)})}
 const ig=document.createElement('a');ig.className='camille-instagram';ig.href=instagram;ig.target='_blank';ig.rel='noopener noreferrer';ig.setAttribute('aria-label','Camille Acosta Photography on Instagram');ig.innerHTML=icon+'<span>Instagram</span>';
 if(existing&&!existing.querySelector('.camille-instagram'))existing.appendChild(ig.cloneNode(true));
 const backdrop=document.createElement('div');backdrop.className='camille-drawer-backdrop';backdrop.setAttribute('aria-hidden','true');
 const drawer=document.createElement('aside');drawer.className='camille-drawer';drawer.setAttribute('aria-label','Mobile navigation');drawer.setAttribute('aria-hidden','true');
 const close=document.createElement('button');close.type='button';close.className='camille-drawer-close';close.textContent='×';close.setAttribute('aria-label','Close menu');
 const nav=document.createElement('nav');nav.className='camille-drawer-links';nav.setAttribute('aria-label','Mobile navigation links');links.forEach(a=>nav.appendChild(a));nav.appendChild(ig);drawer.append(close,nav);document.body.append(backdrop,drawer);
 let lastFocus=null;const isOpen=()=>drawer.classList.contains('is-open');
 function setOpen(open){drawer.classList.toggle('is-open',open);backdrop.classList.toggle('is-open',open);document.body.classList.toggle('camille-drawer-open',open);document.documentElement.classList.toggle('camille-drawer-open',open);drawer.setAttribute('aria-hidden',String(!open));button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close navigation':'Open navigation');if(open){lastFocus=document.activeElement;close.focus()}else if(lastFocus&&lastFocus.focus)lastFocus.focus()}
 button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Open navigation');
 button.addEventListener('click',e=>{if(!matchMedia('(max-width:820px)').matches)return;e.preventDefault();e.stopImmediatePropagation();setOpen(!isOpen())},true);
 close.addEventListener('click',()=>setOpen(false));backdrop.addEventListener('click',()=>setOpen(false));nav.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false)});
 document.addEventListener('keydown',e=>{if(!isOpen())return;if(e.key==='Escape'){setOpen(false);return}if(e.key==='Tab'){const items=[close,...nav.querySelectorAll('a')];const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 addEventListener('resize',()=>{if(innerWidth>820&&isOpen())setOpen(false)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
