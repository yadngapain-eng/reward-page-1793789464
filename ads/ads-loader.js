// Adsterra loader
(function () {
  function runScripts(container) {
    container.querySelectorAll('script').forEach(old => {
      const s = document.createElement('script');
      for (const a of old.attributes) s.setAttribute(a.name, a.value);
      s.text = old.textContent;
      old.replaceWith(s);
    });
  }

  function inject(slot) {
    const key = slot.dataset.ad;
    const cfg = window.ADSTERRA && window.ADSTERRA[key];
    if (!cfg) return;
    if (cfg.html && cfg.html.trim()) {
      slot.innerHTML = cfg.html;
      runScripts(slot);
    } else if (cfg.url) {
      slot.innerHTML = '<a href="' + cfg.url + '" target="_blank" rel="noopener" ' +
        'style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#ff7a45,#ffb347);' +
        'color:#1a1200;border-radius:12px;font-weight:700;text-decoration:none" data-ad-link="1">🎁 Lihat Penawaran Spesial</a>';
    }
  }

  function loadGlobal() {
    ['social_bar', 'popunder'].forEach(key => {
      const cfg = window.ADSTERRA && window.ADSTERRA[key];
      if (!cfg || !cfg.html || !cfg.html.trim()) return;
      // Popunder sekali per sesi (sessionStorage)
      if (key === 'popunder' && sessionStorage.getItem('popunder_loaded')) return;
      const holder = document.createElement('div');
      holder.style.display = 'none';
      holder.innerHTML = cfg.html;
      document.body.appendChild(holder);
      runScripts(holder);
      if (key === 'popunder') sessionStorage.setItem('popunder_loaded', '1');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.ad-slot').forEach(inject);
    loadGlobal();
  });
})();
