window.addEventListener('load',()=>setTimeout(()=>document.querySelector('.loader')?.classList.add('hide'),220));const header=document.querySelector('.header');window.addEventListener('scroll',()=>header?.classList.toggle('scrolled',scrollY>20));const menu=document.querySelector('.menu'),nav=document.querySelector('.header nav');menu?.addEventListener('click',()=>{menu.classList.toggle('open');nav.classList.toggle('open')});nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu?.classList.remove('open');nav?.classList.remove('open')}));const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}}),{threshold:.12});document.querySelectorAll('.reveal').forEach(x=>io.observe(x));document.querySelectorAll('.accordion details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll('.accordion details').forEach(o=>{if(o!==d)o.open=false})}));const qs=[...document.querySelectorAll('.quote')];let qi=0;function showQ(i){if(!qs.length)return;qs.forEach(q=>q.classList.remove('active'));qi=(i+qs.length)%qs.length;qs[qi].classList.add('active')}document.querySelector('.next')?.addEventListener('click',()=>showQ(qi+1));document.querySelector('.prev')?.addEventListener('click',()=>showQ(qi-1));if(qs.length)setInterval(()=>showQ(qi+1),6500);
const filters=document.querySelectorAll('.filter'),items=document.querySelectorAll('.gallery-item');filters.forEach(b=>b.addEventListener('click',()=>{filters.forEach(x=>x.classList.remove('active'));b.classList.add('active');const f=b.dataset.filter;items.forEach(i=>i.classList.toggle('hidden',f!=='all'&&i.dataset.category!==f))}));const lb=document.querySelector('.lightbox'),lbimg=lb?.querySelector('img');let vis=[],li=0;function refresh(){vis=[...document.querySelectorAll('.gallery-item:not(.hidden) img')]}function openLB(img){refresh();li=vis.indexOf(img);lbimg.src=img.src;lb.classList.add('open')}items.forEach(i=>i.addEventListener('click',()=>openLB(i.querySelector('img'))));function move(d){refresh();li=(li+d+vis.length)%vis.length;lbimg.src=vis[li].src}lb?.querySelector('.close')?.addEventListener('click',()=>lb.classList.remove('open'));lb?.querySelector('.lbnext')?.addEventListener('click',()=>move(1));lb?.querySelector('.lbprev')?.addEventListener('click',()=>move(-1));lb?.addEventListener('click',e=>{if(e.target===lb)lb.classList.remove('open')});document.addEventListener('keydown',e=>{if(!lb?.classList.contains('open'))return;if(e.key==='Escape')lb.classList.remove('open');if(e.key==='ArrowRight')move(1);if(e.key==='ArrowLeft')move(-1)});
const grid=document.getElementById('calendarGrid');if(grid){const label=document.getElementById('monthLabel'),times=document.getElementById('timeButtons'),sel=document.getElementById('selectedDateText'),req=document.getElementById('requestButton'),pref=document.getElementById('preferredDate');let view=new Date();view.setDate(1);let date=null,time=null;const slots=['5:00 PM','6:00 PM','7:00 PM'];function renderTimes(){times.innerHTML='';slots.forEach(t=>{const b=document.createElement('button');b.className='time-btn';b.type='button';b.textContent=t;b.onclick=()=>{document.querySelectorAll('.time-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');time=t;update()};times.appendChild(b)})}function render(){grid.innerHTML='';const y=view.getFullYear(),m=view.getMonth();label.textContent=view.toLocaleDateString('en-US',{month:'long',year:'numeric'});const first=new Date(y,m,1).getDay(),count=new Date(y,m+1,0).getDate();for(let i=0;i<first;i++){let s=document.createElement('span');s.className='day muted';grid.appendChild(s)}for(let d=1;d<=count;d++){let b=document.createElement('button');b.type='button';b.className='day';b.textContent=d;let dt=new Date(y,m,d),today=new Date();today.setHours(0,0,0,0);let unavailable=dt<today||![5,6].includes(dt.getDay());if(unavailable)b.classList.add('muted');else b.onclick=()=>{document.querySelectorAll('.day').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');date=dt;time=null;document.querySelectorAll('.time-btn').forEach(x=>x.classList.remove('active'));update()};grid.appendChild(b)}}function update(){if(date&&time){let t=`${date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})} at ${time}`;sel.textContent=t;pref.value=t;req.classList.remove('disabled')}else if(date){sel.textContent=`${date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} — choose a time`;req.classList.add('disabled')}else{sel.textContent='Choose a date and time';req.classList.add('disabled')}}document.getElementById('prevMonth').onclick=()=>{view.setMonth(view.getMonth()-1);render()};document.getElementById('nextMonth').onclick=()=>{view.setMonth(view.getMonth()+1);render()};render();renderTimes()}
document.getElementById('contactForm')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);const sub=encodeURIComponent(`Photography inquiry from ${f.get('name')}`),body=encodeURIComponent(`Name: ${f.get('name')}\nEmail: ${f.get('email')}\nSession: ${f.get('session')}\nPreferred date/time: ${f.get('preferred-date')}\n\nMessage:\n${f.get('message')}`);location.href=`mailto:hello@camilleacostaphoto.com?subject=${sub}&body=${body}`});


// =========================================================
// ULTIMATE MOBILE / TOUCH INTERACTIONS
// =========================================================

// Add a persistent Book button on phones.
if (!document.querySelector(".mobile-book-cta")) {
  const mobileBook = document.createElement("a");
  mobileBook.className = "mobile-book-cta";
  mobileBook.href = "booking.html";
  mobileBook.textContent = "Book a Session";
  document.body.appendChild(mobileBook);
}

// Improve accessible mobile menu state.
if (menu) {
  menu.setAttribute("aria-expanded", "false");
  menu.addEventListener("click", () => {
    menu.setAttribute("aria-expanded", menu.classList.contains("open") ? "true" : "false");
    document.body.style.overflow = nav?.classList.contains("open") ? "hidden" : "";
  });
}
nav?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  document.body.style.overflow = "";
  menu?.setAttribute("aria-expanded", "false");
}));

// Enrich lightbox with swipe gestures + counter + touch hint.
if (lightbox) {
  const counter = document.createElement("div");
  counter.className = "lightbox-counter";
  lightbox.appendChild(counter);

  const hint = document.createElement("div");
  hint.className = "lightbox-hint";
  hint.textContent = "Swipe or use arrows";
  lightbox.appendChild(hint);

  const oldOpenLightbox = openLightbox;
  openLightbox = function(img) {
    oldOpenLightbox(img);
    updateLightboxCounter();
  };

  const oldMoveLightbox = moveLightbox;
  moveLightbox = function(dir) {
    oldMoveLightbox(dir);
    updateLightboxCounter();
  };

  function updateLightboxCounter(){
    refreshVisible();
    if (!visibleImages.length) return;
    counter.textContent = `${lightboxIndex + 1} / ${visibleImages.length}`;
  }

  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  lightbox.addEventListener("touchstart", e => {
    if (!e.changedTouches?.length) return;
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, {passive:true});

  lightbox.addEventListener("touchend", e => {
    if (!e.changedTouches?.length) return;
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;

    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;

    // Horizontal swipe changes images.
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) moveLightbox(1);
      else moveLightbox(-1);
    }

    // Downward swipe closes lightbox.
    if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      lightbox.classList.remove("open");
    }
  }, {passive:true});
}

// Swipe testimonials on touch devices.
const testimonialSlider = document.querySelector(".testimonial-slider");
if (testimonialSlider && testimonials.length) {
  let testimonialStartX = 0;
  testimonialSlider.addEventListener("touchstart", e => {
    testimonialStartX = e.changedTouches[0].screenX;
  }, {passive:true});
  testimonialSlider.addEventListener("touchend", e => {
    const diff = e.changedTouches[0].screenX - testimonialStartX;
    if (Math.abs(diff) > 50) showTestimonial(diff < 0 ? ti + 1 : ti - 1);
  }, {passive:true});
}

// Add native lazy loading and async decoding to images.
document.querySelectorAll("img").forEach((img, index) => {
  if (index > 1) img.loading = "lazy";
  img.decoding = "async";
});

// Hide persistent Book CTA while user is already on booking page.
if (location.pathname.endsWith("booking.html")) {
  document.querySelector(".mobile-book-cta")?.remove();
}

// Make keyboard/touch focus more predictable.
document.querySelectorAll(".gallery-item").forEach(item => {
  item.setAttribute("aria-label", "Open photo");
});

// Improve calendar: scroll selected date into view and prevent stale time selection.
document.querySelectorAll(".day:not(.muted)").forEach(day => {
  day.addEventListener("click", () => {
    if (window.innerWidth <= 700) {
      document.querySelector(".time-picker")?.scrollIntoView({behavior:"smooth", block:"nearest"});
    }
  });
});
