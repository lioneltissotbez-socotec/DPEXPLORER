// DPE Explorer - logique applicative principale
/* ── NAV ── */
function activatePanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');
  const nav = document.querySelector('.nav-item[data-panel="' + id + '"]');
  if (nav) nav.classList.add('active');
  if (id === 'addr') {
    setTimeout(() => {
      const map = typeof window.getAddrLeafletMap === 'function' ? window.getAddrLeafletMap() : window.addrLeafletMap;
      if (map && typeof map.invalidateSize === 'function') map.invalidateSize();
    }, 120);
  }
}

function show(id) {
  activatePanel(id);
}

window.activatePanel = activatePanel;
window.show = show;

/* ── UTILS ── */
function fmt(v) { return (v !== null && v !== undefined && v !== '') ? v : '—'; }
function fmtN(v, dec=0) {
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return dec ? n.toFixed(dec) : Math.round(n).toLocaleString('fr-FR');
}
function etiq(v, lg) {
  if (!v) return '—';
  return `<span class="etiq${lg?' etiq-lg':''} ${v}">${v}</span>`;
}

function setStatus(id, type, msg) {
  const el = document.getElementById('st-' + id);
  el.className = 'status ' + type;
  el.innerHTML = msg;
}
function clearStatus(id) {
  const el = document.getElementById('st-' + id);
  el.className = 'status';
  el.style.display = '';
}
window.setStatus = setStatus;
window.clearStatus = clearStatus;

// apiFetch est maintenant défini dans js/api.js

/* ─────────────────────────────────────────
   ONGLET 1 — RECHERCHE PAR N° DPE
───────────────────────────────────────── */
// searchDpe déplacée dans js/dpe.js


// renderDpeCard déplacée dans js/render-dpe.js


/* ─────────────────────────────────────────
   ONGLET 2 — STATS PAR VILLE
───────────────────────────────────────── */
async function loadStats() {
  const cp = document.getElementById('inp-cp').value.trim();
  const size = document.getElementById('inp-size').value;
  if (!cp) return;
  // Champs sans accents dans les noms pour éviter l'erreur 400
  // Vrais noms de champs confirmés par l'API
  const fields = 'etiquette_dpe,etiquette_ges,surface_habitable_logement,type_batiment,conso_5_usages_ef,emission_ges_5_usages_par_m2,type_energie_principale_chauffage,periode_construction,nom_commune_ban,cout_total_5_usages';
  const params = { q: cp, select: fields, size: size };
  const url = buildUrl(params);
  document.getElementById('url-stats').innerHTML = 'GET &nbsp;<span>' + displayUrl(params) + '</span>';
  const data = await apiFetch(url, 'btn-stats', 'stats');
  if (!data?.results) return;
  renderStats(data, cp);
}

function renderStats(data, cp) {
  const res = data.results;
  const n = res.length;
  if (!n) { document.getElementById('result-stats').innerHTML = '<div class="card" style="color:var(--muted)">Aucun résultat pour ce code postal.</div>'; return; }

  const ville = res[0]['nom_commune_ban'] || cp;
  const EC = {};
  ['A','B','C','D','E','F','G'].forEach(e => EC[e] = 0);
  let totConso=0, nConso=0, totSurf=0, nSurf=0, totGes=0, nGes=0;
  const enrg = {}, types = {};

  res.forEach(r => {
    const e = r['etiquette_dpe'];
    if (e && EC[e] !== undefined) EC[e]++;
    const c = parseFloat(r['conso_5_usages_ef']);
    if (!isNaN(c)) { totConso += c; nConso++; }
    const s = parseFloat(r['surface_habitable_logement']);
    if (!isNaN(s)) { totSurf += s; nSurf++; }
    const g = parseFloat(r['emission_ges_5_usages_par_m2']);
    if (!isNaN(g)) { totGes += g; nGes++; }
    const en = r['type_energie_principale_chauffage'] || 'Non renseigné';
    enrg[en] = (enrg[en] || 0) + 1;
    const ty = r['type_batiment'] || 'Non renseigné';
    types[ty] = (types[ty] || 0) + 1;
  });

  const maxBar = Math.max(...Object.values(EC), 1);
  const passoires = EC['F'] + EC['G'];
  const passPct = Math.round((passoires / n) * 100);
  const bCols = { A:'#1a5c3a', B:'#2d5e16', C:'#4d6b0f', D:'#7c5a08', E:'#7c3a08', F:'#7c1212', G:'#500d0d' };
  const bText = { A:'#4ade80', B:'#86efac', C:'#bef264', D:'#fde68a', E:'#fdba74', F:'#fca5a5', G:'#ef4444' };
  const modeE = ['A','B','C','D','E','F','G'].reduce((a,b) => EC[a] >= EC[b] ? a : b);
  const enrgTop = Object.entries(enrg).sort((a,b) => b[1]-a[1]).slice(0, 5);
  const enrgMax = enrgTop[0]?.[1] || 1;
  const typesHtml = Object.entries(types).sort((a,b)=>b[1]-a[1]).map(([t,c]) => '<span style="font-size:12px;padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);color:#6b7280;margin:2px;display:inline-block">' + t + ' <strong style="color:#e8eaf0">' + c + '</strong></span>').join('');

  document.getElementById('result-stats').innerHTML = `
  <div class="card">
    <div style="font-size:18px;font-weight:700;margin-bottom:4px">${ville} · ${cp}</div>
    <div style="font-family:var(--mono);font-size:12px;color:var(--muted);margin-bottom:20px">
      ${n.toLocaleString('fr-FR')} DPE analysés sur ${data.total?.toLocaleString('fr-FR') || '?'} au total
    </div>

    <div class="metrics">
      <div class="metric cyan"><div class="v">${Math.round(totConso/Math.max(nConso,1)).toLocaleString('fr-FR')}</div><div class="l">kWh EF/an moyen</div></div>
      <div class="metric"><div class="v">${Math.round(totSurf/Math.max(nSurf,1))} m²</div><div class="l">Surface moy.</div></div>
      <div class="metric amber"><div class="v">${Math.round(totGes/Math.max(nGes,1))}</div><div class="l">kg CO₂/m²/an moy.</div></div>
      <div class="metric" style="border:1px solid rgba(239,68,68,.3)"><div class="v" style="color:#fca5a5">${passPct}%</div><div class="l">Passoires F+G</div></div>
      <div class="metric accent"><div class="v">${etiq(modeE)}</div><div class="l">Étiquette dominante</div></div>
    </div>

    <div class="sep"></div>
    <div class="card-title">Répartition des étiquettes DPE</div>
    ${['A','B','C','D','E','F','G'].map(e => `
    <div class="bar-row">
      <div class="bar-label">${etiq(e)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round((EC[e]/maxBar)*100)}%;background:${bCols[e]}"></div></div>
      <div class="bar-count"><span style="color:${bText[e]}">${EC[e]}</span> <span style="opacity:.5">(${Math.round((EC[e]/n)*100)}%)</span></div>
    </div>`).join('')}

    <div class="sep"></div>
    <div class="card-title">Énergies de chauffage</div>
    ${enrgTop.map(([en,cnt]) => `
    <div class="bar-row">
      <div style="font-family:var(--mono);font-size:11px;color:var(--muted);width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${en}">${en}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round((cnt/enrgMax)*100)}%;background:var(--accent2);opacity:.5"></div></div>
      <div class="bar-count">${cnt}</div>
    </div>`).join('')}

    <div class="sep"></div>
    <div class="card-title">Types de logements</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${typesHtml}</div>
  </div>`;
}

/* ─────────────────────────────────────────
   JSON COLORIZER
───────────────────────────────────────── */
function colorizeJson(str) {
  return str
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, m => {
      if (/^"/.test(m)) {
        if (/:$/.test(m)) return `<span class="json-key">${m}</span>`;
        return `<span class="json-str">${m}</span>`;
      }
      if (/null/.test(m)) return `<span class="json-null">${m}</span>`;
      return `<span class="json-num">${m}</span>`;
    });
}

/* ─────────────────────────────────────────
   ONGLET ADRESSE
───────────────────────────────────────── */
// ── État des filtres ──
const activeFilters = { etiq_dpe: new Set(), etiq_ges: new Set(), periode: new Set(), energie: new Set(), type_hab: new Set() };

function toggleFilter(btn) {
  const group = btn.dataset.group;
  const val   = btn.dataset.val;
  if (activeFilters[group].has(val)) {
    activeFilters[group].delete(val);
    btn.classList.remove('active');
  } else {
    activeFilters[group].add(val);
    btn.classList.add('active');
  }
  updateFilterBadge();
}

function updateFilterBadge() {
  let count = 0;
  Object.values(activeFilters).forEach(s => count += s.size);
  const dMin = document.getElementById('f-date-min').value;
  const dMax = document.getElementById('f-date-max').value;
  const sMin = document.getElementById('f-surf-min').value;
  const sMax = document.getElementById('f-surf-max').value;
  if (dMin) count++;
  if (dMax) count++;
  if (sMin) count++;
  if (sMax) count++;
  const badge = document.getElementById('filter-badge');
  if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; }
  else { badge.style.display = 'none'; }
}

function resetFilters() {
  Object.keys(activeFilters).forEach(g => activeFilters[g].clear());
  document.querySelectorAll('.f-btn, .f-btn-sm').forEach(b => b.classList.remove('active'));
  document.getElementById('f-date-min').value = '';
  document.getElementById('f-date-max').value = '';
  document.getElementById('f-surf-min').value = '';
  document.getElementById('f-surf-max').value = '';
  document.getElementById('f-sort').value = '-date_etablissement_dpe';
  updateFilterBadge();
}

function buildQsFilters() {
  // Construit les filtres qs pour l&#39;API ADEME
  const parts = [];

  if (activeFilters.etiq_dpe.size > 0) {
    const vals = [...activeFilters.etiq_dpe].map(v => 'etiquette_dpe:' + v).join(' OR ');
    parts.push(activeFilters.etiq_dpe.size === 1 ? 'etiquette_dpe:' + [...activeFilters.etiq_dpe][0] : '(' + vals + ')');
  }
  if (activeFilters.etiq_ges.size > 0) {
    const vals = [...activeFilters.etiq_ges].map(v => 'etiquette_ges:' + v).join(' OR ');
    parts.push(activeFilters.etiq_ges.size === 1 ? 'etiquette_ges:' + [...activeFilters.etiq_ges][0] : '(' + vals + ')');
  }
  if (activeFilters.periode.size > 0) {
    const vals = [...activeFilters.periode].map(v => 'periode_construction:"' + v + '"').join(' OR ');
    parts.push(activeFilters.periode.size === 1 ? 'periode_construction:"' + [...activeFilters.periode][0] + '"' : '(' + vals + ')');
  }
  if (activeFilters.energie.size > 0) {
    const vals = [...activeFilters.energie].map(v => 'type_energie_principale_chauffage:"' + v + '"').join(' OR ');
    parts.push(activeFilters.energie.size === 1 ? 'type_energie_principale_chauffage:"' + [...activeFilters.energie][0] + '"' : '(' + vals + ')');
  }
  if (activeFilters.type_hab.size > 0) {
    const vals = [...activeFilters.type_hab].map(v => 'type_batiment:' + v).join(' OR ');
    parts.push(activeFilters.type_hab.size === 1 ? 'type_batiment:' + [...activeFilters.type_hab][0] : '(' + vals + ')');
  }

  // Dates
  const dMin = document.getElementById('f-date-min').value;
  const dMax = document.getElementById('f-date-max').value;
  if (dMin || dMax) {
    const from = dMin || '*';
    const to   = dMax || '*';
    parts.push('date_etablissement_dpe:[' + from + ' TO ' + to + ']');
  }

  // Surface
  const sMin = document.getElementById('f-surf-min').value;
  const sMax = document.getElementById('f-surf-max').value;
  if (sMin || sMax) {
    const from = sMin || '*';
    const to   = sMax || '*';
    parts.push('surface_habitable_logement:[' + from + ' TO ' + to + ']');
  }

  return parts.join(' AND ');
}

// escapeQsValue est définie et exportée dans js/map.js (window.escapeQsValue)

function normAddr(v) {
  return String(v || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/\bavenue\b/g, 'av')
    .replace(/\bboulevard\b/g, 'bd')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\s+/g, ' ')
    .trim();
}

function normStreet(v) {
  // Version souple pour comparer “rue gustave courbet” avec “Rue Gustave Courbet”.
  return normAddr(v)
    .replace(/\b(rue|r|route|avenue|av|boulevard|bd|chemin|impasse|place|allee|allée|cours)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCp(v) {
  const m = String(v || '').match(/\b\d{5}\b/);
  return m ? m[0] : '';
}

function parseLocationInput(v) {
  const raw = String(v || '').trim();
  const cp = extractCp(raw);
  const commune = raw.replace(/\b\d{5}\b/g, '').trim();
  return { raw, cp, commune };
}

function buildExactAddressCandidateParams(num, rue, ville, size, sort, qsFilters) {
  const loc = parseLocationInput(ville);
  const cpOrVille = loc.cp || loc.commune || ville;

  // Important v4 : on ne met PLUS de qs en recherche exacte.
  // Le 403 observé vient du proxy lorsque q + qs sont combinés sur une recherche texte.
  // On fait donc une recherche plein texte ADEME, puis le filtrage strict est fait côté navigateur.
  return {
    q: [num, rue, cpOrVille].filter(Boolean).join(' '),
    size: String(Math.max(parseInt(size || '20', 10), 100)),
    sort
  };
}

function buildExactAddressFallbackParams(num, rue, ville, size, sort) {
  const loc = parseLocationInput(ville);
  const cpOrVille = loc.cp || loc.commune || ville;
  return {
    q: [rue, cpOrVille].filter(Boolean).join(' '),
    size: String(Math.max(parseInt(size || '20', 10), 100)),
    sort
  };
}

function isExactAddressMatch(d, num, rue, ville) {
  const nNum = normAddr(num);
  const nRue = normStreet(rue);
  const loc = parseLocationInput(ville);
  const cpWanted = loc.cp;
  const villeWanted = normAddr(loc.commune || loc.raw);

  const dNum = normAddr(d.numero_voie_ban || '');
  const dRue = normStreet(d.nom_rue_ban || '');
  const dCp  = String(d.code_postal_ban || d.code_postal_brut || '');
  const dVille = normAddr(d.nom_commune_ban || d.nom_commune_brut || '');
  const dAdr = normAddr(d.adresse_brut || d.adresse_ban || d.adresse_complete_brut || '');
  const dAdrStreet = normStreet(d.adresse_brut || d.adresse_ban || d.adresse_complete_brut || '');

  const numOk = !nNum || dNum === nNum || dAdr.startsWith(nNum + ' ');
  const rueOk = !nRue || dRue === nRue || dRue.includes(nRue) || dAdrStreet.includes(nRue);
  const locOk = cpWanted ? dCp === cpWanted : (!villeWanted || dVille === villeWanted || dVille.includes(villeWanted));

  return numOk && rueOk && locOk;
}

function compactDpeForLog(d) {
  return {
    numero_dpe: d.numero_dpe,
    adresse_brut: d.adresse_brut,
    adresse_ban: d.adresse_ban,
    adresse_complete_brut: d.adresse_complete_brut,
    numero_voie_ban: d.numero_voie_ban,
    nom_rue_ban: d.nom_rue_ban,
    code_postal_ban: d.code_postal_ban,
    nom_commune_ban: d.nom_commune_ban,
    score_ban: d.score_ban,
    statut_geocodage: d.statut_geocodage,
    etiquette_dpe: d.etiquette_dpe,
    surface_habitable_logement: d.surface_habitable_logement
  };
}

async function searchAddr() {
  const num   = document.getElementById('inp-num').value.trim();
  const rue   = document.getElementById('inp-rue').value.trim();
  const ville = document.getElementById('inp-ville').value.trim();
  const size  = document.getElementById('inp-addr-size').value;
  const sort  = document.getElementById('f-sort').value;
  const exact = document.getElementById('f-exact-addr')?.checked;
  const mapMode = document.getElementById('f-map-nearby')?.checked;

  if (!rue && !ville && !num) {
    setStatus('addr', 'err', '⚠ Renseignez au moins une ville ou une rue.');
    return;
  }

  if (mapMode) {
    await searchAddrNearbyMap(num, rue, ville, size, sort);
    return;
  }

  const qsFilters = buildQsFilters();
  const q = [num, rue, ville].filter(Boolean).join(' ');
  let params = { size, sort };

  if (exact) {
    if (!num || !rue || !ville) {
      setStatus('addr', 'err', '⚠ En recherche exacte, renseignez le numéro, la rue et la ville ou le code postal.');
      return;
    }
    params = buildExactAddressCandidateParams(num, rue, ville, size, sort, qsFilters);
  } else {
    params.q = q;
    if (qsFilters) params.qs = qsFilters;
  }

  const url = buildUrl(params);
  document.getElementById('url-addr').innerHTML = 'GET &nbsp;<span>' + displayUrl(params) + '</span>';
  hideAddrMap();

  console.groupCollapsed('[DPE Explorer] Recherche adresse' + (exact ? ' exacte' : ''));
  console.log('Saisie utilisateur', { numero: num, rue: rue, ville: ville, exact: exact });
  console.log('Paramètres API', params);
  console.log('URL API affichée', displayUrl(params));

  let data = await apiFetch(url, 'btn-addr', 'addr');
  if (!data) { console.groupEnd(); return; }

  console.log('Total ADEME retourné', data.total, 'résultats chargés', data.results?.length || 0);
  console.table((data.results || []).slice(0, 20).map(compactDpeForLog));

  let renderData = data;
  if (exact) {
    let before = data.results || [];
    let filtered = before.filter(d => isExactAddressMatch(d, num, rue, ville));

    if (!filtered.length) {
      const fallbackParams = buildExactAddressFallbackParams(num, rue, ville, size, sort);
      const fallbackUrl = buildUrl(fallbackParams);
      console.warn('[DPE Explorer] Aucun match exact sur la première requête. Fallback rue + CP.', fallbackParams);
      document.getElementById('url-addr').innerHTML = 'GET &nbsp;<span>' + displayUrl(fallbackParams) + '</span>';
      const fallbackData = await apiFetch(fallbackUrl, 'btn-addr', 'addr');
      if (fallbackData) {
        data = fallbackData;
        before = data.results || [];
        console.log('Total ADEME fallback', data.total, 'résultats chargés', before.length);
        console.table(before.slice(0, 20).map(compactDpeForLog));
        filtered = before.filter(d => isExactAddressMatch(d, num, rue, ville));
      }
    }

    console.log('Résultats après filtre local exact', filtered.length);
    console.table(filtered.map(compactDpeForLog));

    renderData = Object.assign({}, data, {
      total: filtered.length,
      results: filtered.slice(0, parseInt(size || '20', 10)),
      _exactSearch: true,
      _exactBeforeCount: before.length,
      _exactInput: { num, rue, ville },
      _exactCandidates: before.slice(0, 8).map(compactDpeForLog)
    });
  }

  console.groupEnd();
  renderAddrResults(renderData, q);
}


// Fonctions carte déplacées dans js/map.js

function renderAddrResults(data, query) {
  const el = document.getElementById('result-addr');
  const res = data.results || [];
  const total = data.total || 0;

  if (!res.length) {
    let diag = '';
    if (data._exactSearch) {
      diag = '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:11px;line-height:1.7">'
        + '<strong style="color:var(--accent2)">Diagnostic recherche exacte</strong><br>'
        + 'L\'API a retourné ' + (data._exactBeforeCount || 0) + ' candidat(s), mais aucun ne correspond strictement à : '
        + '<span style="color:var(--text)">' + data._exactInput.num + ' ' + data._exactInput.rue + ' ' + data._exactInput.ville + '</span>.<br>'
        + 'Ouvre la console navigateur : un tableau affiche les champs ADEME/BAN reçus.'
        + '</div>';
    }
    el.innerHTML = '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:20px;color:var(--muted);font-family:var(--mono);font-size:13px">Aucun DPE trouvé pour cette adresse.' + diag + '</div>';
    return;
  }

  const etiqColors = {
    A:{bg:'#1a5c3a',tx:'#4ade80'}, B:{bg:'#2d5e16',tx:'#86efac'},
    C:{bg:'#4d6b0f',tx:'#bef264'}, D:{bg:'#7c5a08',tx:'#fde68a'},
    E:{bg:'#7c3a08',tx:'#fdba74'}, F:{bg:'#7c1212',tx:'#fca5a5'},
    G:{bg:'#500d0d',tx:'#ef4444'}
  };

  function badge(v) {
    if (!v) return '<span style="color:var(--muted)">—</span>';
    const c = etiqColors[v] || {bg:'#333',tx:'#fff'};
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:5px;font-size:13px;font-weight:700;font-family:var(--mono);background:' + c.bg + ';color:' + c.tx + '">' + v + '</span>';
  }

  let html = '<div style="font-family:var(--mono);font-size:12px;color:var(--muted);margin-bottom:12px">'
    + '<span style="color:var(--accent);font-weight:600">' + total.toLocaleString('fr-FR') + '</span>'
    + ' DPE trouvés · ' + res.length + ' affichés'
    + (data._exactSearch ? ' · <span style="color:var(--accent2)">mode exact local</span>' : '')
    + '</div>';

  html += '<div style="display:flex;flex-direction:column;gap:10px">';

  res.forEach(function(d) {
    const eDpe = d['etiquette_dpe'] || '';
    const eGes = d['etiquette_ges'] || '';
    const adresse = d['adresse_ban'] || d['adresse_brut'] || '';
    const adresseBrut = d['adresse_brut'] || '';
    const cp = d['code_postal_ban'] || '';
    const ville2 = d['nom_commune_ban'] || '';
    const surf = d['surface_habitable_logement'] ? fmtN(d['surface_habitable_logement']) + ' m²' : '—';
    const periode = d['periode_construction'] || '—';
    const conso = d['conso_5_usages_par_m2_ef'] ? fmtN(d['conso_5_usages_par_m2_ef']) + ' kWh/m²' : '—';
    const cout = d['cout_total_5_usages'] ? fmtN(d['cout_total_5_usages']) + ' €/an' : '—';
    const numDpe = d['numero_dpe'] || '';
    const dateEtab = d['date_etablissement_dpe'] || '';
    const energie = d['type_energie_principale_chauffage'] || '—';


    // Coordonnées GPS WGS84 — utiliser _geopoint (lat,lon) pas les coordonnées Lambert 93
    const geopoint = d['_geopoint'] || '';
    let lat = null, lon = null;
    if (geopoint) {
      const parts2 = geopoint.split(',');
      lat = parseFloat(parts2[0]); // latitude WGS84
      lon = parseFloat(parts2[1]); // longitude WGS84
    }

    const adresseEncode = encodeURIComponent((adresseBrut || adresse) + ' ' + cp + ' ' + ville2);
    const googleMapsUrl = lat && lon
      ? 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lon
      : 'https://www.google.com/maps/search/?api=1&query=' + adresseEncode;

    // Street View : utiliser les coordonnées GPS WGS84 exactes
    const streetViewUrl = lat && lon
      ? 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + lat + ',' + lon
      : 'https://www.google.com/maps/search/?api=1&query=' + adresseEncode;

    const ademeUrl   = numDpe ? 'https://observatoire-dpe-audit.ademe.fr/afficher-dpe/' + numDpe : '';

    // Cadastre & RNB
    const rnbId      = d['id_rnb'] || '';
    // RNB : on conserve l'identifiant, mais pas de lien /batiment/<id> car certains ID ADEME renvoient 404.

    // Parcelle : Géoportail avec couche cadastrale, plus fiable qu'un lien cadastre.gouv.fr par coordonnées.
    const cadastreUrl = lat && lon
      ? 'https://www.geoportail.gouv.fr/carte?c=' + lon + ',' + lat + '&z=19&l0=CADASTRALPARCELS.PARCELLAIRE_EXPRESS::GEOPORTAIL:OGC:WMTS(1)&l1=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2::GEOPORTAIL:OGC:WMTS(1)&permalink=yes'
      : '';

    // Iframe Google Maps embed centrée sur les coordonnées GPS exactes
    const mapEmbedSrc = lat && lon
      ? 'https://maps.google.com/maps?q=' + lat + ',' + lon + '&output=embed&z=18'
      : 'https://maps.google.com/maps?q=' + adresseEncode + '&output=embed&z=17';

    // Fonction inline pour charger la fiche complète
    const dJson = btoa(unescape(encodeURIComponent(JSON.stringify(d))));

    html += '<div class="addr-result-card" style="display:grid;grid-template-columns:130px 1fr auto;gap:0;overflow:hidden">'

      // ── Colonne vignette carto ──
      + '<div style="position:relative;background:#1a1a1a;display:flex;flex-direction:column">'
      // Vignette Google Maps (iframe embed léger)
      + '<a href="' + googleMapsUrl + '" target="_blank" rel="noopener" title="Voir sur Google Maps" style="display:block;flex:1;overflow:hidden;text-decoration:none">'
      + '<iframe src="' + mapEmbedSrc + '" '
      + 'width="130" height="90" style="border:none;pointer-events:none;display:block" loading="lazy" referrerpolicy="no-referrer"></iframe>'
      + '<div style="position:absolute;top:0;left:0;right:0;bottom:20px;cursor:pointer"></div>'
      + '</a>'
      // Lien Street View en bas de la vignette
      + '<a href="' + streetViewUrl + '" target="_blank" rel="noopener" '
      + 'style="display:flex;align-items:center;justify-content:center;gap:4px;padding:3px 6px;background:rgba(0,0,0,.7);font-size:10px;color:#4ade80;text-decoration:none;font-family:var(--mono)">'
      + '👁 Street View</a>'
      + '</div>'

      // ── Colonne infos principale ──
      + '<div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;min-width:0">'

      // Ligne 1 : badges + adresse
      + '<div style="display:flex;align-items:flex-start;gap:10px">'
      + '<div style="display:flex;gap:5px;flex-shrink:0">' + badge(eDpe) + badge(eGes) + '</div>'
      + '<div style="min-width:0">'
      + '<div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + adresseBrut + '</div>'
      + '<div style="font-size:11px;color:var(--muted);font-family:var(--mono)">' + cp + ' ' + ville2 + '</div>'
      + '</div></div>'

      // Ligne 2 : métriques clés
      + '<div style="display:flex;gap:14px;flex-wrap:wrap">'
      + '<span style="font-size:11px;color:var(--muted)">📐 <strong style="color:var(--text)">' + surf + '</strong></span>'
      + '<span style="font-size:11px;color:var(--muted)">🏗 <strong style="color:var(--text)">' + periode + '</strong></span>'
      + '<span style="font-size:11px;color:var(--muted)">⚡ <strong style="color:var(--accent2)">' + conso + '</strong></span>'
      + '<span style="font-size:11px;color:var(--muted)">💰 <strong style="color:#f59e0b">' + cout + '</strong></span>'
      + '<span style="font-size:11px;color:var(--muted)">🔥 <strong style="color:var(--text)">' + energie + '</strong></span>'
      + '</div>'

      // Ligne 3 : liens actions
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">'
      + '<a href="' + googleMapsUrl + '" target="_blank" rel="noopener" class="action-link">🗺 Google Maps</a>'
      + '<a href="' + streetViewUrl + '" target="_blank" rel="noopener" class="action-link">👁 Street View</a>'
      + (ademeUrl    ? '<a href="' + ademeUrl    + '" target="_blank" rel="noopener" class="action-link" style="color:var(--accent2)">🏛 ADEME</a>' : '')
      + (cadastreUrl ? '<a href="' + cadastreUrl + '" target="_blank" rel="noopener" class="action-link" style="color:#f59e0b">📐 Parcelle IGN/Cadastre</a>' : '')
      + (rnbId      ? '<span class="action-link" title="ID RNB exposé par ADEME — lien direct désactivé car /batiment/<id> peut renvoyer 404" style="color:#22d3ee;cursor:default">🏗 ID RNB</span>' : '')
      + '<button onclick="loadDpeFromAddrB64(\'' + dJson + '\')" class="action-link action-btn">🔍 Détail complet</button>'
      + '</div>'

      + '</div>'

      // ── Colonne méta droite ──
      + '<div style="padding:12px 14px;text-align:right;border-left:1px solid var(--border);min-width:110px;display:flex;flex-direction:column;gap:6px;justify-content:center">'
      + '<div>'
      + '<div style="font-size:9px;color:var(--muted);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em">N° DPE</div>'
      + '<div style="font-size:10px;font-weight:600;color:var(--accent);font-family:var(--mono);word-break:break-all">' + numDpe + '</div>'
      + '</div>'
      + '<div>'
      + '<div style="font-size:9px;color:var(--muted);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em">Établi le</div>'
      + '<div style="font-size:11px;font-family:var(--mono)">' + dateEtab + '</div>'
      + '</div>'
      + '</div>'

      + '</div>';
  });

  html += '</div>';
  el.innerHTML = html;
}

// loadDpeFromAddr / loadDpeFromAddrB64 déplacées dans js/dpe.js

// Exposer au scope global window pour les onclick générés via innerHTML
window.toggleFilter       = toggleFilter;
window.resetFilters       = resetFilters;
window.updateFilterBadge  = updateFilterBadge;
window.searchAddr         = searchAddr;
// Exports carte déplacés dans js/map.js

/* ─────────────────────────────────────────
   PLAN DE RÉNOVATION — Import XML
───────────────────────────────────────── */

// Drag & drop sur la zone reno
document.addEventListener('DOMContentLoaded', function() {
  const drop = document.getElementById('reno-drop');
  if (drop) {
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; });
    drop.addEventListener('dragleave', () => { drop.style.borderColor = 'rgba(255,255,255,.15)'; });
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.style.borderColor = 'rgba(255,255,255,.15)';
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.xml')) {
        const dt = new DataTransfer(); dt.items.add(file);
        document.getElementById('reno-xml-input').files = dt.files;
        loadRenoXml(document.getElementById('reno-xml-input'));
      }
    });
  }
  // Drop zone 3D — accepte XML et XLS/XLSX
  const drop3dEl = document.getElementById('view3d-drop');
  if (drop3dEl) {
    drop3dEl.addEventListener('dragover', e => { e.preventDefault(); drop3dEl.style.borderColor='var(--accent)'; });
    drop3dEl.addEventListener('dragleave', () => { drop3dEl.style.borderColor='rgba(255,255,255,.15)'; });
    drop3dEl.addEventListener('drop', e => {
      e.preventDefault();
      drop3dEl.style.borderColor='rgba(255,255,255,.15)';
      const file = e.dataTransfer.files[0];
      if (!file) return;
      // Passer le File directement — pas besoin de DataTransfer → input
      load3dFile(file);
    });
  }
});

function loadRenoXml(input) {
  const file = input.files[0];
  if (!file) return;
  setStatus('reno', 'info', '<span class="spin">↻</span> &nbsp;Lecture du fichier XML...');

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(e.target.result, 'application/xml');
      const parseErr = doc.querySelector('parsererror');
      if (parseErr) throw new Error('XML invalide : ' + parseErr.textContent.slice(0,80));
      const data = parseXmlDpe(doc);
      clearStatus('reno');
      document.getElementById('result-reno').innerHTML = renderRenoPlan(data);
      // Mettre à jour le titre de la drop zone
      document.getElementById('reno-drop').innerHTML =
        '<div style="font-size:20px">✅</div>' +
        '<div style="font-size:13px;font-weight:600;color:var(--accent);margin-top:8px">' + file.name + '</div>' +
        '<div style="font-size:11px;color:var(--muted);margin-top:4px">N° ' + (data.meta.numero_dpe || '?') + ' · ' + (data.meta.adresse || '') + '</div>';
    } catch(err) {
      setStatus('reno', 'err', '✖ ' + err.message);
    }
  };
  reader.readAsText(file);
}

function xget(doc, tag, idx) {
  const els = doc.getElementsByTagName(tag);
  idx = idx || 0;
  return (els[idx] && els[idx].textContent) ? els[idx].textContent.trim() : null;
}

const ORIENT = {'1':'Nord','2':'Est','3':'Sud','4':'Ouest','5':'NE','6':'NO','7':'SE','8':'SO','9':'Horizontal'};
const ADJ    = {'1':'Extérieur','2':'LNC','3':'Terre-plein','4':'Sous-sol NC','5':'Vide sanitaire','6':'LCC','7':'Circulation','8':'Communs','10':'Extérieur','11':'Comble perdu','12':'Comble aménagé'};
const VITRAGE= {'1':'Simple','2':'Double','3':'Triple','4':'Double fenêtre'};
const MATMUR = {'1':'Brique','2':'Béton banché','3':'Pierre de taille','4':'Parpaing','5':'Bois','6':'Autre','7':'Pierre calcaire','8':'Pisé','9':'Béton cellulaire'};
const LOTS   = {'1':['🧱','Isolation murs'],'2':['🪨','Isolation plancher bas'],'3':['🏠','Isolation toiture'],'4':['🪟','Menuiseries'],'5':['🔥','Chauffage'],'6':['🚿','ECS'],'7':['💡','Éclairage'],'8':['💨','Ventilation'],'9':['🔒','Étanchéité'],'10':['☀️','ENR']};

function calcEtiq(conso_m2) {
  if (conso_m2 <= 70) return 'A';
  if (conso_m2 <= 110) return 'B';
  if (conso_m2 <= 180) return 'C';
  if (conso_m2 <= 250) return 'D';
  if (conso_m2 <= 330) return 'E';
  if (conso_m2 <= 420) return 'F';
  return 'G';
}

const ETIQ_COLORS = {A:{bg:'#1a5c3a',tx:'#4ade80'},B:{bg:'#2d5e16',tx:'#86efac'},C:{bg:'#4d6b0f',tx:'#bef264'},D:{bg:'#7c5a08',tx:'#fde68a'},E:{bg:'#7c3a08',tx:'#fdba74'},F:{bg:'#7c1212',tx:'#fca5a5'},G:{bg:'#500d0d',tx:'#ef4444'}};

function etiqPill(v, size) {
  const c = ETIQ_COLORS[v] || {bg:'#333',tx:'#fff'};
  const sz = size === 'lg' ? '38px;font-size:20px' : '26px;font-size:13px';
  return '<span style="display:inline-flex;align-items:center;justify-content:center;width:' + sz + ';height:' + (size==='lg'?38:26) + 'px;border-radius:6px;font-weight:700;font-family:var(--mono);background:' + c.bg + ';color:' + c.tx + '">' + v + '</span>';
}

function parseXmlDpe(doc) {
  const surf = parseFloat(xget(doc,'surface_habitable_logement') || xget(doc,'surface_habitable') || 0);
  const niv  = parseInt(xget(doc,'nombre_niveau_logement') || 1);
  const hsp  = parseFloat(xget(doc,'hsp') || 2.5);

  const murs = [];
  for (const mur of doc.getElementsByTagName('mur')) {
    const de = mur.getElementsByTagName('donnee_entree')[0];
    if (!de) continue;
    const g  = t => { const el = de.getElementsByTagName(t)[0]; return el ? el.textContent.trim() : null; };
    const um = mur.getElementsByTagName('umur')[0];
    const s  = parseFloat(g('surface_paroi_opaque') || 0);
    if (!s) continue;
    murs.push({
      surface: s,
      orientation: ORIENT[g('enum_orientation_id')] || '?',
      adjacence: ADJ[g('enum_type_adjacence_id')] || '?',
      materiau: MATMUR[g('enum_materiaux_structure_mur_id')] || '?',
      U: um ? parseFloat(um.textContent) : null,
      versExt: g('enum_type_adjacence_id') === '1',
    });
  }

  const baies = [];
  for (const bv of doc.getElementsByTagName('baie_vitree')) {
    const de = bv.getElementsByTagName('donnee_entree')[0];
    if (!de) continue;
    const g = t => { const el = de.getElementsByTagName(t)[0]; return el ? el.textContent.trim() : null; };
    const uw = bv.getElementsByTagName('uw')[0];
    const s  = parseFloat(g('surface_totale_baie') || 0);
    if (!s) continue;
    baies.push({
      surface: s,
      nb: parseInt(g('nb_baie') || 1),
      orientation: ORIENT[g('enum_orientation_id')] || '?',
      vitrage: VITRAGE[g('enum_type_vitrage_id')] || '?',
      Uw: uw ? parseFloat(uw.textContent) : null,
    });
  }

  const pts = [];
  const TYPE_PT = {'1':'PB/mur','2':'PI/mur','3':'PH/mur','4':'Refend/mur','5':'Menuiserie/mur','6':'Angle sortant','7':'Angle rentrant'};
  for (const pt of doc.getElementsByTagName('pont_thermique')) {
    const de = pt.getElementsByTagName('donnee_entree')[0];
    if (!de) continue;
    const g = t => { const el = de.getElementsByTagName(t)[0]; return el ? el.textContent.trim() : null; };
    const k = pt.getElementsByTagName('k')[0];
    pts.push({
      type: TYPE_PT[g('enum_type_liaison_id')] || '?',
      longueur: parseFloat(g('l') || 0),
      k: k ? parseFloat(k.textContent) : 0,
    });
  }

  const dep = doc.getElementsByTagName('deperdition')[0];
  const deperditions = dep ? {
    murs: parseFloat(dep.getElementsByTagName('deperdition_mur')[0]?.textContent || 0),
    plancher_bas: parseFloat(dep.getElementsByTagName('deperdition_plancher_bas')[0]?.textContent || 0),
    plancher_haut: parseFloat(dep.getElementsByTagName('deperdition_plancher_haut')[0]?.textContent || 0),
    baies: parseFloat(dep.getElementsByTagName('deperdition_baie_vitree')[0]?.textContent || 0),
    portes: parseFloat(dep.getElementsByTagName('deperdition_porte')[0]?.textContent || 0),
    pts: parseFloat(dep.getElementsByTagName('deperdition_pont_thermique')[0]?.textContent || 0),
    air: parseFloat(dep.getElementsByTagName('deperdition_renouvellement_air')[0]?.textContent || 0),
    total: parseFloat(dep.getElementsByTagName('deperdition_enveloppe')[0]?.textContent || 0),
  } : {};

  const scenarios = [];
  for (const pack of doc.getElementsByTagName('pack_travaux')) {
    const num     = pack.getElementsByTagName('enum_num_pack_travaux_id')[0];
    const cMin    = pack.getElementsByTagName('cout_pack_travaux_min')[0];
    const cMax    = pack.getElementsByTagName('cout_pack_travaux_max')[0];
    const consoAp = pack.getElementsByTagName('conso_5_usages_apres_travaux')[0];
    const gesAp   = pack.getElementsByTagName('emission_ges_5_usages_apres_travaux')[0];
    const conso_a = consoAp ? parseFloat(consoAp.textContent) : 0;
    // conso_5_usages_apres_travaux est en kWh/m²/an (pas en kWh total)
    const m2_ap   = Math.round(conso_a);
    const cout_mn = cMin ? parseFloat(cMin.textContent) : 0;
    const cout_mx = cMax ? parseFloat(cMax.textContent) : 0;
    const etapes  = [];
    const tc = pack.getElementsByTagName('travaux_collection')[0];
    if (tc) {
      for (const trav of tc.getElementsByTagName('travaux')) {
        const lot  = trav.getElementsByTagName('enum_lot_travaux_id')[0];
        const desc = trav.getElementsByTagName('description_travaux')[0];
        const perf = trav.getElementsByTagName('performance_recommande')[0];
        const cet  = trav.getElementsByTagName('conso_5_usages_apres_travaux')[0];
        const get2 = trav.getElementsByTagName('emission_ges_5_usages_apres_travaux')[0];
        const lotId = lot ? lot.textContent.trim() : '?';
        const c_et = cet ? parseFloat(cet.textContent) : null;
        // conso_5_usages_apres_travaux des étapes est aussi en kWh/m²/an
        etapes.push({
          lot: lotId,
          info: LOTS[lotId] || ['🔧', lotId],
          desc: desc ? desc.textContent.trim() : '',
          perf: perf ? perf.textContent.trim() : '',
          conso_ap: c_et,
          m2_ap: c_et ? Math.round(c_et) : null,
          etiq_ap: c_et ? calcEtiq(c_et) : null,
          ges_ap: get2 ? parseFloat(get2.textContent) : null,
        });
      }
    }
    scenarios.push({
      id: num ? num.textContent.trim() : '?',
      etiq_av: xget(doc, 'classe_bilan_dpe'),
      etiq_ap: calcEtiq(m2_ap),
      conso_av_m2: parseFloat(xget(doc,'conso_5_usages_m2') || 0),
      conso_ap_kwh: conso_a,
      conso_ap_m2: m2_ap,
      ges_av: parseFloat(xget(doc,'emission_ges_5_usages_m2') || 0),
      ges_ap: gesAp ? parseFloat(gesAp.textContent) : 0,
      cout_min: cout_mn,
      cout_max: cout_mx,
      etapes,
    });
  }

  return {
    meta: {
      numero_dpe: xget(doc,'numero_dpe'),
      adresse: xget(doc,'adresse_brut'),
      date_visite: xget(doc,'date_visite_diagnostiqueur'),
      date_dpe: xget(doc,'date_etablissement_dpe'),
      etiq_dpe: xget(doc,'classe_bilan_dpe'),
      etiq_ges: xget(doc,'classe_emission_ges'),
      logiciel: xget(doc,'version_logiciel'),
    },
    logement: { surface: surf, niveaux: niv, hsp },
    performance: {
      conso_ef_m2: parseFloat(xget(doc,'conso_5_usages_m2') || 0),
      conso_ep_m2: parseFloat(xget(doc,'ep_conso_5_usages_m2') || 0),
      ges_m2: parseFloat(xget(doc,'emission_ges_5_usages_m2') || 0),
      cout_total: parseFloat(xget(doc,'cout_5_usages') || 0),
      cout_ch: parseFloat(xget(doc,'cout_ch') || 0),
      cout_ecs: parseFloat(xget(doc,'cout_ecs') || 0),
      cout_eclairage: parseFloat(xget(doc,'cout_eclairage') || 0),
    },
    murs, baies, ponts: pts, deperditions, scenarios,
  };
}

function renderRenoPlan(d) {
  const m = d.meta;
  const l = d.logement;
  const p = d.performance;
  const dep = d.deperditions;
  const depTotal = dep.total || 1;

  const fmtK = v => v >= 1000 ? (v/1000).toFixed(1) + 'k€' : Math.round(v) + ' €';
  const fmtN = (v, u) => v ? Math.round(v).toLocaleString('fr-FR') + (u||'') : '—';

  // Entête
  let html = '<div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;padding:16px 20px;background:var(--surface2);border:1px solid var(--border);border-radius:10px">';
  html += '<div style="display:flex;gap:8px">' + etiqPill(m.etiq_dpe,'lg') + '<span style="color:var(--muted);font-size:18px;align-self:center">/</span>' + etiqPill(m.etiq_ges,'lg') + '</div>';
  html += '<div><div style="font-size:15px;font-weight:700">' + (m.adresse||'') + '</div>';
  html += '<div style="font-size:12px;color:var(--muted);font-family:var(--mono)">' + (m.numero_dpe||'') + ' · ' + l.surface + ' m² · ' + l.niveaux + ' niveau(x) · HSP ' + l.hsp + ' m</div>';
  html += '<div style="font-size:11px;color:var(--muted);margin-top:4px">Visité le ' + (m.date_visite||'?') + ' · ' + (m.logiciel||'') + '</div></div></div>';

  // KPIs
  html += '<div class="kpi-row">';
  html += '<div class="kpi-box"><div class="v" style="color:#22d3ee">' + fmtN(p.conso_ef_m2,' kWh/m²') + '</div><div class="l">Conso EF/m²/an</div></div>';
  html += '<div class="kpi-box"><div class="v" style="color:#f87171">' + fmtN(p.ges_m2,' kg CO₂') + '</div><div class="l">GES/m²/an</div></div>';
  html += '<div class="kpi-box"><div class="v" style="color:#f59e0b">' + fmtN(p.cout_total,' €') + '</div><div class="l">Coût total/an</div></div>';
  html += '<div class="kpi-box"><div class="v">' + fmtN(p.cout_ch,' €') + '</div><div class="l">dont chauffage</div></div>';
  html += '</div>';

  // Déperditions
  if (dep.total) {
    html += '<div class="reno-card"><div class="reno-card-head"><span style="font-size:14px">📉</span><span style="font-size:13px;font-weight:600;color:var(--text)">Déperditions thermiques</span><span style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-left:auto">' + fmtN(dep.total,' W/K total') + '</span></div><div class="reno-card-body">';
    const depItems = [
      ['Murs', dep.murs,'#ef4444'],
      ['Renouvellement air', dep.air,'#f97316'],
      ['Plancher haut', dep.plancher_haut,'#eab308'],
      ['Baies vitrées', dep.baies,'#22d3ee'],
      ['Portes', dep.portes,'#a78bfa'],
      ['Ponts thermiques', dep.pts,'#6b7280'],
      ['Plancher bas', dep.plancher_bas,'#6b7280'],
    ].filter(x => x[1] > 0).sort((a,b) => b[1]-a[1]);
    depItems.forEach(([label,val,color]) => {
      const pct = Math.round((val/depTotal)*100);
      html += '<div class="dep-bar-row"><span class="dep-label">' + label + '</span>';
      html += '<div class="dep-track"><div class="dep-fill" style="width:' + pct + '%;background:' + color + ';opacity:.7"></div></div>';
      html += '<span class="dep-val">' + pct + '% <span style="color:var(--muted)">' + Math.round(val) + '</span></span></div>';
    });
    html += '</div></div>';
  }

  // Parois
  const mursExt = d.murs.filter(m2 => m2.versExt);
  if (mursExt.length) {
    html += '<div class="reno-card"><div class="reno-card-head"><span style="font-size:14px">🧱</span><span style="font-size:13px;font-weight:600">Murs donnant sur extérieur</span><span style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-left:auto">' + mursExt.length + ' paroi(s)</span></div><div class="reno-card-body">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px">';
    mursExt.forEach(m2 => {
      const uColor = !m2.U ? '#6b7280' : m2.U < 0.4 ? '#4ade80' : m2.U < 0.8 ? '#86efac' : m2.U < 1.5 ? '#fde68a' : '#fca5a5';
      html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
      html += '<span style="font-size:11px;font-weight:600;color:var(--text)">' + m2.orientation + '</span>';
      html += '<span style="font-size:11px;font-family:var(--mono);color:' + uColor + '">' + (m2.U ? 'U=' + m2.U.toFixed(2) : '—') + '</span></div>';
      html += '<div style="font-size:10px;color:var(--muted)">' + m2.materiau + ' · ' + m2.surface + ' m²</div></div>';
    });
    html += '</div></div></div>';
  }

  // Baies
  if (d.baies.length) {
    html += '<div class="reno-card"><div class="reno-card-head"><span style="font-size:14px">🪟</span><span style="font-size:13px;font-weight:600">Baies vitrées</span><span style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-left:auto">' + d.baies.reduce((a,b)=>a+b.nb,0) + ' baie(s) · ' + d.baies.reduce((a,b)=>a+b.surface,0).toFixed(1) + ' m²</span></div><div class="reno-card-body">';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">';
    d.baies.forEach(bv => {
      const uColor = !bv.Uw ? '#6b7280' : bv.Uw < 1 ? '#4ade80' : bv.Uw < 1.5 ? '#86efac' : bv.Uw < 2.5 ? '#fde68a' : '#fca5a5';
      html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
      html += '<span style="font-size:11px;font-weight:600;color:var(--text)">' + bv.orientation + ' · ×' + bv.nb + '</span>';
      html += '<span style="font-size:11px;font-family:var(--mono);color:' + uColor + '">' + (bv.Uw ? 'Uw=' + bv.Uw.toFixed(1) : '—') + '</span></div>';
      html += '<div style="font-size:10px;color:var(--muted)">' + bv.vitrage + ' · ' + bv.surface + ' m²</div></div>';
    });
    html += '</div></div></div>';
  }

  // Scénarios de rénovation
  if (d.scenarios.length) {
    html += '<div style="font-size:15px;font-weight:700;margin:20px 0 12px">🔧 Scénarios de rénovation</div>';
    d.scenarios.forEach((sc, i) => {
      // Gain annuel = économie sur le coût total proportionnelle à la baisse de conso
      const gain_ratio = p.conso_ef_m2 > 0 ? (p.conso_ef_m2 - sc.conso_ap_m2) / p.conso_ef_m2 : 0;
      const gain = gain_ratio > 0 ? Math.round(p.cout_total * gain_ratio) : null;
      html += '<div class="reno-card">';
      html += '<div class="reno-card-head">';
      html += '<div class="scenario-num" style="background:rgba(74,222,128,.15);color:var(--accent)">' + (i+1) + '</div>';
      html += '<div style="flex:1"><div style="font-size:13px;font-weight:600">Scénario ' + (i+1) + ' — ' + (sc.etapes.length === 1 ? 'En une étape' : sc.etapes.length + ' étapes') + '</div>';
      html += '<div style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:2px">' + sc.etapes.map(e => e.info[0]+' '+e.info[1]).join(' · ') + '</div></div>';
      html += '<div style="display:flex;align-items:center;gap:6px">' + etiqPill(sc.etiq_av) + '<span style="color:var(--muted);font-size:14px">→</span>' + etiqPill(sc.etiq_ap) + '</div></div>';
      html += '<div class="reno-card-body">';

      // Métriques scénario
      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">';
      html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px">';
      const coutStr = sc.cout_min > 500 
        ? fmtK(sc.cout_min) + ' → ' + fmtK(sc.cout_max)
        : '<span style="font-size:12px;color:var(--muted)">Non renseigné</span>';
      html += '<div style="font-size:16px;font-weight:700;font-family:var(--mono);color:#f59e0b">' + coutStr + '</div>';
      html += '<div style="font-size:10px;color:var(--muted);margin-top:3px;text-transform:uppercase;letter-spacing:.06em">Coût estimé</div></div>';
      html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px">';
      html += '<div style="font-size:16px;font-weight:700;font-family:var(--mono);color:#22d3ee">' + fmtN(sc.conso_ap_m2,' kWh/m²') + '</div>';
      html += '<div style="font-size:10px;color:var(--muted);margin-top:3px;text-transform:uppercase;letter-spacing:.06em">Conso après</div></div>';
      html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px">';
      html += '<div style="font-size:16px;font-weight:700;font-family:var(--mono);color:#4ade80">' + (gain ? '-'+fmtN(gain,' €/an') : '—') + '</div>';
      html += '<div style="font-size:10px;color:var(--muted);margin-top:3px;text-transform:uppercase;letter-spacing:.06em">Gain annuel estimé</div></div>';
      html += '</div>';

      // Étapes
      html += '<div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Travaux préconisés</div>';
      sc.etapes.forEach(etape => {
        html += '<div class="lot-row">';
        html += '<div class="lot-icon">' + etape.info[0] + '</div>';
        html += '<div class="lot-body">';
        html += '<div class="lot-label">' + etape.info[1] + '</div>';
        html += '<div class="lot-desc">' + (etape.desc || '').split('\n').join('<br>') + '</div>';
        if (etape.perf) html += '<div class="lot-perf">' + etape.perf + '</div>';
        if (etape.m2_ap !== null) {
          html += '<div style="margin-top:6px;font-size:11px;color:var(--muted);font-family:var(--mono)">';
          html += 'Après cette étape : ' + etape.m2_ap + ' kWh/m² ' + etiqPill(etape.etiq_ap);
          if (etape.ges_ap) html += ' · ' + Math.round(etape.ges_ap/l.surface) + ' kg CO₂/m²';
          html += '</div>';
        }
        html += '</div></div>';
      });
      html += '</div></div>';
    });
  } else {
    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:20px;color:var(--muted);font-size:13px;text-align:center">Aucun scénario de rénovation trouvé dans ce fichier XML.</div>';
  }
  return html;
}

window.loadRenoXml = loadRenoXml;

/* ─────────────────────────────────────────
   VISUALISATION 3D THERMIQUE v2
   Approche : 1 façade = 1 mur + 1 ouverture représentant le ratio vitrage réel
───────────────────────────────────────── */

let renderer3d = null, scene3d = null, camera3d = null;
let animFrame3d = null, dpe3dData = null;
let isDragging3d = false, prevMouse3d = {x:0, y:0};
let camTheta = Math.PI/4, camPhi = Math.PI/3.5, camDist = 20;
let allMeshes3d = [];
let renoMode = false, xrayMode = false;

// Gradient thermique absolu basé sur les seuils réglementaires RT2012/RE2020
// Indépendant du dossier — même couleur pour le même U-value quel que soit le bâtiment
const U_SCALE = [
  { u: 0.00, r:0x1a, g:0x7a, b:0x4a },  // Très bien    : vert foncé   (≤ 0.15)
  { u: 0.20, r:0x4a, g:0xde, b:0x80 },  // Bien         : vert vif     (≤ 0.25)
  { u: 0.40, r:0xa0, g:0xcc, b:0x20 },  // Acceptable   : vert-jaune   (≤ 0.40)
  { u: 0.70, r:0xf5, g:0x9e, b:0x0b },  // Insuffisant  : orange       (≤ 0.70)
  { u: 1.20, r:0xd8, g:0x5a, b:0x00 },  // Mauvais      : orange-rouge (≤ 1.20)
  { u: 2.00, r:0xef, g:0x22, b:0x22 },  // Très mauvais : rouge vif    (≤ 2.00)
  { u: 3.00, r:0x80, g:0x00, b:0x00 },  // Passoire     : rouge foncé  (> 2.00)
];
const U_MAX_DISPLAY = 2.5; // Valeur max pour la légende

function uToColor(U) {
  if (!U || U <= 0) return new THREE.Color(0x334455); // Non renseigné : gris bleu
  // Interpolation linéaire entre les paliers
  for (let i = 0; i < U_SCALE.length - 1; i++) {
    const a = U_SCALE[i], b2 = U_SCALE[i+1];
    if (U <= b2.u) {
      const t = (U - a.u) / (b2.u - a.u);
      return new THREE.Color(
        (a.r + (b2.r - a.r)*t) / 255,
        (a.g + (b2.g - a.g)*t) / 255,
        (a.b + (b2.b - a.b)*t) / 255,
      );
    }
  }
  // Au-delà du dernier palier : rouge foncé
  return new THREE.Color(U_SCALE[U_SCALE.length-1].r/255, U_SCALE[U_SCALE.length-1].g/255, U_SCALE[U_SCALE.length-1].b/255);
}

// Parse XML ADEME — version corrigée avec les vraies balises
function parseXml3d(doc) {
  const xget = (tag, root) => {
    const el = (root||doc).querySelector(tag) || (root||doc).getElementsByTagName(tag)[0];
    return el && el.textContent ? el.textContent.trim() : null;
  };

  const ORIENT = {'1':'N','2':'E','3':'S','4':'O','5':'NE','6':'NO','7':'SE','8':'SO'};
  const ADJ    = {'1':'EXT'};
  const MAT    = {'1':'Brique','2':'Béton banché','3':'Pierre','4':'Parpaing',
                  '5':'Bois','6':'Autre','7':'Calcaire','8':'Pisé','9':'Cellulaire'};

  const surf  = parseFloat(xget('surface_habitable_logement') || 100);
  const niv   = parseInt(xget('nombre_niveau_logement') || 1);
  const hspEl = doc.getElementsByTagName('hsp')[0];
  const hsp   = hspEl && hspEl.textContent ? parseFloat(hspEl.textContent) : 2.5;

  // Agréger murs par orientation (extérieur uniquement)
  const mursMap = {};
  for (const mur of doc.getElementsByTagName('mur')) {
    const de = mur.getElementsByTagName('donnee_entree')[0];
    if (!de) continue;
    const adjId = (de.getElementsByTagName('enum_type_adjacence_id')[0] || {}).textContent || '';
    if (adjId !== '1') continue; // extérieur seulement
    const orientId = (de.getElementsByTagName('enum_orientation_id')[0] || {}).textContent || '';
    const orient   = ORIENT[orientId] || '?';
    const surfEl   = de.getElementsByTagName('surface_paroi_opaque')[0];
    const surf_m   = parseFloat(surfEl && surfEl.textContent ? surfEl.textContent : 0);
    const matId    = (de.getElementsByTagName('enum_materiaux_structure_mur_id')[0] || {}).textContent || '';
    const epEl     = de.getElementsByTagName('epaisseur_structure')[0];
    const epiEl    = de.getElementsByTagName('epaisseur_isolation')[0];
    const umEl     = mur.getElementsByTagName('umur')[0];
    const U        = umEl && umEl.textContent ? parseFloat(umEl.textContent) : 1.5;

    if (!mursMap[orient]) {
      mursMap[orient] = { surf:0, U_vals:[], mat: MAT[matId]||'?',
                          ep: epEl ? parseFloat(epEl.textContent)||0 : 0,
                          ep_iso: epiEl ? parseFloat(epiEl.textContent)||0 : 0 };
    }
    mursMap[orient].surf += surf_m;
    mursMap[orient].U_vals.push(U);
  }
  // Calculer U moyen
  for (const o in mursMap) {
    const d = mursMap[o];
    d.U = d.U_vals.reduce((a,b) => a+b, 0) / d.U_vals.length;
  }

  // Agréger baies par orientation (parcourir toutes les balises quel que soit le niveau)
  const baisMap = {};
  for (const bv of doc.getElementsByTagName('baie_vitree')) {
    const orientEl = bv.getElementsByTagName('enum_orientation_id')[0];
    const surfEl   = bv.getElementsByTagName('surface_totale_baie')[0];
    const nbEl     = bv.getElementsByTagName('nb_baie')[0];
    const uwEl     = bv.getElementsByTagName('uw')[0];
    if (!orientEl || !surfEl) continue;
    const orient = ORIENT[orientEl.textContent.trim()] || '?';
    const surf_b = parseFloat(surfEl.textContent || 0);
    const nb     = parseInt(nbEl && nbEl.textContent ? nbEl.textContent : 1);
    const Uw     = uwEl && uwEl.textContent ? parseFloat(uwEl.textContent) : 3.0;
    if (!baisMap[orient]) baisMap[orient] = { surf:0, nb:0, Uw };
    baisMap[orient].surf += surf_b;
    baisMap[orient].nb   += nb;
  }

  // Calculer ratio vitrage/mur par façade
  for (const o in baisMap) {
    const surfMur = mursMap[o] ? mursMap[o].surf : 1;
    baisMap[o].ratio = surfMur > 0 ? baisMap[o].surf / surfMur : 0;
  }

  return { surf, niv, hsp, H: niv*hsp, mursMap, baisMap,
    etiq: xget('classe_bilan_dpe'), adresse: xget('adresse_brut'),
    numero: xget('numero_dpe') };
}

function load3dFile(inputOrFile) {
  // Accepte un HTMLInputElement ou un objet File directement
  const file = (inputOrFile instanceof File) ? inputOrFile : inputOrFile.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xml') {
    // Lire comme XML
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, 'application/xml');
        if (doc.querySelector('parsererror')) throw new Error('XML invalide');
        dpe3dData = parseXml3d(doc);
        _finishLoad3d(file.name, dpe3dData);
      } catch(err) { setStatus('3d', 'err', '✖ ' + err.message); }
    };
    reader.readAsText(file);
  } else {
    // Lire comme XLS/XLSX via SheetJS
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
        dpe3dData = parseXls3d(wb);
        _finishLoad3d(file.name, dpe3dData);
      } catch(err) { setStatus('3d', 'err', '✖ XLS: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  }
  setStatus('3d', 'info', '<span class="spin">↻</span> &nbsp;Lecture fichier...');
}

function _finishLoad3d(fname, data) {
  const elCtrl  = document.getElementById('controls3d');
  const elWrap  = document.getElementById('canvas3d-wrap');
  const elStats = document.getElementById('parois3d-stats');
  const elDrop  = document.getElementById('view3d-drop');
  if (elCtrl)  elCtrl.style.display  = 'flex';
  if (elWrap)  elWrap.style.display  = 'block';
  if (elStats) elStats.style.display = 'block';
  setTimeout(() => {
    build3dScene(data);
    clearStatus('3d');
    if (elDrop) elDrop.innerHTML =
      '<div style="font-size:15px;color:var(--accent);font-weight:600">✅ ' + fname + '</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:4px">' + (data.adresse||data.numero||'') + '</div>';
    renderParoisStats(data);
  }, 60);
}

function parseXls3d(wb) {
  const ws = wb.Sheets['logement'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });

  // Construire un dict { clé: [val1, val2, ...] }
  const R = {};
  rows.forEach(row => {
    const key = String(row[0] || '').trim();
    if (!key) return;
    const vals = row.slice(1).filter(v => v !== '' && v !== null && v !== undefined).map(v => String(v).trim());
    if (!R[key]) R[key] = [];
    R[key] = R[key].concat(vals);
  });

  // Trouver les deux blocs orientation (murs puis baies)
  const orientRows = rows.reduce((acc, row, i) => {
    if (String(row[0]||'').trim() === 'orientation') acc.push(i); return acc;
  }, []);
  const murOrientRow  = orientRows[0] !== undefined ? rows[orientRows[0]] : [];
  const baieOrientRow = orientRows[1] !== undefined ? rows[orientRows[1]] : [];
  const murOrients  = murOrientRow.slice(1).filter(v=>v!=='').map(v=>String(v).trim());
  const baieOrients = baieOrientRow.slice(1).filter(v=>v!=='').map(v=>String(v).trim());

  // Trouver le premier bloc type_adjacence (pour les murs)
  const adjRows = rows.reduce((acc,row,i) => {
    if (String(row[0]||'').trim()==='type_adjacence') acc.push(i); return acc;
  }, []);
  const murAdjs = adjRows[0]!==undefined
    ? rows[adjRows[0]].slice(1).filter(v=>v!=='').map(v=>String(v).trim())
    : [];

  const ORIENT_MAP = {'nord':'N','sud':'S','est':'E','ouest':'O','n':'N','s':'S','e':'E','o':'O'};
  const ISO_LABEL  = {'iti':'Isolation intérieure (ITI)','ite':'Isolation extérieure (ITE)',
                      'itr':'Isolation par remplissage','non isolé':'Non isolé',
                      'non isolée':'Non isolé','':''};

  // Agréger murs par orientation extérieure
  const mursMap = {};
  const surfs  = R['surface_paroi_opaque'] || [];
  const umurs  = R['umur'] || [];
  const mats   = R['materiaux_structure_mur'] || [];
  const isos   = R['type_isolation'] || [];
  const eps    = R['epaisseur_structure'] || [];
  const ep_isos= R['epaisseur_isolation'] || [];

  murOrients.forEach((o, i) => {
    const adj = murAdjs[i] || 'extérieur';
    if (adj !== 'extérieur') return;
    const orient = ORIENT_MAP[o.toLowerCase()] || o.toUpperCase()[0];
    const surf   = parseFloat(surfs[i] || 0);
    const U      = parseFloat(umurs[i] || umurs[0] || 1.5);
    const mat    = mats[i] || mats[0] || '?';
    const iso    = isos[i] || isos[0] || '';
    const ep_iso = parseFloat(ep_isos[0] || 0); // souvent une seule valeur
    if (!mursMap[orient]) {
      mursMap[orient] = { surf:0, U_vals:[], mat, iso: ISO_LABEL[iso.toLowerCase()]||iso, ep_iso };
    }
    mursMap[orient].surf += surf;
    mursMap[orient].U_vals.push(U);
  });
  for (const o in mursMap) {
    const d = mursMap[o];
    d.U = d.U_vals.reduce((a,b)=>a+b,0) / d.U_vals.length;
  }

  // Baies
  const baisMap = {};
  const bSurfs  = R['surface_totale_baie'] || [];
  const bNbs    = R['nb_baie'] || [];
  const bUws    = R['uw'] || R['uw_1'] || [];
  const bTypes  = R['type_baie'] || [];
  const bFerm   = R['type_fermeture'] || [];

  baieOrients.forEach((o, i) => {
    const orient = ORIENT_MAP[o.toLowerCase()] || o.toUpperCase()[0];
    const surf   = parseFloat(bSurfs[i] || 0);
    const nb     = parseInt(bNbs[i] || 1);
    const Uw     = parseFloat(bUws[i] || 3.0);
    const type   = bTypes[i] || '?';
    const ferm   = bFerm[i] || '';
    if (!baisMap[orient]) baisMap[orient] = { surf:0, nb:0, Uw, types:[], fermetures:[] };
    baisMap[orient].surf += surf;
    baisMap[orient].nb   += nb;
    baisMap[orient].types.push(type);
    baisMap[orient].fermetures.push(ferm);
  });
  for (const o in baisMap) {
    const md = mursMap[o];
    baisMap[o].ratio = md && md.surf > 0 ? baisMap[o].surf / md.surf : 0;
  }

  // Généralités
  const ws_admin = wb.Sheets['administratif'];
  const adm = ws_admin ? XLSX.utils.sheet_to_json(ws_admin, {header:1, defval:''}) : [];
  const admDict = {};
  adm.forEach(r => { if (r[0]) admDict[String(r[0]).trim()] = String(r[1]||'').trim(); });

  const surf = parseFloat(R['surface_habitable_logement']?.[0] || R['surface_habitable']?.[0] || 100);
  const niv  = parseInt(R['nombre_niveau_logement']?.[0] || 1);
  const hsp  = parseFloat(R['hsp']?.[0] || 2.5);

  return {
    surf, niv, hsp, H: niv*hsp,
    mursMap, baisMap,
    adresse: admDict['adresse_brut'] || admDict['reference_interne_projet'] || '',
    numero:  admDict['reference_interne_projet'] || '',
    source:  'xls',
  };
}

function load3dXml(input) {
  const file = input.files[0];
  if (!file) return;
  setStatus('3d', 'info', '<span class="spin">↻</span> &nbsp;Construction de la maquette...');
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(e.target.result, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('XML invalide');
      dpe3dData = parseXml3d(doc);

      const elCtrl  = document.getElementById('controls3d');
      const elWrap  = document.getElementById('canvas3d-wrap');
      const elStats = document.getElementById('parois3d-stats');
      const elDrop  = document.getElementById('view3d-drop');

      if (elCtrl)  elCtrl.style.display  = 'flex';
      if (elWrap)  elWrap.style.display  = 'block';
      if (elStats) elStats.style.display = 'block';

      setTimeout(() => {
        build3dScene(dpe3dData);
        clearStatus('3d');
        if (elDrop) elDrop.innerHTML =
          '<div style="font-size:15px;color:var(--accent);font-weight:600">✅ ' + file.name + '</div>' +
          '<div style="font-size:11px;color:var(--muted);margin-top:4px">' +
          (dpe3dData.adresse||'') + '</div>';
        renderParoisStats(dpe3dData);
      }, 60);
    } catch(err) {
      setStatus('3d', 'err', '✖ ' + err.message);
    }
  };
  reader.readAsText(file);
}

function build3dScene(d) {
  const canvas = document.getElementById('canvas3d');
  const wrap   = document.getElementById('canvas3d-wrap');
  if (!canvas || !wrap) return;

  const W = wrap.clientWidth || 900;
  const H3 = 520;
  canvas.width  = W;
  canvas.height = H3;

  if (renderer3d) renderer3d.dispose();
  if (animFrame3d) cancelAnimationFrame(animFrame3d);
  allMeshes3d = [];

  // Scène
  scene3d = new THREE.Scene();
  scene3d.background = new THREE.Color(0x0c0c14);
  scene3d.fog = new THREE.FogExp2(0x0c0c14, 0.04);

  renderer3d = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
  renderer3d.setSize(W, H3);
  renderer3d.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer3d.shadowMap.enabled = true;
  renderer3d.shadowMap.type = THREE.PCFSoftShadowMap;

  camera3d = new THREE.PerspectiveCamera(42, W/H3, 0.1, 300);
  camTheta = Math.PI/4.5; camPhi = Math.PI/3.5; camDist = 20;
  updateCamera3d();

  // Lumières
  scene3d.add(new THREE.AmbientLight(0xffffff, 0.45));
  const sun = new THREE.DirectionalLight(0xfff8e8, 1.1);
  sun.position.set(12, 22, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
  scene3d.add(sun);
  // lumière de remplissage ajoutée ci-dessous
  const fill = new THREE.DirectionalLight(0x8899cc, 0.25);
  fill.position.set(-10, 4, -8); scene3d.add(fill);

  // Dimensions depuis les murs extérieurs
  const { mursMap, baisMap, H, niv, hsp } = d;
  const getLen = o => mursMap[o] ? mursMap[o].surf / H : 0;
  const Lx = Math.max((getLen('N') + getLen('S')) / 2, 3); // E-O
  const Lz = Math.max((getLen('E') + getLen('O')) / 2, 3); // N-S

  // Couleurs basées sur seuils absolus RT2012/RE2020 — pas de normalisation relative

  // Sol
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshLambertMaterial({ color:0x12121e })
  );
  ground.rotation.x = -Math.PI/2; ground.position.y = -0.01;
  ground.receiveShadow = true; scene3d.add(ground);

  // Grille fine
  scene3d.add(new THREE.GridHelper(60, 60, 0x1a1a2e, 0x1a1a2e));

  // ── 4 FAÇADES ──
  // Config : [orientation, centre_x, centre_z, largeur, angle_Y]
  const facades = [
    { o:'N', cx:0,      cz:-Lz/2, W:Lx, rot:0        },
    { o:'S', cx:0,      cz: Lz/2, W:Lx, rot:Math.PI  },
    { o:'E', cx: Lx/2, cz:0,     W:Lz, rot:-Math.PI/2 },
    { o:'O', cx:-Lx/2, cz:0,     W:Lz, rot: Math.PI/2 },
  ];

  facades.forEach(f => {
    const md = mursMap[f.o];
    const bd = baisMap[f.o];
    const U  = md ? md.U : null;
    const wallColor = uToColor(U);

    // ── MUR PLEIN (avec trou si vitrages) ──
    // On utilise un BoxGeometry simple et on place l'ouverture comme un plan transparent

    // Matériau mur
    const wallMat = new THREE.MeshPhongMaterial({
      color: wallColor, shininess:12,
      emissive: new THREE.Color(wallColor).multiplyScalar(0.05),
    });

    // Si pas de baie : mur plein
    // Si baie : mur avec "ouverture" représentée par un plan vitré
    const wallGeo = new THREE.BoxGeometry(f.W, H, 0.22);
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(f.cx, H/2, f.cz);
    wallMesh.rotation.y = f.rot;
    wallMesh.castShadow = true; wallMesh.receiveShadow = true;
    wallMesh.userData = {
      type: 'wall', orient: f.o,
      U: U ? U.toFixed(2) : '—',
      mat: md ? md.mat : '—',
      surf: md ? md.surf.toFixed(1) : '—',
      ep_iso: md && md.ep_iso > 0 ? (md.ep_iso * 100).toFixed(0) : 0,
      iso: md ? (md.iso || '') : '',
      originalColor: wallColor.clone(),
    };
    allMeshes3d.push(wallMesh);
    scene3d.add(wallMesh);

    // ── OUVERTURE VITRÉE (ratio réel) ──
    if (bd && bd.surf > 0) {
      const ratio = Math.min(bd.ratio || 0, 0.8);
      // Dimensions de l'ouverture : hauteur = 60% H, largeur proportionnelle au ratio
      const win_h = Math.min(H * 0.55, H - 0.6);
      const win_w = ratio * f.W;
      const win_y = H * 0.38; // centré à 38% de la hauteur

      // Cadre (rectangle creux) — 4 barreaux
      const frameColor = 0x888899;
      const fT = 0.08; // épaisseur cadre

      const frameParts = [
        { w:win_w + fT*2, h:fT,           x:0,         y:win_y+win_h/2+fT/2  }, // haut
        { w:win_w + fT*2, h:fT,           x:0,         y:win_y-win_h/2-fT/2  }, // bas
        { w:fT,           h:win_h+fT*2,   x:-win_w/2,  y:win_y                }, // gauche
        { w:fT,           h:win_h+fT*2,   x: win_w/2,  y:win_y                }, // droite
      ];

      const frameDepth = 0.28;
      frameParts.forEach(fp => {
        const fm = new THREE.Mesh(
          new THREE.BoxGeometry(fp.w, fp.h, frameDepth),
          new THREE.MeshPhongMaterial({ color:frameColor, shininess:40 })
        );
        fm.position.set(f.cx, fp.y, f.cz);
        fm.rotation.y = f.rot;
        const offset = frameDepth/2;
        if (f.o === 'N') fm.position.z += -0.01;
        if (f.o === 'S') fm.position.z +=  0.01;
        if (f.o === 'E') fm.position.x +=  0.01;
        if (f.o === 'O') fm.position.x += -0.01;
        // Position locale
        const cos = Math.cos(f.rot), sin = Math.sin(f.rot);
        fm.position.x += fp.x * cos;
        fm.position.z += fp.x * sin;
        scene3d.add(fm);
      });

      // Vitrage translucide
      const winMat = new THREE.MeshPhongMaterial({
        color: 0x88bbdd, transparent:true, opacity:0.35,
        shininess:120, reflectivity:0.8,
        emissive: new THREE.Color(0x112233),
      });
      const winGeo = new THREE.BoxGeometry(win_w, win_h, 0.04);
      const winMesh = new THREE.Mesh(winGeo, winMat);

      // Positionner en face du mur
      const nx = Math.sin(f.rot), nz = Math.cos(f.rot); // normale sortante
      winMesh.position.set(f.cx, win_y, f.cz);
      winMesh.rotation.y = f.rot;
      // Décaler légèrement devant le mur
      winMesh.position.x += nx * 0.12;
      winMesh.position.z += nz * 0.12;
      // Ajuster X local (le long de la façade)
      winMesh.position.x += 0; // centré

      winMesh.userData = {
        type: 'window', orient: f.o,
        Uw: bd.Uw.toFixed(1), nb: bd.nb,
        surf: bd.surf.toFixed(1), ratio: (ratio*100).toFixed(0),
        originalColor: new THREE.Color(0x88bbdd),
      };
      allMeshes3d.push(winMesh);
      scene3d.add(winMesh);
    }
  });

  // ── PLANCHER BAS ──
  const floorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(Lx, 0.18, Lz),
    new THREE.MeshPhongMaterial({ color:0x222230, shininess:5 })
  );
  floorMesh.position.set(0, -0.09, 0); floorMesh.receiveShadow = true;
  scene3d.add(floorMesh);

  // ── PLANCHER INTERMÉDIAIRE (si 2 niveaux) ──
  if (niv > 1) {
    for (let lv = 1; lv < niv; lv++) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(Lx+0.22, 0.15, Lz+0.22),
        new THREE.MeshPhongMaterial({ color:0x1a1a28, shininess:5 })
      );
      slab.position.set(0, lv*hsp, 0); scene3d.add(slab);
    }
  }

  // ── TOITURE (simple plat avec débord) ──
  const roofMesh = new THREE.Mesh(
    new THREE.BoxGeometry(Lx+0.5, 0.2, Lz+0.5),
    new THREE.MeshPhongMaterial({ color:0x2a2030, shininess:8 })
  );
  roofMesh.position.set(0, H+0.1, 0);
  roofMesh.castShadow = true; scene3d.add(roofMesh);

  // Cheminée (décoration)
  const chimneyH = 1.2;
  const chimneyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, chimneyH, 0.4),
    new THREE.MeshPhongMaterial({ color:0x3a2020 })
  );
  chimneyMesh.position.set(Lx*0.25, H+0.2+chimneyH/2, -Lz*0.2); scene3d.add(chimneyMesh);

  // ── WIREFRAME CONTOUR ──
  const bldEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(Lx+0.22, H, Lz+0.22));
  const edgeLine = new THREE.LineSegments(bldEdges,
    new THREE.LineBasicMaterial({ color:0x334466, transparent:true, opacity:0.5 }));
  edgeLine.position.set(0, H/2, 0); scene3d.add(edgeLine);

  // ── LABELS CARDINAUX ──
  const labels = [
    { o:'N', x:0,       z:-(Lz/2+2), color:'#ff6666' },
    { o:'S', x:0,       z:  Lz/2+2,  color:'#66aaff' },
    { o:'E', x: Lx/2+2, z:0,         color:'#ffcc66' },
    { o:'O', x:-Lx/2-2, z:0,         color:'#88dd88' },
  ];
  labels.forEach(lb => addLabel3d(lb.o, lb.x, 0.6, lb.z, lb.color, 56));

  // ── LÉGENDE U-VALUES ──
  buildLegend3d();

  // ── RAYCASTER ──
  setupRaycaster3d();

  // ── ANIMATION ──
  animate3d();
}

function addLabel3d(text, x, y, z, color, size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = color || '#ffffff';
  ctx.font = 'bold ' + (size||52) + 'px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 64);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent:true, depthWrite:false
  }));
  sp.position.set(x, y, z);
  sp.scale.set(1.4, 1.4, 1);
  scene3d.add(sp);
}


function buildLegend3d() {
  const wrap = document.getElementById('legend-items');
  if (!wrap) return;

  const rows = [
    { label:'≤ 0.20', txt:'Très performant', U:0.20 },
    { label:'0.20 – 0.40', txt:'Bon', U:0.35 },
    { label:'0.40 – 0.70', txt:'Moyen', U:0.55 },
    { label:'0.70 – 1.20', txt:'Faible', U:0.95 },
    { label:'1.20 – 2.00', txt:'Mauvais', U:1.60 },
    { label:'> 2.00', txt:'Très mauvais', U:2.50 },
    { label:'—', txt:'Non renseigné', U:null },
  ];

  wrap.innerHTML = rows.map(r => {
    let color = '#334455';
    if (r.U !== null) {
      const c = uToColor(r.U);
      color = '#' + [c.r, c.g, c.b]
        .map(v => Math.round(v * 255).toString(16).padStart(2, '0'))
        .join('');
    }

    return '<div style="display:grid;grid-template-columns:48px 1fr;gap:8px;align-items:center">' +
      '<div style="height:10px;border-radius:5px;background:' + color + ';border:1px solid rgba(255,255,255,.18)"></div>' +
      '<div style="display:flex;justify-content:space-between;gap:10px;white-space:nowrap">' +
        '<span style="color:rgba(255,255,255,.72)">' + r.label + '</span>' +
        '<span style="color:rgba(255,255,255,.42)">' + r.txt + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}


function setupRaycaster3d() {
  const canvas  = document.getElementById('canvas3d');
  const tooltip = document.getElementById('tooltip3d');
  if (!canvas) return;

  const raycaster = new THREE.Raycaster();
  const mouse     = new THREE.Vector2();

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera3d);
    const hits = raycaster.intersectObjects(allMeshes3d);

    // Reset couleurs
    allMeshes3d.forEach(m => {
      if (m.userData.originalColor) m.material.color.copy(m.userData.originalColor);
    });

    if (tooltip) {
      if (hits.length) {
        const ud = hits[0].object.userData;
        let html = '';
        if (ud.type === 'wall') {
          const isoTip = ud.iso || (ud.ep_iso > 0 ? ud.ep_iso + ' cm' : null);
          html = '<strong style="color:#4ade80">Façade ' + ud.orient + '</strong><br>' +
            'Matériau : ' + ud.mat + '<br>' +
            'Surface totale : ' + ud.surf + ' m²<br>' +
            'U moyen = <strong style="color:#f59e0b">' + ud.U + ' W/m²K</strong><br>' +
            (isoTip && isoTip !== 'Non isolé'
              ? '<span style="color:#4ade80">✓ ' + isoTip + '</span>'
              : '<span style="color:#fca5a5">✗ Non isolé</span>');
        } else {
          html = '<strong style="color:#88ccff">Vitrage ' + ud.orient + '</strong><br>' +
            ud.nb + ' baie(s) · ' + ud.surf + ' m²<br>' +
            'Ratio façade : ' + ud.ratio + '%<br>' +
            'Uw = <strong style="color:#f59e0b">' + ud.Uw + ' W/m²K</strong>';
        }
        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX - canvas.getBoundingClientRect().left + 14) + 'px';
        tooltip.style.top  = (e.clientY - canvas.getBoundingClientRect().top  - 10) + 'px';
        hits[0].object.material.color.multiplyScalar(1.35);
      } else {
        tooltip.style.display = 'none';
      }
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (tooltip) tooltip.style.display = 'none';
    allMeshes3d.forEach(m => {
      if (m.userData.originalColor) m.material.color.copy(m.userData.originalColor);
    });
  });

  // Orbite drag
  canvas.addEventListener('mousedown', e => { isDragging3d=true; prevMouse3d={x:e.clientX,y:e.clientY}; });
  window.addEventListener('mouseup',   () => { isDragging3d=false; });
  canvas.addEventListener('mousemove', e => {
    if (!isDragging3d) return;
    camTheta -= (e.clientX - prevMouse3d.x) * 0.012;
    camPhi    = Math.max(0.08, Math.min(Math.PI/2 - 0.05, camPhi - (e.clientY - prevMouse3d.y) * 0.012));
    prevMouse3d = {x:e.clientX, y:e.clientY};
    updateCamera3d();
  });
  canvas.addEventListener('wheel', e => {
    camDist = Math.max(6, Math.min(50, camDist + e.deltaY * 0.025));
    updateCamera3d(); e.preventDefault();
  }, {passive:false});
}

function updateCamera3d() {
  if (!camera3d) return;
  const targetY = dpe3dData ? dpe3dData.H * 0.45 : 3;
  camera3d.position.set(
    camDist * Math.sin(camPhi) * Math.sin(camTheta),
    camDist * Math.cos(camPhi) + targetY * 0.3,
    camDist * Math.sin(camPhi) * Math.cos(camTheta)
  );
  camera3d.lookAt(0, targetY, 0);
}

function setView3d(view) {
  document.querySelectorAll('.btn3d').forEach(b => b.classList.remove('active'));
  const id = {perspective:'btn-persp',north:'btn-north',south:'btn-south',east:'btn-east',west:'btn-west',top:'btn-top'}[view];
  const el = document.getElementById(id); if (el) el.classList.add('active');
  switch(view) {
    case 'perspective': camTheta= Math.PI/4.5; camPhi=Math.PI/3.5; camDist=20; break;
    case 'north':       camTheta= Math.PI;     camPhi=Math.PI/5;   camDist=18; break;
    case 'south':       camTheta= 0;           camPhi=Math.PI/5;   camDist=18; break;
    case 'east':        camTheta= Math.PI/2;   camPhi=Math.PI/5;   camDist=18; break;
    case 'west':        camTheta=-Math.PI/2;   camPhi=Math.PI/5;   camDist=18; break;
    case 'top':         camTheta= Math.PI/4;   camPhi=0.06;        camDist=24; break;
  }
  updateCamera3d();
}

function toggleRenovation(enabled) {
  renoMode = enabled;
  if (!dpe3dData) return;
  allMeshes3d.forEach(m => {
    if (m.userData.type !== 'wall') return;
    const U = parseFloat(m.userData.U) || 1.5;
    const newU = enabled ? Math.max(U * 0.3, 0.15) : U; // simulation isolation
    const nc = uToColor(newU);
    m.userData.originalColor = nc.clone();
    m.material.color.copy(nc);
  });
}

function toggleXray(enabled) {
  xrayMode = enabled;
  allMeshes3d.filter(m => m.userData.type === 'wall').forEach(m => {
    m.material.transparent = enabled;
    m.material.opacity     = enabled ? 0.3 : 1.0;
    m.material.depthWrite  = !enabled;
  });
}

function animate3d() {
  animFrame3d = requestAnimationFrame(animate3d);
  if (renderer3d && scene3d && camera3d) renderer3d.render(scene3d, camera3d);
}

function renderParoisStats(d) {
  const el = document.getElementById('parois3d-stats');
  if (!el) return;
  const LABEL = {N:'Nord',E:'Est',S:'Sud',O:'Ouest'};

  let html = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">';
  ['N','E','S','O'].forEach(o => {
    const md = d.mursMap[o]; if (!md) return;
    const bd = d.baisMap[o];
    const c  = uToColor(md.U);
    const hex = '#' + [c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
    html += '<span style="font-size:13px;font-weight:700">Façade ' + LABEL[o] + '</span>';
    html += '<span style="font-size:11px;font-family:var(--mono);padding:2px 8px;border-radius:4px;background:' + hex + '22;color:' + hex + ';border:1px solid ' + hex + '44">U=' + md.U.toFixed(2) + '</span></div>';
    html += '<div style="font-size:11px;color:var(--muted);line-height:2">';
    html += '📐 Surface mur : <strong style="color:var(--text)">' + md.surf.toFixed(1) + ' m²</strong><br>';
    html += '🧱 Matériau : <strong style="color:var(--text)">' + md.mat + '</strong><br>';
    // Isolation — afficher le label complet si dispo (XLS) sinon l'épaisseur (XML)
    const isoLabel = md.iso || (md.ep_iso > 0 ? (md.ep_iso*100).toFixed(0)+' cm' : null);
    const isoColor = isoLabel && isoLabel !== 'Non isolé' ? 'var(--accent)' : '#fca5a5';
    html += '🔒 Isolation : <strong style="color:' + isoColor + '">' + (isoLabel || 'Non isolé') + '</strong><br>';
    html += '🪟 Vitrage : <strong style="color:var(--text)">' + (bd ? bd.surf.toFixed(1)+' m² ('+Math.round(bd.ratio*100)+'% façade)' : 'aucun') + '</strong>';
    if (bd && bd.types && bd.types.length) {
      const typesUniq = [...new Set(bd.types)].join(', ');
      html += '<br>🏠 Types : <strong style="color:var(--text)">' + typesUniq + '</strong>';
    }
    html += '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

window.load3dXml      = load3dXml;
window.load3dFile     = load3dFile;
window.setView3d      = setView3d;
window.toggleRenovation = toggleRenovation;
window.toggleXray     = toggleXray;


/* INIT */

/* ─────────────────────────────────────────
   UI-2 — Modes d’affichage
───────────────────────────────────────── */
(function(){
  const allowed = ['user','immo','expert'];
  function apply(mode){
    const m = allowed.includes(mode) ? mode : 'user';
    document.body.setAttribute('data-ui-mode', m);
    try { localStorage.setItem('dpeExplorerUiMode', m); } catch(e) {}
    const sel = document.getElementById('ui-mode-select');
    if (sel) sel.value = m;

    // En mode simple, on referme les détails expert pour réduire la charge visuelle.
    // En mode expert, les détails ADEME sont ouverts par défaut.
    document.querySelectorAll('details.expert-details').forEach(d => { d.open = (m === 'expert'); });
  }
  window.setUIMode = apply;
  document.addEventListener('DOMContentLoaded', function(){
    let saved = 'user';
    try { saved = localStorage.getItem('dpeExplorerUiMode') || 'user'; } catch(e) {}
    apply(saved);
  });
})();

/* ─────────────────────────────────────────
   GÉOLOCALISATION AU DÉMARRAGE
   Ouvre automatiquement le panel carte centré
   sur la position de l'utilisateur (rayon 500 m).
   Si la géoloc est refusée ou indisponible : rien ne change.
   Ne se relance pas si l'utilisateur revient sur l'onglet.
───────────────────────────────────────── */
(function () {
  'use strict';

  let _geolocDone = false; // garde-fou : on ne lance qu'une seule fois

  async function initGeolocOnStart() {
    if (_geolocDone) return;
    if (!navigator.geolocation) return; // navigateur ne supporte pas

    _geolocDone = true;

    navigator.geolocation.getCurrentPosition(
      async function onSuccess(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        // 1. Forcer le rayon à 500 m dans le sélecteur UI
        const radiusSelect = document.getElementById('f-map-radius');
        if (radiusSelect) radiusSelect.value = '500';

        // 2. S'assurer que DPE et Audits sont cochés
        const cbDpe = document.getElementById('f-map-dpe');
        const cbAudit = document.getElementById('f-map-audit');
        if (cbDpe) cbDpe.checked = true;
        if (cbAudit) cbAudit.checked = true;

        // 3. Basculer sur le panel carte (onglet "Recherche par adresse")
        if (typeof window.activatePanel === 'function') {
          window.activatePanel('addr');
        }

        // 4. Afficher un message d'attente dans le panel
        if (typeof window.setStatus === 'function') {
          window.setStatus('addr', 'info',
            '<span class="spin">↻</span> &nbsp;Localisation détectée — chargement des DPE et audits dans un rayon de 500 m…');
        }

        // 5. Lancer la recherche autour des coordonnées GPS
        //    searchNearbyFromMapCenter est définie dans js/map.js et lit le rayon
        //    depuis le sélecteur #f-map-radius qu'on vient de mettre à 500.
        if (typeof window.searchNearbyFromMapCenter === 'function') {
          try {
            await window.searchNearbyFromMapCenter(lat, lon);
          } catch (e) {
            console.warn('[DPE Explorer] Erreur géoloc démarrage', e);
            if (typeof window.setStatus === 'function') {
              window.setStatus('addr', 'err', '✖ Impossible de charger les DPE autour de votre position : ' + e.message);
            }
          }
        }
      },
      function onError(err) {
        // Refus utilisateur ou géoloc indisponible → on reste sur le panel Recherche DPE
        console.info('[DPE Explorer] Géolocalisation refusée ou indisponible :', err.message);
        _geolocDone = false; // reset pour permettre un éventuel retry manuel (usage futur)
      },
      {
        enableHighAccuracy: false, // inutile pour une bbox de 500 m
        timeout: 8000,             // 8 s max avant d'abandonner silencieusement
        maximumAge: 60000          // accepte une position vieille de 1 min
      }
    );
  }

  // Lancement après que tous les modules soient prêts
  document.addEventListener('DOMContentLoaded', function () {
    // setTimeout 0 laisse map.js finir ses exports window.* avant qu'on les appelle
    setTimeout(initGeolocOnStart, 0);
  });

  // Exposition pour debug console : window.initGeolocOnStart()
  window.initGeolocOnStart = initGeolocOnStart;
})();
