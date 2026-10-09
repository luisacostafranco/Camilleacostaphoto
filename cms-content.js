/** Decap owns text. Photo Studio owns public photo selection once first published. */
(async () => {
  'use strict';
  const get = async path => {
    const r=await fetch(path,{cache:'no-cache'});
    if(!r.ok)throw new Error(`Unable to load ${path}`);
    return r.json();
  };
  const responsiveSet = p => {
    if(!p?.thumb || !p?.medium)return null;
    const sizes=[
      [p.thumb,Number(p.thumb_width||560)],
      [p.medium,Number(p.medium_width||1200)],
      [p.image,Number(p.width||2400)]
    ];
    const uniq=new Map();
    for(const [src,width] of sizes)if(src && width>0)uniq.set(width,`${src} ${width}w`);
    return [...uniq.entries()].sort((a,b)=>a[0]-b[0]).map(([,descriptor])=>descriptor).join(', ');
  };
  const embedURL = link => {
    try{const u=new URL(link);u.searchParams.set('embed','true');u.searchParams.set('theme','light');u.searchParams.set('layout','month_view');return u.toString();}
    catch{return link;}
  };
  const homeImgs=[...document.querySelectorAll('[data-home-photo]')];
  const gallery=document.querySelector('[data-portfolio-gallery]');
  const wantsPhotos=!!(homeImgs.length||gallery);
  const wantsText=!!document.querySelector('[data-hero-title], [data-session-price], [data-faq-list]');
  const cssReady= new Promise(resolve => {
    if(!wantsPhotos)return resolve();
    const css=document.createElement('link');css.rel='stylesheet';css.href='photo-framing.css';
    const timer=setTimeout(resolve,2100);
    css.onload=css.onerror=()=>{clearTimeout(timer);resolve();};
    document.head.appendChild(css);
  });
  const modulePromise = wantsPhotos ? import('./photo-framing-public.js').catch(()=>null) : Promise.resolve(null);
  const sitePromise = wantsText ? get('content/site.json').catch(e=>{console.warn(e.message);return null;}) : Promise.resolve(null);
  const portfolioPromise = gallery ? get('content/portfolio.json').catch(e=>{console.warn(e.message);return null;}) : Promise.resolve(null);
  try {
    const [site,portfolio,frameModule]=await Promise.all([sitePromise,portfolioPromise,modulePromise]);
    if(site)window.CAMILLE_SITE_CONTENT=site;
    const hero=document.querySelector('[data-hero-title]');
    if(hero && site?.hero_title){
      const words=site.hero_title.trim().split(/\s+/),mid=Math.ceil(words.length/2);
      hero.textContent='';
      hero.append(document.createTextNode(words.slice(0,mid).join(' ')),document.createElement('br'),document.createTextNode(words.slice(mid).join(' ')));
    }
    if(site){
      document.querySelectorAll('[data-location-line]').forEach(e=>e.textContent=site.location_line||'');
      document.querySelectorAll('[data-intro-text]').forEach(e=>e.textContent=site.intro_text||'');
      if(site.session){
        for(const [key,selector] of [['price','data-session-price'],['title','data-session-title'],['duration','data-session-duration'],['location','data-session-location'],['description','data-session-description']]){
          document.querySelectorAll(`[${selector}]`).forEach(e=>e.textContent=site.session[key]||'');
        }
        if(site.session.cal_link){
          document.querySelectorAll('[data-cal-embed]').forEach(f=>f.src=embedURL(site.session.cal_link));
          document.querySelectorAll('[data-cal-fallback]').forEach(a=>a.href=site.session.cal_link);
        }
      }
      const faq=document.querySelector('[data-faq-list]');
      if(faq && Array.isArray(site.faq)){
        faq.replaceChildren();
        site.faq.forEach((item,index)=>{
          const details=document.createElement('details');if(index===0)details.open=true;
          const summary=document.createElement('summary');
          summary.append(document.createTextNode(item.question||''));
          const arrow=document.createElement('span');arrow.textContent='⌄';summary.append(arrow);
          const answer=document.createElement('p');answer.textContent=item.answer||'';
          details.append(summary,answer);faq.append(details);
        });
      }
    }
    if(wantsPhotos){
      // IMPORTANT: determine which system owns photos BEFORE setting an image src.
      // If Supabase is temporarily unavailable, show a status, not old CMS images.
      const snapshot=frameModule ? await frameModule.loadPublishedPhotos() : null;
      let home=[],items=[],mode='error';
      let frames=null;
      if(snapshot?.enabled===true){
        home=Array.isArray(snapshot.home)?snapshot.home.slice(0,7):[];
        items=Array.isArray(snapshot.portfolio)?snapshot.portfolio:[];
        mode='photo-studio';
      }else if(snapshot?.enabled===false){
        home=(site?.homepage_photos||[]).slice(0,7);
        items=portfolio?.items||[];
        mode='decap';
        frames=await frameModule.loadFrames();
      }
      if(mode==='error'){
        const message=document.querySelector('.cms-photo-error');
        if(message){message.hidden=false;message.textContent='Photos are temporarily unavailable. Please refresh shortly.';}
        document.querySelector('.pixie-collage')?.classList.remove('cms-photo-pending');
      }else{
        await cssReady;
        homeImgs.forEach((img,index)=>{
          const p=home[index];
          const container=img.closest('.pixie-photo');
          if(!p?.image){
            img.removeAttribute('src');img.removeAttribute('srcset');
            if(container){container.removeAttribute('data-lightbox');container.style.display='none';}
            return;
          }
          if(container){container.style.display='';container.setAttribute('data-lightbox','');}
          const f=mode==='decap'?frameModule.matchingFrame(frames,`home:${index+1}`,p.image):p;
          if(f)frameModule.applyFrame(img,f);
          img.alt=p.alt||'Camille Acosta Photography';
          img.loading=index<2?'eager':'lazy';
          img.decoding='async';
          if(index===0)img.fetchPriority='high';
          if(mode==='photo-studio'&&p.thumb&&p.medium){
            img.srcset=responsiveSet(p);
            img.sizes='(max-width: 760px) 46vw, 25vw';
          }else {img.removeAttribute('srcset');img.removeAttribute('sizes');}
          img.addEventListener('load',()=>container?.classList.add('cms-photo-ready'),{once:true});
          img.addEventListener('error',()=>container?.classList.add('cms-photo-failed'),{once:true});
          img.src=p.image;
        });
        const collage=document.querySelector('.pixie-collage');
        collage?.classList.remove('cms-photo-pending');
        collage?.classList.toggle('pm-reduced',home.filter(p=>p?.image).length<7);
        if(gallery){
          gallery.replaceChildren();
          items.forEach((p,index)=>{
            if(!p?.image)return;
            const b=document.createElement('button');
            const category=['family','couples','portraits','kids'].includes(p.category)?p.category:'portraits';
            const layout=['tall','wide'].includes(p.layout)?` ${p.layout}`:'';
            b.className=`gallery-item ${category}${layout} reveal`;
            b.dataset.category=category;
            const img=document.createElement('img');
            img.loading=index<2?'eager':'lazy';img.decoding='async';
            const f=mode==='decap'?frameModule.matchingFrame(frames,`portfolio:${index+1}`,p.image):p;
            if(f)frameModule.applyFrame(img,f);
            img.alt=p.alt||'Camille Acosta Photography';
            if(mode==='photo-studio'&&p.thumb&&p.medium){
              img.srcset=responsiveSet(p);
              img.sizes='(max-width: 760px) 90vw, 33vw';
            }
            img.src=p.image;
            b.append(img);gallery.append(b);
          });
        }
      }
    }
  }catch(e){
    console.warn('Website content failed to load:',e);
    const msg=document.querySelector('.cms-photo-error');if(msg)msg.hidden=false;
  }finally{
    const s=document.createElement('script');s.src='site-v2.js';document.body.append(s);
  }
})();
