/** Uniform photo gallery / category filters / accessible fullscreen viewer. */
import {normalizeCategories,assignedCategories} from './website-public.js';

function slugFromURL(){return (new URLSearchParams(location.search).get('category')||'all').toLowerCase();}
function setCrop(img,p){
  for(const mode of ['desktop','mobile']){
    img.style.setProperty(`--camille-${mode}-x`,`${Number(p[`${mode}_x`]??50)}%`);
    img.style.setProperty(`--camille-${mode}-y`,`${Number(p[`${mode}_y`]??50)}%`);
    img.style.setProperty(`--camille-${mode}-zoom`,String(Number(p[`${mode}_zoom`]??1)));
  }
}
function srcset(p){
  const candidate=[[p.thumb,p.thumb_width||560],[p.medium,p.medium_width||1200],[p.image,p.width||2400]];
  return [...new Map(candidate.filter(([url,n])=>url&&Number(n)>0).map(([url,n])=>[Number(n),url])).entries()]
    .sort((a,b)=>a[0]-b[0]).map(([w,url])=>`${url} ${w}w`).join(', ');
}
let instance=null;
export function renderPortfolio(itemsRaw,categoriesRaw){
  const target=document.querySelector('[data-portfolio-gallery]');
  if(!target)return;
  if(instance)instance.dispose();
  const items=(Array.isArray(itemsRaw)?itemsRaw:[]).filter(p=>p?.image);
  const categories=normalizeCategories(categoriesRaw);
  const counts=Object.fromEntries(categories.map(c=>[c.slug,items.filter(p=>assignedCategories(p).includes(c.slug)).length]));
  const options=categories.filter(c=>c.visible&&counts[c.slug]);
  const filterBar=document.querySelector('[data-portfolio-filters]');
  const empty=document.querySelector('[data-portfolio-empty]');
  let active=slugFromURL();
  if(active!=='all'&&!options.some(c=>c.slug===active))active='all';
  let visible=[];let activeIndex=0;let previousFocus=null;let downX=0;
  const modal=document.querySelector('#portfolioViewer');
  const modalImg=modal?.querySelector('[data-viewer-image]');
  const modalCount=modal?.querySelector('[data-viewer-count]');
  function updateViewer(){
    const p=visible[activeIndex];if(!p||!modalImg)return;
    modalImg.src=p.image;
    modalImg.alt=p.alt||'Camille Acosta Photography photograph';
    modalCount.textContent=`${activeIndex+1} / ${visible.length}`;
  }
  function open(id){
    const i=visible.findIndex(p=>p.id===id);if(i<0||!modal)return;
    activeIndex=i;previousFocus=document.activeElement;updateViewer();
    if(!modal.open)modal.showModal();
    document.body.classList.add('portfolio-viewer-open');
    modal.querySelector('[data-viewer-close]')?.focus();
  }
  function close(){if(modal?.open)modal.close();document.body.classList.remove('portfolio-viewer-open');previousFocus?.focus?.();}
  function move(delta){if(!visible.length)return;activeIndex=(activeIndex+delta+visible.length)%visible.length;updateViewer();}
  function showCategory(next,updateURL=true){
    active=next==='all'||options.some(c=>c.slug===next)?next:'all';
    visible=items.filter(p=>active==='all'||assignedCategories(p).includes(active));
    target.replaceChildren();
    visible.forEach((p,i)=>{
      const b=document.createElement('button');b.type='button';b.className='portfolio-tile';
      b.setAttribute('aria-label',`View ${p.alt||'photo'} larger`);
      const img=document.createElement('img');img.alt=p.alt||'Camille Acosta Photography';
      img.loading=i<3?'eager':'lazy';img.decoding='async';
      if(i===0)img.fetchPriority='high';
      if(p.thumb&&p.medium){img.srcset=srcset(p);img.sizes='(max-width: 699px) 47vw, (max-width:1050px) 32vw, 24vw';}
      setCrop(img,p);img.src=p.image;
      b.append(img);b.addEventListener('click',()=>open(p.id));target.append(b);
    });
    if(filterBar){
      filterBar.querySelectorAll('button[data-category]').forEach(b=>{
        const isCurrent=b.dataset.category===active;b.classList.toggle('active',isCurrent);
        b.setAttribute('aria-pressed',String(isCurrent));
      });
    }
    if(empty){empty.hidden=visible.length>0;empty.textContent=active==='all'?'Photos are coming soon.':'No photos are published in this category yet.';}
    const total=document.querySelector('[data-portfolio-count]');
    if(total)total.textContent=`${visible.length} photograph${visible.length===1?'':'s'}`;
    if(updateURL){const u=new URL(location.href);if(active==='all')u.searchParams.delete('category');else u.searchParams.set('category',active);history.replaceState(null,'',u);}
  }
  if(filterBar){
    filterBar.replaceChildren();
    for(const c of [{slug:'all',label:'All'},...options]){
      const b=document.createElement('button');b.type='button';b.dataset.category=c.slug;
      b.className='portfolio-category-filter';b.textContent=c.label;
      b.addEventListener('click',()=>showCategory(c.slug));filterBar.append(b);
    }
  }
  const onKey=e=>{
    if(!modal?.open)return;
    if(e.key==='ArrowRight'){e.preventDefault();move(1);}
    else if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}
    // Native dialog handles Escape. On close event we restore focus.
  };
  const onClose=()=>{document.body.classList.remove('portfolio-viewer-open');previousFocus?.focus?.();};
  const onDialogClick=e=>{if(e.target===modal)close();};
  const onStart=e=>{downX=e.changedTouches?.[0]?.screenX||0;};
  const onEnd=e=>{const diff=(e.changedTouches?.[0]?.screenX||0)-downX;if(Math.abs(diff)>55)move(diff<0?1:-1);};
  const onBack=()=>showCategory(slugFromURL(),false);
  document.addEventListener('keydown',onKey);
  modal?.addEventListener('close',onClose);
  modal?.addEventListener('click',onDialogClick);
  modal?.addEventListener('touchstart',onStart,{passive:true});
  modal?.addEventListener('touchend',onEnd,{passive:true});
  const onPrev=()=>move(-1),onNext=()=>move(1);
  modal?.querySelector('[data-viewer-close]')?.addEventListener('click',close);
  modal?.querySelector('[data-viewer-prev]')?.addEventListener('click',onPrev);
  modal?.querySelector('[data-viewer-next]')?.addEventListener('click',onNext);
  window.addEventListener('popstate',onBack);
  showCategory(active,false);
  instance={dispose(){document.removeEventListener('keydown',onKey);window.removeEventListener('popstate',onBack);modal?.removeEventListener('close',onClose);modal?.removeEventListener('click',onDialogClick);modal?.removeEventListener('touchstart',onStart);modal?.removeEventListener('touchend',onEnd);modal?.querySelector('[data-viewer-close]')?.removeEventListener('click',close);modal?.querySelector('[data-viewer-prev]')?.removeEventListener('click',onPrev);modal?.querySelector('[data-viewer-next]')?.removeEventListener('click',onNext);close();}};
  window.dispatchEvent(new CustomEvent('camille:portfolio-ready',{detail:{categories:options,counts}}));
}
