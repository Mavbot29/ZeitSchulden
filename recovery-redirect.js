'use strict';
{ const p = new URLSearchParams(location.hash.slice(1)); if (p.get('type') === 'recovery' || p.get('type') === 'email_change' || p.has('error')) { const fragment = location.hash; history.replaceState(null, '', location.pathname); location.replace('./auth-callback.html' + fragment); } }
