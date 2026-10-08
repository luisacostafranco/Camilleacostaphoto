(()=>{
'use strict';
const instagram='https://www.instagram.com/camille.acosta.photography';
const icon='<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.8" cy="6.3" r="1" fill="currentColor" stroke="none"/></svg>';
function init(){
 let nav=document.querySelector('.unified-nav'),button=document.querySelector('.unified-menu');
 if(!nav){
  const header=document.querySelector('.studio-header, .mini-header');
  if(!header)return;
  button=document.createElement('button');button.className='unified-menu';button.type='button';button.setAttribute('aria-label','Open navigation');button.setAttribute('aria-expanded','false');button.innerHTML='<span></span><span></span><span></span>';
  header.append(button);
  nav=document.createElement('nav');nav.className='unified-nav';nav.setAttribute('aria-label','Main navigation');
  nav.innerHTML='<a href="index.html">Home</a><a href="portfolio.html">Portfolio</a><a href="index.html#faq">FAQ</a><a href="client.html" class="client-login-link">Client Login</a><a href="booking.html" class="unified-book">Book a Session</a>';
  header.append(nav);
 }
 if(!nav.querySelector('.camille-instagram')){const a=document.createElement('a');a.className='camille-instagram';a.href=instagram;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Camille Acosta Photography on Instagram');a.innerHTML=icon+'<span>Instagram</span>';nav.append(a);}
 let backdrop=document.querySelector('.camille-nav-backdrop');if(!backdrop){backdrop=document.createElement('div');backdrop.className='camille-nav-backdrop';backdrop.setAttribute('aria-hidden','true');document.body.append(backdrop);}
 if(!button)return;
 let lastFocus=null;
 function setOpen(open){if(open)lastFocus=document.activeElement;nav.classList.toggle('open',open);button.classList.toggle('open',open);backdrop.classList.toggle('open',open);document.body.classList.toggle('camille-nav-open',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close navigation':'Open navigation');if(open)nav.querySelector('a')?.focus();else if(lastFocus===button)button.focus();}
 button.addEventListener('click',e=>{if(!matchMedia('(max-width: 820px)').matches)return;e.preventDefault();e.stopImmediatePropagation();setOpen(!nav.classList.contains('open'));},true);
 backdrop.addEventListener('click',()=>setOpen(false));
 nav.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open'))setOpen(false);if(e.key==='Tab'&&nav.classList.contains('open')){const focusable=[button,...nav.querySelectorAll('a')];const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 addEventListener('resize',()=>{if(innerWidth>820)setOpen(false);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
