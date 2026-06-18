
// DPE Explorer — couche API centralisée ADEME / Audit / BAN
(function () {
  'use strict';

  const CFG = window.DPE_CONFIG;

  // Compatibilité avec l'ancien app.js : ces noms restent disponibles en global.
  window.ADEME = CFG.ADEME_DPE_LINES;
  window.ADEME_AUDIT = CFG.ADEME_AUDIT_LINES;
  window.PROXY_BASE = CFG.PROXY_BASE;
  window.PROXY_CONFIGURED = CFG.PROXY_CONFIGURED;

  // Les noms de champs ADEME peuvent contenir des accents : on encode les valeurs,
  // pas les clés, pour éviter le double encodage côté Data Fair.
  window.ademeQs = function ademeQs(params) {
    return Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => k + '=' + encodeURIComponent(v))
      .join('&');
  };

  window.buildDatasetUrl = function buildDatasetUrl(dataset, params) {
    return CFG.ADEME_BASE + '/' + dataset + '/lines?' + window.ademeQs(params || {});
  };

  window.buildUrl = function buildUrl(params) {
    if (!CFG.PROXY_CONFIGURED) return null;
    return CFG.PROXY_BASE + '/?' + window.ademeQs(params || {});
  };

  window.buildUrlRaw = function buildUrlRaw(rawParams) {
    if (!CFG.PROXY_CONFIGURED) return null;
    return CFG.PROXY_BASE + '/?' + (rawParams || '');
  };

  window.displayUrl = function displayUrl(params) {
    return CFG.ADEME_DPE_LINES + '?' + window.ademeQs(params || {});
  };

  window.displayAuditUrl = function displayAuditUrl(params) {
    return CFG.ADEME_AUDIT_LINES + '?' + window.ademeQs(params || {});
  };

  window.directDpeUrl = function directDpeUrl(params) {
    return CFG.ADEME_DPE_LINES + '?' + window.ademeQs(params || {});
  };

  window.directAuditUrl = function directAuditUrl(params) {
    return CFG.ADEME_AUDIT_LINES + '?' + window.ademeQs(params || {});
  };

  window.banGeocodeUrl = function banGeocodeUrl(address, limit) {
    return CFG.BAN_API + '?limit=' + (limit || 1) + '&q=' + encodeURIComponent(address || '');
  };

  async function fetchJson(fetchUrl, label) {
    if (CFG.DEBUG) console.log('[DPE Explorer] Fetch ' + (label || 'api'), fetchUrl);
    const r = await fetch(fetchUrl, { headers: { Accept: 'application/json' } });
    if (!r.ok) {
      const err = new Error('HTTP ' + r.status + ' — ' + r.statusText);
      err.status = r.status;
      err.url = fetchUrl;
      throw err;
    }
    return await r.json();
  }

  window.fetchJson = fetchJson;

  window.fetchAdemeDirect = function fetchAdemeDirect(params) {
    return fetchJson(CFG.ADEME_DPE_LINES + '?' + window.ademeQs(params || {}), 'ademe-direct-dpe');
  };

  window.fetchAuditDirect = function fetchAuditDirect(params) {
    return fetchJson(CFG.ADEME_AUDIT_LINES + '?' + window.ademeQs(params || {}), 'ademe-direct-audit');
  };

  window.geocodeBAN = async function geocodeBAN(address, limit) {
    return fetchJson(window.banGeocodeUrl(address, limit || 1), 'ban-geocode');
  };

  // Fonction historique conservée pour ne pas casser app.js.
  // Elle reste responsable de l'état UI des boutons, mais la logique réseau est centralisée ici.
  window.apiFetch = async function apiFetch(url, btnId, statusId) {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.disabled = true;
      btn.dataset.previousText = btn.textContent;
      btn.textContent = '⏳ Chargement…';
    }

    if (!CFG.PROXY_CONFIGURED || !url) {
      if (typeof window.setStatus === 'function') {
        window.setStatus(statusId, 'err',
          '⚙ Worker non configuré — configure PROXY_BASE dans <strong>js/config.js</strong>.');
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.previousText || '→ Exécuter';
      }
      return null;
    }

    if (typeof window.setStatus === 'function') {
      window.setStatus(statusId, 'info', '<span class="spin">↻</span> &nbsp;Requête en cours…');
    }

    try {
      try {
        const d = await fetchJson(url, 'proxy');
        if (typeof window.clearStatus === 'function') window.clearStatus(statusId);
        return d;
      } catch (eProxy) {
        const canFallbackDirect = eProxy.status === 403 && url.startsWith(CFG.PROXY_BASE + '/?');
        if (!canFallbackDirect) throw eProxy;

        const directUrl = CFG.ADEME_DPE_LINES + '?' + url.split('/?')[1];
        console.warn('[DPE Explorer] Proxy 403. Tentative ADEME directe.', { proxyUrl: url, directUrl });
        const d = await fetchJson(directUrl, 'ADEME direct après 403 proxy');
        if (typeof window.clearStatus === 'function') window.clearStatus(statusId);
        return d;
      }
    } catch (e) {
      console.error('[DPE Explorer] Erreur API', e);
      if (typeof window.setStatus === 'function') {
        window.setStatus(statusId, 'err', '✖ ' + e.message +
          '<br><span style="font-size:11px;color:var(--muted)">Voir la console navigateur pour le détail.</span>');
      }
      return null;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.previousText || '→ Exécuter';
      }
    }
  };
})();
