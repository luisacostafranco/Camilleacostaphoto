(() => {
"use strict";
const $ = id => document.getElementById(id);
const cfg = window.CLIENT_PORTAL_CONFIG || {};
const ready = cfg.supabaseUrl && !cfg.supabaseUrl.includes("PASTE_") &&
              cfg.supabaseAnonKey && !cfg.supabaseAnonKey.includes("PASTE_");
const sb = ready ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
let client = null;
let signedContract = null;
let preview = null;
let payment = null;
let questionnaire = null;


async function fetchSignedContract(clientId) {
  const { data, error } = await sb.from("signed_contracts")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) console.warn(error);
  return data || null;
}

async function loadPortal() {
  if (!sb) {
    $("loginMessage").textContent = "Client portal is not connected yet.";
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    $("loginView").hidden = false;
    $("portalView").hidden = true;
    $("contractView").hidden = true;
    $("questionnaireView").hidden = true;
    return;
  }

  const { data, error } = await sb.from("clients")
    .select("*")
    .eq("user_email", session.user.email)
    .maybeSingle();

  if (error || !data) {
    $("loginView").hidden = false;
    $("portalView").hidden = true;
    $("loginMessage").textContent =
      "You’re signed in, but Camille has not activated a client portal for this email yet.";
    return;
  }

  client = data;
  signedContract = await fetchSignedContract(client.id);
  await loadPayment();
  await loadQuestionnaire();

  $("loginView").hidden = true;
  $("portalView").hidden = false;
  $("contractView").hidden = true;
  $("questionnaireView").hidden = true;

  $("clientName").textContent = client.client_name
    ? `Hi, ${client.client_name.split(" ")[0]}.`
    : "Your session";
  $("sessionType").textContent = client.session_type || "Photography Session";
  $("sessionDate").textContent = CamilleContracts.formatDate(client.session_date);
  $("sessionTime").textContent = client.session_time || "To be confirmed";
  $("sessionLocation").textContent = client.session_location || "To be confirmed";
  $("sessionFee").textContent = client.session_fee || "$150";
  const canCalendar=window.CamilleCalendar?.hasValidSession(client)===true;
  $("addToCalendarButton").hidden=!canCalendar;
  $("calendarDownloadMessage").textContent=client.session_date&&!canCalendar
    ? "Ask Camille to confirm the session time to add it to your calendar." : "";
  const discounted=client.referral_discount_applied===true && Number.isInteger(client.base_fee_cents);
  $("sessionDiscountLine").hidden=!discounted;
  if(discounted){
    $("sessionDiscountLine").textContent=`10% referral thank-you applied · regular fee ${(client.base_fee_cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})}`;
  }


  if (signedContract) {
    $("contractHeading").textContent = "Agreement signed";
    $("contractSummary").textContent =
      `Signed ${new Date(signedContract.signed_at).toLocaleString()}. Your signed agreement is permanently preserved.`;
    $("openContractButton").textContent = "VIEW SIGNED AGREEMENT";
    $("downloadContractButton").hidden = false;
  } else {
    $("contractHeading").textContent = "Agreement pending";
    $("contractSummary").textContent =
      "Review and sign your photography agreement before your session.";
    $("openContractButton").textContent = "REVIEW CONTRACT";
    $("downloadContractButton").hidden = true;
  }

  if (client.gallery_url) {
    $("galleryButton").href = client.gallery_url;
    $("galleryButton").classList.remove("disabled");
    $("galleryMessage").textContent = "Your gallery is ready.";
  } else {
    $("galleryButton").classList.add("disabled");
    $("galleryMessage").textContent =
      "Your gallery link will appear here when Camille has it ready.";
  }
  renderWorkflow();
}

async function loadPayment() {
  const { data, error } = await sb.from("client_payments")
    .select("claimed_at, confirmed_at")
    .eq("client_id", client.id)
    .maybeSingle();
  payment = error ? null : data;
  if (error) {
    $("paymentHeading").textContent = "Status unavailable";
    $("paymentMessage").textContent = "Payment status could not load. Please try again later.";
    $("claimPaymentButton").disabled = true;
    return;
  }

  $("paymentAmount").textContent = client.session_fee || "$150";
  const title = payment?.confirmed_at ? "Paid in Full"
    : payment?.claimed_at ? "Awaiting Camille's confirmation"
    : "Payment pending";
  $("paymentHeading").textContent = title;
  $("claimPaymentButton").hidden = !!payment?.claimed_at || !!payment?.confirmed_at;
  $("paymentMessage").textContent = payment?.confirmed_at
    ? `Camille confirmed payment on ${new Date(payment.confirmed_at).toLocaleDateString()}.`
    : payment?.claimed_at
      ? "Thanks! Camille will check Venmo and confirm the payment."
      : "After sending payment in Venmo, tap ‘I've Paid’ below.";

  const cfg = window.CAMILLE_PAYMENT_CONFIG || {};
  const qr = $("venmoQr");
  qr.addEventListener("load", () => {
    qr.hidden = false;
    $("venmoQrFallback").hidden = true;
  }, {once:true});
  qr.addEventListener("error", () => {
    qr.hidden = true;
    $("venmoQrFallback").hidden = false;
  }, {once:true});
  if (cfg.qrImage) qr.src = cfg.qrImage;

  const link = $("venmoLink");
  if (typeof cfg.venmoProfileUrl === "string" && /^https:\/\/(www\.)?venmo\.com\//i.test(cfg.venmoProfileUrl)) {
    link.href = cfg.venmoProfileUrl;
    link.hidden = false;
  } else {
    link.hidden = true;
  }
}


async function loadQuestionnaire() {
  const {data,error} = await sb.from("client_questionnaires").select("*")
    .eq("client_id",client.id).maybeSingle();
  questionnaire = error ? null : data;
  if (error) console.warn("Questionnaire unavailable:",error.message);
}

function renderWorkflow() {
  if (!client) return;
  const {steps,completed,total} = CamilleWorkflow.summary({client,signed:signedContract,payment,questionnaire});
  $("workflowCount").textContent = `${completed} of ${total} essential steps complete`;
  $("workflowBar").style.width = `${Math.round((completed/total)*100)}%`;
  $("workflowBar").parentElement.setAttribute("aria-valuenow",String(completed));
  const actionLabels = {contract:signedContract?"View agreement":"Review agreement",
    questionnaire:questionnaire?.submitted_at?"Edit answers":"Open questionnaire", gallery:"Open gallery"};
  $("workflowSteps").innerHTML = steps.map((step,i)=>{
    let action="";
    if (step.key==="contract" || step.key==="questionnaire") {
      action=`<button type="button" data-workflow-action="${step.key}">${actionLabels[step.key]} →</button>`;
    } else if (step.key==="gallery" && client.gallery_url && /^https:\/\//i.test(client.gallery_url)) {
      action=`<a href="${CamilleContracts.esc(client.gallery_url)}" target="_blank" rel="noopener noreferrer">Open gallery →</a>`;
    }
    return `<div class="workflow-step ${step.status}">
      <span class="workflow-icon ${step.status==='done'?'done':''}" aria-hidden="true">${step.status==='done'?'✓':i+1}</span>
      <div class="workflow-copy"><strong>${CamilleContracts.esc(step.label)}${step.optional?'<span class="workflow-optional">OPTIONAL</span>':''}</strong>
      <p>${CamilleContracts.esc(step.detail)}</p>${action}</div></div>`;
  }).join("");
  $("questionnaireHeading").textContent = questionnaire?.submitted_at ? "Preferences received" :
    questionnaire?.is_skipped ? "Questionnaire skipped" : "Plan your session";
  $("questionnaireSummary").textContent = questionnaire?.submitted_at ?
    "Camille has your answers. You can still update them." : questionnaire?.is_skipped ?
    "No problem — you can fill this in whenever you like." :
    "Tell Camille who is coming and what you're celebrating. This is completely optional.";
  $("openQuestionnaireButton").textContent = questionnaire?.submitted_at ? "EDIT ANSWERS" : "OPEN QUESTIONNAIRE";
}

function openQuestionnaire() {
  if (!client) return;
  const q=questionnaire || {};
  $("qCount").value=q.attendee_count ?? "";
  $("qOccasion").value=q.occasion || "";
  $("qStyle").value=q.photo_style || "";
  $("qChildren").value=q.children_ages || "";
  $("qLocation").value=q.location_ideas || "";
  $("qShots").value=q.must_have_shots || "";
  $("qNotes").value=q.notes || "";
  $("questionnaireMessage").textContent="";
  $("portalView").hidden=true;
  $("contractView").hidden=true;
  $("questionnaireView").hidden=false;
  window.scrollTo({top:0,behavior:"smooth"});
}

function closeQuestionnaire() {
  $("questionnaireView").hidden=true;
  $("portalView").hidden=false;
  renderWorkflow();
  window.scrollTo({top:0,behavior:"smooth"});
}

async function saveQuestionnaire(skip=false) {
  if (!client) return;
  const countRaw=$("qCount").value.trim();
  const count=countRaw?Number(countRaw):null;
  if (!skip && (count!==null && (!Number.isInteger(count)||count<1||count>50))) {
    $("questionnaireMessage").textContent="Please enter a number of people between 1 and 50.";
    return;
  }
  const fields={
    client_id:client.id,
    attendee_count:skip?null:count,
    occasion:skip?null:$("qOccasion").value,
    children_ages:skip?null:$("qChildren").value.trim(),
    photo_style:skip?null:$("qStyle").value,
    location_ideas:skip?null:$("qLocation").value.trim(),
    must_have_shots:skip?null:$("qShots").value.trim(),
    notes:skip?null:$("qNotes").value.trim(),
    is_skipped:skip,
    submitted_at:skip?null:new Date().toISOString(),
    updated_at:new Date().toISOString()
  };
  const save=$("saveQuestionnaireButton"),skipBtn=$("skipQuestionnaireButton");
  save.disabled=skipBtn.disabled=true;
  $("questionnaireMessage").textContent="Saving…";
  const {data,error}=await sb.from("client_questionnaires")
    .upsert(fields,{onConflict:"client_id"}).select().single();
  save.disabled=skipBtn.disabled=false;
  if(error){$("questionnaireMessage").textContent=error.message;return;}
  questionnaire=data;
  closeQuestionnaire();
}

$("workflowSteps")?.addEventListener("click",e=>{
  const btn=e.target.closest("[data-workflow-action]");
  if(!btn)return;
  if(btn.dataset.workflowAction==="contract") openContract();
  if(btn.dataset.workflowAction==="questionnaire") openQuestionnaire();
});
$("openQuestionnaireButton")?.addEventListener("click",openQuestionnaire);
$("backFromQuestionnaire")?.addEventListener("click",closeQuestionnaire);
$("questionnaireForm")?.addEventListener("submit",e=>{e.preventDefault();saveQuestionnaire(false);});
$("skipQuestionnaireButton")?.addEventListener("click",()=>saveQuestionnaire(true));

$("claimPaymentButton")?.addEventListener("click", async () => {
  if (!client || !sb || !confirm("Have you already sent your payment in Venmo? This does not process a payment.")) return;
  const button = $("claimPaymentButton");
  button.disabled = true;
  $("paymentMessage").textContent = "Saving your payment notice…";
  const { data, error } = await sb.rpc("client_claim_payment");
  if (error) {
    $("paymentMessage").textContent = error.message;
    button.disabled = false;
    return;
  }
  payment = data;
  await loadPayment();
  renderWorkflow();
});

async function openContract() {
  if (!client) return;
  $("portalView").hidden = true;
  $("contractView").hidden = false;

  if (signedContract) {
    $("contractText").innerHTML = CamilleContracts.renderSnapshotHTML(signedContract);
    $("signatureArea").hidden = true;
    $("signedActions").hidden = false;
    return;
  }

  const { data, error } = await sb.rpc("get_contract_preview");
  if (error) {
    $("contractText").innerHTML =
      `<p>We couldn't load the agreement. ${CamilleContracts.esc(error.message)}</p>`;
    return;
  }
  preview = data;
  $("contractText").innerHTML = CamilleContracts.renderPreviewHTML(preview);
  $("signatureArea").hidden = false;
  $("signedActions").hidden = true;
}

$("magicLinkForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!sb) return loadPortal();
  const email = $("clientEmail").value.trim();
  $("loginMessage").textContent = "Sending sign-in link…";
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}/client.html` }
  });
  $("loginMessage").textContent = error
    ? error.message
    : "Check your email for your secure sign-in link.";
});

$("signOutButton")?.addEventListener("click", async () => {
  if (sb) await sb.auth.signOut();
  location.reload();
});

$("openContractButton")?.addEventListener("click", openContract);
$("addToCalendarButton")?.addEventListener("click",()=>{
  if(!client)return;
  try{
    window.CamilleCalendar.download(client);
    $("calendarDownloadMessage").textContent="Calendar file downloaded. Open it to add your session to your calendar.";
  }catch(e){
    $("calendarDownloadMessage").textContent=e.message||"Could not create calendar event.";
  }
});

$("backToPortal")?.addEventListener("click", () => {
  $("contractView").hidden = true;
  $("portalView").hidden = false;
});

$("signContractButton")?.addEventListener("click", async () => {
  if (!sb || !client) return;
  const name = $("signatureName").value.trim();
  if (!$("contractConsent").checked || !name) {
    $("contractMessage").textContent =
      "Please check the agreement box and type your legal name.";
    return;
  }

  $("signContractButton").disabled = true;
  $("contractMessage").textContent = "Signing and preserving your agreement…";

  const { data, error } = await sb.rpc("sign_client_contract", {
    p_legal_name: name
  });

  $("signContractButton").disabled = false;
  if (error) {
    $("contractMessage").textContent = error.message;
    return;
  }

  signedContract = data;
  renderWorkflow();
  $("contractMessage").textContent = "Agreement signed successfully.";
  $("contractText").innerHTML = CamilleContracts.renderSnapshotHTML(signedContract);
  $("signatureArea").hidden = true;
  $("signedActions").hidden = false;
});

$("downloadContractButton")?.addEventListener("click", () => {
  if (signedContract) CamilleContracts.downloadSignedPDF(signedContract);
});
$("downloadContractInsideButton")?.addEventListener("click", () => {
  if (signedContract) CamilleContracts.downloadSignedPDF(signedContract);
});

if (sb) sb.auth.onAuthStateChange(() => setTimeout(loadPortal, 0));
loadPortal();
})();