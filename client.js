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

  $("loginView").hidden = true;
  $("portalView").hidden = false;
  $("contractView").hidden = true;

  $("clientName").textContent = client.client_name
    ? `Hi, ${client.client_name.split(" ")[0]}.`
    : "Your session";
  $("sessionType").textContent = client.session_type || "Photography Session";
  $("sessionDate").textContent = CamilleContracts.formatDate(client.session_date);
  $("sessionTime").textContent = client.session_time || "To be confirmed";
  $("sessionLocation").textContent = client.session_location || "To be confirmed";
  $("sessionFee").textContent = client.session_fee || "$150";

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
}

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