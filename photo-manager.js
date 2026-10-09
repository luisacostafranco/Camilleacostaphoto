/** Camille Acosta Photo Studio V2 — all writes require Studio Admin auth. */
import {centered, frameKeys, clone, clamp, round, importCMS, normalizeCatalogue, moveItem, photoPreview} from './photo-site-model.js';
import {optimizePhoto, prettyBytes} from './photo-optimizer.js';

const $ = id => document.getElementById(id);
const config = window.CLIENT_PORTAL_CONFIG || {};
const ready = window.supabase?.createClient && config.supabaseUrl && config.supabaseAnonKey &&
              !String(config.supabaseUrl).includes('PASTE_') && !String(config.supabaseAnonKey).includes('PASTE_');
const sb = ready ? window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey) : null;
const PUBLIC_BUCKET = 'camille-site-photos';
const ORIGINAL_BUCKET = 'camille-photo-originals';
const HOME_DESKTOP = [[190,252],[305,245],[305,160],[376,520],[305,160],[305,330],[190,252]];
const HOME_PHONE = [[177,172],[177,208],[177,136],[177,244],[177,172],[177,244],[177,172]];
const state = {
  catalogue:{home:[],portfolio:[]}, savedJSON:'', published:{home:[],portfolio:[]},
  enabled:false, revision:0, selectedId:null, collection:'home', mode:'desktop',
  imageDimensions:null,pointers:new Map(),pinch:null, undo:[],redo:[],busy:false,
  upload:{mode:null,collection:'home',index:null,file:null,processed:null},
  authenticated:false, mouseGestureStarted:false
};
const text = (id,value) => {$(id).textContent=value;};
const stringify = value => JSON.stringify(value);
const selected = () => [...state.catalogue.home,...state.catalogue.portfolio].find(p=>p.id===state.selectedId) || null;
const currentList = () => state.catalogue[state.collection];
const dirty = () => stringify(state.catalogue)!==state.savedJSON;
const n = (v, fallback) => Number.isFinite(Number(v)) ? Number(v):fallback;
const fmt = num => n(num,50)===50?'Centered':`${Math.round(n(num,50))}%`;
const safeUrl = path => {try {const u=new URL(path,location.href);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
const maxHome=7;

function view(which) {
  for(const id of ['loading','login','unauthorized','mainEditor']) $(id).hidden = id!==which;
}
function message(value,error=false) {
  text('globalMessage',value);
  $('globalMessage').style.color=error?'#9a4e44':'';
}
function messageAt(value,error=false) {
  text('saveMessage',value);
  $('saveMessage').style.color=error?'#9a4e44':'';
}
function recordUndo(){
  state.undo.push(stringify(state.catalogue));
  if(state.undo.length>45) state.undo.shift();
  state.redo=[];
}
function afterChange(msg='Unpublished edits. Save Draft to keep them, then Publish when ready.') {
  $('undoChanges').disabled=!state.undo.length;
  $('redoChanges').disabled=!state.redo.length;
  $('saveDraftTop').disabled=state.busy || !dirty();
  $('saveChanges').disabled=state.busy || !dirty();
  $('publishPhotos').disabled=state.busy || !state.catalogue.home.length;
  text('savedBadge',dirty()?'Unpublished edits':'Draft saved');
  $('savedBadge').classList.toggle('unsaved',dirty());
  $('liveStatus').classList.toggle('dirty',dirty());
  $('liveStatus').classList.toggle('live',state.enabled&&!dirty());
  text('liveStatus',!state.enabled?'CMS PHOTOS ARE CURRENTLY LIVE':dirty()?'UNPUBLISHED EDITS':'PHOTO MANAGER IS LIVE');
  if(msg)message(msg);
}
function setBusy(busy) {
  state.busy=busy;
  $('addPhoto').disabled=busy;
  ['saveDraftTop','saveChanges','publishPhotos'].forEach(id => $(id).disabled=busy);
  afterChange('');
}
function frameDimensions(photo,mode) {
  if (state.collection==='home') return (mode==='mobile'?HOME_PHONE:HOME_DESKTOP)[Math.max(0,state.catalogue.home.indexOf(photo))]||[220,240];
  if(mode==='mobile')return [350,340];
  if(photo?.layout==='tall')return [235,475];
  if(photo?.layout==='wide')return [500,230];
  return [235,230];
}
function applyCover(img,photo,mode) {
  if(!img || !photo)return;
  const x=n(photo[`${mode}_x`],50),y=n(photo[`${mode}_y`],50),zoom=n(photo[`${mode}_zoom`],1);
  img.style.objectPosition=`${x}% ${y}%`;
  img.style.transformOrigin=`${x}% ${y}%`;
  img.style.transform=`scale(${zoom})`;
}
function setMode(mode){if(!selected())return;state.mode=mode;updatePreview();}
function setImage(img,src){
  const url=safeUrl(src);
  if(url && img.src!==url)img.src=url;
  if(!url)img.removeAttribute('src');
}
function updatePreview() {
  const p=selected();if(!p)return;
  const mode=state.mode;
  const dims=frameDimensions(p,mode),aspect=dims[0]/dims[1];
  const stageWidth=$('dragFrame').parentElement.clientWidth || 400;
  const cap=mode==='mobile'?320:510;
  const width=clamp(Math.min(cap,Math.max(100,stageWidth-15),480*aspect),95,cap);
  $('dragFrame').style.width=`${width}px`;
  $('dragFrame').style.aspectRatio=`${dims[0]}/${dims[1]}`;
  applyCover($('dragImage'),p,mode);
  text('frameShape',`${mode==='mobile'?'Phone':'Desktop'} website frame · Drag on the photo`);
  for(const view of ['desktop','mobile']){
    const a=frameDimensions(p,view),mini=$(view==='desktop'?'desktopMini':'mobileMini');
    mini.style.aspectRatio=`${a[0]}/${a[1]}`;
    mini.style.maxWidth=a[0]/a[1]<.8?'125px':'205px';
    applyCover($(view==='desktop'?'desktopMiniImage':'mobileMiniImage'),p,view);
  }
  $('viewDesktop').setAttribute('aria-selected',String(mode==='desktop'));
  $('viewMobile').setAttribute('aria-selected',String(mode==='mobile'));
  $('quickDesktop').classList.toggle('active',mode==='desktop');
  $('quickMobile').classList.toggle('active',mode==='mobile');
  const zoom=n(p[`${mode}_zoom`],1);
  $('zoomRange').value=String(Math.round(zoom*100));
  $('xRange').value=String(n(p[`${mode}_x`],50));
  $('yRange').value=String(n(p[`${mode}_y`],50));
  text('zoomValue',`${Math.round(zoom*100)}%`);
  text('xValue',fmt(p[`${mode}_x`]));
  text('yValue',fmt(p[`${mode}_y`]));
  text('copyOtherView',mode==='desktop'?'COPY PHONE POSITION TO DESKTOP':'COPY DESKTOP POSITION TO PHONE');
  afterChange('');
}
function selectPhoto(id) {
  state.selectedId=id;
  const p=selected();
  if(!p) {
    $('emptyEditor').hidden=false;
    $('editContent').hidden=true;
    drawList();return;
  }
  $('emptyEditor').hidden=true;
  $('editContent').hidden=false;
  state.imageDimensions=null;
  state.mode='desktop';
  const list=state.catalogue.home.some(x=>x.id===id)?'home':'portfolio';
  state.collection=list;
  const index=state.catalogue[list].findIndex(x=>x.id===id);
  text('slotLabel',`${list==='home'?'Homepage':'Portfolio'} / Photo ${index+1}`);
  text('photoTitle',p.alt || `Photo ${index+1}`);
  $('viewOnSite').href=list==='home'?'index.html':'portfolio.html';
  $('portfolioDetails').hidden=list==='home';
  $('photoAlt').value=p.alt||'';
  $('photoCategory').value=p.category||'portraits';
  $('photoLayout').value=p.layout||'normal';
  const img=$('dragImage');
  img.onload=()=>{if(selected()?.id===id)state.imageDimensions={width:img.naturalWidth,height:img.naturalHeight};};
  img.onerror=()=>messageAt('This photo could not load. Try replacing the file.',true);
  for(const name of ['dragImage','desktopMiniImage','mobileMiniImage','originalImage']) {
    setImage($(name),p.image);
    $(name).alt=p.alt||'Camille Acosta Photography';
  }
  drawList();updatePreview();
  messageAt('Drag to adjust. Save Draft when you like it, then Publish.');
}
function drawList(){
  text('homeCount',String(state.catalogue.home.length));
  text('portfolioCount',String(state.catalogue.portfolio.length));
  $('tabHome').setAttribute('aria-selected',String(state.collection==='home'));
  $('tabPortfolio').setAttribute('aria-selected',String(state.collection==='portfolio'));
  text('listDescription',state.collection==='home'?
    `Homepage: ${state.catalogue.home.length}/7 photos. Drag a card to reorder; use arrows on phones.`:
    `${state.catalogue.portfolio.length} portfolio photos. Drag to reorder or use the arrows.`);
  const parent=$('photoList');parent.replaceChildren();
  const list=currentList();
  const count=state.collection==='home'?7:list.length;
  for(let i=0;i<count;i++){
    const p=list[i];
    const wrap=document.createElement('div');
    wrap.className='pm-photo-entry';wrap.draggable=!!p;
    wrap.dataset.index=String(i);
    wrap.setAttribute('aria-selected',String(!!p&&p.id===state.selectedId));
    const b=document.createElement('button');b.type='button';b.className='pm-photo-option';
    b.setAttribute('aria-label',p?`Edit photo ${i+1}`:`Add photo to homepage position ${i+1}`);
    if(p){
      const img=document.createElement('img');img.alt=p.alt||'Website photo';
      img.loading='lazy';img.decoding='async';setImage(img,photoPreview(p));
      applyCover(img,p,'desktop');
      const meta=document.createElement('span');meta.className='pm-photo-option-info';
      const label=document.createElement('strong');label.textContent=`PHOTO ${i+1}`;
      const sub=document.createElement('small');sub.textContent=p.alt || p.category || 'Drag to reorder';
      meta.append(label,sub);b.append(img,meta);
      b.onclick=()=>{
        selectPhoto(p.id);
        if(matchMedia('(max-width: 760px)').matches) $('editPanel').scrollIntoView({behavior:'smooth',block:'start'});
      };
    }else {
      const empty=document.createElement('span');empty.className='pm-photo-empty';
      empty.textContent='+ ADD PHOTO';b.append(empty);
      b.onclick=()=>openUploader('add',state.collection,i);
    }
    wrap.appendChild(b);
    if(p){
      const row=document.createElement('div');row.className='pm-card-move';
      for(const [arrow,diff,label] of [['↑',-1,'Move earlier'],['↓',1,'Move later']]){
        const btn=document.createElement('button');btn.type='button';btn.textContent=arrow;btn.title=label;
        btn.setAttribute('aria-label',`${label}: photo ${i+1}`);
        btn.disabled=(i+diff<0||i+diff>=list.length);
        btn.onclick=()=>movePhoto(state.collection,i,i+diff);
        row.appendChild(btn);
      }
      wrap.appendChild(row);
      wrap.addEventListener('dragstart',e=>{
        e.dataTransfer.effectAllowed='move';
        e.dataTransfer.setData('text/plain',`${state.collection}:${i}`);
      });
      wrap.addEventListener('dragover',e=>{
        if(e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/plain')){
          e.preventDefault();wrap.classList.add('drag-target');
        }
      });
      wrap.addEventListener('dragleave',()=>wrap.classList.remove('drag-target'));
      wrap.addEventListener('drop',e=>{
        e.preventDefault();wrap.classList.remove('drag-target');
        if(e.dataTransfer.files?.length){
          openUploader('replace',state.collection,i);
          processFile(e.dataTransfer.files[0]);return;
        }
        const [collection,start]=String(e.dataTransfer.getData('text/plain')||'').split(':');
        if(collection===state.collection)movePhoto(collection,Number(start),i);
      });
    }
    parent.appendChild(wrap);
  }
  if(state.collection==='portfolio'){
    const add=document.createElement('button');add.type='button';add.className='pm-photo-option';
    add.innerHTML='<span class="pm-photo-empty">+ ADD PHOTO</span>';
    add.onclick=()=>openUploader('add','portfolio');
    parent.appendChild(add);
  }
}
function movePhoto(collection,from,to){
  recordUndo();
  if(!moveItem(state.catalogue,collection,from,to)){state.undo.pop();return;}
  drawList();
  updatePreview();
  afterChange('Photo moved. Save Draft, then Publish when ready.');
}
function mutateSelected(fn,record=true){
  const p=selected();if(!p)return;
  if(record)recordUndo();
  fn(p);
  updatePreview();
  afterChange('Photo adjustment is ready to save.');
}
function zoomTo(val){mutateSelected(p=>p[`${state.mode}_zoom`]=round(clamp(val,1,2.5),2),false);}
function panBy(dx,dy){
  const p=selected(),dim=state.imageDimensions;
  if(!p||!dim)return;
  const frame=$('dragFrame').getBoundingClientRect();
  if(!frame.width || !frame.height)return;
  const cover=Math.max(frame.width/dim.width,frame.height/dim.height)*n(p[`${state.mode}_zoom`],1);
  const overflowX=Math.max(0,dim.width*cover-frame.width);
  const overflowY=Math.max(0,dim.height*cover-frame.height);
  if(overflowX>.1)p[`${state.mode}_x`]=round(clamp(n(p[`${state.mode}_x`],50)-100*dx/overflowX,0,100));
  if(overflowY>.1)p[`${state.mode}_y`]=round(clamp(n(p[`${state.mode}_y`],50)-100*dy/overflowY,0,100));
  updatePreview();
}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function installDrag(){
  const frame=$('dragFrame');
  frame.addEventListener('pointerdown',e=>{
    if(!selected() || (e.pointerType==='mouse'&&e.button!==0))return;
    e.preventDefault();
    if(!state.pointers.size)recordUndo();
    frame.focus({preventScroll:true});
    try{frame.setPointerCapture(e.pointerId);}catch{}
    state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    frame.classList.add('dragging');
    if(state.pointers.size===2){
      const [a,b]=[...state.pointers.values()];
      state.pinch={initialDistance:Math.max(distance(a,b),1),zoom:n(selected()[`${state.mode}_zoom`],1)};
    }
  });
  frame.addEventListener('pointermove',e=>{
    if(!state.pointers.has(e.pointerId))return;
    const before=state.pointers.get(e.pointerId);
    state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(state.pointers.size===2){
      const [a,b]=[...state.pointers.values()];
      if(state.pinch)zoomTo(state.pinch.zoom*distance(a,b)/state.pinch.initialDistance);
    }else panBy(e.clientX-before.x,e.clientY-before.y);
  });
  const release=e=>{
    state.pointers.delete(e.pointerId);
    if(state.pointers.size<2)state.pinch=null;
    if(!state.pointers.size)frame.classList.remove('dragging');
  };
  for(const name of ['pointerup','pointercancel','lostpointercapture']) frame.addEventListener(name,release);
  frame.addEventListener('keydown',e=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();recordUndo();
    const dx=e.key==='ArrowLeft'?-12:e.key==='ArrowRight'?12:0;
    const dy=e.key==='ArrowUp'?-12:e.key==='ArrowDown'?12:0;
    panBy(dx,dy);
  });
  frame.addEventListener('dblclick',()=>mutateSelected(p=>{
    p[`${state.mode}_x`]=50;p[`${state.mode}_y`]=50;
  }));
}

async function loadSavedState() {
  if(!sb)throw new Error('Missing Supabase configuration');
  const {data,error}=await sb.rpc('photo_site_editor_get');
  if(error)throw new Error(`${error.message} — did you run SUPABASE-PHOTO-STUDIO-V2.sql?`);
  state.catalogue=normalizeCatalogue(data.draft);
  state.published=normalizeCatalogue(data.published);
  state.savedJSON=stringify(state.catalogue);
  state.revision=Number(data.revision||0);
  state.enabled=data.enabled===true;
  state.undo=[];state.redo=[];
  $('importBanner').hidden=state.catalogue.home.length>0 || state.catalogue.portfolio.length>0;
  if(!state.selectedId || !selected())state.selectedId=state.catalogue.home[0]?.id||state.catalogue.portfolio[0]?.id||null;
  drawList();selectPhoto(state.selectedId);
  afterChange(state.enabled?'Photo Manager is live. Edit and publish changes whenever you like.':
    'Decap photos are still live. Import, adjust and publish when ready.');
}
async function importDecap(){
  if((state.catalogue.home.length||state.catalogue.portfolio.length) &&
     !confirm('Replace your current UNPUBLISHED draft with the photos in Decap? This will not change the live site until you publish.'))return;
  if(state.busy)return;
  setBusy(true);message('Importing the latest Decap photographs and saved framing…');
  try {
    const get=async path=>{
      const r=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)throw new Error(`Could not read ${path} (${r.status})`);
      return r.json();
    };
    const [site,portfolio,framing]=await Promise.all([
      get('content/site.json'),get('content/portfolio.json'),
      sb.from('photo_framing').select('*')
    ]);
    if(framing.error)throw framing.error;
    recordUndo();
    state.catalogue=importCMS(site,portfolio,framing.data||[]);
    state.selectedId=state.catalogue.home[0]?.id||state.catalogue.portfolio[0]?.id||null;
    $('importBanner').hidden=true;
    drawList();selectPhoto(state.selectedId);
    message('Imported! Your live website is unchanged. Save Draft, preview, then Publish.');
  } catch(e){message(`Import failed: ${e.message}`,true);}
  finally {setBusy(false);}
}

async function saveDraft() {
  if(state.busy)return false;
  if(!dirty())return true;
  setBusy(true);
  message('Securely saving your private draft…');
  const payload=clone(state.catalogue);
  const {data,error}=await sb.rpc('photo_site_save_draft',{
    p_data:payload,p_expected_revision:state.revision
  });
  setBusy(false);
  if(error){message(`Could not save draft: ${error.message}`,true);return false;}
  state.revision=Number(data.revision);
  state.savedJSON=stringify(payload);
  afterChange('Draft saved! Visitors still see the previously published pictures until you click Publish.');
  messageAt('Draft saved. Publish when you like the whole page.');
  return true;
}
async function publishPhotos() {
  if(state.busy)return;
  if(!state.catalogue.home.length){message('Add at least one homepage photo before publishing.',true);return;}
  if(dirty()) {
    const okay=await saveDraft();if(!okay)return;
  }
  if(!confirm('Publish these homepage and portfolio photos now? Website visitors will see all changes together.'))return;
  setBusy(true);message('Publishing website photos…');
  const {data,error}=await sb.rpc('photo_site_publish',{p_expected_revision:state.revision});
  setBusy(false);
  if(error){message(`Publish failed: ${error.message}`,true);return;}
  state.revision=Number(data.revision);
  state.enabled=true;
  state.published=clone(state.catalogue);
  afterChange('Published successfully! The homepage and portfolio now use these photos. Refresh the public pages to check.');
  messageAt('Published. Your desktop and phone framing is now live.');
}
async function restorePrevious(){
  if(state.busy)return;
  if(dirty() && !confirm('You have unsaved edits. Restoring the prior published version will replace them. Continue?'))return;
  if(!confirm('Restore the previous published collection, including image order and both crop views?'))return;
  setBusy(true);
  const {data,error}=await sb.rpc('photo_site_restore_previous',{p_expected_revision:state.revision});
  setBusy(false);
  if(error){message(error.message,true);return;}
  state.revision=Number(data.revision);
  state.catalogue=normalizeCatalogue(data.published);
  state.published=clone(state.catalogue);
  state.savedJSON=stringify(state.catalogue);
  state.selectedId=null;
  state.undo=[];state.redo=[];
  drawList();selectPhoto(state.catalogue.home[0]?.id||state.catalogue.portfolio[0]?.id||null);
  afterChange('Restored the previous published version. Changes are live.');
}
async function emergencyFallback(){
  if(!confirm('Emergency fallback: show the old Decap photo selections publicly again? Your Photo Manager draft and saved photos will be kept.'))return;
  if(state.busy)return;
  setBusy(true);
  const {data,error}=await sb.rpc('photo_site_use_decap_fallback',{p_expected_revision:state.revision});
  setBusy(false);
  if(error){message(error.message,true);return;}
  state.enabled=false;state.revision++;
  afterChange('Emergency fallback enabled: public homepage and portfolio use Decap photos again.');
}
function undo(){
  if(!state.undo.length)return;
  state.redo.push(stringify(state.catalogue));
  state.catalogue=normalizeCatalogue(JSON.parse(state.undo.pop()));
  if(!selected())state.selectedId=state.catalogue.home[0]?.id||state.catalogue.portfolio[0]?.id||null;
  selectPhoto(state.selectedId);afterChange('Undo applied. Save Draft when ready.');
}
function redo(){
  if(!state.redo.length)return;
  state.undo.push(stringify(state.catalogue));
  state.catalogue=normalizeCatalogue(JSON.parse(state.redo.pop()));
  if(!selected())state.selectedId=state.catalogue.home[0]?.id||state.catalogue.portfolio[0]?.id||null;
  selectPhoto(state.selectedId);afterChange('Redo applied. Save Draft when ready.');
}

function resetUpload(){
  const u=state.upload;
  if(u.processed) {
    URL.revokeObjectURL(u.processed.previewURL);
    URL.revokeObjectURL(u.processed.thumbnailURL);
  }
  state.upload={mode:null,collection:'home',index:null,file:null,processed:null};
  $('uploadPreviewWrap').hidden=true;
  $('confirmUpload').disabled=true;
  $('changeUpload').hidden=true;
  text('uploadMessage','');
  $('uploadInput').value='';
  $('keepOriginal').checked=false;
}
function openUploader(mode,collection=state.collection,index=null){
  if(state.busy)return;
  if(mode==='add' && collection==='home' && state.catalogue.home.length>=maxHome){
    message('The homepage has seven positions. Replace or remove one before adding another.',true);return;
  }
  resetUpload();
  state.upload.mode=mode;
  state.upload.collection=collection;
  state.upload.index=index;
  text('uploadTitle',mode==='replace'?'Replace this photograph':'Add a website photograph');
  $('uploadDialog').showModal();
}
async function processFile(file){
  if(!file || !state.upload.mode)return;
  const u=state.upload;
  if(u.processed){
    URL.revokeObjectURL(u.processed.previewURL);
    URL.revokeObjectURL(u.processed.thumbnailURL);
  }
  u.file=file;
  u.processed=null;
  $('confirmUpload').disabled=true;
  $('uploadPreviewWrap').hidden=true;
  text('uploadMessage','Optimizing your image on this device…');
  try {
    const result=await optimizePhoto(file);
    if(u !== state.upload){URL.revokeObjectURL(result.previewURL);URL.revokeObjectURL(result.thumbnailURL);return;}
    u.processed=result;
    $('uploadPreviewImage').src=result.previewURL;
    $('uploadPreviewWrap').hidden=false;
    text('uploadStats',`${prettyBytes(file.size)} original → ${prettyBytes(result.savedBytes)} WebP (${result.width} × ${result.height}). A 1200px mobile version and 560px thumbnail are included.`);
    $('changeUpload').hidden=false;
    $('confirmUpload').disabled=false;
    text('uploadMessage','Ready! Click Use This Photo, then drag it into place and preview.');
  }catch(err){text('uploadMessage',err.message);}
}
async function put(bucket,path,blob,type){
  const {error}=await sb.storage.from(bucket).upload(path,blob,{
    cacheControl:'31536000',upsert:false,contentType:type
  });
  if(error)throw new Error(`${bucket}: ${error.message}`);
  return path;
}
function publicPhotoURL(path){
  return sb.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
}
async function confirmUpload(){
  const u=state.upload;
  if(!u.processed || state.busy)return;
  state.busy=true;
  $('confirmUpload').disabled=true;
  $('cancelUpload').disabled=true;
  text('uploadMessage','Uploading the optimized photo…');
  try {
    const token=crypto.randomUUID();
    const mainPath=`optimized/${token}.webp`;
    const mediumPath=`mobile/${token}.webp`;
    const thumbPath=`thumbnails/${token}.webp`;
    await put(PUBLIC_BUCKET,mainPath,u.processed.optimized,'image/webp');
    text('uploadMessage','Creating fast mobile and thumbnail versions…');
    await put(PUBLIC_BUCKET,mediumPath,u.processed.medium,'image/webp');
    await put(PUBLIC_BUCKET,thumbPath,u.processed.thumbnail,'image/webp');
    let originalPath=null;
    if($('keepOriginal').checked){
      text('uploadMessage','Saving the full original privately…');
      const kind=(u.file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
      originalPath=`originals/${token}.${kind}`;
      await put(ORIGINAL_BUCKET,originalPath,u.file,u.file.type);
    }
    const existing=u.mode==='replace'?currentList()[u.index ?? currentList().findIndex(p=>p.id===state.selectedId)]:null;
    const p={
      ...(existing?clone(existing):{id:crypto.randomUUID(),alt:'',category:'portraits',layout:'normal'}),
      image:publicPhotoURL(mainPath),medium:publicPhotoURL(mediumPath),
      thumb:publicPhotoURL(thumbPath),file_path:mainPath,thumb_path:thumbPath,
      original_path:originalPath, file_size:u.processed.optimized.size,
      width:u.processed.width,medium_width:u.processed.medium_width,thumb_width:u.processed.thumb_width,
      alt:'', ...centered()
    };
    // Changing a photo resets both device crops. Reposition in the editor.
    recordUndo();
    const collection=u.collection;
    if(u.mode==='replace') {
      let index=u.index;
      if(index===null || index===undefined)index=state.catalogue[collection].findIndex(x=>x.id===state.selectedId);
      if(index<0)throw new Error('Original photo no longer selected. Please try again.');
      state.catalogue[collection][index]=p;
    }else if(collection==='home') {
      state.catalogue.home.splice(u.index===null?state.catalogue.home.length:u.index,0,p);
    }else state.catalogue.portfolio.push(p);
    state.selectedId=p.id;state.collection=collection;
    $('uploadDialog').close();resetUpload();
    drawList();selectPhoto(p.id);
    afterChange('Uploaded! Drag the new photo into position on Desktop and Phone. Save Draft, then Publish.');
    if(matchMedia('(max-width:760px)').matches)$('editPanel').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){text('uploadMessage',`Upload failed: ${e.message}. Your public website is unchanged.`);}
  finally{state.busy=false;$('confirmUpload').disabled=!state.upload.processed;$('cancelUpload').disabled=false;afterChange('');}
}
async function showOriginal(){
  const p=selected();if(!p)return;
  let url=p.image;
  if(p.original_path){
    const {data,error}=await sb.storage.from(ORIGINAL_BUCKET).createSignedUrl(p.original_path,300);
    if(!error && data?.signedUrl)url=data.signedUrl;
    else messageAt('Original not available; showing optimized picture.',true);
  }
  setImage($('originalImage'),url);
  $('originalDialog').showModal();
}

function previewActual() {
  if(!selected())return;
  $('actualPageDialog').showModal();
  openActualFrame(state.mode);
}
function openActualFrame(mode){
  const frame=$('actualFrame'),phone=mode==='mobile';
  $('actualDesktop').setAttribute('aria-pressed',String(!phone));
  $('actualPhone').setAttribute('aria-pressed',String(phone));
  frame.style.width=phone?'390px':'1100px';
  $('actualViewport').style.justifyContent=phone?'center':'flex-start';
  text('actualStatus','Loading the real page layout…');
  frame.src=state.collection==='home'?'index.html':'portfolio.html';
}
function cssFrame(img,p){
  for(const mode of ['desktop','mobile']){
    img.style.setProperty(`--camille-${mode}-x`,`${n(p[`${mode}_x`],50)}%`);
    img.style.setProperty(`--camille-${mode}-y`,`${n(p[`${mode}_y`],50)}%`);
    img.style.setProperty(`--camille-${mode}-zoom`,String(n(p[`${mode}_zoom`],1)));
  }
  img.classList.add('camille-framed-image');
}
function applyActualPreview(){
  let doc;
  try{doc=$('actualFrame').contentDocument;}catch{return false;}
  if(!doc)return false;
  const collection=state.collection,all=state.catalogue[collection];
  if(collection==='home'){
    const nodes=Array.from(doc.querySelectorAll('[data-home-photo]'));
    if(nodes.length<7)return false;
    nodes.forEach((img,i)=>{
      const p=all[i],b=img.closest('.pixie-photo');
      if(!p){img.removeAttribute('src');if(b)b.style.display='none';return;}
      if(b)b.style.display='';
      img.src=p.image;img.alt=p.alt||'Photo';cssFrame(img,p);
    });
    const collage=doc.querySelector('.pixie-collage');
    collage?.classList.remove('cms-photo-pending');
    collage?.classList.toggle('pm-reduced',all.length<7);
  }else{
    const gallery=doc.querySelector('[data-portfolio-gallery]');
    if(!gallery)return false;
    gallery.replaceChildren();
    all.forEach(p=>{
      const b=doc.createElement('button');
      b.className=`gallery-item ${p.category||'portraits'} ${p.layout==='normal'?'':p.layout}`;
      const img=doc.createElement('img');img.src=p.image;img.alt=p.alt||'Photography';cssFrame(img,p);
      b.append(img);gallery.append(b);
    });
  }
  text('actualStatus','Previewing your current draft, including photos you have not published.');
  return true;
}
function actualReady(){
  let attempts=0;
  const check=()=>{
    if(!$('actualPageDialog').open)return;
    if(applyActualPreview())return;
    if(++attempts<45)setTimeout(check,125);
    else text('actualStatus','Preview could not load. Save Draft and inspect the live website after publishing.');
  };
  setTimeout(check,130);
}

function bindControls(){
  for(const [tab,collection] of [['tabHome','home'],['tabPortfolio','portfolio']]){
    $(tab).addEventListener('click',()=>{
      state.collection=collection;
      const first=state.catalogue[collection][0];
      selectPhoto(first?.id||null);
    });
  }
  for(const [id,mode] of [['viewDesktop','desktop'],['viewMobile','mobile'],['quickDesktop','desktop'],['quickMobile','mobile']]){
    $(id).addEventListener('click',()=>setMode(mode));
  }
  const gestureStart=()=>{if(selected())recordUndo();};
  for(const id of ['zoomRange','xRange','yRange'])$(id).addEventListener('pointerdown',gestureStart);
  $('zoomRange').addEventListener('input',e=>zoomTo(Number(e.target.value)/100));
  $('zoomMinus').addEventListener('click',()=>{recordUndo();zoomTo(n(selected()?.[`${state.mode}_zoom`],1)-.05);});
  $('zoomPlus').addEventListener('click',()=>{recordUndo();zoomTo(n(selected()?.[`${state.mode}_zoom`],1)+.05);});
  for(const [id,key] of [['xRange','x'],['yRange','y']]){
    $(id).addEventListener('input',e=>mutateSelected(p=>{p[`${state.mode}_${key}`]=Number(e.target.value);},false));
  }
  $('centerCurrent').addEventListener('click',()=>mutateSelected(p=>{
    p[`${state.mode}_x`]=50;p[`${state.mode}_y`]=50;p[`${state.mode}_zoom`]=1;
  }));
  $('copyOtherView').addEventListener('click',()=>mutateSelected(p=>{
    const source=state.mode==='desktop'?'mobile':'desktop';
    for(const key of ['x','y','zoom'])p[`${state.mode}_${key}`]=p[`${source}_${key}`];
  }));
  $('photoAlt').addEventListener('focus',gestureStart);
  $('photoAlt').addEventListener('blur',drawList);
  $('photoAlt').addEventListener('input',e=>{
    const p=selected();if(!p)return;
    p.alt=e.target.value;text('photoTitle',p.alt||'Selected photo');afterChange('Photo description updated.');
  });
  for(const [id,key] of [['photoCategory','category'],['photoLayout','layout']]){
    $(id).addEventListener('change',e=>{
      mutateSelected(p=>{p[key]=e.target.value;});drawList();
    });
  }
  $('addPhoto').addEventListener('click',()=>openUploader('add'));
  $('replacePhoto').addEventListener('click',()=>{
    const p=selected();if(!p)return;
    const index=state.catalogue[state.collection].findIndex(x=>x.id===p.id);
    openUploader('replace',state.collection,index);
  });
  $('removePhoto').addEventListener('click',()=>{
    const p=selected();if(!p)return;
    if(!confirm('Remove this photo from the unpublished website draft? It stays in Storage and any currently published site until you click Publish.'))return;
    recordUndo();
    const arr=currentList(),idx=arr.findIndex(x=>x.id===p.id);
    if(idx>=0)arr.splice(idx,1);
    selectPhoto(arr[idx]?.id||arr[idx-1]?.id||null);
    afterChange('Photo removed from draft. Save and Publish when ready. It is not deleted from Storage.');
  });
  $('undoChanges').addEventListener('click',undo);
  $('redoChanges').addEventListener('click',redo);
  $('saveDraftTop').addEventListener('click',saveDraft);
  $('saveChanges').addEventListener('click',saveDraft);
  $('publishPhotos').addEventListener('click',publishPhotos);
  $('restorePublished').addEventListener('click',restorePrevious);
  $('useCMS').addEventListener('click',emergencyFallback);
  $('discardDraft').addEventListener('click',()=>{
    if(!dirty())return;
    if(!confirm('Discard only the edits not yet saved to Supabase?'))return;
    state.catalogue=normalizeCatalogue(JSON.parse(state.savedJSON));
    state.undo=[];state.redo=[];
    state.selectedId=null;
    selectPhoto(state.catalogue.home[0]?.id||state.catalogue.portfolio[0]?.id||null);
    afterChange('Unpublished edits discarded. Saved draft remains.');
  });
  $('reloadPhotos').addEventListener('click',async()=>{
    if(dirty()&&!confirm('Reload your saved draft? Unsaved edits will be discarded.'))return;
    try{await loadSavedState();}catch(e){message(e.message,true);}
  });
  $('importCurrent').addEventListener('click',importDecap);
  $('showActualPage').addEventListener('click',previewActual);
  $('actualFrame').addEventListener('load',actualReady);
  $('actualDesktop').addEventListener('click',()=>openActualFrame('desktop'));
  $('actualPhone').addEventListener('click',()=>openActualFrame('mobile'));
  $('closeActualPage').addEventListener('click',()=>{
    $('actualPageDialog').close();$('actualFrame').removeAttribute('src');
  });
  $('viewOriginal').addEventListener('click',showOriginal);
  $('closeOriginal').addEventListener('click',()=>$('originalDialog').close());
  $('originalDialog').addEventListener('click',e=>{if(e.target===$('originalDialog'))$('originalDialog').close();});

  const dropZone=$('dropZone');
  dropZone.addEventListener('click',e=>{if(e.target!==$('browsePhotos'))$('uploadInput').click();});
  $('browsePhotos').addEventListener('click',e=>{e.stopPropagation();$('uploadInput').click();});
  dropZone.addEventListener('keydown',e=>{
    if(e.key==='Enter' || e.key===' '){e.preventDefault();$('uploadInput').click();}
  });
  dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('is-dragover');});
  dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('is-dragover'));
  dropZone.addEventListener('drop',e=>{
    e.preventDefault();dropZone.classList.remove('is-dragover');
    if(e.dataTransfer?.files?.[0])processFile(e.dataTransfer.files[0]);
  });
  $('uploadInput').addEventListener('change',e=>{if(e.target.files?.[0])processFile(e.target.files[0]);});
  $('changeUpload').addEventListener('click',()=>$('uploadInput').click());
  $('confirmUpload').addEventListener('click',confirmUpload);
  $('cancelUpload').addEventListener('click',()=>{$('uploadDialog').close();resetUpload();});
  $('uploadDialog').addEventListener('close',()=>{if(!state.busy)resetUpload();});
  // Allow dragging a photo file onto the editor itself to replace the selection.
  $('dragFrame').addEventListener('dragover',e=>{
    if(e.dataTransfer?.types.includes('Files'))e.preventDefault();
  });
  $('dragFrame').addEventListener('drop',e=>{
    if(!e.dataTransfer?.files?.length)return;
    e.preventDefault();
    const p=selected();if(!p)return;
    openUploader('replace',state.collection,currentList().findIndex(x=>x.id===p.id));
    processFile(e.dataTransfer.files[0]);
  });
  window.addEventListener('beforeunload',e=>{
    if(dirty() && !state.busy){e.preventDefault();e.returnValue='';}
  });
  window.addEventListener('resize',()=>{if(selected())updatePreview();});
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey) && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){
      if(e.key.toLowerCase()==='z'){
        e.preventDefault();e.shiftKey?redo():undo();
      }
    }
  });
  installDrag();
}

async function boot(){
  if(!sb){view('login');text('loginMessage','Check client-config.js. Photo Studio needs the existing Supabase connection.');return;}
  const {data:{session},error}=await sb.auth.getSession();
  if(error || !session){view('login');$('signOut').hidden=true;state.authenticated=false;return;}
  const {data:allowed,error:roleError}=await sb.rpc('is_studio_admin');
  if(roleError || allowed!==true){view('unauthorized');$('signOut').hidden=false;return;}
  if(state.authenticated && !$('mainEditor').hidden)return;
  state.authenticated=true;
  $('signOut').hidden=false;
  view('mainEditor');
  try{await loadSavedState();}
  catch(e){message(`Couldn't load the Photo Studio: ${e.message}`,true);}
}
$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!sb)return;
  text('loginMessage','Sending your private Studio Admin sign-in link…');
  const {error}=await sb.auth.signInWithOtp({
    email:$('loginEmail').value.trim(),
    options:{emailRedirectTo:`${location.origin}/photo-manager.html`}
  });
  text('loginMessage',error?error.message:'Check your email for a new sign-in link.');
});
$('signOut').addEventListener('click',async()=>{
  if(dirty()&&!confirm('Sign out and discard unsaved edits?'))return;
  await sb?.auth.signOut();location.reload();
});
$('backStudioLink').addEventListener('click',e=>{
  if(dirty()&&!confirm('Leave without saving draft edits?'))e.preventDefault();
});
bindControls();
if(sb)sb.auth.onAuthStateChange(()=>setTimeout(boot,0));
boot();
