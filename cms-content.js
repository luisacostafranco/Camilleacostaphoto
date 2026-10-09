
(async () => {
  "use strict";

  const get = async p => {
    const r = await fetch(p, {cache:"no-cache"});
    if (!r.ok) throw new Error(p);
    return r.json();
  };
  const embedURL = link => {
    try {
      const u = new URL(link);
      u.searchParams.set("embed","true");
      u.searchParams.set("theme","light");
      u.searchParams.set("layout","month_view");
      return u.toString();
    } catch { return link; }
  };

  // Ensure framing CSS is installed before photos become visible. This keeps
  // a saved crop from briefly flashing as a default centered image.
  const frameStylesReady = new Promise(resolve => {
    if (!document.querySelector('[data-home-photo], [data-portfolio-gallery]')) return resolve();
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'photo-framing.css';
    const timer = setTimeout(resolve, 1800);
    css.onload = css.onerror = () => { clearTimeout(timer); resolve(); };
    document.head.appendChild(css);
  });

  // Begin loading photo positioning in parallel with the CMS content so the
  // visitor never sees a centered photo jump to its saved framing later.
  const framingPromise = import('./photo-framing-public.js')
    .then(async m => ({ utils:m, frames:await m.loadFrames() }))
    .catch(error => {
      console.warn('Photo framing unavailable; CMS images will still load.', error);
      return null;
    });

  try {
    const needsSite = !!document.querySelector("[data-home-photo], [data-session-price], [data-faq-list]");
    const needsPortfolio = !!document.querySelector("[data-portfolio-gallery]");
    const [site, portfolio, framing] = await Promise.all([
      needsSite ? get("content/site.json") : Promise.resolve(null),
      needsPortfolio ? get("content/portfolio.json") : Promise.resolve(null),
      Promise.all([framingPromise,frameStylesReady]).then(([framing]) => framing)
    ]);
    if (site) window.CAMILLE_SITE_CONTENT = site;

    const hero = document.querySelector("[data-hero-title]");
    if (hero && site?.hero_title) {
      const words = site.hero_title.trim().split(/\s+/);
      const mid = Math.ceil(words.length / 2);
      hero.innerHTML = words.slice(0, mid).join(" ") + "<br>" + words.slice(mid).join(" ");
    }
    if (site) {
      document.querySelectorAll("[data-location-line]").forEach(e => e.textContent = site.location_line || "");
      document.querySelectorAll("[data-intro-text]").forEach(e => e.textContent = site.intro_text || "");
      (site.homepage_photos || []).slice(0,7).forEach((photo,i) => {
        const img = document.querySelector(`[data-home-photo="${i+1}"]`);
        if (!img) return;
        if (photo.image) {
          const frame = framing?.utils.matchingFrame(framing.frames, `home:${i+1}`, photo.image);
          if (frame) framing.utils.applyFrame(img, frame);
          img.addEventListener("load", () => img.parentElement.classList.add("cms-photo-ready"), {once:true});
          img.addEventListener("error", () => img.parentElement.classList.add("cms-photo-failed"), {once:true});
          img.src = photo.image;
        }
        if (photo.alt) img.alt = photo.alt;
      });
      document.querySelector(".pixie-collage")?.classList.remove("cms-photo-pending");
    }

    if (site?.session) {
      document.querySelectorAll("[data-session-price]").forEach(e => e.textContent = site.session.price || "");
      document.querySelectorAll("[data-session-title]").forEach(e => e.textContent = site.session.title || "");
      document.querySelectorAll("[data-session-duration]").forEach(e => e.textContent = site.session.duration || "");
      document.querySelectorAll("[data-session-location]").forEach(e => e.textContent = site.session.location || "");
      document.querySelectorAll("[data-session-description]").forEach(e => e.textContent = site.session.description || "");
      if (site.session.cal_link) {
        document.querySelectorAll("[data-cal-embed]").forEach(f => f.src = embedURL(site.session.cal_link));
        document.querySelectorAll("[data-cal-fallback]").forEach(a => a.href = site.session.cal_link);
      }
    }

    const faq = document.querySelector("[data-faq-list]");
    if (faq && Array.isArray(site?.faq)) {
      faq.innerHTML = "";
      site.faq.forEach((item,i) => {
        const d = document.createElement("details");
        if (i === 0) d.open = true;
        const s = document.createElement("summary");
        s.append(document.createTextNode(item.question || ""));
        const arrow = document.createElement("span");
        arrow.textContent = "⌄";
        s.appendChild(arrow);
        const p = document.createElement("p");
        p.textContent = item.answer || "";
        d.append(s,p);
        faq.appendChild(d);
      });
    }

    const gallery = document.querySelector("[data-portfolio-gallery]");
    if (gallery && Array.isArray(portfolio?.items)) {
      gallery.innerHTML = "";
      portfolio.items.forEach((item,i) => {
        const b = document.createElement("button");
        const layout = item.layout && item.layout !== "normal" ? ` ${item.layout}` : "";
        b.className = `gallery-item ${item.category || "portraits"}${layout} reveal`;
        b.dataset.category = item.category || "portraits";
        const img = document.createElement("img");
        img.loading = i === 0 ? "eager" : "lazy";
        img.decoding = "async";
        const frame = framing?.utils.matchingFrame(framing.frames, `portfolio:${i+1}`, item.image);
        if (frame) framing.utils.applyFrame(img, frame);
        img.src = item.image;
        img.alt = item.alt || "Camille Acosta Photography";
        b.appendChild(img);
        gallery.appendChild(b);
      });
    }
  } catch (e) {
    console.warn("CMS content unavailable; no old photographs will be displayed.", e);
    const error = document.querySelector(".cms-photo-error");
    if (error) error.hidden = false;
  } finally {
    const s = document.createElement("script");
    s.src = "site-v2.js";
    document.body.appendChild(s);
  }
})();
