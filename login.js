'use strict';
(() => {
  const cfg = { ...window.ZS_CONFIG, url: (window.ZS_CONFIG.url || '').replace(/\/$/, '') };
  const key = 'zeitschulden-auth-session';
  const $ = id => document.getElementById(id);
  const say = msg => { $('message').textContent = msg; };
  const validConfig = () => { try { const u = new URL(cfg.url); return u.protocol === 'https:' && u.hostname.endsWith('.supabase.co') && u.pathname === '/' && !u.username && !u.password && !u.search && !u.hash && /^sb_publishable_/.test(cfg.publishableKey); } catch { return false; } };
  const show = id => { for (const n of ['login','register','recover','signedIn']) $(n).hidden = n !== id; $('authNav').hidden = id === 'signedIn'; };
  const clear = () => { localStorage.removeItem(key); sessionStorage.removeItem(key); };
  let session = null;
  let generation = 0;
  let verification = null;
  async function request(path, opts) { const r = await fetch(cfg.url + path, { ...opts, headers: { apikey: cfg.publishableKey, 'content-type': 'application/json', ...(opts.headers || {}) }, cache: 'no-store', referrerPolicy: 'no-referrer' }); let body = {}; try { body = await r.json(); } catch {} return {ok:r.ok,status:r.status,body}; }
  async function action(body) { return request('/functions/v1/zeitschulden-auth', { method:'POST', body:JSON.stringify(body) }); }
  async function friendRpc(name, params) {
    if (!session) throw new Error('SESSION');
    const started = generation;
    if (!verification) { const pending = verify(session, !!localStorage.getItem(key)); verification = pending; pending.finally(() => { if (verification === pending) verification = null; }).catch(() => {}); }
    if (!await verification || started !== generation || !session) throw new Error('SESSION');
    const r = await request('/rest/v1/rpc/' + name, {method:'POST', headers:{Authorization:'Bearer ' + session.access_token}, body:JSON.stringify(params)});
    if (!r.ok) throw new Error('REQUEST');
    return r.body;
  }
  async function loadMeetings() {
    const started = generation;
    const list = $('meetingsList');
    list.replaceChildren();
    $('meetingsStatus').textContent = 'Treffen werden geladen …';
    try {
      const rows = await friendRpc('zs_meeting_list', {});
      if (started !== generation) return;
      if (!Array.isArray(rows)) throw new Error('RESPONSE');
      $('meetingsStatus').textContent = rows.length ? '' : 'Noch keine Treffen.';
      for (const row of rows) {
        const item = document.createElement('div');
        item.className = 'friend-item';
        const title = document.createElement('strong');
        title.textContent = row.title;
        const details = document.createElement('p');
        const when = new Date(row.starts_at).toLocaleString('de-DE', {dateStyle:'medium',timeStyle:'short'});
        const response = row.my_response === 'pending' ? 'Einladung offen' : row.my_response === 'accepted' ? 'Zugesagt' : 'Einladung abgelehnt';
        details.textContent = when + ' · ' + row.place + ' · @' + row.creator_username + ' · ' + response;
        item.append(title, details);
        const participants = document.createElement('p');
        participants.textContent = 'Teilnehmer werden geladen …';
        item.append(participants);
        friendRpc('zs_meeting_participants_list', {p_meeting_id:row.meeting_id})
          .then(people => {
            if (started !== generation || !Array.isArray(people)) return;
            const labels = {pending:'offen', accepted:'zugesagt', declined:'abgelehnt'};
            participants.textContent = people.length
              ? 'Teilnehmer: ' + people.map(p => p.display_name + ' (@' + p.username + ') – ' + (p.is_creator ? 'erstellt' : labels[p.response] || 'unbekannt')).join('; ')
              : 'Keine Teilnehmer angezeigt.';
          })
          .catch(() => { if (started === generation) participants.textContent = 'Teilnehmer konnten nicht geladen werden.'; });
        if (row.my_response === 'pending' && !row.is_creator) {
          for (const [label, accept] of [['Zusagen',true],['Einladung ablehnen',false]]) {
            const b = document.createElement('button');
            b.type = 'button'; b.textContent = label;
            b.addEventListener('click', async () => {
              b.disabled = true;
              try { await friendRpc('zs_meeting_respond',{p_meeting_id:row.meeting_id,p_accept:accept}); await loadMeetings(); }
              catch { if (started === generation) $('meetingsStatus').textContent = 'Die Einladung konnte nicht beantwortet werden.'; b.disabled = false; }
            });
            item.append(b);
          }
        }
        list.append(item);
      }
    } catch { if (started === generation) $('meetingsStatus').textContent = 'Treffen konnten nicht geladen werden.'; }
  }
  $('meetingForm').addEventListener('submit', async e => {
    e.preventDefault(); const started = generation, button = e.submitter;
    const names = $('meetingInvitees').value.split(',').map(x => x.trim()).filter(Boolean);
    const date = new Date($('meetingTime').value);
    if (!names.length || names.length > 20 || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      $('meetingsStatus').textContent = 'Bitte Datum in der Zukunft und 1 bis 20 Freunde angeben.'; return;
    }
    button.disabled = true;
    try {
      await friendRpc('zs_meeting_create',{p_title:$('meetingTitle').value,p_place:$('meetingPlace').value,p_starts_at:date.toISOString(),p_invitees:names});
      if (started !== generation) return;
      e.target.reset(); await loadMeetings();
      $('meetingsStatus').textContent = 'Treffen erstellt und Einladungen gespeichert.';
    } catch { if (started === generation) $('meetingsStatus').textContent = 'Das Erstellen konnte nicht bestätigt werden. Aktualisiere die Liste, bevor du es erneut versuchst, und prüfe die Eingaben.'; }
    finally { button.disabled = false; }
  });
  $('meetingRefresh').addEventListener('click', loadMeetings);
  async function loadFriends() {
    const started = generation;
    const list = $('friendsList');
    list.replaceChildren();
    $('friendsStatus').textContent = 'Freunde und Anfragen werden geladen …';
    try {
      const rows = await friendRpc('zs_friend_list', {});
      if (started !== generation) return;
      if (!Array.isArray(rows)) throw new Error('RESPONSE');
      if (!rows.length) $('friendsStatus').textContent = 'Noch keine Freunde oder offenen Anfragen.';
      else $('friendsStatus').textContent = '';
      for (const row of rows) {
        const item = document.createElement('div');
        item.className = 'friend-item';
        const title = document.createElement('strong');
        title.textContent = row.display_name + ' (@' + row.username + ')';
        const info = document.createElement('p');
        info.textContent = row.status === 'accepted' ? 'Befreundet' : row.direction === 'received' ? 'Eingegangene Anfrage' : 'Anfrage gesendet';
        item.append(title, info);
        if (row.status === 'pending' && row.direction === 'received') {
          for (const [label, accept] of [['Annehmen',true], ['Ablehnen',false]]) {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = label;
            button.addEventListener('click', async () => {
              button.disabled = true;
              try { await friendRpc('zs_friend_answer', {p_request_id:row.request_id,p_accept:accept}); await loadFriends(); }
              catch { $('friendsStatus').textContent = 'Die Anfrage konnte nicht beantwortet werden.'; button.disabled = false; }
            });
            item.append(button);
          }
        }
        list.append(item);
      }
    } catch { if (started === generation) $('friendsStatus').textContent = 'Freunde konnten nicht geladen werden. Bitte erneut anmelden oder später versuchen.'; }
  }
  $('friendForm').addEventListener('submit', async e => {
    e.preventDefault(); const button = e.submitter; button.disabled = true;
    try {
      await friendRpc('zs_friend_send', {p_username:$('friendUsername').value.trim()});
      $('friendUsername').value = ''; await loadFriends();
      $('friendsStatus').textContent = 'Anfrage gesendet.';
    } catch { $('friendsStatus').textContent = 'Anfrage nicht möglich. Prüfe den Benutzernamen und bestehende Anfragen.'; }
    finally { button.disabled = false; }
  });
  $('friendRefresh').addEventListener('click', loadFriends);
  async function loadProfile() {
    const started = generation;
    $('profileName').textContent = 'Profil wird geladen …';
    $('profileUser').textContent = '';
    try {
      const r = await request('/rest/v1/rpc/zeitschulden_mein_profil', {method:'POST', headers:{Authorization:'Bearer ' + session.access_token}, body:'{}'});
      if (started !== generation) return;
      if (!r.ok || !Array.isArray(r.body) || r.body.length !== 1) throw new Error();
      $('profileName').textContent = r.body[0].display_name;
      $('profileUser').textContent = '@' + r.body[0].username;
      await loadFriends();
      if (started === generation) await loadMeetings();
    } catch {
      if (started === generation) $('profileName').textContent = 'Profil konnte nicht geladen werden.';
    }
  }
  function persist(s, remember) { clear(); (remember ? localStorage : sessionStorage).setItem(key, JSON.stringify(s)); session = s; }
  async function verify(s, remember) { const started=generation; if (!s || typeof s.access_token !== 'string' || typeof s.refresh_token !== 'string') return false; let result = await request('/auth/v1/user', {method:'GET',headers:{Authorization:'Bearer ' + s.access_token}}); if (result.status === 401) { const refresh = await request('/auth/v1/token?grant_type=refresh_token', {method:'POST',body:JSON.stringify({refresh_token:s.refresh_token})}); if (started !== generation || !refresh.ok || !refresh.body.access_token || !refresh.body.refresh_token) return false; s = {access_token:refresh.body.access_token,refresh_token:refresh.body.refresh_token}; persist(s,remember); result = await request('/auth/v1/user',{method:'GET',headers:{Authorization:'Bearer '+s.access_token}}); } if (result.ok && started === generation) { session=s; return true; } return false; }
  for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => { say(''); show(b.dataset.tab); });
  $('loginForm').addEventListener('submit', async e => { e.preventDefault(); if (!validConfig()) return say('Die Verbindung ist noch nicht eingerichtet.'); const button=e.submitter; button.disabled=true; try { const r=await action({action:'login',username:$('loginUser').value,password:$('loginPassword').value}); $('loginPassword').value=''; if(!r.ok) return say(r.status===429?'Zu viele Versuche. Bitte warte eine Minute.':'Anmeldung nicht möglich. Bitte prüfe deine Eingaben.'); if (!r.body.access_token || !r.body.refresh_token) return say('Die Anmeldung konnte nicht abgeschlossen werden.'); persist({access_token:r.body.access_token,refresh_token:r.body.refresh_token},$('remember').checked); if (!await verify(session,$('remember').checked)) { clear(); session=null; return say('Die Sitzung konnte nicht bestätigt werden.'); } show('signedIn'); say(''); await loadProfile(); } catch { say('Verbindung fehlgeschlagen. Bitte erneut versuchen.'); } finally {button.disabled=false;} });
  $('registerForm').addEventListener('submit', async e => { e.preventDefault(); if (!validConfig()) return say('Die Verbindung ist noch nicht eingerichtet.'); const password=$('regPassword').value; if(new TextEncoder().encode(password).length>72) return say('Das Passwort darf höchstens 72 UTF-8-Bytes lang sein.'); const button=e.submitter; button.disabled=true; try { const r=await action({action:'register',username:$('regUser').value,display_name:$('displayName').value,invite_code:$('invite').value,password,recovery_email:$('recoveryEmail').value}); $('regPassword').value=''; if(!r.ok) { if(r.status===503 && r.body.error==='REGISTRATION_UNCERTAIN') return say('Der Abschluss ist unklar. Bitte nicht erneut registrieren; der Kontostatus muss geprüft werden.'); return say(r.status===429?'Zu viele Versuche. Bitte warte eine Minute.':'Registrierung nicht möglich. Bitte prüfe deine Eingaben und den Einladungscode.'); } $('invite').value=''; if(r.body.recovery==='verification_pending') say('Konto erstellt. Bitte bestätige die E-Mail in deinem Postfach.'); else if(r.body.recovery==='not_started') say('Konto erstellt, aber die E-Mail-Bestätigung konnte nicht gestartet werden. Bitte nicht erneut registrieren.'); else say('Konto erstellt. Du kannst dich jetzt anmelden.'); show('login'); } catch {say('Der Status ist unklar. Bitte nicht erneut registrieren, bevor der Kontostatus geprüft wurde.');} finally {button.disabled=false;} });
  $('recoverForm').addEventListener('submit',async e=>{e.preventDefault();if(!validConfig())return say('Die Verbindung ist noch nicht eingerichtet.');const button=e.submitter;button.disabled=true;try{const r=await action({action:'recover',username:$('recoverUser').value});say(r.status===429?'Zu viele Versuche. Bitte warte eine Minute.':r.ok?'Falls eine bestätigte E-Mail hinterlegt ist, erhältst du eine Nachricht.':'Die Anfrage konnte nicht verarbeitet werden.');}catch{say('Verbindung fehlgeschlagen. Bitte erneut versuchen.');}finally{button.disabled=false;}});
  $('logout').addEventListener('click', async()=>{const s=session;generation++;clear();session=null;$('friendsList').replaceChildren();$('friendsStatus').textContent='';$('meetingsList').replaceChildren();$('meetingsStatus').textContent='';$('meetingForm').reset();$('profileName').textContent='';$('profileUser').textContent='';show('login');say('Du bist abgemeldet.');if(s?.access_token){try{const r=await request('/auth/v1/logout',{method:'POST',headers:{Authorization:'Bearer '+s.access_token}});if(!r.ok) throw new Error();}catch{say('Lokal abgemeldet. Die serverseitige Abmeldung konnte nicht bestätigt werden.');}}});
  (async()=>{ if(!validConfig()) return say('Bitte zuerst die Verbindung in config.js einrichten.'); const remember=!!localStorage.getItem(key); let raw=localStorage.getItem(key)||sessionStorage.getItem(key); if(!raw)return; try { const s=JSON.parse(raw); if(await verify(s,remember)){show('signedIn');await loadProfile();}else {clear();say('Bitte melde dich erneut an.');} } catch {say('Die Sitzung konnte nicht geprüft werden. Bitte überprüfe deine Verbindung.');} })();
})();
