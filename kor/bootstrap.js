/* Only this edition defaults to Korean. Upstream locales retain their normal behavior. */
window.PS_KOR = true;
try { if (!localStorage.getItem('ps.lang')) localStorage.setItem('ps.lang', 'ko'); } catch {}
