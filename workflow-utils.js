/* Workflow statuses are derived from existing records: never stored twice. */
window.CamilleWorkflow = (() => {
  function steps({client, signed, payment, questionnaire}) {
    return [
      {key:'booking', label:'Session confirmed', detail:'Your session is reserved with Camille.', status:'done'},
      {key:'contract', label:'Photography agreement', detail:signed?'Signed and preserved as a PDF.':'Review and sign your agreement.',status:signed?'done':'todo'},
      {key:'questionnaire', label:'Session questionnaire', detail:questionnaire?.submitted_at?'Thanks for sharing your preferences.':questionnaire?.is_skipped?'Skipped — you can complete it later.':'Tell Camille a little about your session (optional).',status:questionnaire?.submitted_at?'done':questionnaire?.is_skipped?'skipped':'optional',optional:true},
      {key:'session', label:'Photography session', detail:client.session_completed_at?'Camille marked your session complete.':client.session_date?`Scheduled for ${CamilleContracts.formatDate(client.session_date)}.`:'Awaiting a session date.',status:client.session_completed_at?'done':'todo'},
      {key:'payment', label:'Payment', detail:payment?.confirmed_at?'Camille has confirmed your payment.':payment?.claimed_at?'You reported payment; Camille is verifying it.':'Payment is due at the end of your session.',status:payment?.confirmed_at?'done':payment?.claimed_at?'waiting':'todo'},
      {key:'gallery', label:'Photo gallery', detail:client.gallery_url?'Your gallery is ready to view.':'Camille will share your edited photos here.',status:client.gallery_url?'done':'todo'}
    ];
  }
  function summary(context) {
    const all=steps(context), required=all.filter(s=>!s.optional);
    return {steps:all, completed:required.filter(s=>s.status==='done').length, total:required.length};
  }
  return {steps,summary};
})();
