/** Public website content reader: Supabase published content, never private drafts. */
export const FALLBACK_CATEGORIES = [
  {slug:'family',label:'Families',visible:true},
  {slug:'couples',label:'Couples',visible:true},
  {slug:'portraits',label:'Portraits',visible:true},
  {slug:'kids',label:'Kids',visible:true},
  {slug:'maternity',label:'Maternity',visible:true},
  {slug:'newborns',label:'Newborns',visible:true},
  {slug:'seniors',label:'Seniors',visible:true}
];
export const clone = value => JSON.parse(JSON.stringify(value));
export const safeCategorySlug = value => /^[a-z][a-z0-9-]{0,39}$/.test(String(value||''));
export function normalizeCategories(list){
  const used=new Set();
  return (Array.isArray(list)?list:FALLBACK_CATEGORIES).filter(c=>{
    if(!c||!safeCategorySlug(c.slug)||used.has(c.slug))return false;
    used.add(c.slug);return true;
  }).slice(0,16).map(c=>({slug:c.slug,label:String(c.label||c.slug).slice(0,45),visible:c.visible!==false}));
}
export function assignedCategories(photo){
  const all=Array.isArray(photo?.categories)?photo.categories:[];
  const list=all.filter(safeCategorySlug);
  if(!list.length && safeCategorySlug(photo?.category))list.push(photo.category);
  return [...new Set(list)];
}
export function normalizeSite(site){
  const source=site&&typeof site==='object'?site:{};
  return {
    hero_title:String(source.hero_title||'FUN & HIGH-QUALITY PHOTOGRAPHY'),
    location_line:String(source.location_line||'TOOELE & SALT LAKE COUNTIES'),
    intro_text:String(source.intro_text||''),
    session:{
      title:String(source.session?.title||'Photography Session'),
      price:String(source.session?.price||'$150'),
      duration:String(source.session?.duration||'60 minutes'),
      location:String(source.session?.location||'Tooele, Utah'),
      description:String(source.session?.description||''),
      cal_link:String(source.session?.cal_link||'https://cal.com/camille-acosta-photography/30min')
    },
    contact:{email:String(source.contact?.email||'camille.acosta.photography@gmail.com'),
      instagram:String(source.contact?.instagram||'https://www.instagram.com/camille.acosta.photography')},
    faq:(Array.isArray(source.faq)?source.faq:[]).slice(0,30).map(f=>({question:String(f.question||''),answer:String(f.answer||'')})),
    home:{
      booking_heading:String(source.home?.booking_heading||'Book a session'),
      booking_intro:String(source.home?.booking_intro||'Choose a date and time below, then send your inquiry.'),
      contact_heading:String(source.home?.contact_heading||'Questions or ready to book?'),
      contact_intro:String(source.home?.contact_intro||'Send the details below and include anything helpful—session type, preferred date, number of people, or location ideas.')
    },
    booking:{
      heading:String(source.booking?.heading||'Let’s find a date.'),
      intro:String(source.booking?.intro||'Choose a live date and time below. Availability and reservations are handled through Cal.com without leaving the website.'),
      contact_heading:String(source.booking?.contact_heading||'Questions before booking?'),
      contact_intro:String(source.booking?.contact_intro||'Include the type of session, preferred date, number of people, location ideas, or anything else that would be helpful.')
    },
    portfolio:{
      heading:String(source.portfolio?.heading||'The moments between the poses.'),
      intro:String(source.portfolio?.intro||'Families, couples, maternity, newborns, seniors, and portraits in Tooele County and surrounding Utah areas.'),
      cta_heading:String(source.portfolio?.cta_heading||'Want photos like these?')
    }
  };
}
export function normalizeWebsite(raw){
  return {site:normalizeSite(raw?.site),categories:normalizeCategories(raw?.categories)};
}
let configPromise;
async function config(){
  if(window.CLIENT_PORTAL_CONFIG?.supabaseUrl)return window.CLIENT_PORTAL_CONFIG;
  if(!configPromise)configPromise=new Promise(resolve=>{
    const script=document.createElement('script');let done=false;
    const finish=(x)=>{if(done)return;done=true;clearTimeout(timer);resolve(x);};
    const timer=setTimeout(()=>finish(null),2500);
    script.src='client-config.js';
    script.onload=()=>finish(window.CLIENT_PORTAL_CONFIG||null);
    script.onerror=()=>finish(null);
    document.head.appendChild(script);
  });
  return configPromise;
}
let request;
export async function getWebsitePublic(){
  if(request)return request;
  request=(async()=>{
    const c=await config();
    if(!c?.supabaseUrl||!c?.supabaseAnonKey||String(c.supabaseUrl).includes('PASTE_'))return null;
    const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),6500);
    try{
      const res=await fetch(`${String(c.supabaseUrl).replace(/\/$/,'')}/rest/v1/rpc/camille_website_public`,{
        method:'POST',headers:{apikey:c.supabaseAnonKey,'Content-Type':'application/json'},
        body:'{}',cache:'no-store',signal:abort.signal
      });
      if(!res.ok)throw new Error(`Website content HTTP ${res.status}`);
      const payload=await res.json();
      if(typeof payload?.enabled!=='boolean')throw new Error('Unexpected published-content response');
      return payload.enabled?{enabled:true,content:normalizeWebsite(payload.content),revision:payload.revision}:{enabled:false};
    }catch(err){console.warn('Published content temporarily unavailable',err.message);return null;}
    finally{clearTimeout(timeout);}
  })();
  return request;
}
