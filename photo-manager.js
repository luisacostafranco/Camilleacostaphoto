(() => {
'use strict';
const $ = id => document.getElementById(id);
const config = window.CLIENT_PORTAL_CONFIG || {};
const configured = window.supabase?.createClient && config.supabaseUrl && config.supabaseAnonKey &&
  !String(config.supabaseUrl).includes('PASTE_') && !String(config.supabaseAnonKey).includes('PASTE_');
const sb = configured ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

// Dimensions approximate the current actual desktop/mobile CSS frames for each
// public slot. The public photo-frame transform is exactly the same cover math.
const HOME_DESKTOP = [
  [190,252],[305,245],[305,160],[376,520],[305,160],[305,330],[190,252]
];
const HOME_MOBILE = [
  [177,172],[177,208],[177,136],[177,244],[177,172],[177,244],[177,172]
];
const centered = () => ({
  desktop_x:50,desktop_y:50,desktop_zoom:1,
  mobile_x:50,mobile_y:50,mobile_zoom:1
});
const numericFields = Object.keys(centered());
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
const round = (n,places=1) => Math.round(n*10**places)/10**places;
const eq = (a,b) => numericFields.every(k => Number(a?.[k]) === Number(b?.[k]));

const state = {
  all:[],frames:new Map(),selected:null,draft:null,original:null,
  collection:'home',mode:'desktop',saving:false,authenticated:false,
  pointers:new Map(),pinch:null,imageDimensions:null
};

function display(id) {
  for (const key of ['loading','login','unauthorized','mainEditor']) $(key).hidden = key !== id;
}
function setMessage(message,error=false) {
  $('saveMessage').textContent = message;
  $('saveMessage').style.color = error ? '#a3392e' : '';
}
function safeText(value) { return String(value ?? '').replace(/\s+/g,' ').trim(); }
function imageIdentity(input) {
  try {
    const url = new URL(String(input||''), location.href);
    return url.origin === location.origin ? url.pathname : url.origin + url.pathname;
  } catch { return String(input||'').trim(); }
}
function currentImageRecord(p) {
  const row=state.frames.get(p.key);
  return row && imageIdentity(row.image_path)===imageIdentity(p.image) ? row : null;
}
function formatNumber(value,fallback=50) {
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}
function baseFromRow(row) {
  const base=centered();
  if (row) for(const key of numericFields) base[key]=formatNumber(row[key],base[key]);
  return base;
}
function frameDimensions(photo,mode) {
  if (photo.collection==='home') {
    const rows=mode==='desktop'?HOME_DESKTOP:HOME_MOBILE;
    return rows[photo.index] || [240,240];
  }
  if(mode==='mobile')return [350,340];
  if(photo.layout==='tall')return [235,475];
  if(photo.layout==='wide')return [500,230];
  return [235,230];
}
function applyCover(img,framing,mode) {
  const x=framing[`${mode}_x`], y=framing[`${mode}_y`], zoom=framing[`${mode}_zoom`];
  img.style.objectPosition=`${x}% ${y}%`;
  img.style.transformOrigin=`${x}% ${y}%`;
  img.style.transform=`scale(${zoom})`;
}
function markDirty() {
  if (!state.draft || !state.original) return;
  const changed = !eq(state.draft,state.original);
  $('saveChanges').disabled = !changed || state.saving;
  $('savedBadge').textContent=changed?'Unsaved changes':'Saved';
  $('savedBadge').classList.toggle('unsaved',changed);
  if (changed) setMessage('Unsaved — click Save Photo Position to update the website.');
}
function hasUnsaved() {
  return Boolean(state.draft && state.original && !eq(state.draft,state.original));
}
function confirmDiscard() {
  if (state.saving) {
    alert('Your photo is still saving. Please wait a moment.');
    return false;
  }
  return !hasUnsaved() || confirm('This photo has unsaved changes. Discard them and switch photos?');
}
function setMode(next) {
  if(!state.selected) return;
  state.mode=next;
  updatePreview();
}
function updatePreview() {
  const p=state.selected, crop=state.draft;
  if(!p || !crop)return;
  const mode=state.mode;
  const dims=frameDimensions(p,mode), aspect=dims[0]/dims[1];
  const stageWidth=$('dragFrame').parentElement.clientWidth;
  const baseLimit=mode==='mobile' ? 320:510;
  const width=clamp(Math.min(baseLimit,stageWidth-15, 480*aspect),95,baseLimit);
  $('dragFrame').style.width=`${width}px`;
  $('dragFrame').style.aspectRatio=`${dims[0]}/${dims[1]}`;
  applyCover($('dragImage'),crop,mode);
  $('frameShape').textContent=`${mode==='mobile'?'Phone':'Desktop'} website frame · Drag anywhere on the photo`;

  ['desktop','mobile'].forEach(view => {
    const a=frameDimensions(p,view);
    const thumb=$(view==='desktop'?'desktopMini':'mobileMini');
    thumb.style.aspectRatio=`${a[0]}/${a[1]}`;
    thumb.style.maxWidth=a[0]/a[1]<.8?'125px':'205px';
    applyCover($(view==='desktop'?'desktopMiniImage':'mobileMiniImage'),crop,view);
  });

  $('viewDesktop').setAttribute('aria-selected',String(mode==='desktop'));
  $('viewMobile').setAttribute('aria-selected',String(mode==='mobile'));
  $('quickDesktop').classList.toggle('active',mode==='desktop');
  $('quickMobile').classList.toggle('active',mode==='mobile');

  const x=crop[`${mode}_x`],y=crop[`${mode}_y`],zoom=crop[`${mode}_zoom`];
  $('zoomRange').value=String(Math.round(zoom*100));
  $('xRange').value=String(x);
  $('yRange').value=String(y);
  $('zoomValue').textContent=`${Math.round(zoom*100)}%`;
  $('xValue').textContent= x===50?'Centered':`${Math.round(x)}%`;
  $('yValue').textContent= y===50?'Centered':`${Math.round(y)}%`;
  $('copyOtherView').textContent=mode==='mobile'?
    'COPY DESKTOP POSITION TO PHONE':'COPY PHONE POSITION TO DESKTOP';
  markDirty();
}
function createPhotoList() {
  const items=state.all.filter(p=>p.collection===state.collection);
  $('homeCount').textContent=state.all.filter(p=>p.collection==='home').length;
  $('portfolioCount').textContent=state.all.filter(p=>p.collection==='portfolio').length;
  $('tabHome').setAttribute('aria-selected',String(state.collection==='home'));
  $('tabPortfolio').setAttribute('aria-selected',String(state.collection==='portfolio'));
  $('listDescription').textContent=state.collection==='home'?
    'These are the seven homepage photos currently selected in Decap CMS.':
    'These photos and layouts come directly from your Decap CMS portfolio.';
  const list=$('photoList');
  list.replaceChildren();
  if(!items.length){
    const p=document.createElement('p');
    p.textContent='No photos found in this collection. Choose photos in Decap CMS first.';
    list.appendChild(p);return;
  }
  items.forEach(p=>{
    const row=currentImageRecord(p);
    const b=document.createElement('button');
    b.type='button';
    b.className='pm-photo-option';
    b.dataset.key=p.key;
    b.setAttribute('aria-current',String(state.selected?.key===p.key));
    b.title=`Edit ${p.label}`;
    const img=document.createElement('img');
    img.loading='lazy'; img.decoding='async';
    img.src=p.image; img.alt=p.alt || p.label;
    applyCover(img,baseFromRow(row),'desktop');
    const meta=document.createElement('span');meta.className='pm-photo-option-info';
    const strong=document.createElement('strong');strong.textContent=p.label;
    const small=document.createElement('small');small.textContent=safeText(p.alt)||p.category||'Photography';
    meta.append(strong,small);
    b.append(img,meta);
    if(row){const flag=document.createElement('span');flag.className='pm-photo-dot';flag.textContent='✓';flag.title='Custom framing saved';b.append(flag);}
    b.addEventListener('click',()=>{
      selectPhoto(p);
      if (state.selected?.key===p.key && matchMedia('(max-width: 760px)').matches) {
        $('editPanel').scrollIntoView({behavior:'smooth',block:'start'});
      }
    });
    list.appendChild(b);
  });
}
function selectPhoto(p) {
  if(state.selected?.key===p.key)return;
  if(!confirmDiscard())return;
  state.selected=p;
  state.mode='desktop';
  state.imageDimensions=null;
  state.pointers.clear(); state.pinch=null;
  state.original=baseFromRow(currentImageRecord(p));
  state.draft={...state.original};
  $('emptyEditor').hidden=true;
  $('editContent').hidden=false;
  $('slotLabel').textContent=p.collection==='home'?`Homepage / Photo ${p.index+1}`:`Portfolio / Photo ${p.index+1}`;
  $('photoTitle').textContent=safeText(p.alt)||p.label;
  $('viewOnSite').href=p.collection==='home'?'index.html':'portfolio.html';
  ['dragImage','desktopMiniImage','mobileMiniImage','originalImage'].forEach(id => {
    const image=$(id);
    image.src=p.image;
    image.alt=p.alt||p.label;
  });
  const drag=$('dragImage');
  drag.onload=()=>{
    if(state.selected?.key!==p.key)return;
    state.imageDimensions={width:drag.naturalWidth,height:drag.naturalHeight};
  };
  drag.onerror=()=>setMessage('This image could not load. Check its URL in Decap CMS.',true);
  createPhotoList();
  updatePreview();
}
async function loadCatalogue(keepSelection=false) {
  const query = path => fetch(`${path}?v=${Date.now()}`,{cache:'no-store'}).then(r=>{
    if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  });
  const [site,portfolio,result]=await Promise.all([
    query('content/site.json'),query('content/portfolio.json'),
    sb.from('photo_framing').select('*')
  ]);
  if(result.error)throw new Error(`Photo settings unavailable: ${result.error.message}. Run SUPABASE-PHOTO-FRAMING.sql first.`);
  const all=[];
  (site.homepage_photos||[]).slice(0,7).forEach((p,index)=>{
    if(!p.image)return;
    all.push({collection:'home',key:`home:${index+1}`,index,image:p.image,
      alt:p.alt||'',label:`Photo ${index+1}`});
  });
  (portfolio.items||[]).forEach((p,index)=>{
    if(!p.image)return;
    all.push({collection:'portfolio',key:`portfolio:${index+1}`,index,image:p.image,
      alt:p.alt||'',category:p.category||'',layout:p.layout||'normal',label:`Photo ${index+1}`});
  });
  const prevKey=keepSelection?state.selected?.key:null;
  state.frames=new Map((result.data||[]).map(row=>[row.target_key,row]));
  state.all=all;
  state.selected=null;
  state.original=null;state.draft=null;
  createPhotoList();
  if(prevKey) {
    const same=state.all.find(p=>p.key===prevKey);
    if(same)selectPhoto(same);
  }
  if(!state.selected){ $('emptyEditor').hidden=false; $('editContent').hidden=true; }
}
function panBy(dx,dy) {
  const p=state.selected, draft=state.draft, nat=state.imageDimensions;
  if(!p || !draft || !nat)return;
  const frame=$('dragFrame').getBoundingClientRect();
  if(frame.width<=0 || frame.height<=0)return;
  const zoom=draft[`${state.mode}_zoom`];
  const coverScale=Math.max(frame.width/nat.width,frame.height/nat.height)*zoom;
  const overflowX=Math.max(0,nat.width*coverScale-frame.width);
  const overflowY=Math.max(0,nat.height*coverScale-frame.height);
  const keyX=`${state.mode}_x`,keyY=`${state.mode}_y`;
  if(overflowX>0.1)draft[keyX]=round(clamp(draft[keyX]-100*dx/overflowX,0,100));
  if(overflowY>0.1)draft[keyY]=round(clamp(draft[keyY]-100*dy/overflowY,0,100));
  updatePreview();
}
function zoomTo(value) {
  if(!state.draft)return;
  state.draft[`${state.mode}_zoom`]=round(clamp(value,1,2.5),2);
  updatePreview();
}
const pointers=state.pointers;
function distance(a,b) {return Math.hypot(a.x-b.x,a.y-b.y);}
function installDrag() {
  const frame=$('dragFrame');
  frame.addEventListener('pointerdown',e=>{
    if(!state.selected)return;
    if(e.pointerType==='mouse' && e.button!==0)return;
    e.preventDefault(); frame.focus({preventScroll:true});
    try{frame.setPointerCapture(e.pointerId);}catch{}
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    frame.classList.add('dragging');
    if(pointers.size===2){
      const [a,b]=[...pointers.values()];
      state.pinch={startDistance:Math.max(distance(a,b),1),startZoom:state.draft[`${state.mode}_zoom`]};
    }
  });
  frame.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    const old=pointers.get(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>=2){
      if(!state.pinch) {
        const [a,b]=[...pointers.values()];
        state.pinch={startDistance:Math.max(distance(a,b),1),startZoom:state.draft[`${state.mode}_zoom`]};
      }
      const [a,b]=[...pointers.values()];
      zoomTo(state.pinch.startZoom*distance(a,b)/state.pinch.startDistance);
    } else panBy(e.clientX-old.x,e.clientY-old.y);
  });
  const release=e=>{
    pointers.delete(e.pointerId);
    if(pointers.size<2)state.pinch=null;
    if(!pointers.size)frame.classList.remove('dragging');
  };
  frame.addEventListener('pointerup',release);
  frame.addEventListener('pointercancel',release);
  frame.addEventListener('lostpointercapture',release);
  frame.addEventListener('keydown',e=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();
    const multiplier=e.shiftKey?18:6;
    const dx=e.key==='ArrowLeft'?-multiplier:e.key==='ArrowRight'?multiplier:0;
    const dy=e.key==='ArrowUp'?-multiplier:e.key==='ArrowDown'?multiplier:0;
    panBy(dx,dy);
  });
  frame.addEventListener('dblclick',()=>{
    if(!state.draft)return;
    state.draft[`${state.mode}_x`]=50;
    state.draft[`${state.mode}_y`]=50;
    updatePreview();
  });
}
async function save() {
  if(!state.selected || !state.draft || !hasUnsaved() || state.saving)return;
  state.saving=true;
  $('saveChanges').disabled=true;
  setMessage('Saving the desktop and phone positions…');
  const p=state.selected;
  const savedDraft={...state.draft};
  const row={target_key:p.key,image_path:p.image,...savedDraft};
  const {data,error}=await sb.from('photo_framing').upsert(row,{onConflict:'target_key'}).select().single();
  state.saving=false;
  if(error){
    markDirty();
    setMessage(`Couldn't save: ${error.message}. You must be signed in as Studio Admin.`,true);
    return;
  }
  state.frames.set(p.key,data);
  state.original={...savedDraft};
  createPhotoList();
  updatePreview();
  setMessage(hasUnsaved() ?
    'The previous position was saved. You have newer unsaved edits—save again when ready.' :
    'Saved! The new framing is live. Open the website in another tab to check it.');
}
function applyDraftInActualPage() {
  const iframe=$('actualFrame');
  let doc;
  try { doc=iframe.contentDocument; } catch { return false; }
  if(!doc || !state.selected || !state.draft)return false;
  const p=state.selected;
  const selector=p.collection==='home'?
    `[data-home-photo="${p.index+1}"]`:
    `[data-portfolio-gallery] .gallery-item:nth-child(${p.index+1}) img`;
  const img=doc.querySelector(selector);
  if(!img || !img.getAttribute('src'))return false;
  const crop=state.draft;
  for(const view of ['desktop','mobile']){
    img.style.setProperty(`--camille-${view}-x`,`${crop[`${view}_x`]}%`);
    img.style.setProperty(`--camille-${view}-y`,`${crop[`${view}_y`]}%`);
    img.style.setProperty(`--camille-${view}-zoom`,`${crop[`${view}_zoom`]}`);
  }
  img.classList.add('camille-framed-image');
  img.closest('.pixie-photo,.gallery-item')?.scrollIntoView({block:'center',inline:'nearest'});
  $('actualStatus').textContent='Viewing your photo in the actual website layout.';
  return true;
}
function displayActualPage(mode) {
  if(!state.selected)return;
  const frame=$('actualFrame');
  const phone=mode==='mobile';
  $('actualDesktop').setAttribute('aria-pressed',String(!phone));
  $('actualPhone').setAttribute('aria-pressed',String(phone));
  $('actualViewport').style.justifyContent=phone?'center':'flex-start';
  frame.style.width=phone?'390px':'1100px';
  $('actualStatus').textContent='Loading website preview…';
  const src=state.selected.collection==='home'?'index.html':'portfolio.html';
  // Disable stale preview: setting the source anew makes the website redraw
  // against its real mobile or desktop media query width.
  frame.src=src;
}
function actualPageReady() {
  let tries=0;
  const check=()=>{
    if(!$('actualPageDialog').open)return;
    if(applyDraftInActualPage())return;
    if(++tries<35)setTimeout(check,125);
    else $('actualStatus').textContent='The preview could not load. Save and open the website to inspect the change.';
  };
  setTimeout(check,160);
}

function bindControls() {
  $('tabHome').addEventListener('click',()=>{
    if(state.collection==='home' || !confirmDiscard())return;
    state.selected=null;state.draft=null;state.original=null;
    state.collection='home';createPhotoList();
    const first=state.all.find(p=>p.collection==='home'); if(first)selectPhoto(first);
  });
  $('tabPortfolio').addEventListener('click',()=>{
    if(state.collection==='portfolio' || !confirmDiscard())return;
    state.selected=null;state.draft=null;state.original=null;
    state.collection='portfolio';createPhotoList();
    const first=state.all.find(p=>p.collection==='portfolio');if(first)selectPhoto(first);
  });
  $('viewDesktop').addEventListener('click',()=>setMode('desktop'));
  $('viewMobile').addEventListener('click',()=>setMode('mobile'));
  $('quickDesktop').addEventListener('click',()=>setMode('desktop'));
  $('quickMobile').addEventListener('click',()=>setMode('mobile'));
  $('zoomRange').addEventListener('input',e=>zoomTo(Number(e.target.value)/100));
  $('zoomMinus').addEventListener('click',()=>zoomTo((state.draft?.[`${state.mode}_zoom`]||1)-.05));
  $('zoomPlus').addEventListener('click',()=>zoomTo((state.draft?.[`${state.mode}_zoom`]||1)+.05));
  for(const [id,part] of [['xRange','x'],['yRange','y']]){
    $(id).addEventListener('input',e=>{
      if(!state.draft)return;
      state.draft[`${state.mode}_${part}`]=Number(e.target.value);
      updatePreview();
    });
  }
  $('centerCurrent').addEventListener('click',()=>{
    if(!state.draft)return;
    state.draft[`${state.mode}_x`]=50;
    state.draft[`${state.mode}_y`]=50;
    state.draft[`${state.mode}_zoom`]=1;
    updatePreview();
  });
  $('copyOtherView').addEventListener('click',()=>{
    if(!state.draft)return;
    const source=state.mode==='desktop'?'mobile':'desktop';
    for(const part of ['x','y','zoom'])state.draft[`${state.mode}_${part}`]=state.draft[`${source}_${part}`];
    updatePreview();
  });
  $('saveChanges').addEventListener('click',save);
  $('showActualPage').addEventListener('click',()=>{
    if(!state.selected)return;
    $('actualPageDialog').showModal();
    displayActualPage(state.mode);
  });
  $('closeActualPage').addEventListener('click',()=>{
    $('actualPageDialog').close();
    $('actualFrame').removeAttribute('src');
  });
  $('actualFrame').addEventListener('load',actualPageReady);
  $('actualDesktop').addEventListener('click',()=>displayActualPage('desktop'));
  $('actualPhone').addEventListener('click',()=>displayActualPage('mobile'));
  $('viewOriginal').addEventListener('click',()=>{
    if(!state.selected)return;
    $('originalDialog').showModal();
  });
  $('closeOriginal').addEventListener('click',()=>$('originalDialog').close());
  $('originalDialog').addEventListener('click',e=>{if(e.target===$('originalDialog'))$('originalDialog').close();});
  $('reloadPhotos').addEventListener('click',async()=>{
    if(!confirmDiscard())return;
    $('reloadPhotos').disabled=true;
    try{await loadCatalogue(true);setMessage('Refreshed from Decap CMS and Supabase.');}
    catch(e){setMessage(e.message,true);}
    finally{$('reloadPhotos').disabled=false;}
  });
  addEventListener('beforeunload',e=>{
    if(hasUnsaved()){e.preventDefault();e.returnValue='';}
  });
  addEventListener('resize',()=>{if(state.selected)updatePreview();});
  installDrag();
}
async function boot() {
  if(!sb){display('login');$('loginMessage').textContent='Missing Supabase connection. Check client-config.js.';return;}
  const {data:{session},error}=await sb.auth.getSession();
  if(error || !session){display('login');$('signOut').hidden=true;return;}
  const {data:admin,error:roleError}=await sb.rpc('is_studio_admin');
  if(roleError || admin!==true){display('unauthorized');$('signOut').hidden=false;return;}
  if(state.authenticated && !$('mainEditor').hidden) return;
  state.authenticated=true;
  $('signOut').hidden=false;
  display('mainEditor');
  try{await loadCatalogue();}
  catch(e){
    $('emptyEditor').innerHTML='';
    const title=document.createElement('h2');title.textContent='Could not load photo editor';
    const description=document.createElement('p');description.textContent=e.message;
    $('emptyEditor').append(title,description);
  }
}
$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!sb)return;
  const email=$('loginEmail').value.trim();
  $('loginMessage').textContent='Sending your sign-in link…';
  const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:`${location.origin}/photo-manager.html`}});
  $('loginMessage').textContent=error?error.message:'Check your email for a new sign-in link. The link opens this photo manager.';
});
$('signOut').addEventListener('click',async()=>{
  if(!confirmDiscard())return;
  await sb?.auth.signOut();location.reload();
});
$('backStudioLink').addEventListener('click',e=>{
  if(!confirmDiscard())e.preventDefault();
});
bindControls();
if(sb)sb.auth.onAuthStateChange(()=>setTimeout(boot,0));
boot();
})();
