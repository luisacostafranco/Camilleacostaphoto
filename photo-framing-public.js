/**
 * Camille Acosta Photography: public, read-only photo framing.
 * No private keys. No changes to photos. The Decap JSON continues to decide
 * which pictures appear, while Supabase stores the presentation only.
 */
const FIELDS = 'target_key,image_path,desktop_x,desktop_y,desktop_zoom,mobile_x,mobile_y,mobile_zoom';

function loadBrowserConfig() {
  if (window.CLIENT_PORTAL_CONFIG) return Promise.resolve(window.CLIENT_PORTAL_CONFIG);
  return new Promise(resolve => {
    const script = document.createElement('script');
    let completed=false;
    const finish=value => {
      if(completed)return;
      completed=true;clearTimeout(timeout);resolve(value);
    };
    const timeout=setTimeout(()=>finish(null),1700);
    script.src = 'client-config.js';
    script.onload = () => finish(window.CLIENT_PORTAL_CONFIG || null);
    script.onerror = () => finish(null);
    document.head.appendChild(script);
  });
}

export function imageIdentity(input) {
  try {
    const url = new URL(String(input || ''), window.location.href);
    return url.origin === window.location.origin ? url.pathname : url.origin + url.pathname;
  } catch { return String(input || '').trim(); }
}

export function matchingFrame(frames, key, image) {
  const entry = frames.get(key);
  return entry && imageIdentity(entry.image_path) === imageIdentity(image) ? entry : null;
}

export function applyFrame(img, frame) {
  if (!img || !frame) return;
  const fields = {
    '--camille-desktop-x': `${frame.desktop_x ?? 50}%`,
    '--camille-desktop-y': `${frame.desktop_y ?? 50}%`,
    '--camille-desktop-zoom': `${frame.desktop_zoom ?? 1}`,
    '--camille-mobile-x': `${frame.mobile_x ?? 50}%`,
    '--camille-mobile-y': `${frame.mobile_y ?? 50}%`,
    '--camille-mobile-zoom': `${frame.mobile_zoom ?? 1}`
  };
  for (const [key,value] of Object.entries(fields)) img.style.setProperty(key,value);
  img.classList.add('camille-framed-image');
}

export async function loadFrames() {
  const config = await loadBrowserConfig();
  if (!config?.supabaseUrl || !config?.supabaseAnonKey ||
      String(config.supabaseUrl).includes('PASTE_')) return new Map();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2200);
  try {
    const root = String(config.supabaseUrl).replace(/\/$/, '');
    const url = `${root}/rest/v1/photo_framing?select=${FIELDS}`;
    const result = await fetch(url, {
      headers: { apikey: config.supabaseAnonKey },
      cache: 'no-store',
      signal: controller.signal
    });
    if (!result.ok) throw new Error(`Photo settings: ${result.status}`);
    const rows = await result.json();
    if (!Array.isArray(rows)) return new Map();
    return new Map(rows.map(entry => [entry.target_key, entry]));
  } catch (error) {
    // The site must still load CMS-selected pictures when Supabase is offline.
    console.warn('Using centered photo framing (photo settings unavailable).', error.message);
    return new Map();
  } finally {
    clearTimeout(timeout);
  }
}

/** Public Photo Studio snapshot. This RPC returns ONLY published pictures. */
export async function loadPublishedPhotos() {
  const config=await loadBrowserConfig();
  if(!config?.supabaseUrl || !config?.supabaseAnonKey ||
     String(config.supabaseUrl).includes('PASTE_')) return null;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),7000);
  try {
    const root=String(config.supabaseUrl).replace(/\/$/,'');
    const res=await fetch(`${root}/rest/v1/rpc/photo_site_public`,{
      method:'POST',headers:{
        apikey:config.supabaseAnonKey,'Content-Type':'application/json'
      },body:'{}',cache:'no-store',signal:controller.signal
    });
    if(!res.ok)throw new Error(`Published photo request: HTTP ${res.status}`);
    const data=await res.json();
    if(!data || typeof data.enabled!=='boolean')throw new Error('Unexpected photo catalogue response');
    return data;
  } catch(err) {
    console.warn('Published photo list could not be reached:',err.message);
    return null; // Do not briefly show outdated CMS pictures when status is unknown.
  } finally {clearTimeout(timeout);}
}
