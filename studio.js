(() => {
"use strict";
const $ = id => document.getElementById(id);
const cfg = window.CLIENT_PORTAL_CONFIG || {};
const ready = cfg.supabaseUrl && !cfg.supabaseUrl.includes("PASTE_") &&
              cfg.supabaseAnonKey && !cfg.supabaseAnonKey.includes("PASTE_");
const sb = ready ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
let clients = [];
let contracts = new Map();
let payments = new Map();
let questionnaires = new Map();
let reminderLogs = new Map();
let miniEvent = null;

function inviteClient(client) {
  const subject = encodeURIComponent("Your Camille Acosta Photography client portal");
  const body = encodeURIComponent(
`Hi ${client.client_name || ""},

Your photography session portal is ready.

Open:
https://camilleacostaphoto.com/client.html

Enter this email address (${client.user_email}) and choose “Send Sign-In Link.” You’ll receive a secure email link to view your session details and contract.

— Camille Acosta Photography`
  );
  location.href = `mailto:${client.user_email}?subject=${subject}&body=${body}`;
}

async function isAdmin() {
  const { data, error } = await sb.rpc("is_studio_admin");
  if (error) return false;
  return data === true;
}

async function loadData() {
  const requests = await Promise.all([
    sb.from("clients").select("*").order("session_date",{ascending:true,nullsFirst:false}),
    sb.from("signed_contracts").select("*"),
    sb.from("client_payments").select("client_id,claimed_at,confirmed_at"),
    sb.from("client_questionnaires").select("*"),
    sb.from("client_reminder_log").select("*")
  ]);
  for (const result of requests) if (result.error) throw result.error;
  clients=requests[0].data||[];
  contracts=new Map((requests[1].data||[]).map(c=>[c.client_id,c]));
  payments=new Map((requests[2].data||[]).map(x=>[x.client_id,x]));
  questionnaires=new Map((requests[3].data||[]).map(q=>[q.client_id,q]));
  reminderLogs=new Map((requests[4].data||[]).map(r=>[`${r.client_id}:${r.session_date}`,r]));
  renderClients();
}

function renderClients() {
  $("clientCount").textContent = clients.length;
  $("pendingCount").textContent = clients.filter(c => !contracts.has(c.id)).length;
  $("galleryCount").textContent = clients.filter(c => !!c.gallery_url).length;
  $("paymentCount").textContent = clients.filter(c => {
    const x=payments.get(c.id);
    return x?.claimed_at && !x.confirmed_at;
  }).length;

  const list = $("clientList");
  if (!clients.length) {
    list.innerHTML = `<div class="client-admin-card"><div><h2>No clients yet</h2><p>Add your first confirmed Cal.com client.</p></div></div>`;
    return;
  }

  list.innerHTML = "";
  clients.forEach(client => {
    const signed = contracts.get(client.id);
    const payment = payments.get(client.id);
    const questionnaire = questionnaires.get(client.id);
    const reminder = reminderLogs.get(`${client.id}:${client.session_date}`);
    const flow = CamilleWorkflow.summary({client,signed,payment,questionnaire});
    const paymentText = payment?.confirmed_at ? "Paid in Full"
      : payment?.claimed_at ? "Client says paid" : "Payment pending";
    const card = document.createElement("article");
    card.className = "client-admin-card";
    card.innerHTML = `
      <div>
        <h2>${CamilleContracts.esc(client.client_name)}</h2>
        <p>${CamilleContracts.esc(client.user_email)}</p>
      </div>
      <div class="meta">
        ${CamilleContracts.esc(client.session_type || "Photography Session")}<br>
        ${CamilleContracts.esc(CamilleContracts.formatDate(client.session_date))}<br>
        ${CamilleContracts.esc(client.session_time || "Time TBD")}
      </div>
      <div>
        <span class="status-chip ${signed ? "good" : ""}">${signed ? "Contract signed" : "Contract pending"}</span>
        <span class="status-chip ${client.gallery_url ? "good" : ""}">${client.gallery_url ? "Gallery ready" : "No gallery"}</span>
        <span class="status-chip ${payment?.confirmed_at ? "good" : ""}">${paymentText}</span>
        <span class="status-chip ${client.session_completed_at ? "good" : ""}">${client.session_completed_at ? "Session completed" : "Session upcoming"}</span>
        <span class="status-chip ${questionnaire?.submitted_at ? "good" : ""}">${questionnaire?.submitted_at ? "Questionnaire received" : questionnaire?.is_skipped ? "Questionnaire skipped" : "Questionnaire optional"}</span>
        <span class="status-chip ${client.referral_discount_applied ? "good" : ""}">${client.referral_discount_applied ? "10% referral reward" : `${flow.completed}/${flow.total} steps`}</span>
      </div>
      <div class="card-actions"></div>
      <details class="studio-workflow-detail">
        <summary>VIEW CLIENT WORKFLOW &amp; QUESTIONNAIRE <span>⌄</span></summary>
        <div class="studio-workflow-content"></div>
      </details>`;

    const actions = card.querySelector(".card-actions");

    const edit = document.createElement("button");
    edit.textContent = "EDIT";
    edit.onclick = () => openEditor(client);
    actions.appendChild(edit);

    const invite = document.createElement("button");
    invite.textContent = "SEND INVITE";
    invite.onclick = () => inviteClient(client);
    actions.appendChild(invite);

    const copy = document.createElement("button");
    copy.textContent = "COPY PORTAL";
    copy.onclick = async () => {
      await navigator.clipboard.writeText("https://camilleacostaphoto.com/client.html");
      copy.textContent = "COPIED";
      setTimeout(() => copy.textContent = "COPY PORTAL", 1100);
    };
    actions.appendChild(copy);

    const verify = document.createElement("button");
    verify.textContent = payment?.confirmed_at ? "UNDO PAID" : "MARK AS PAID";
    verify.onclick = async () => {
      const isPaid = !!payment?.confirmed_at;
      const question = isPaid
        ? `Remove the paid confirmation for ${client.client_name}?`
        : `Have you verified the ${client.session_fee || "session"} payment from ${client.client_name} in your Venmo account?`;
      if (!confirm(question)) return;
      verify.disabled = true;
      verify.textContent = "SAVING…";
      const {error} = await sb.rpc("admin_confirm_client_payment", {
        p_client_id:client.id,
        p_confirm:!isPaid
      });
      if (error) {
        alert(`Could not update payment: ${error.message}`);
        verify.disabled = false;
        verify.textContent = isPaid ? "UNDO PAID" : "MARK AS PAID";
      } else {
        await loadData();
      }
    };
    actions.appendChild(verify);


    const complete = document.createElement("button");
    complete.textContent = client.session_completed_at ? "UNDO SESSION COMPLETE" : "MARK SESSION COMPLETE";
    complete.onclick = async () => {
      const next = client.session_completed_at ? null : new Date().toISOString();
      if(!confirm(next ? `Mark ${client.client_name}'s photo session complete?` :
        `Reopen ${client.client_name}'s session?`)) return;
      complete.disabled=true;
      const {error}=await sb.from("clients").update({session_completed_at:next}).eq("id",client.id);
      if(error){alert(error.message);complete.disabled=false;return;}
      await loadData();
    };
    actions.appendChild(complete);

    const detail = card.querySelector(".studio-workflow-content");
    const safe = CamilleContracts.esc;
    const qFields = questionnaire?.submitted_at ? [
      ["People attending",questionnaire.attendee_count],
      ["Occasion",questionnaire.occasion],
      ["Photography style",questionnaire.photo_style],
      ["Children's ages",questionnaire.children_ages],
      ["Location ideas",questionnaire.location_ideas],
      ["Must-have photos",questionnaire.must_have_shots],
      ["Other notes",questionnaire.notes]
    ].filter(([_,value])=>value!==null&&value!==""&&value!==undefined) : [];

    let reminderText = "No reminder sent yet";
    if(!client.reminder_opt_in) reminderText="Reminders disabled for this client";
    else if(reminder?.status==="sent") reminderText=`Sent ${new Date(reminder.sent_at).toLocaleString()}`;
    else if(reminder?.status==="failed") reminderText=`Delivery failed — check function logs${reminder.error_message?": "+reminder.error_message:""}`;
    else if(reminder?.status==="reserved") reminderText="Reminder being processed / check logs";

    detail.innerHTML = `<div class="studio-workflow-steps">
       ${flow.steps.map(step=>`<div class="studio-flow-step"><span class="studio-flow-dot ${step.status==='done'?'done':''}">${step.status==='done'?'✓':'·'}</span><div><strong>${safe(step.label)}${step.optional?' (optional)':''}</strong><p>${safe(step.detail)}</p></div></div>`).join("")}
       </div>
       <div class="studio-record-notes">
        <div><b>One-day reminder</b><p>${safe(reminderText)}</p></div>
        <div><b>Referral</b><p>${client.referred_by?`Referred by ${safe(client.referred_by)}`:'No referrer recorded'}${client.referral_discount_applied?" · 10% discount applied to this session":""}</p></div>
        <div><b>Optional questionnaire</b>${qFields.length ? qFields.map(([label,value])=>`<p><strong>${safe(label)}:</strong> ${safe(value)}</p>`).join("") : `<p>${questionnaire?.is_skipped?'Client skipped this optional form.':'No answers yet.'}</p>`}</div>
       </div>`;

    if (signed) {
      const pdf = document.createElement("button");
      pdf.textContent = "CONTRACT PDF";
      pdf.onclick = () => CamilleContracts.downloadSignedPDF(signed);
      actions.appendChild(pdf);
    }
    list.appendChild(card);
  });
}

function openEditor(client=null) {
  $("studioDashboard").hidden = true;
  $("miniEditor").hidden = true;
  $("clientEditor").hidden = false;
  $("editorMessage").textContent = "";

  $("editingClientId").value = client?.id || "";
  $("editorTitle").textContent = client ? "Edit Client" : "Add Client";
  $("editName").value = client?.client_name || "";
  $("editEmail").value = client?.user_email || "";
  $("editType").value = client?.session_type || "Photography Session";
  $("editDate").value = client?.session_date || "";
  $("editTime").value = client?.session_time || "";
  $("editLocation").value = client?.session_location || "Tooele, Utah";
  const fee = client?.base_fee_cents != null ? client.base_fee_cents / 100 : parseFee(client?.session_fee || "$150");
  $("editFee").value = Number.isFinite(fee) ? fee.toFixed(2) : "150.00";
  $("editReferredBy").value=client?.referred_by || "";
  $("editReferralDiscount").checked=!!client?.referral_discount_applied;
  $("editReminderEnabled").checked=client?.reminder_opt_in !== false;
  const priceLocked=!!(client&&contracts.has(client.id));
  $("editFee").disabled=priceLocked;
  $("editReferralDiscount").disabled=priceLocked;
  $("signedFeeNotice").hidden=!priceLocked;
  updateFeePreview();
  $("editGallery").value = client?.gallery_url || "";
}

function closeEditor() {
  $("clientEditor").hidden = true;
  $("miniEditor").hidden = true;
  $("studioDashboard").hidden = false;
}

async function boot() {
  if (!sb) {
    $("studioLoginMessage").textContent = "Studio Admin is not connected yet.";
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    $("studioLogin").hidden = false;
    $("miniEditor").hidden = true;
    $("studioUnauthorized").hidden = true;
    $("studioDashboard").hidden = true;
    $("clientEditor").hidden = true;
    return;
  }

  if (!(await isAdmin())) {
    $("studioLogin").hidden = true;
    $("miniEditor").hidden = true;
    $("studioUnauthorized").hidden = false;
    $("studioDashboard").hidden = true;
    $("clientEditor").hidden = true;
    return;
  }

  $("studioLogin").hidden = true;
  $("studioUnauthorized").hidden = true;
  $("studioDashboard").hidden = false;
  $("clientEditor").hidden = true;
  $("miniEditor").hidden = true;

  try {
    await loadData();
  } catch (e) {
    $("clientList").innerHTML = `<p>${CamilleContracts.esc(e.message)}</p>`;
  }
}

$("studioLoginForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("studioEmail").value.trim();
  $("studioLoginMessage").textContent = "Sending admin sign-in link…";
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}/studio.html` }
  });
  $("studioLoginMessage").textContent = error
    ? error.message
    : "Check your email for the Studio Admin sign-in link.";
});

$("studioSignOut")?.addEventListener("click", async () => {
  await sb.auth.signOut(); location.reload();
});
$("unauthorizedSignOut")?.addEventListener("click", async () => {
  await sb.auth.signOut(); location.reload();
});


function parseFee(value) {
  const raw=String(value??'').trim().replace(/^\$/,'');
  return /^\d+(?:\.\d{1,2})?$/.test(raw)? Number(raw) : NaN;
}
function moneyFromCents(cents){return (cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});}
function updateFeePreview(){
  const base=parseFee($("editFee").value);
  if(!Number.isFinite(base)||base<0){$("calculatedFee").textContent="Enter a valid session price.";return;}
  const cents=Math.round(base*100);
  const discount=$("editReferralDiscount").checked;
  $("calculatedFee").textContent=`Final session fee: ${moneyFromCents(discount?Math.round(cents*0.9):cents)}${discount?` (10% off ${moneyFromCents(cents)})`:''}`;
}
$("editFee")?.addEventListener("input",updateFeePreview);
$("editReferralDiscount")?.addEventListener("change",updateFeePreview);

async function openMiniEditor(){
  $("studioDashboard").hidden=true;
  $("clientEditor").hidden=true;
  $("miniEditor").hidden=false;
  $("miniMessage").textContent='Loading fall mini sessions…';
  const {data,error}=await sb.from("mini_events").select("*").eq("slug","fall-2026").maybeSingle();
  if(error || !data){$("miniMessage").textContent=error?.message || "Event not found. Run the workflow SQL upgrade.";return;}
  miniEvent=data;
  $("miniTitle").value=data.title||"Fall Mini Sessions";
  $("miniDate").value=data.event_date||"";
  $("miniLocation").value=data.location||"";
  $("miniPrice").value=(data.price_cents/100).toFixed(2);
  $("miniDuration").value=data.duration_minutes;
  $("miniSpots").value=data.planned_spots||"";
  $("miniIncludes").value=data.included_images||"";
  $("miniDescription").value=data.description||"";
  $("miniCover").value=data.cover_image_url||"";
  $("miniCalUrl").value=data.cal_booking_url||"";
  $("miniActive").checked=!!data.is_active;
  $("miniMessage").textContent=data.is_active?"Live bookings are enabled.":"Draft: visitors can preview the page, but cannot book yet.";
}
$("fallMinisButton")?.addEventListener("click",openMiniEditor);
$("closeMiniEditor")?.addEventListener("click",closeEditor);
$("miniEditorForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const calUrl=$("miniCalUrl").value.trim(), cover=$("miniCover").value.trim();
  const active=$("miniActive").checked;
  if(calUrl&&!/^https:\/\/(www\.)?cal\.com\/[a-z0-9_./-]+(?:\?.*)?$/i.test(calUrl)){
    $("miniMessage").textContent="Use a genuine https://cal.com/... event link.";return;
  }
  if(cover&&!(/^https:\/\//i.test(cover)||/^\/assets\/[\w./-]+$/i.test(cover))){
    $("miniMessage").textContent="Use an https:// image URL or a path like /assets/photo.jpg.";return;
  }
  if(active && !calUrl){$("miniMessage").textContent="Add the dedicated Cal.com mini booking link before activating.";return;}
  const date=$("miniDate").value;
  const localParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const getPart=k=>localParts.find(x=>x.type===k)?.value||'00';
  const localToday=`${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  if(active && date<localToday){
    $("miniMessage").textContent="Use a future date to activate fall mini booking.";return;
  }
  const price=Math.round(Number($("miniPrice").value)*100);
  if(!Number.isSafeInteger(price)||price<0){$("miniMessage").textContent="Invalid price.";return;}
  const payload={
    title:$("miniTitle").value.trim(),event_date:date||null,
    location:$("miniLocation").value.trim(),price_cents:price,
    duration_minutes:Number($("miniDuration").value),planned_spots:$("miniSpots").value?Number($("miniSpots").value):null,
    included_images:$("miniIncludes").value.trim(),description:$("miniDescription").value.trim(),
    cover_image_url:cover,cal_booking_url:calUrl,is_active:active,updated_at:new Date().toISOString()
  };
  const save=$("saveMiniButton");save.disabled=true;
  $("miniMessage").textContent="Saving…";
  const {data,error}=await sb.from("mini_events").update(payload).eq("slug","fall-2026").select().single();
  save.disabled=false;
  if(error){$("miniMessage").textContent=error.message;return;}
  miniEvent=data;
  $("miniMessage").textContent=active?"Saved. Mini-session bookings are LIVE. Preview the page to verify your Cal.com availability.":"Saved as draft. The page is accessible by direct link, but booking is closed.";
});

$("newClientButton")?.addEventListener("click", () => openEditor());
$("closeEditor")?.addEventListener("click", closeEditor);

$("clientEditorForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("editingClientId").value;
  const locked = !!(id && contracts.has(id));
  const base=parseFee($("editFee").value);
  if(!locked && (!Number.isFinite(base)||base<0||base>1000000)) {
    $("editorMessage").textContent="Enter a valid dollar amount for the standard session fee.";
    return;
  }
  const payload={
    client_name:$("editName").value.trim(),
    user_email:$("editEmail").value.trim().toLowerCase(),
    session_type:$("editType").value.trim()||"Photography Session",
    session_date:$("editDate").value||null,
    session_time:$("editTime").value.trim()||null,
    session_location:$("editLocation").value.trim()||null,
    gallery_url:$("editGallery").value.trim()||null,
    referred_by:$("editReferredBy").value.trim()||null,
    reminder_opt_in:$("editReminderEnabled").checked
  };
  if(!locked){
    const cents=Math.round(base*100);
    const discount=$("editReferralDiscount").checked;
    payload.base_fee_cents=cents;
    payload.referral_discount_applied=discount;
    payload.session_fee=moneyFromCents(discount?Math.round(cents*0.9):cents);
  }

  $("editorMessage").textContent = "Saving…";
  let result;
  if (id) result = await sb.from("clients").update(payload).eq("id", id).select().single();
  else result = await sb.from("clients").insert(payload).select().single();

  if (result.error) {
    $("editorMessage").textContent = result.error.message;
    return;
  }

  $("editorMessage").textContent = "Saved.";
  await loadData();
  setTimeout(closeEditor, 450);
});

$("sendInviteFromEditor")?.addEventListener("click", () => {
  inviteClient({
    client_name: $("editName").value.trim(),
    user_email: $("editEmail").value.trim()
  });
});

if (sb) sb.auth.onAuthStateChange(() => setTimeout(boot, 0));
boot();
})();