/* Download a portable .ics session event (Apple, Outlook and Google Calendar).
   Runs only in the browser; no calendar access or account connection is needed. */
window.CamilleCalendar = (() => {
  "use strict";
  const digits=n=>String(n).padStart(2,"0");
  function parseTime(value){
    const raw=String(value||"").trim().toUpperCase();
    const match=raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?(?:\b|$)/);
    if(!match)return null;
    let hour=Number(match[1]);
    const minute=match[2]?Number(match[2]):0;
    const meridian=match[3];
    if(minute>59 || (!meridian && (hour>23 || !match[2])) || (meridian && (hour<1||hour>12))) return null;
    if(meridian) hour=hour%12+(meridian==="PM"?12:0);
    return {hour,minute};
  }
  function hasValidSession(session){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(session?.session_date||""))return false;
    const [y,m,d]=session.session_date.split("-").map(Number);
    const valid=new Date(Date.UTC(y,m-1,d));
    if(valid.getUTCFullYear()!==y||valid.getUTCMonth()!==m-1||valid.getUTCDate()!==d)return false;
    return !!parseTime(session?.session_time);
  }
  function escapeIcs(value){
    return String(value??"").replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n")
      .replace(/,/g,"\\,").replace(/;/g,"\\;");
  }
  function stamp(d){
    return `${d.getUTCFullYear()}${digits(d.getUTCMonth()+1)}${digits(d.getUTCDate())}T${digits(d.getUTCHours())}${digits(d.getUTCMinutes())}${digits(d.getUTCSeconds())}Z`;
  }
  function fold(line){
    const encoder=new TextEncoder();
    const segments=[];let part="",bytes=0;
    for(const ch of line){
      const b=encoder.encode(ch).length;
      if(bytes+b>74 && part){segments.push(part);part=" ";bytes=1;}
      part+=ch;bytes+=b;
    }
    if(part)segments.push(part);
    return segments.join("\r\n");
  }
  function makeIcs(session,now=new Date()){
    if(!hasValidSession(session))throw new Error("A confirmed session date and time are required.");
    const [y,m,d]=session.session_date.split("-").map(Number);
    const {hour,minute}=parseTime(session.session_time);
    const duration=Number(session.session_duration_minutes);
    const minutes=Number.isInteger(duration)&&duration>=10&&duration<=600?duration:60;
    const start=new Date(Date.UTC(y,m-1,d,hour,minute));
    const end=new Date(start.getTime()+minutes*60000);
    const localTime=date=>`${date.getUTCFullYear()}${digits(date.getUTCMonth()+1)}${digits(date.getUTCDate())}T${digits(date.getUTCHours())}${digits(date.getUTCMinutes())}00`;
    const title=String(session.session_type||"Photography Session");
    const location=String(session.session_location||"Location to be confirmed with Camille");
    const lines=[
      "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Camille Acosta Photography//Session Booking//EN",
      "CALSCALE:GREGORIAN","METHOD:PUBLISH",
      "BEGIN:VTIMEZONE","TZID:America/Denver","X-LIC-LOCATION:America/Denver",
      "BEGIN:DAYLIGHT","TZOFFSETFROM:-0700","TZOFFSETTO:-0600",
      "TZNAME:MDT","DTSTART:20070311T020000","RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU","END:DAYLIGHT",
      "BEGIN:STANDARD","TZOFFSETFROM:-0600","TZOFFSETTO:-0700",
      "TZNAME:MST","DTSTART:20071104T020000","RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU","END:STANDARD",
      "END:VTIMEZONE","BEGIN:VEVENT",
      `UID:camille-session-${String(session.id||"booking").replace(/[^A-Za-z0-9-]/g,"")}@camilleacostaphoto.com`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;TZID=America/Denver:${localTime(start)}`,
      `DTEND;TZID=America/Denver:${localTime(end)}`,
      `SUMMARY:${escapeIcs(title+" | Camille Acosta Photography")}`,
      `LOCATION:${escapeIcs(location)}`,
      `DESCRIPTION:${escapeIcs("Your photography session with Camille Acosta Photography. Please confirm any changes directly with Camille. Client portal: https://camilleacostaphoto.com/client.html")}`,
      "STATUS:CONFIRMED","END:VEVENT","END:VCALENDAR"
    ];
    return lines.map(fold).join("\r\n")+"\r\n";
  }
  function download(session){
    const contents=makeIcs(session);
    const blob=new Blob([contents],{type:"text/calendar;charset=utf-8"});
    const objectUrl=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=objectUrl;
    anchor.download=`Camille-Photography-${session.session_date}.ics`;
    anchor.style.display="none";
    document.body.appendChild(anchor);
    anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
  }
  return {parseTime,hasValidSession,makeIcs,download};
})();
