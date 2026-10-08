(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const cfg=window.CLIENT_PORTAL_CONFIG||{};
  const todayLocal=()=>{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const part=key=>parts.find(p=>p.type===key)?.value||'00';
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
  const prettyDate=date=>date?new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}):'Date to be announced';
  const money=cents=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2,minimumFractionDigits:0});
  const validCal=value=>{
    try{const u=new URL(value);return u.protocol==='https:' && ['cal.com','www.cal.com'].includes(u.hostname) && u.pathname.split('/').filter(Boolean).length>=2;}catch{return false;}
  };
  const validCover=value=>{
    if(/^\/assets\/[a-z\d_./-]+$/i.test(value))return true;
    try{return new URL(value).protocol==='https:';}catch{return false;}
  };
  async function load() {
    const ready=cfg.supabaseUrl&&!cfg.supabaseUrl.includes('PASTE_')&&cfg.supabaseAnonKey&&!cfg.supabaseAnonKey.includes('PASTE_');
    if(!ready||!window.supabase){
      $('miniState').textContent='Booking details are being prepared. Please check back soon.';return;
    }
    const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
    const {data:event,error}=await sb.from('mini_events').select('*').eq('slug','fall-2026').maybeSingle();
    if(error||!event){
      $('miniState').textContent='Fall Mini Sessions details are coming soon. Please check back later.';return;
    }
    $('miniTitle').textContent=event.title||'Fall Mini Sessions';
    document.title=`${event.title||'Fall Mini Sessions'} | Camille Acosta Photography`;
    $('miniDateLocation').textContent=`${prettyDate(event.event_date)} · ${event.location||'Tooele, Utah'}`;
    $('miniDescription').textContent=event.description||'A short, relaxed fall portrait experience.';
    $('miniPrice').textContent=money(event.price_cents||0);
    $('miniLength').textContent=`${event.duration_minutes||20} min`;
    $('miniSpots').textContent=event.planned_spots||'—';
    $('miniIncludes').textContent=`Includes ${event.included_images||'edited photographs'}`;
    // Prefer an event-specific photo; otherwise borrow the FIRST LIVE CMS homepage photo.
    // Never use hardcoded old placeholder pictures from the original static HTML.
    let cover=event.cover_image_url||'';
    if(!cover){
      try{
        const response=await fetch('content/site.json',{cache:'no-cache'});
        if(response.ok){const site=await response.json();cover=site?.homepage_photos?.[0]?.image||'';}
      }catch{/* Warm editorial gradient remains a safe fallback. */}
    }
    if(cover && validCover(cover)){
      const img=new Image();
      img.onload=()=>{
        $('miniCoverBlock').style.backgroundImage=`url(${JSON.stringify(cover)})`;
        $('miniCoverBlock').classList.add('has-cover');
      };
      img.src=cover;
    }
    const active=event.is_active && event.event_date && event.event_date>=todayLocal() && validCal(event.cal_booking_url);
    if(active){
      const url=new URL(event.cal_booking_url);
      url.searchParams.set('embed','true');
      url.searchParams.set('theme','light');
      url.searchParams.set('layout','month_view');
      $('miniCalendar').src=url.toString();
      $('miniCalLink').href=event.cal_booking_url;
      $('miniState').hidden=true;
      $('miniCalendarArea').hidden=false;
      $('miniBookJump').textContent='BOOK YOUR MINI SESSION ↓';
    }else{
      $('miniCalendarArea').hidden=true;
      $('miniState').hidden=false;
      $('miniState').textContent=event.is_active && event.event_date && event.event_date<todayLocal()
        ? 'This event has ended. Thank you for your interest!'
        : 'Booking opens soon! Camille is getting the fall mini-session calendar ready.';
      $('miniBookJump').textContent='VIEW BOOKING DETAILS ↓';
    }
  }
  load().catch(()=>{$('miniState').textContent='Booking details are temporarily unavailable. Please check back soon.';});
})();
