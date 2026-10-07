
window.CamilleContracts = (() => {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));

  function formatDate(value) {
    if (!value) return "To be confirmed";
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-US", {
      month:"long", day:"numeric", year:"numeric"
    });
  }

  function normalizeSignedContract(row) {
    if (!row) return null;
    const snapshot = row.contract_snapshot || {};
    return {
      id: row.id,
      signedAt: row.signed_at,
      signerName: row.signer_name,
      signerEmail: row.signer_email,
      version: row.contract_version,
      hash: row.snapshot_sha256,
      snapshot
    };
  }

  function renderSnapshotHTML(contractRow) {
    const c = normalizeSignedContract(contractRow);
    if (!c) return "";
    const s = c.snapshot;
    const sections = Array.isArray(s.sections) ? s.sections : [];
    return `
      <div class="contract-meta-block">
        <p><strong>Client:</strong> ${esc(s.client_name)}</p>
        <p><strong>Session:</strong> ${esc(s.session_type)}</p>
        <p><strong>Date:</strong> ${esc(formatDate(s.session_date))}</p>
        <p><strong>Time:</strong> ${esc(s.session_time || "To be confirmed")}</p>
        <p><strong>Location:</strong> ${esc(s.session_location || "To be confirmed")}</p>
        <p><strong>Fee:</strong> ${esc(s.session_fee || "$150")}</p>
      </div>
      ${sections.map(section => `
        <h2>${esc(section.title)}</h2>
        <p>${esc(section.body)}</p>
      `).join("")}
      <div class="signed-contract-block">
        <p><strong>Electronically signed by:</strong> ${esc(c.signerName)}</p>
        <p><strong>Email:</strong> ${esc(c.signerEmail)}</p>
        <p><strong>Signed:</strong> ${esc(new Date(c.signedAt).toLocaleString())}</p>
        <p><strong>Contract version:</strong> ${esc(c.version)}</p>
        <p class="contract-hash"><strong>Record ID:</strong> ${esc(c.hash || c.id)}</p>
      </div>`;
  }

  function renderPreviewHTML(preview) {
    if (!preview) return "";
    const client = preview.client || {};
    const template = preview.template || {};
    const sections = Array.isArray(template.sections) ? template.sections : [];
    return `
      <div class="contract-meta-block">
        <p><strong>Client:</strong> ${esc(client.client_name)}</p>
        <p><strong>Session:</strong> ${esc(client.session_type)}</p>
        <p><strong>Date:</strong> ${esc(formatDate(client.session_date))}</p>
        <p><strong>Time:</strong> ${esc(client.session_time || "To be confirmed")}</p>
        <p><strong>Location:</strong> ${esc(client.session_location || "To be confirmed")}</p>
        <p><strong>Fee:</strong> ${esc(client.session_fee || "$150")}</p>
      </div>
      ${sections.map(section => `
        <h2>${esc(section.title)}</h2>
        <p>${esc(section.body)}</p>
      `).join("")}`;
  }

  function addWrappedText(doc, text, x, y, width, opts={}) {
    const lineHeight = opts.lineHeight || 5.5;
    const fontSize = opts.fontSize || 10;
    const style = opts.style || "normal";
    const font = opts.font || "times";
    doc.setFont(font, style);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(String(text || ""), width);
    for (const line of lines) {
      if (y > 272) {
        doc.addPage();
        y = 24;
      }
      doc.text(line, x, y);
      y += lineHeight;
    }
    return y;
  }

  function downloadSignedPDF(contractRow) {
    if (!contractRow || !window.jspdf?.jsPDF) {
      alert("The PDF generator has not loaded yet. Please try again in a moment.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:"mm", format:"letter"});
    const c = normalizeSignedContract(contractRow);
    const s = c.snapshot || {};
    const margin = 20;
    const width = 176;
    let y = 22;

    doc.setTextColor(79, 76, 71);
    doc.setFont("helvetica","normal");
    doc.setFontSize(12);
    doc.text("CAMILLE ACOSTA", 108, y, {align:"center"});
    y += 5;
    doc.setFontSize(8);
    doc.text("PHOTOGRAPHY", 108, y, {align:"center"});
    y += 7;
    doc.setDrawColor(190, 185, 176);
    doc.line(margin, y, 196, y);
    y += 12;

    doc.setFont("times","normal");
    doc.setFontSize(22);
    doc.text("Photography Agreement", margin, y);
    y += 12;

    const detailRows = [
      ["Client", s.client_name || ""],
      ["Session", s.session_type || ""],
      ["Date", formatDate(s.session_date)],
      ["Time", s.session_time || "To be confirmed"],
      ["Location", s.session_location || "To be confirmed"],
      ["Fee", s.session_fee || "$150"]
    ];
    doc.setFontSize(9);
    detailRows.forEach(([label, value]) => {
      doc.setFont("helvetica","bold");
      doc.text(`${label}:`, margin, y);
      doc.setFont("helvetica","normal");
      doc.text(String(value), margin + 28, y);
      y += 5;
    });
    y += 6;

    (s.sections || []).forEach(section => {
      if (y > 250) { doc.addPage(); y = 24; }
      doc.setFont("times","bold");
      doc.setFontSize(13);
      doc.text(section.title || "", margin, y);
      y += 7;
      y = addWrappedText(doc, section.body || "", margin, y, width, {
        font:"times", style:"normal", fontSize:10, lineHeight:5.3
      });
      y += 5;
    });

    if (y > 225) { doc.addPage(); y = 24; }
    doc.setDrawColor(190,185,176);
    doc.line(margin, y, 196, y);
    y += 10;
    doc.setFont("times","bold");
    doc.setFontSize(13);
    doc.text("Electronic Signature", margin, y);
    y += 8;
    y = addWrappedText(doc, `Signed by: ${c.signerName}`, margin, y, width, {font:"times", fontSize:10});
    y = addWrappedText(doc, `Email: ${c.signerEmail}`, margin, y, width, {font:"times", fontSize:10});
    y = addWrappedText(doc, `Signed: ${new Date(c.signedAt).toLocaleString()}`, margin, y, width, {font:"times", fontSize:10});
    y = addWrappedText(doc, `Contract version: ${c.version}`, margin, y, width, {font:"times", fontSize:10});
    y += 2;
    y = addWrappedText(doc, `Record ID: ${c.hash || c.id}`, margin, y, width, {
      font:"courier", fontSize:7.5, lineHeight:4.3
    });

    const safeName = String(s.client_name || "Client").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"");
    const date = s.session_date || new Date(c.signedAt).toISOString().slice(0,10);
    doc.save(`Camille-Acosta-Photography-${safeName}-${date}.pdf`);
  }

  return { esc, formatDate, renderSnapshotHTML, renderPreviewHTML, downloadSignedPDF };
})();
