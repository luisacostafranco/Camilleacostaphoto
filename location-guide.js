(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const cfg=window.CLIENT_PORTAL_CONFIG||{};
  const ready=cfg.supabaseUrl&&!cfg.supabaseUrl.includes("PASTE_")&&cfg.supabaseAnonKey&&!cfg.supabaseAnonKey.includes("PASTE_");
  if(!ready||!window.supabase)return;
  const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
  const safeUrl=value=>{
    if(typeof value!=="string"||!value)return "";
    if(/^\/assets\/[a-zA-Z0-9_./-]+$/.test(value))return value;
    try{const u=new URL(value);return u.protocol==="https:"?u.href:"";}catch{return "";}
  };
  const mapUrl=value=>{
    if(typeof value!=="string"||!value)return "";
    try{const u=new URL(value);return u.protocol==="https:"?u.href:"";}catch{return "";}
  };
  function element(tag,className,text){
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=String(text);
    return el;
  }
  function renderSpot(spot){
    const card=element("article","guide-card");
    const image=safeUrl(spot.image_url);
    if(image){
      const img=element("img","guide-card-photo");
      img.src=image;
      img.alt=`${spot.title} - photography location inspiration`;
      img.loading="lazy";
      img.decoding="async";
      img.addEventListener("error",()=>{
        const empty=element("div","guide-card-photo guide-card-placeholder","CAMILLE ACOSTA PHOTOGRAPHY");
        img.replaceWith(empty);
      },{once:true});
      card.appendChild(img);
    }else card.appendChild(element("div","guide-card-photo guide-card-placeholder","CAMILLE ACOSTA PHOTOGRAPHY"));
    const body=element("div","guide-card-body");
    if(spot.area)body.appendChild(element("p","guide-card-label",spot.area));
    body.appendChild(element("h3","",spot.title));
    if(spot.description)body.appendChild(element("p","guide-card-description",spot.description));
    const meta=element("div","guide-card-meta");
    for(const [label,value] of [["Best light",spot.best_time],["Season",spot.best_season],["Good to know",spot.practical_notes]]){
      if(!value)continue;
      const p=element("p","");
      const heading=element("strong","",label);
      p.appendChild(heading);
      p.appendChild(document.createTextNode(value));
      meta.appendChild(p);
    }
    if(meta.childElementCount)body.appendChild(meta);
    const map=mapUrl(spot.maps_url);
    if(map){
      const link=element("a","guide-map-link","VIEW ON MAP +");
      link.href=map;
      link.target="_blank";
      link.rel="noopener noreferrer";
      body.appendChild(link);
    }
    card.appendChild(body);
    return card;
  }
  async function load(){
    const [settings,spots]=await Promise.all([
      sb.from("location_guide_settings").select("*").eq("slug","favorite-spots").maybeSingle(),
      sb.from("location_guide_spots").select("*").order("sort_order",{ascending:true})
    ]);
    if(settings.error||spots.error||!settings.data)return;
    const s=settings.data;
    const visible=(spots.data||[]).filter(x=>x.is_visible);
    if(!visible.length)return;
    $("guideTitle").textContent=s.title;
    document.title=`${s.title} | Camille Acosta Photography`;
    $("guideSubtitle").textContent=s.subtitle||"";
    $("guideIntroduction").textContent=s.introduction||"";
    $("guidePlanningTip").textContent=s.planning_tip||"";
    const cover=safeUrl(s.hero_image_url);
    if(cover){
      const test=new Image();
      test.onload=()=>{$("guideHeroPhoto").style.backgroundImage=`url(${JSON.stringify(cover)})`;};
      test.src=cover;
    }
    $("guideSpots").replaceChildren(...visible.map(renderSpot));
    $("guideDraft").hidden=true;
    $("guideContent").hidden=false;
    $("guidePreviewBadge").hidden=!!s.is_published;
  }
  load().catch(()=>{/* Leave a clean "coming soon" state on network failures. */});
})();
