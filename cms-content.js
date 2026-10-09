/** Camille Website V3: Studio owns published text/categories; Photo Manager owns photos. */
(async()=>{
  'use strict';
  const fetchJSON=async path=>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error(`${path}: ${r.status}`);return r.json();};
  const imgs=[...document.querySelectorAll('[data-home-photo]')];
  const gallery=document.querySelector('[data-portfolio-gallery]');
  const wantsPhotos=!!(imgs.length||gallery);
  const root=document.documentElement;
  let pageLoaded=false;let siteData=null;let categories=[];let photos=[];
  let hasSitePreview=location.search.includes('website-editor-preview=1');
  let queuedPreview=null;
  function renderText(site){
    if(!site||typeof site!=='object')return;
    siteData=site;
    window.CAMILLE_SITE_CONTENT=site;
    const title=document.querySelector('[data-hero-title]');
    if(title&&site.hero_title){
      const words=String(site.hero_title).trim().split(/\s+/),mid=Math.ceil(words.length/2);
      title.replaceChildren(document.createTextNode(words.slice(0,mid).join(' ')),document.createElement('br'),document.createTextNode(words.slice(mid).join(' ')));
    }
    for(const [key,selector] of [['location_line','[data-location-line]'],['intro_text','[data-intro-text]']]){
      document.querySelectorAll(selector).forEach(el=>el.textContent=site[key]||'');
    }
    for(const [key,selector] of [['price','[data-session-price]'],['title','[data-session-title]'],
      ['duration','[data-session-duration]'],['location','[data-session-location]'],['description','[data-session-description]']]){
      document.querySelectorAll(selector).forEach(el=>el.textContent=site.session?.[key]||'');
    }
    for(const el of document.querySelectorAll('[data-content]')){
      const value=el.dataset.content.split('.').reduce((o,k)=>o?.[k],site);
      if(typeof value==='string')el.textContent=value;
    }
    const contactEmail=site.contact?.email;
    if(contactEmail&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)){
      document.querySelectorAll('[data-contact-email]').forEach(a=>{
        a.textContent=contactEmail;a.href=`mailto:${contactEmail}`;
      });
    }
    const link=site.session?.cal_link;
    if(link){
      try{
        const cal=new URL(link);if(cal.hostname!=='cal.com'||cal.protocol!=='https:')throw Error('Invalid Cal URL');
        const embed=new URL(cal.toString());embed.searchParams.set('embed','true');embed.searchParams.set('theme','light');embed.searchParams.set('layout','month_view');
        document.querySelectorAll('[data-cal-embed]').forEach(el=>{if(el.src!==embed.toString())el.src=embed.toString();});
        document.querySelectorAll('[data-cal-fallback]').forEach(el=>el.href=cal.toString());
      }catch(e){console.warn('Ignoring invalid booking URL',e.message);}
    }
    const faq=document.querySelector('[data-faq-list]');
    if(faq&&Array.isArray(site.faq)){
      faq.replaceChildren();
      site.faq.forEach((item,i)=>{
        const details=document.createElement('details');if(i===0)details.open=true;
        const sum=document.createElement('summary');sum.append(document.createTextNode(item.question||''));
        const caret=document.createElement('span');caret.textContent='⌄';sum.append(caret);
        const answer=document.createElement('p');answer.textContent=item.answer||'';
        details.append(sum,answer);faq.append(details);
      });
    }
    window.dispatchEvent(new CustomEvent('camille:site-content',{detail:{site,categories}}));
  }
  function responsiveSet(p){
    if(!p?.thumb||!p.medium)return '';
    const set=new Map([[Number(p.thumb_width||560),p.thumb],[Number(p.medium_width||1200),p.medium],[Number(p.width||2400),p.image]]);
    return [...set.entries()].sort((a,b)=>a[0]-b[0]).map(([w,u])=>`${u} ${w}w`).join(', ');
  }
  window.addEventListener('message',e=>{
    if(!hasSitePreview||e.origin!==location.origin||e.source!==window.parent||e.data?.kind!=='CAMILLE_WEBSITE_PREVIEW')return;
    queuedPreview=e.data.content;
    if(pageLoaded){
      const payload=queuedPreview;
      import('./website-public.js').then(({normalizeWebsite})=>{
        const data=normalizeWebsite(payload);categories=data.categories;renderText(data.site);
        if(gallery)import('./portfolio-gallery.js').then(({renderPortfolio})=>renderPortfolio(photos,categories));
        window.dispatchEvent(new CustomEvent('camille:preview-categories',{detail:{categories}}));
      });
    }
  });
  try{
    const [websiteModule,photoModule,portfolioModule]=await Promise.all([
      import('./website-public.js'),wantsPhotos?import('./photo-framing-public.js').catch(()=>null):Promise.resolve(null),
      gallery?import('./portfolio-gallery.js'):Promise.resolve(null)
    ]);
    // Fetch website words and published Photo Studio selections concurrently.
    // This saves a network round trip on mobile, where first photo loading matters.
    const siteRequest=websiteModule.getWebsitePublic();
    const photoRequest=wantsPhotos&&photoModule?photoModule.loadPublishedPhotos():Promise.resolve(null);
    const publicContent=await siteRequest;
    let decapSite=null,decapPortfolio=null;
    if(publicContent?.enabled===true){
      siteData=publicContent.content.site;categories=publicContent.content.categories;
    } else if(publicContent?.enabled===false){
      decapSite=await fetchJSON('content/site.json').catch(e=>{console.warn(e.message);return null;});
      siteData=decapSite?websiteModule.normalizeSite(decapSite):null;
      categories=websiteModule.FALLBACK_CATEGORIES;
    }else{
      // Unknown server status: do not substitute potentially outdated Decap text after migration.
      // Keep static markup, and allow the website to remain usable.
      categories=websiteModule.FALLBACK_CATEGORIES;
    }
    if(siteData)renderText(siteData);
    if(wantsPhotos){
      const snapshot=await photoRequest;
      let home=[],mode='error',frames=null;
      if(snapshot?.enabled===true){home=Array.isArray(snapshot.home)?snapshot.home:[];photos=Array.isArray(snapshot.portfolio)?snapshot.portfolio:[];mode='studio';}
      else if(snapshot?.enabled===false){
        decapSite ||= await fetchJSON('content/site.json').catch(()=>null);
        decapPortfolio=gallery?await fetchJSON('content/portfolio.json').catch(()=>null):null;
        home=(decapSite?.homepage_photos||[]).slice(0,7);
        photos=decapPortfolio?.items||[];mode='decap';
        frames=photoModule?await photoModule.loadFrames():new Map();
      }
      if(mode==='error'){
        const msg=document.querySelector('.cms-photo-error');if(msg){msg.hidden=false;msg.textContent='Photos are temporarily unavailable. Please refresh shortly.';}
        document.querySelector('.pixie-collage')?.classList.remove('cms-photo-pending');
      }else{
        if(imgs.length){
          for(const [index,img] of imgs.entries()){
            const p=home[index],container=img.closest('.pixie-photo');
            if(!p?.image){img.removeAttribute('src');img.removeAttribute('srcset');if(container){container.style.display='none';container.removeAttribute('data-lightbox');}continue;}
            if(container){container.style.display='';container.setAttribute('data-lightbox','');}
            const f=mode==='decap'?photoModule?.matchingFrame(frames,`home:${index+1}`,p.image):p;
            if(f)photoModule?.applyFrame(img,f);
            img.alt=p.alt||'Camille Acosta Photography';img.loading=index<2?'eager':'lazy';img.decoding='async';
            if(index===0)img.fetchPriority='high';
            const set=mode==='studio'?responsiveSet(p):'';
            if(set){img.srcset=set;img.sizes='(max-width:760px) 46vw, 25vw';}else{img.removeAttribute('srcset');img.removeAttribute('sizes');}
            img.addEventListener('load',()=>container?.classList.add('cms-photo-ready'),{once:true});
            img.src=p.image;
          }
          const collage=document.querySelector('.pixie-collage');
          collage?.classList.remove('cms-photo-pending');collage?.classList.toggle('pm-reduced',home.filter(p=>p?.image).length<7);
        }
        if(gallery){
          const entries=mode==='decap'?photos.map((p,i)=>{
            const f=photoModule?.matchingFrame(frames,`portfolio:${i+1}`,p.image);
            return {id:`legacy-${i}`,...p,...(f||{})};
          }):photos;
          photos=entries;
          portfolioModule.renderPortfolio(entries,categories);
        }
      }
    }
    if(queuedPreview){
      const payload=websiteModule.normalizeWebsite(queuedPreview);categories=payload.categories;
      renderText(payload.site);
      if(gallery)portfolioModule.renderPortfolio(photos,categories);
    }
  }catch(err){console.warn('Website content loader:',err);}
  finally{
    pageLoaded=true;root.classList.remove('content-loading');
    if(hasSitePreview&&window.parent!==window)window.parent.postMessage({kind:'CAMILLE_WEBSITE_PREVIEW_READY'},location.origin);
    const script=document.createElement('script');script.src='site-v2.js';document.body.append(script);
  }
})();
