// DPE Explorer - module métier DPE
// Dépendances globales conservées pendant le refactoring progressif : buildUrl, displayUrl, apiFetch, renderDpeCard.

function parseAdemeNumberList(text) {
  return [...new Set(String(text || '')
    .split(/[\s,;]+/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean))];
}

function isAuditNumber(num) {
  return /^A\d/i.test(String(num || '').trim());
}

async function fetchDpeByNumber(num) {
  const params = { q: num, size: '1' };
  const data = typeof fetchAdemeDirect === 'function'
    ? await fetchAdemeDirect(params)
    : await fetchJson(directDpeUrl(params), 'dpe-number');
  return data?.results?.[0] || null;
}

async function fetchAuditByNumberForMap(num) {
  const params = { q: num, size: '50' };
  const data = typeof fetchAuditDirect === 'function'
    ? await fetchAuditDirect(params)
    : await fetchJson(directAuditUrl(params), 'audit-number-map');
  const rows = (data?.results || []).filter(r => String(r.n_audit || '').toUpperCase() === String(num).toUpperCase() || String(r.n_audit || '').toUpperCase().includes(String(num).toUpperCase()));
  return typeof normalizeAuditRows === 'function' ? normalizeAuditRows(rows.length ? rows : data?.results || []) : null;
}

async function searchDpe() {
  const num = document.getElementById('inp-dpe').value.trim();
  if (!num) return;
  // Recherche fulltext sur le numéro DPE — pas de q_fields pour éviter les pb d'encodage
  const params = { q: num, size: '1' };
  const url = buildUrl(params);
  document.getElementById('url-search').innerHTML = 'GET &nbsp;<span>' + displayUrl(params) + '</span>';
  const data = await apiFetch(url, 'btn-search', 'search');
  if (!data) return;
  const el = document.getElementById('result-search');
  if (!data.results?.length) {
    el.innerHTML = `<div class="card" style="color:var(--muted)">Aucun DPE trouvé pour ce numéro.<br>
      Le DPE est peut-être trop récent (synchro hebdomadaire) ou le numéro est incorrect.</div>`;
    return;
  }
  const d = data.results[0];
  el.innerHTML = renderDpeCard(d, data.total);
}

async function loadAdemeListOnMap() {
  const textarea = document.getElementById('inp-ademe-list');
  const single = document.getElementById('inp-dpe')?.value || '';
  const nums = parseAdemeNumberList((textarea?.value || '').trim() || single);
  const btn = document.getElementById('btn-map-list');
  const urlEl = document.getElementById('url-search');

  if (!nums.length) {
    if (typeof setStatus === 'function') setStatus('search', 'err', 'Collez au moins un numéro DPE ou Audit ADEME.');
    return;
  }

  const dpes = [];
  const audits = [];
  const errors = [];
  if (btn) { btn.disabled = true; btn.dataset.previousText = btn.textContent; btn.textContent = '⏳ Chargement…'; }
  if (typeof setStatus === 'function') setStatus('search', 'info', '<span class="spin">↻</span> Chargement de la sélection ADEME…');
  if (urlEl) urlEl.innerHTML = 'GET &nbsp;<span>Chargement de ' + nums.length + ' numéro(s) ADEME</span>';

  try {
    for (let i = 0; i < nums.length; i++) {
      const num = nums[i];
      try {
        if (isAuditNumber(num)) {
          const audit = await fetchAuditByNumberForMap(num);
          if (audit) audits.push(audit); else errors.push(num + ' introuvable');
        } else {
          const dpe = await fetchDpeByNumber(num);
          if (dpe) dpes.push(dpe); else errors.push(num + ' introuvable');
        }
        if (typeof setStatus === 'function') {
          setStatus('search', 'info', '<span class="spin">↻</span> Chargement ' + (i + 1) + '/' + nums.length + ' · ' + dpes.length + ' DPE · ' + audits.length + ' audit(s)');
        }
      } catch(e) {
        console.warn('[DPE Explorer] Erreur chargement numéro ADEME', num, e);
        errors.push(num + ' erreur API');
      }
    }

    const dedupedDpes = [...new Map(dpes.map(d => [d.numero_dpe || d._id || JSON.stringify(d), d])).values()];
    const dedupedAudits = [...new Map(audits.map(a => [a.n_audit || JSON.stringify(a), a])).values()];
    if (!dedupedDpes.length && !dedupedAudits.length) {
      if (typeof setStatus === 'function') setStatus('search', 'err', 'Aucun DPE/Audit exploitable trouvé dans la liste.');
      return;
    }

    if (typeof setMapFromAdemeSelection === 'function') {
      setMapFromAdemeSelection(dedupedDpes, dedupedAudits, 'Sélection par N° ADEME');
      if (typeof setStatus === 'function') {
        setStatus('search', errors.length ? 'ok' : 'ok', dedupedDpes.length + ' DPE · ' + dedupedAudits.length + ' audit(s) chargés sur la carte.' + (errors.length ? ' ' + errors.length + ' numéro(s) introuvable(s).' : ''));
      }
    } else {
      if (typeof setStatus === 'function') setStatus('search', 'err', 'Module carte indisponible.');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.previousText || '🗺 Afficher la sélection sur la carte'; }
  }
}

function loadDpeFromAddr(jsonStr) {
  const d = JSON.parse(jsonStr);
  if (typeof activatePanel === 'function') activatePanel('search');
  else {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-search')?.classList.add('active');
  }
  const result = document.getElementById('result-search');
  const url = document.getElementById('url-search');
  if (result) result.innerHTML = renderDpeCard(d, 1);
  if (url) url.innerHTML = 'GET &nbsp;<span>Chargé depuis la recherche adresse / carte</span>';
  window.scrollTo(0, 0);
}

function loadDpeFromAddrB64(b64) {
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    loadDpeFromAddr(json);
  } catch(e) {
    console.error('Erreur B64:', e);
  }
}

window.searchDpe = searchDpe;
window.loadAdemeListOnMap = loadAdemeListOnMap;
window.loadDpeFromAddr = loadDpeFromAddr;
window.loadDpeFromAddrB64 = loadDpeFromAddrB64;
