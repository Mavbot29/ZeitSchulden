'use strict';
(() => {
  const params = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  history.replaceState(null, '', location.pathname);
  const status = document.getElementById('status');
  const form = document.getElementById('reset');
  const cfg = { ...window.ZS_CONFIG, url: (window.ZS_CONFIG.url || '').replace(/\/$/, '') };
  let token = params.get('access_token');
  const type = params.get('type');
  if (params.has('error') || query.has('error')) { token=null; status.textContent='Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.'; return; }
  if (type !== 'recovery' || !token) { token=null; status.textContent = type === 'email_change' ? 'Die E-Mail-Bestätigung wurde verarbeitet. Du kannst zur Anmeldung zurückkehren.' : 'Es liegt kein gültiger Wiederherstellungslink vor.'; return; }
  try { const u=new URL(cfg.url); if(u.protocol!=='https:' || !u.hostname.endsWith('.supabase.co') || u.pathname!=='/' || u.username || u.password || u.search || u.hash || !/^sb_publishable_/.test(cfg.publishableKey)) throw new Error(); } catch { token=null; status.textContent='Das Testprojekt ist noch nicht eingerichtet.'; return; }
  status.textContent='Bitte wähle ein neues Passwort.'; form.hidden=false;
  form.addEventListener('submit',async e=>{e.preventDefault();const a=document.getElementById('password'),b=document.getElementById('repeat'),button=e.submitter; if(a.value!==b.value || a.value.length<12 || new TextEncoder().encode(a.value).length>72){status.textContent='Die Passwörter müssen übereinstimmen und mindestens 12 Zeichen sowie höchstens 72 UTF-8-Bytes haben.';return;} button.disabled=true; try {const r=await fetch(cfg.url+'/auth/v1/user',{method:'PUT',headers:{apikey:cfg.publishableKey,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({password:a.value}),cache:'no-store',referrerPolicy:'no-referrer'});if(!r.ok){status.textContent='Das Passwort konnte nicht gespeichert werden. Fordere gegebenenfalls einen neuen Link an.';return;} token=null;a.value='';b.value='';form.hidden=true;status.textContent='Das Passwort wurde geändert. Du kannst dich jetzt anmelden.';}catch{status.textContent='Verbindung fehlgeschlagen. Bitte versuche es erneut.';}finally{button.disabled=false;}});
})();
