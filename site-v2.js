
(() => {
  "use strict";

  // -----------------------------
  // Shared mobile navigation
  // -----------------------------
  const menu = document.querySelector(".unified-menu");
  const nav = document.querySelector(".unified-nav");

  function closeNav(){
    if (!menu || !nav) return;
    menu.classList.remove("open");
    nav.classList.remove("open");
    menu.setAttribute("aria-expanded","false");
    document.body.style.overflow = "";
  }

  if (menu && nav){
    menu.addEventListener("click", () => {
      const isOpen = !nav.classList.contains("open");
      menu.classList.toggle("open", isOpen);
      nav.classList.toggle("open", isOpen);
      menu.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", closeNav));
    window.addEventListener("resize", () => {
      if (window.innerWidth > 820) closeNav();
    });
  }

  // Current-page state
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (page === "index.html" || page === ""){
    document.querySelector('[data-page="home"]')?.classList.add("current");
  } else if (page === "portfolio.html"){
    document.querySelector('[data-page="portfolio"]')?.classList.add("current");
  } else if (page === "booking.html"){
    document.querySelector('[data-page="booking"]')?.classList.add("current");
  }

  // -----------------------------
  // Reveal animations
  // -----------------------------
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window){
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, {threshold:.1});
    reveals.forEach(el => observer.observe(el));
  } else {
    reveals.forEach(el => el.classList.add("visible"));
  }

  // -----------------------------
  // FAQ accordions
  // -----------------------------
  const details = document.querySelectorAll(".simple-accordion details, .accordion details");
  details.forEach(d => {
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      details.forEach(other => {
        if (other !== d) other.open = false;
      });
    });
  });

  // -----------------------------
  // Homepage image lightbox
  // -----------------------------
  const simpleLightbox = document.querySelector(".simple-lightbox");
  const simplePhotos = [...document.querySelectorAll("[data-lightbox] img")];
  let simpleIndex = 0;

  if (simpleLightbox && simplePhotos.length){
    const img = simpleLightbox.querySelector("img");
    const count = simpleLightbox.querySelector(".simple-lightbox-count");

    const paint = () => {
      img.src = simplePhotos[simpleIndex].src;
      img.alt = simplePhotos[simpleIndex].alt;
      if (count) count.textContent = `${simpleIndex + 1} / ${simplePhotos.length}`;
    };

    const open = source => {
      simpleIndex = simplePhotos.indexOf(source);
      paint();
      simpleLightbox.classList.add("open");
      document.body.style.overflow = "hidden";
    };

    const close = () => {
      simpleLightbox.classList.remove("open");
      document.body.style.overflow = "";
    };

    const move = dir => {
      simpleIndex = (simpleIndex + dir + simplePhotos.length) % simplePhotos.length;
      paint();
    };

    document.querySelectorAll("[data-lightbox]").forEach(btn => {
      btn.addEventListener("click", () => open(btn.querySelector("img")));
    });

    simpleLightbox.querySelector(".simple-lightbox-close")?.addEventListener("click", close);
    simpleLightbox.querySelector(".simple-lightbox-prev")?.addEventListener("click", () => move(-1));
    simpleLightbox.querySelector(".simple-lightbox-next")?.addEventListener("click", () => move(1));
    simpleLightbox.addEventListener("click", e => { if (e.target === simpleLightbox) close(); });

    let sx = 0, sy = 0;
    simpleLightbox.addEventListener("touchstart", e => {
      sx = e.changedTouches[0].screenX;
      sy = e.changedTouches[0].screenY;
    }, {passive:true});
    simpleLightbox.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].screenX - sx;
      const dy = e.changedTouches[0].screenY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) move(dx < 0 ? 1 : -1);
      else if (dy > 90) close();
    }, {passive:true});

    document.addEventListener("keydown", e => {
      if (!simpleLightbox.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    });
  }

  // -----------------------------
  // Portfolio filter + lightbox
  // -----------------------------
  const filters = document.querySelectorAll(".filter");
  const galleryItems = [...document.querySelectorAll(".gallery-item")];

  filters.forEach(btn => {
    btn.addEventListener("click", () => {
      filters.forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.dataset.filter;
      galleryItems.forEach(item => {
        item.classList.toggle("hidden", filter !== "all" && item.dataset.category !== filter);
      });
    });
  });

  const portfolioLB = document.querySelector(".lightbox");
  if (portfolioLB && galleryItems.length){
    const lbImg = portfolioLB.querySelector("img");
    let visible = [];
    let index = 0;

    const refresh = () => {
      visible = [...document.querySelectorAll(".gallery-item:not(.hidden) img")];
    };
    const show = source => {
      refresh();
      index = visible.indexOf(source);
      lbImg.src = source.src;
      portfolioLB.classList.add("open");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      portfolioLB.classList.remove("open");
      document.body.style.overflow = "";
    };
    const move = dir => {
      refresh();
      if (!visible.length) return;
      index = (index + dir + visible.length) % visible.length;
      lbImg.src = visible[index].src;
    };

    galleryItems.forEach(item => item.addEventListener("click", () => show(item.querySelector("img"))));
    portfolioLB.querySelector(".close")?.addEventListener("click", close);
    portfolioLB.querySelector(".lbprev")?.addEventListener("click", () => move(-1));
    portfolioLB.querySelector(".lbnext")?.addEventListener("click", () => move(1));
    portfolioLB.addEventListener("click", e => { if (e.target === portfolioLB) close(); });

    let sx = 0;
    portfolioLB.addEventListener("touchstart", e => sx = e.changedTouches[0].screenX, {passive:true});
    portfolioLB.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].screenX - sx;
      if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1);
    }, {passive:true});
  }

  // -----------------------------
  // Generic calendar renderer
  // -----------------------------
  function buildCalendar(config){
    const grid = document.getElementById(config.gridId);
    const label = document.getElementById(config.labelId);
    const prev = document.getElementById(config.prevId);
    const next = document.getElementById(config.nextId);
    const timesWrap = document.getElementById(config.timesId);
    const selectedText = document.getElementById(config.selectedId);
    const preferred = config.preferredId ? document.getElementById(config.preferredId) : null;

    if (!grid || !label || !prev || !next || !timesWrap || !selectedText) return;

    let view = new Date();
    view.setDate(1);
    let selectedDate = null;
    let selectedTime = null;
    const slots = ["5:00 PM","6:00 PM","7:00 PM"];

    const update = () => {
      if (selectedDate && selectedTime){
        const text = `${selectedDate.toLocaleDateString("en-US",{
          weekday:"long", month:"long", day:"numeric", year:"numeric"
        })} at ${selectedTime}`;
        selectedText.textContent = text;
        if (preferred) preferred.value = text;
        document.getElementById("requestButton")?.classList.remove("disabled");
      } else if (selectedDate){
        selectedText.textContent =
          `${selectedDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})} — choose a time`;
      } else {
        selectedText.textContent = "Choose a date and time";
      }
    };

    const renderTimes = () => {
      timesWrap.innerHTML = "";
      slots.forEach(time => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = config.timeClass;
        b.textContent = time;
        b.addEventListener("click", () => {
          timesWrap.querySelectorAll("button").forEach(x => x.classList.remove("active"));
          b.classList.add("active");
          selectedTime = time;
          update();
        });
        timesWrap.appendChild(b);
      });
    };

    const render = () => {
      grid.innerHTML = "";
      const y = view.getFullYear();
      const m = view.getMonth();

      label.textContent = view.toLocaleDateString("en-US",{month:"long",year:"numeric"});

      const first = new Date(y,m,1).getDay();
      const daysInMonth = new Date(y,m+1,0).getDate();

      for (let i=0;i<first;i++){
        const spacer = document.createElement("span");
        spacer.className = `${config.dayClass} muted`;
        grid.appendChild(spacer);
      }

      for (let d=1; d<=daysInMonth; d++){
        const b = document.createElement("button");
        b.type = "button";
        b.className = config.dayClass;
        b.textContent = d;

        const dt = new Date(y,m,d);
        const today = new Date();
        today.setHours(0,0,0,0);

        // Demo availability: Friday + Saturday evenings.
        const unavailable = dt < today || ![5,6].includes(dt.getDay());

        if (unavailable){
          b.classList.add("muted");
        } else {
          b.addEventListener("click", () => {
            grid.querySelectorAll("button").forEach(x => x.classList.remove("selected"));
            b.classList.add("selected");
            selectedDate = dt;
            selectedTime = null;
            timesWrap.querySelectorAll("button").forEach(x => x.classList.remove("active"));
            update();
          });
        }
        grid.appendChild(b);
      }
    };

    prev.addEventListener("click", () => {
      view.setMonth(view.getMonth()-1);
      render();
    });
    next.addEventListener("click", () => {
      view.setMonth(view.getMonth()+1);
      render();
    });

    render();
    renderTimes();
  }

  // Homepage calendar
  buildCalendar({
    gridId:"homeCalendarGrid",
    labelId:"homeMonthLabel",
    prevId:"homePrevMonth",
    nextId:"homeNextMonth",
    timesId:"homeTimeButtons",
    selectedId:"homeSelectedDateText",
    preferredId:"homePreferredDate",
    dayClass:"home-calendar-day",
    timeClass:"home-time-button"
  });

  // Booking page calendar
  buildCalendar({
    gridId:"calendarGrid",
    labelId:"monthLabel",
    prevId:"prevMonth",
    nextId:"nextMonth",
    timesId:"timeButtons",
    selectedId:"selectedDateText",
    preferredId:"preferredDate",
    dayClass:"day",
    timeClass:"time-btn"
  });

  // -----------------------------
  // Contact forms
  // -----------------------------
  function connectMailForm(id){
    const form = document.getElementById(id);
    if (!form) return;

    form.addEventListener("submit", e => {
      e.preventDefault();
      const data = new FormData(form);
      const name = data.get("name") || "";
      const email = data.get("email") || "";
      const session = data.get("session") || "";
      const preferred = data.get("preferred-date") || "";
      const message = data.get("message") || "";

      const subject = encodeURIComponent(`Photography inquiry from ${name}`);
      const body = encodeURIComponent(
`Name: ${name}
Email: ${email}
Session type: ${session}
Preferred date/time: ${preferred}

Message:
${message}`
      );
      location.href = `mailto:hello@camilleacostaphoto.com?subject=${subject}&body=${body}`;
    });
  }

  connectMailForm("homeInquiryForm");
  connectMailForm("contactForm");
  connectMailForm("simpleContactForm");
})();
