/** Private visual website editor. Never exposes draft content to public database roles. */
import {normalizeWebsite,normalizeSite,FALLBACK_CATEGORIES,clone,safeCategorySlug} from './website-public.js';
const $=id=>document.getElementById(id);
const cfg=window.CLIENT_PORTAL_CONFIG||{};
const usable=window.supabase?.createClient&&cfg.supabaseUrl&&cfg.supabaseAnonKey&&!String(cfg.supabaseUrl).includes('PASTE_');
const sb=usable?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
const state={data:null,saved:null,published:null,revision:0,enabled:false,activeTab:'homepage',busy:false,undo:[],isAuthed:false,previewPage:'index.html',previewPhone:false};
const str=o=>JSON.stringify(o);
const dirty=()=>state.data&&str(state.data)!==str(state.saved);
const tell=(message,error=false)=>{const el=$('weMessage');el.textContent=message;el.style.color=error?'#9a4e44':'';};
const pathGet=(obj,path)=>path.split('.').reduce((o,key)=>o?.[key],obj);
function pathSet(obj,path,value){const parts=path.split('.');let at=obj;while(parts.length>1){const key=parts.shift();at[key] ||= {};at=at[key];}at[parts[0]]=value;}
function undoPush(){if(!state.data)return;state.undo.push(str(state.data));if(state.undo.length>65)state.undo.shift();}
function refreshButtons(){
  const changed=!!dirty();const hasDraft=!!state.data;
  for(const id of ['weSaveTop','weSaveBottom'])$(id).disabled=state.busy||!changed;
  for(const id of ['wePublishTop','wePublishBottom'])$(id).disabled=state.busy||!hasDraft;
  $('weUndo').disabled=!state.undo.length||state.busy;
  $('weBadge').textContent=!state.enabled?'DECAP TEXT CURRENTLY LIVE':changed?'UNSAVED DRAFT EDITS':'STUDIO EDITOR IS LIVE';
  $('wePublication').textContent=state.enabled?'Publish again to share any new edits':'Nothing is live from this editor until you publish';
}
function changed(message='Unpublished changes. Save Draft, then Publish when ready.'){refreshButtons();tell(message);}
function showPage(which){for(const id of ['weLoading','weLogin','weUnauthorized','weEditor'])$(id).hidden=id!==which;}
function activateTab(name){
  state.activeTab=name;
  document.querySelectorAll('[data-we-tab]').forEach(btn=>{btn.classList.toggle('current',btn.dataset.weTab===name);btn.setAttribute('aria-current',String(btn.dataset.weTab===name));});
  document.querySelectorAll('[data-we-panel]').forEach(panel=>panel.hidden=panel.dataset.wePanel!==name);
}
function repeatButtons(index,total,onMove,onRemove){
  const actions=document.createElement('div');actions.className='we-repeat-actions';
  for(const [txt,dir,title] of [['↑',-1,'Move earlier'],['↓',1,'Move later']]){
    const b=document.createElement('button');b.type='button';b.textContent=txt;b.title=title;b.setAttribute('aria-label',title);
    b.disabled=index+dir<0||index+dir>=total;
    b.addEventListener('click',()=>onMove(dir));actions.append(b);
  }
  const remove=document.createElement('button');remove.type='button';remove.textContent='REMOVE';remove.className='remove';
  remove.addEventListener('click',onRemove);actions.append(remove);return actions;
}
function renderFAQs(){
  const list=$('weFAQList');list.replaceChildren();
  state.data.site.faq.forEach((item,index,arr)=>{
    const card=document.createElement('article');card.className='we-repeat-card';
    const top=document.createElement('div');top.className='we-repeat-heading';
    const name=document.createElement('strong');name.textContent=`QUESTION ${index+1}`;
    top.append(name,repeatButtons(index,arr.length,dir=>{
      undoPush();[arr[index],arr[index+dir]]=[arr[index+dir],arr[index]];renderFAQs();changed();
    },()=>{if(!confirm('Remove this question from your draft?'))return;undoPush();arr.splice(index,1);renderFAQs();changed();}));
    card.append(top);
    for(const [field,labelText,kind,max] of [['question','QUESTION','input',240],['answer','ANSWER','textarea',2500]]){
      const label=document.createElement('label');label.textContent=labelText;
      const input=document.createElement(kind);input.value=item[field]||'';input.maxLength=max;if(kind==='textarea')input.rows=3;
      input.addEventListener('focus',undoPush,{once:true});
      input.addEventListener('input',()=>{item[field]=input.value;changed();});
      label.append(input);card.append(label);
    }
    list.append(card);
  });
}
function slugify(text){return String(text||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').replace(/^[^a-z]*/,'').slice(0,40)||'category';}
function uniqueSlug(label,index){
  const taken=new Set(state.data.categories.filter((_,i)=>i!==index).map(c=>c.slug));const base=slugify(label);
  let s=base,n=2;while(taken.has(s)){s=`${base.slice(0,36)}-${n++}`;}return s;
}
function renderCategories(){
  const list=$('weCategoryList');list.replaceChildren();
  state.data.categories.forEach((entry,index,arr)=>{
    const card=document.createElement('article');card.className='we-repeat-card';
    const top=document.createElement('div');top.className='we-repeat-heading';
    const title=document.createElement('strong');title.textContent=`CATEGORY ${index+1}`;
    top.append(title,repeatButtons(index,arr.length,dir=>{
      undoPush();[arr[index],arr[index+dir]]=[arr[index+dir],arr[index]];renderCategories();changed();
    },()=>{
      if(!confirm(`Remove ${entry.label}? Any photographs assigned to it will remain visible under All.`))return;
      undoPush();arr.splice(index,1);renderCategories();changed();
    }));
    const label=document.createElement('label');label.textContent='DISPLAY NAME';
    const name=document.createElement('input');name.type='text';name.maxLength=45;name.value=entry.label;
    name.addEventListener('focus',undoPush,{once:true});
    name.addEventListener('input',()=>{entry.label=name.value;changed();});
    name.addEventListener('change',()=>{
      if(entry._new){entry.slug=uniqueSlug(entry.label,index);delete entry._new;renderCategories();changed();}
    });
    label.append(name);
    const show=document.createElement('label');show.className='we-visible';
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=entry.visible!==false;
    cb.addEventListener('change',()=>{undoPush();entry.visible=cb.checked;changed();});
    show.append(cb,document.createTextNode('Show this category when it contains photos'));
    const slug=document.createElement('div');slug.className='we-slug';slug.textContent=`Direct link: /portfolio.html?category=${entry.slug}`;
    card.append(top,label,show,slug);list.append(card);
  });
}
function cleanForDatabase(){
  // Internal flags used during editing are never persisted.
  const clean=clone(state.data);
  clean.categories.forEach((c,i)=>{if(c._new){c.slug=slugify(c.label);delete c._new;}});
  return clean;
}
function renderForm(){
  if(!state.data)return;
  for(const input of document.querySelectorAll('[data-field]'))input.value=pathGet(state.data.site,input.dataset.field)||'';
  renderFAQs();renderCategories();refreshButtons();
}
function restoreFrom(data){state.data=normalizeWebsite(data);renderForm();}
async function loadState(){
  const {data,error}=await sb.rpc('camille_website_editor_get');if(error)throw error;
  state.revision=Number(data.revision);state.enabled=!!data.enabled;state.published=data.published||{};
  if(!data.draft?.site){state.data=null;state.saved=null;state.undo=[];$('weImportNotice').hidden=false;
    state.data=normalizeWebsite({site:{},categories:FALLBACK_CATEGORIES});state.saved=clone(state.data);tell('Import Camille’s current content before saving a draft.');
  }else{
    state.data=normalizeWebsite(data.draft);state.saved=clone(state.data);state.undo=[];
    $('weImportNotice').hidden=true;tell('Draft loaded. Changes stay private until you publish.');
  }
  renderForm();
}
async function importDecap(){
  if(state.enabled&&!confirm('Import older Decap content into your draft? This will replace your current UNSAVED edits, not the published website.'))return;
  if(!state.enabled&&state.saved?.site?.faq?.length&&
    !confirm('Replace your current editing draft with the content in Decap? Public website will remain unchanged.'))return;
  try{
    const [siteResult,portResult]=await Promise.all([
      fetch('content/site.json',{cache:'no-store'}),fetch('content/portfolio.json',{cache:'no-store'})
    ]);
    if(!siteResult.ok||!portResult.ok)throw new Error('Could not find the current Decap content files');
    const oldSite=await siteResult.json(),oldPort=await portResult.json();
    const extras=[...new Set((oldPort.items||[]).map(p=>p.category).filter(Boolean))];
    const cats=clone(FALLBACK_CATEGORIES);
    for(const slug of extras)if(safeCategorySlug(slug)&&!cats.some(c=>c.slug===slug))cats.push({slug,label:slug[0].toUpperCase()+slug.slice(1),visible:true});
    undoPush();state.data=normalizeWebsite({site:oldSite,categories:cats});
    renderForm();changed('Imported current Decap text and FAQs into an UNPUBLISHED draft. Check each section, Save, then Publish.');
    $('weImportNotice').hidden=true;
  }catch(err){tell(`Import failed: ${err.message}. Nothing changed on the public website.`,true);}
}
function validate(){
  const d=state.data;
  if(!d.site.contact.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))throw new Error('Enter a valid contact email.');
  const insta=d.site.contact.instagram;if(insta&&!/^https:\/\/(www\.)?instagram\.com\//.test(insta))throw new Error('Instagram should link to instagram.com.');
  const cal=d.site.session.cal_link;if(cal&&!/^https:\/\/cal\.com\//.test(cal))throw new Error('Use a https://cal.com/ booking URL.');
  if(d.site.faq.some(f=>f.question.trim().length<2))throw new Error('Please fill in or remove any unfinished FAQ questions.');
  const slugs=d.categories.map(c=>c.slug);if(slugs.length!==new Set(slugs).size)throw new Error('Category direct links need unique slugs.');
  if(d.categories.some(c=>!c.label.trim()||!safeCategorySlug(c.slug)))throw new Error('Every category needs a name and valid link.');
}
async function saveDraft(){
  if(!sb||!state.data)return false;
  try{validate();}catch(e){tell(e.message,true);return false;}
  if(!dirty())return true;
  const clean=cleanForDatabase();state.busy=true;refreshButtons();tell('Saving private draft…');
  const {data,error}=await sb.rpc('camille_website_save',{p_data:clean,p_expected_revision:state.revision});
  state.busy=false;
  if(error){refreshButtons();tell(`Could not save: ${error.message}`,true);return false;}
  state.revision=Number(data.revision);state.data=normalizeWebsite(clean);state.saved=clone(state.data);state.undo=[];
  renderForm();tell('Draft saved. Visitors still see the previous published text.');return true;
}
async function publish(){
  if(!state.data)return;
  if(dirty()){if(!(await saveDraft()))return;}
  if(!confirm('Publish all of these website words and category names? Changes will become visible to visitors.'))return;
  state.busy=true;refreshButtons();tell('Publishing…');
  const {data,error}=await sb.rpc('camille_website_publish',{p_expected_revision:state.revision});state.busy=false;
  if(error){refreshButtons();tell(error.message,true);return;}
  state.enabled=true;state.revision=Number(data.revision);state.published=clone(state.data);
  refreshButtons();tell('Published successfully. Refresh the homepage or portfolio to see your changes!');
}
async function restorePrevious(){
  if(!confirm('Restore the previous PUBLISHED version of your website words and categories? Your current published version will be replaced.'))return;
  state.busy=true;refreshButtons();
  const {data,error}=await sb.rpc('camille_website_restore',{p_expected_revision:state.revision});state.busy=false;
  if(error){tell(error.message,true);refreshButtons();return;}
  state.revision=Number(data.revision);state.enabled=true;state.saved=normalizeWebsite(data.content);
  state.data=clone(state.saved);state.published=clone(state.data);state.undo=[];renderForm();tell('Previous published version restored.');
}
async function fallback(){
  if(!confirm('Emergency fallback: return PUBLIC website text to the older Decap content? Your Studio drafts are kept.'))return;
  const {data,error}=await sb.rpc('camille_website_decap_fallback',{p_expected_revision:state.revision});
  if(error){tell(error.message,true);return;}
  state.revision=Number(data.revision);state.enabled=false;refreshButtons();tell('Decap fallback enabled for public website text.');
}
function previewSend(){const iframe=$('wePreviewFrame');if(!iframe?.contentWindow||!state.data)return;
  iframe.contentWindow.postMessage({kind:'CAMILLE_WEBSITE_PREVIEW',content:cleanForDatabase()},location.origin);
}
function openPreview(){if(!state.data)return;
  const dlg=$('wePreviewDialog');dlg.showModal();loadPreview(state.activeTab==='booking'?'booking.html':state.activeTab==='portfolio'?'portfolio.html':'index.html');
}
function loadPreview(page){state.previewPage=page;const frame=$('wePreviewFrame');frame.src=`${page}?website-editor-preview=1`;document.querySelectorAll('[data-preview-page]').forEach(b=>b.classList.toggle('current',b.dataset.previewPage===page));}
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==$('wePreviewFrame').contentWindow)return;
  if(e.data?.kind==='CAMILLE_WEBSITE_PREVIEW_READY')previewSend();
});
$('wePreviewFrame').addEventListener('load',()=>setTimeout(previewSend,150));
$('weClosePreview').addEventListener('click',()=>{$('wePreviewDialog').close();$('wePreviewFrame').src='about:blank';});
for(const btn of document.querySelectorAll('[data-preview-page]'))btn.addEventListener('click',()=>loadPreview(btn.dataset.previewPage));
$('wePreviewPhone').addEventListener('click',()=>{
  state.previewPhone=!state.previewPhone;
  $('wePreviewWrap').classList.toggle('is-phone',state.previewPhone);
  $('wePreviewPhone').setAttribute('aria-pressed',String(state.previewPhone));
  $('wePreviewPhone').classList.toggle('current',state.previewPhone);
});

function bind(){
  for(const btn of document.querySelectorAll('[data-we-tab]'))btn.addEventListener('click',()=>activateTab(btn.dataset.weTab));
  for(const el of document.querySelectorAll('[data-field]')){
    el.addEventListener('focus',undoPush);
    el.addEventListener('input',()=>{if(!state.data)return;pathSet(state.data.site,el.dataset.field,el.value);changed();});
  }
  $('weFAQAdd').addEventListener('click',()=>{
    if(state.data.site.faq.length>=30)return tell('Up to 30 questions are supported.',true);
    undoPush();state.data.site.faq.push({question:'',answer:''});renderFAQs();changed();
    $('weFAQList').lastElementChild?.querySelector('input')?.focus();
  });
  $('weCategoryAdd').addEventListener('click',()=>{
    if(state.data.categories.length>=16)return tell('Up to 16 categories are supported.',true);
    undoPush();state.data.categories.push({slug:uniqueSlug('New category',-1),label:'New category',visible:true,_new:true});
    renderCategories();changed();$('weCategoryList').lastElementChild?.querySelector('input[type="text"]')?.focus();
  });
  for(const id of ['weSaveTop','weSaveBottom'])$(id).addEventListener('click',saveDraft);
  for(const id of ['wePublishTop','wePublishBottom'])$(id).addEventListener('click',publish);
  $('weImportButton').addEventListener('click',importDecap);
  $('weRestore').addEventListener('click',restorePrevious);
  $('weDecapFallback').addEventListener('click',fallback);
  $('wePreview').addEventListener('click',openPreview);
  $('weUndo').addEventListener('click',()=>{
    if(!state.undo.length)return;state.data=normalizeWebsite(JSON.parse(state.undo.pop()));renderForm();changed('Last edit undone.');
  });
  $('weReset').addEventListener('click',()=>{
    if(!dirty())return;
    if(!confirm('Discard changes made since the last Save Draft?'))return;
    state.data=clone(state.saved);state.undo=[];renderForm();tell('Unsaved changes discarded.');
  });
  window.addEventListener('beforeunload',e=>{if(dirty()&&!state.busy){e.preventDefault();e.returnValue='';}});
}
async function boot(){
  if(!sb){showPage('weLogin');$('weLoginMessage').textContent='Website Editor needs the existing client-config.js connection.';return;}
  const {data:{session}}=await sb.auth.getSession();
  if(!session){showPage('weLogin');state.isAuthed=false;return;}
  const {data,error}=await sb.rpc('is_studio_admin');
  if(error||data!==true){showPage('weUnauthorized');return;}
  if(state.isAuthed&&!$('weEditor').hidden)return;
  state.isAuthed=true;showPage('weEditor');
  try{await loadState();}catch(err){tell(`Could not open Studio Website Editor: ${err.message}`,true);}
}
$('weLoginForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!sb)return;
  $('weLoginMessage').textContent='Sending your sign-in link…';
  const {error}=await sb.auth.signInWithOtp({email:$('weLoginEmail').value.trim(),options:{emailRedirectTo:`${location.origin}/website-editor.html`}});
  $('weLoginMessage').textContent=error?error.message:'Check your inbox for a secure Studio Admin sign-in link.';
});
$('weSignOutDenied').addEventListener('click',async()=>{await sb?.auth.signOut();location.reload();});
bind();if(sb)sb.auth.onAuthStateChange(()=>setTimeout(boot,0));boot();
