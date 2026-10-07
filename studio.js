(() => {
"use strict";
const $ = id => document.getElementById(id);
const cfg = window.CLIENT_PORTAL_CONFIG || {};
const ready = cfg.supabaseUrl && !cfg.supabaseUrl.includes("PASTE_") &&
              cfg.supabaseAnonKey && !cfg.supabaseAnonKey.includes("PASTE_");
const sb = ready ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
let clients = [];
let contracts = new Map();

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
  const [{ data: clientRows, error: clientErr }, { data: contractRows, error: contractErr }] =
    await Promise.all([
      sb.from("clients").select("*").order("session_date", { ascending: true, nullsFirst: false }),
      sb.from("signed_contracts").select("*")
    ]);

  if (clientErr) throw clientErr;
  if (contractErr) throw contractErr;

  clients = clientRows || [];
  contracts = new Map((contractRows || []).map(c => [c.client_id, c]));
  renderClients();
}

function renderClients() {
  $("clientCount").textContent = clients.length;
  $("pendingCount").textContent = clients.filter(c => !contracts.has(c.id)).length;
  $("galleryCount").textContent = clients.filter(c => !!c.gallery_url).length;

  const list = $("clientList");
  if (!clients.length) {
    list.innerHTML = `<div class="client-admin-card"><div><h2>No clients yet</h2><p>Add your first confirmed Cal.com client.</p></div></div>`;
    return;
  }

  list.innerHTML = "";
  clients.forEach(client => {
    const signed = contracts.get(client.id);
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
      </div>
      <div class="card-actions"></div>`;

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
  $("editFee").value = client?.session_fee || "$150";
  $("editGallery").value = client?.gallery_url || "";
}

function closeEditor() {
  $("clientEditor").hidden = true;
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
    $("studioUnauthorized").hidden = true;
    $("studioDashboard").hidden = true;
    $("clientEditor").hidden = true;
    return;
  }

  if (!(await isAdmin())) {
    $("studioLogin").hidden = true;
    $("studioUnauthorized").hidden = false;
    $("studioDashboard").hidden = true;
    $("clientEditor").hidden = true;
    return;
  }

  $("studioLogin").hidden = true;
  $("studioUnauthorized").hidden = true;
  $("studioDashboard").hidden = false;
  $("clientEditor").hidden = true;

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

$("newClientButton")?.addEventListener("click", () => openEditor());
$("closeEditor")?.addEventListener("click", closeEditor);

$("clientEditorForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("editingClientId").value;
  const payload = {
    client_name: $("editName").value.trim(),
    user_email: $("editEmail").value.trim().toLowerCase(),
    session_type: $("editType").value.trim() || "Photography Session",
    session_date: $("editDate").value || null,
    session_time: $("editTime").value.trim() || null,
    session_location: $("editLocation").value.trim() || null,
    session_fee: $("editFee").value.trim() || "$150",
    gallery_url: $("editGallery").value.trim() || null
  };

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