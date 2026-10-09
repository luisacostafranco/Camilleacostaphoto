/** Camille Acosta: accessible, isolated mobile drawer + published portfolio categories. */
(()=>{'use strict';
const icon='<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.8" cy="6.3" r="1" fill="currentColor" stroke="none"/></svg>';
const defaultInstagram='https://www.instagram.com/camille.acosta.photography';
const mobileBreak=()=>matchMedia('(max-width:820px)').matches;
function init(){
  const header=document.querySelector('.unified-header,.studio-header,.mini-header');if(!header)return;
  let menu=header.querySelector('.unified-menu');
  if(!menu){menu=document.createElement('button');menu.type='button';menu.className='unified-menu';menu.innerHTML='<span></span><span></span><span></span>';header.append(menu);}
  menu.setAttribute('aria-label','Open navigation');menu.setAttribute('aria-expanded','false');
  const desktopNav=header.querySelector('.unified-nav');
  let links=desktopNav?[...desktopNav.querySelectorAll(':scope > a')].map(a=>a.cloneNode(true)):[];
  if(!links.length){for(const [label,url,cls] of [
    ['Home','index.html',''],['Portfolio','portfolio.html',''],['FAQ','index.html#faq',''],
    ['Client Login','client.html','client-login-link'],['Book a Session','booking.html','unified-book']]){
    const a=document.createElement('a');a.textContent=label;a.href=url;a.className=cls;links.push(a);
  }}
  const instagram=()=>{const a=document.createElement('a');a.href=defaultInstagram;a.target='_blank';a.rel='noopener noreferrer';a.className='camille-instagram';a.setAttribute('aria-label','Camille Acosta Photography on Instagram');a.innerHTML=icon+'<span>Instagram</span>';return a;};
  let desktopInstagram=desktopNav?.querySelector(':scope > .camille-instagram');
  if(desktopNav&&!desktopInstagram){desktopInstagram=instagram();desktopNav.append(desktopInstagram);}
  const backdrop=document.createElement('div');backdrop.className='camille-drawer-backdrop';backdrop.setAttribute('aria-hidden','true');
  const drawer=document.createElement('aside');drawer.className='camille-drawer';drawer.setAttribute('aria-label','Mobile navigation');drawer.setAttribute('aria-hidden','true');
  drawer.inert=true;
  const close=document.createElement('button');close.type='button';close.className='camille-drawer-close';close.textContent='×';close.setAttribute('aria-label','Close menu');
  const nav=document.createElement('nav');nav.className='camille-drawer-links';nav.setAttribute('aria-label','Main mobile navigation');
  let mobileCategories=null,menuToggle=null,desktopCategories=null;
  links.forEach(a=>{
    if(/portfolio\.html/i.test(a.getAttribute('href')||'')&&!mobileCategories){
      const line=document.createElement('div');line.className='camille-drawer-portfolio-line';
      line.append(a);
      menuToggle=document.createElement('button');menuToggle.className='camille-drawer-portfolio-toggle';menuToggle.type='button';menuToggle.setAttribute('aria-label','Expand portfolio categories');menuToggle.setAttribute('aria-expanded','false');menuToggle.textContent='⌄';
      line.append(menuToggle);nav.append(line);
      mobileCategories=document.createElement('div');mobileCategories.className='camille-drawer-categories';nav.append(mobileCategories);
      menuToggle.addEventListener('click',()=>{
        const expanded=!mobileCategories.classList.contains('is-expanded');
        mobileCategories.classList.toggle('is-expanded',expanded);
        menuToggle.setAttribute('aria-expanded',String(expanded));menuToggle.textContent=expanded?'⌃':'⌄';
      });
    }else nav.append(a);
  });
  const mobileIG=instagram();nav.append(mobileIG);drawer.append(close,nav);document.body.append(backdrop,drawer);
  let lastFocus=null;const isOpen=()=>drawer.classList.contains('is-open');
  function setOpen(open){
    drawer.classList.toggle('is-open',open);backdrop.classList.toggle('is-open',open);
    document.documentElement.classList.toggle('camille-drawer-open',open);
    document.body.classList.toggle('camille-drawer-open',open);
    drawer.setAttribute('aria-hidden',String(!open));drawer.inert=!open;
    menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    if(open){lastFocus=document.activeElement;close.focus();}
    else{if(mobileCategories){mobileCategories.classList.remove('is-expanded');menuToggle.setAttribute('aria-expanded','false');menuToggle.textContent='⌄';}lastFocus?.focus?.();}
  }
  // Capture phase prevents legacy site-v2 menu handlers from toggling the old navigation.
  menu.addEventListener('click',e=>{if(!mobileBreak())return;e.preventDefault();e.stopImmediatePropagation();setOpen(!isOpen());},true);
  backdrop.addEventListener('click',()=>setOpen(false));close.addEventListener('click',()=>setOpen(false));
  nav.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false);});
  document.addEventListener('keydown',e=>{
    if(!isOpen())return;
    if(e.key==='Escape'){setOpen(false);return;}
    if(e.key!=='Tab')return;
    const items=[close,...nav.querySelectorAll('a,button')].filter(el=>el.getClientRects().length&&!el.closest('.camille-drawer-categories:not(.is-expanded)'));
    const first=items[0],last=items[items.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
  addEventListener('resize',()=>{if(!mobileBreak()&&isOpen())setOpen(false);});
  // Accessible desktop dropdown uses same published categories as mobile.
  if(desktopNav){
    const portfolioLink=desktopNav.querySelector(':scope > a[href*="portfolio.html"]');
    if(portfolioLink){
      const group=document.createElement('div');group.className='desktop-portfolio-group';
      portfolioLink.replaceWith(group);group.append(portfolioLink);
      const toggle=document.createElement('button');toggle.type='button';toggle.className='portfolio-desktop-toggle';toggle.textContent='⌄';toggle.setAttribute('aria-label','Portfolio categories');toggle.setAttribute('aria-expanded','false');
      desktopCategories=document.createElement('div');desktopCategories.className='desktop-portfolio-submenu';
      group.append(toggle,desktopCategories);
      toggle.addEventListener('click',()=>{const open=!group.classList.contains('is-open');group.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));});
      document.addEventListener('click',e=>{if(!group.contains(e.target)){group.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');}});
      group.addEventListener('keydown',e=>{if(e.key==='Escape'){group.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');portfolioLink.focus();}});
    }
  }
  function update(categories,items,insta){
    if(insta&&/^https:\/\/(www\.)?instagram\.com\//.test(insta)){
      [mobileIG,desktopInstagram].filter(Boolean).forEach(a=>a.href=insta);
    }
    const list=Array.isArray(categories)?categories:[];
    const photoItems=Array.isArray(items)?items:[];
    const hasPhoto=c=>photoItems.some(p=>{
      const cats=Array.isArray(p.categories)&&p.categories.length?p.categories:[p.category];
      return cats.includes(c.slug);
    });
    const included=list.filter(c=>c.visible!==false&&hasPhoto(c));
    if(mobileCategories){mobileCategories.replaceChildren();const all=document.createElement('a');all.href='portfolio.html';all.textContent='View All';mobileCategories.append(all);
      for(const c of included){const a=document.createElement('a');a.href=`portfolio.html?category=${encodeURIComponent(c.slug)}`;a.textContent=c.label;mobileCategories.append(a);}
      menuToggle.hidden=included.length===0;
    }
    if(desktopCategories){desktopCategories.replaceChildren();const all=document.createElement('a');all.href='portfolio.html';all.textContent='View All';desktopCategories.append(all);
      for(const c of included){const a=document.createElement('a');a.href=`portfolio.html?category=${encodeURIComponent(c.slug)}`;a.textContent=c.label;desktopCategories.append(a);}
      desktopCategories.parentElement.querySelector('.portfolio-desktop-toggle').hidden=included.length===0;
    }
  }
  let currentCategories=null,currentPhotos=[];
  function apply(){if(currentCategories)update(currentCategories,currentPhotos,window.CAMILLE_SITE_CONTENT?.contact?.instagram);}
  window.addEventListener('camille:preview-categories',e=>{currentCategories=e.detail?.categories;apply();});
  window.addEventListener('camille:site-content',e=>{currentCategories=e.detail?.categories||currentCategories;apply();});
  // On all public and private pages, load category navigation from published data.
  Promise.all([import('./website-public.js'),import('./photo-framing-public.js')]).then(async([siteModule,photoModule])=>{
    const [siteResult,photoResult]=await Promise.all([siteModule.getWebsitePublic(),photoModule.loadPublishedPhotos()]);
    currentCategories=siteResult?.enabled?siteResult.content.categories:siteModule.FALLBACK_CATEGORIES;
    if(photoResult?.enabled)currentPhotos=photoResult.portfolio||[];
    else if(photoResult?.enabled===false){try{const r=await fetch('content/portfolio.json',{cache:'no-cache'});if(r.ok)currentPhotos=(await r.json()).items||[];}catch{}}
    update(currentCategories,currentPhotos,siteResult?.content?.site?.contact?.instagram||window.CAMILLE_SITE_CONTENT?.contact?.instagram);
  }).catch(e=>console.warn('Portfolio navigation temporarily unavailable:',e));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
