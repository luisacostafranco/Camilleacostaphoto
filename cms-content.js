
(async () => {
  "use strict";
  const stamp = `?v=${Date.now()}`;
  const get = async p => {
    const r = await fetch(p + stamp, {cache:"no-store"});
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

  try {
    const [site, portfolio] = await Promise.all([get("content/site.json"), get("content/portfolio.json")]);
    window.CAMILLE_SITE_CONTENT = site;

    const hero = document.querySelector("[data-hero-title]");
    if (hero && site.hero_title) {
      const words = site.hero_title.trim().split(/\s+/);
      const mid = Math.ceil(words.length / 2);
      hero.innerHTML = words.slice(0, mid).join(" ") + "<br>" + words.slice(mid).join(" ");
    }
    document.querySelectorAll("[data-location-line]").forEach(e => e.textContent = site.location_line || "");
    document.querySelectorAll("[data-intro-text]").forEach(e => e.textContent = site.intro_text || "");

    (site.homepage_photos || []).slice(0,7).forEach((p,i) => {
      const img = document.querySelector(`[data-home-photo="${i+1}"]`);
      if (!img) return;
      if (p.image) img.src = p.image;
      if (p.alt) img.alt = p.alt;
    });

    if (site.session) {
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
    if (faq && Array.isArray(site.faq)) {
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
    if (gallery && Array.isArray(portfolio.items)) {
      gallery.innerHTML = "";
      portfolio.items.forEach((item,i) => {
        const b = document.createElement("button");
        const layout = item.layout && item.layout !== "normal" ? ` ${item.layout}` : "";
        b.className = `gallery-item ${item.category || "portraits"}${layout} reveal`;
        b.dataset.category = item.category || "portraits";
        const img = document.createElement("img");
        img.loading = i === 0 ? "eager" : "lazy";
        img.decoding = "async";
        img.src = item.image;
        img.alt = item.alt || "Camille Acosta Photography";
        b.appendChild(img);
        gallery.appendChild(b);
      });
    }
  } catch (e) {
    console.warn("CMS content unavailable; using HTML fallback.", e);
  } finally {
    const s = document.createElement("script");
    s.src = "site-v2.js";
    document.body.appendChild(s);
  }
})();
