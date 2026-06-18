// DPE Explorer - module carte de proximité adresse
// Lot 4D : carte mixte DPE + Audits énergétiques.
// Dépendances globales conservées pendant le refactoring progressif :
// L, displayUrl, displayAuditUrl, buildUrl, activeFilters, normAddr, compactDpeForLog,
// setStatus, clearStatus, renderAddrResults, loadDpeFromAddrB64, normalizeAuditRows, renderAudit.

let addrLeafletMap = null;
let addrLeafletLayer = null;
let addrDrawnItems = null;
let addrDrawControl = null;
let addrActiveDrawHandler = null;
let mapDrawingActive = false;

// État cartographique conservé en mémoire : la collecte ADEME est faite une fois,
// puis les filtres ci-dessous ne font que masquer/afficher les résultats déjà chargés.
let addrMapState = { dpes: [], audits: [], visibleDpes: [], visibleAudits: [], center: null, radius: 50, fullAddress: '', size: '20', source:'address', selectionPolygon: null };
let mapClickRecenterReady = false;

// ── BARRE DE PROGRESSION DE COLLECTE ─────────────────────────────
// Compteurs partagés mis à jour pendant fetchDataFairAllPages
let _progressDpe   = 0;
let _progressAudit = 0;
let _progressPhase = ''; // 'dpe' | 'audit' | 'done' | ''

function setSearchProgress(dpeCount, auditCount, phase) {
  _progressDpe   = dpeCount;
  _progressAudit = auditCount;
  _progressPhase = phase || '';

  const bar    = document.getElementById('search-progress-bar');
  const wrap   = document.getElementById('search-progress');
  if (!wrap) return;

  if (phase === 'done' || phase === '') {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';

  const dpeEl   = document.getElementById('prog-dpe-count');
  const audEl   = document.getElementById('prog-audit-count');
  const phaseEl = document.getElementById('prog-phase-label');
  const fillEl  = document.getElementById('prog-bar-fill');

  if (dpeEl)   dpeEl.textContent   = dpeCount;
  if (audEl)   audEl.textContent   = auditCount;
  if (phaseEl) phaseEl.textContent = phase === 'dpe'   ? 'Collecte DPE…'
                                    : phase === 'audit' ? 'Collecte Audits…'
                                    : phase === 'geo'   ? 'Géocodage…'
                                    : 'Recherche…';

  // Barre indéterminée animée (on ne connaît pas le total exact)
  if (fillEl) {
    const total = dpeCount + auditCount;
    // Animation CSS gère le mouvement, on pousse juste un data-attr
    fillEl.setAttribute('data-count', total);
  }
}

function resetSearchProgress() {
  _progressDpe   = 0;
  _progressAudit = 0;
  _progressPhase = '';
  setSearchProgress(0, 0, '');
}

window.setSearchProgress  = setSearchProgress;
window.resetSearchProgress = resetSearchProgress;

function hideAddrMap() {
  const card = document.getElementById('addr-map-card');
  if (card) card.style.display = 'none';
}

function extractCpFromInput(v) {
  const m = String(v || '').match(/\b\d{5}\b/);
  return m ? m[0] : '';
}

function cleanCityFromInput(v) {
  return String(v || '').replace(/\b\d{5}\b/g, '').trim();
}

function parseGeoPoint(v) {
  const gp = String(v || '');
  if (!gp || !gp.includes(',')) return null;
  const parts = gp.split(',');
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
}

function dpeLatLon(d) {
  return parseGeoPoint(d && d._geopoint);
}

function auditLatLon(auditOrRow) {
  if (!auditOrRow) return null;
  if (Number.isFinite(Number(auditOrRow.lat)) && Number.isFinite(Number(auditOrRow.lon))) {
    return { lat:Number(auditOrRow.lat), lon:Number(auditOrRow.lon) };
  }
  return parseGeoPoint(auditOrRow._geopoint);
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = v => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}


function buildGeoBboxParams(center, radius, datasetType) {
  // DataFair/ADEME accepte un paramètre bbox géographique, format OGC :
  // bbox = lonMin,latMin,lonMax,latMax
  // Les tests ont confirmé que c’est cette syntaxe qui filtre réellement le dataset DPE.
  const lat = Number(center && center.lat);
  const lon = Number(center && center.lon);
  const r = Math.max(30, Number(radius || 50));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const dLat = r / 111320;
  const dLon = r / (111320 * Math.cos(lat * Math.PI / 180));

  const latMin = lat - dLat;
  const latMax = lat + dLat;
  const lonMin = lon - dLon;
  const lonMax = lon + dLon;

  return {
    bbox: [lonMin, latMin, lonMax, latMax].join(','),
    // size=1000 évite les erreurs DataFair lorsque page*size dépasse la fenêtre max.
    // On pagine ensuite proprement jusqu'au plafond choisi.
    size: '1000',
    _label: datasetType + '-geo-bbox-ogc-' + Math.round(r) + 'm'
  };
}

function markerColor(e) {
  return { A:'#4ade80', B:'#86efac', C:'#d9ef28', D:'#fde047', E:'#fb923c', F:'#f97316', G:'#ef4444' }[e] || '#94a3b8';
}

function dpeMarkerColor(e) { return markerColor(e); }

function normalizePolygonLatLngs(latlngs) {
  const pts = [];
  (latlngs || []).forEach(p => {
    if (Array.isArray(p)) pts.push(...normalizePolygonLatLngs(p));
    else if (p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))) pts.push({ lat:Number(p.lat), lon:Number(p.lng) });
  });
  return pts;
}

function pointInPolygon(lat, lon, polygon) {
  const pts = polygon || [];
  if (pts.length < 3) return false;
  // Ray casting : x = longitude, y = latitude
  const x = lon;
  const y = lat;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].lon, yi = pts[i].lat;
    const xj = pts[j].lon, yj = pts[j].lat;
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function itemPassesSelectionZone(item) {
  const poly = addrMapState.selectionPolygon;
  if (!poly || poly.length < 3) return true;
  const ll = itemLatLon(item);
  if (!ll) return false;
  return pointInPolygon(ll.lat, ll.lon, poly);
}

function updateMapZoneInfo() {
  const el = document.getElementById('map-zone-info');
  if (!el) return;
  const poly = addrMapState.selectionPolygon;
  if (poly && poly.length >= 3) {
    const dpeCount = (addrMapState.visibleDpes || []).length;
    const auditCount = (addrMapState.visibleAudits || []).length;
    el.innerHTML = '<span class="free-zone-badge">Zone active · ' + dpeCount + ' DPE · ' + auditCount + ' audit(s)</span>';
  } else {
    el.textContent = 'Aucune zone dessinée. La sélection filtre les DPE/Audits déjà chargés dans le rayon.';
  }
}

function resetMapSelectionState(clearLayer) {
  addrMapState.selectionPolygon = null;
  if (clearLayer && addrDrawnItems) addrDrawnItems.clearLayers();
  updateMapZoneInfo();
}

function encodeObjForHtml(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

async function fetchJsonSmart(params) {
  const urls = [];
  const direct = displayUrl(params);
  const proxied = buildUrl(params);

  // Important : certaines requêtes DataFair avec qs sont refusées par le proxy
  // alors que l'API ADEME directe les accepte. On tente donc l'ADEME direct en premier.
  urls.push({ label:'ademe-direct-dpe', url: direct });
  if (proxied) urls.push({ label:'proxy-dpe', url: proxied });

  let lastErr = null;
  for (const u of urls) {
    try {
      console.log('[DPE Explorer] Fetch', u.label, u.url);
      const r = await fetch(u.url, { headers: { Accept:'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + r.statusText);
      return await r.json();
    } catch(e) {
      lastErr = e;
      console.warn('[DPE Explorer] Echec fetch', u.label, e.message);
    }
  }
  throw lastErr || new Error('Aucune réponse API DPE');
}

async function fetchAuditJsonSmart(params) {
  const urls = [];
  const direct = typeof displayAuditUrl === 'function' ? displayAuditUrl(params) : (window.DPE_CONFIG.ADEME_AUDIT_LINES + '?' + ademeQs(params));
  urls.push({ label:'ademe-direct-audit', url: direct });

  // On évite volontairement le proxy pour l'audit en recherche carto : les requêtes qs
  // sur DataFair sont plus fiables en direct et l'endpoint ADEME est CORS-compatible.
  let lastErr = null;
  for (const u of urls) {
    try {
      console.log('[DPE Explorer] Fetch', u.label, u.url);
      const r = await fetch(u.url, { headers: { Accept:'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + r.statusText);
      return await r.json();
    } catch(e) {
      lastErr = e;
      console.warn('[DPE Explorer] Echec fetch', u.label, e.message);
    }
  }
  throw lastErr || new Error('Aucune réponse API Audit');
}

async function geocodeAddressBAN(query) {
  const url = 'https://api-adresse.data.gouv.fr/search/?limit=1&q=' + encodeURIComponent(query);
  console.log('[DPE Explorer] Géocodage BAN', url);
  const r = await fetch(url, { headers: { Accept:'application/json' } });
  if (!r.ok) throw new Error('Géocodage BAN HTTP ' + r.status);
  const data = await r.json();
  const f = data.features && data.features[0];
  if (!f) throw new Error('Adresse introuvable dans la BAN');
  return {
    label: f.properties.label,
    score: f.properties.score,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    postcode: f.properties.postcode || extractCpFromInput(query),
    city: f.properties.city || cleanCityFromInput(query),
    banId: f.properties.id || ''
  };
}

async function reverseGeocodeBAN(lat, lon) {
  const url = 'https://api-adresse.data.gouv.fr/reverse/?lon=' + encodeURIComponent(lon) + '&lat=' + encodeURIComponent(lat);
  console.log('[DPE Explorer] Reverse géocodage BAN', url);
  const r = await fetch(url, { headers: { Accept:'application/json' } });
  if (!r.ok) throw new Error('Reverse géocodage BAN HTTP ' + r.status);
  const data = await r.json();
  const f = data.features && data.features[0];
  const props = f ? f.properties || {} : {};
  return {
    label: props.label || ('Point carte ' + lat.toFixed(6) + ', ' + lon.toFixed(6)),
    score: props.score || null,
    lon: lon,
    lat: lat,
    postcode: props.postcode || '',
    city: props.city || '',
    banId: props.id || '',
    housenumber: props.housenumber || '',
    street: props.street || props.name || ''
  };
}

function escapeQsValue(v) {
  return String(v || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
}

function titleCaseStreetForAdeme(rue) {
  const small = new Set(['de','du','des','la','le','les','l','d','a','au','aux','et']);
  return String(rue || '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => small.has(w) && i > 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/^rue\b/i, 'Rue')
    .replace(/^avenue\b/i, 'Avenue')
    .replace(/^boulevard\b/i, 'Boulevard')
    .replace(/^impasse\b/i, 'Impasse')
    .replace(/^chemin\b/i, 'Chemin');
}

function passesAdvancedFiltersLocal(d) {
  if (activeFilters.etiq_dpe.size && !activeFilters.etiq_dpe.has(String(d.etiquette_dpe || ''))) return false;
  if (activeFilters.etiq_ges.size && !activeFilters.etiq_ges.has(String(d.etiquette_ges || ''))) return false;
  if (activeFilters.periode.size && !activeFilters.periode.has(String(d.periode_construction || ''))) return false;
  if (activeFilters.energie.size && !activeFilters.energie.has(String(d.type_energie_principale_chauffage || ''))) return false;
  if (activeFilters.type_hab.size) {
    const t = normAddr(d.type_batiment || '');
    const ok = [...activeFilters.type_hab].some(v => t.includes(normAddr(v)));
    if (!ok) return false;
  }
  const dMin = document.getElementById('f-date-min').value;
  const dMax = document.getElementById('f-date-max').value;
  const date = d.date_etablissement_dpe || '';
  if (dMin && (!date || date < dMin)) return false;
  if (dMax && (!date || date > dMax)) return false;
  const sMin = parseFloat(document.getElementById('f-surf-min').value || '');
  const sMax = parseFloat(document.getElementById('f-surf-max').value || '');
  const surf = parseFloat(d.surface_habitable_logement || '');
  if (!isNaN(sMin) && (isNaN(surf) || surf < sMin)) return false;
  if (!isNaN(sMax) && (isNaN(surf) || surf > sMax)) return false;
  return true;
}


function getCheckedValues(selector) {
  return [...document.querySelectorAll(selector)]
    .filter(el => el.checked)
    .map(el => String(el.value || '').trim())
    .filter(Boolean);
}

function isMapExhaustiveMode() {
  return document.getElementById('f-map-exhaustive')?.checked !== false;
}

function applyAdvancedFiltersOnMap() {
  return document.getElementById('f-map-use-advanced')?.checked === true;
}

function passesMapVisualFilters(item) {
  const includeDpe = document.getElementById('f-map-dpe')?.checked !== false;
  const includeAudit = document.getElementById('f-map-audit')?.checked !== false;
  const selectedClasses = getCheckedValues('.f-map-class');

  if (item._kind === 'audit') {
    if (!includeAudit) return false;
    const before = item.initial?.classe_bilan_dpe || item.final?.classe_bilan_dpe || '';
    const after = item.final?.classe_bilan_dpe || before;
    if (selectedClasses.length && !selectedClasses.includes(before) && !selectedClasses.includes(after)) return false;
    return true;
  }

  if (!includeDpe) return false;
  const e = String(item.etiquette_dpe || '');
  if (selectedClasses.length && !selectedClasses.includes(e)) return false;
  if (applyAdvancedFiltersOnMap() && !passesAdvancedFiltersLocal(item)) return false;
  return true;
}

function applyMapDisplayFilters() {
  if (!addrMapState.center) return;
  const dpes = (addrMapState.dpes || []).filter(passesMapVisualFilters).filter(itemPassesSelectionZone);
  const audits = (addrMapState.audits || []).filter(passesMapVisualFilters).filter(itemPassesSelectionZone);
  addrMapState.visibleDpes = dpes;
  addrMapState.visibleAudits = audits;
  renderMixedNearbyMap(dpes, audits, addrMapState.center, addrMapState.radius);
  renderMixedNearbyResults(dpes, audits, addrMapState.center, addrMapState.radius, addrMapState.fullAddress, addrMapState.size, {
    rawDpeCount: addrMapState.dpes.length,
    rawAuditCount: addrMapState.audits.length,
    zoneActive: !!(addrMapState.selectionPolygon && addrMapState.selectionPolygon.length >= 3)
  });
  updateMapZoneInfo();
}

function buildStreetAttempts(center, rue, ville, datasetType, radius) {
  const cp = extractCpFromInput(ville) || center.postcode || '';
  const effectiveCity = center.city || cleanCityFromInput(ville);
  const streetCpQuery = [rue, cp || ville].filter(Boolean).join(' ');
  const streetNormForQs = titleCaseStreetForAdeme(rue);
  const attempts = [];

  // Stratégie principale : requête géographique côté ADEME.
  // On interroge un bbox géographique OGC autour du centre, puis on applique le rayon exact en local.
  // C'est beaucoup plus fiable et léger que scanner tout un code postal.
  const geoAttempt = buildGeoBboxParams(center, radius, datasetType);
  if (geoAttempt) attempts.push(geoAttempt);

  // Secours CP exact uniquement si le mode exhaustif est demandé.
  // Il reste utile si certains enregistrements n'ont pas de coordonnées cartographiques exploitables.
  if (isMapExhaustiveMode() && cp) {
    attempts.push({ qs:'code_postal_ban:' + cp, size:'10000', _label: datasetType + '-cp-secours-qs' });
  }

  // Requêtes ciblées rue + CP. Elles accélèrent quand l'API répond bien sur les champs BAN.
  if (datasetType === 'dpe') {
    if (center.banId) attempts.push({ qs: 'identifiant_ban:' + center.banId, size:'500', _label:'dpe-identifiant-ban' });
    if (streetNormForQs && cp) {
      attempts.push({ qs:'code_postal_ban:' + cp + ' AND nom_rue_ban:"' + escapeQsValue(streetNormForQs) + '"', size:'10000', _label:'dpe-rue-cp' });
      attempts.push({ qs:'code_postal_ban:' + cp + ' AND adresse_ban:"' + escapeQsValue(streetNormForQs) + '"', size:'10000', _label:'dpe-adresse-ban' });
      attempts.push({ qs:'code_postal_ban:' + cp + ' AND adresse_complete_brut:"' + escapeQsValue(streetNormForQs) + '"', size:'10000', _label:'dpe-adresse-brut' });
    }
  } else {
    if (center.banId) attempts.push({ qs: 'identifiant_ban:' + center.banId, size:'1000', _label:'audit-identifiant-ban' });
    if (streetNormForQs && cp) {
      attempts.push({ qs:'code_postal_ban:' + cp + ' AND nom_voie_ban:"' + escapeQsValue(streetNormForQs) + '"', size:'10000', _label:'audit-rue-cp' });
      attempts.push({ qs:'code_postal_ban:' + cp + ' AND adresse_ban:"' + escapeQsValue(streetNormForQs) + '"', size:'10000', _label:'audit-adresse-ban' });
      attempts.push({ qs:'code_postal_ban:' + cp + ' AND adresse_brut:"' + escapeQsValue(streetNormForQs) + '"', size:'10000', _label:'audit-adresse-brut' });
    }
  }

  // Secours texte. Ces requêtes sont parfois très larges : elles passent après les requêtes cadrées.
  if (!isMapExhaustiveMode()) {
    attempts.push({ q: streetCpQuery, size:'5000', _label:datasetType + '-q-rue-cp' });
    attempts.push({ q: [rue, effectiveCity].filter(Boolean).join(' '), size:'5000', _label:datasetType + '-q-rue-ville' });
  }

  return attempts.filter(Boolean);
}

function cleanDataFairParams(params) {
  const out = Object.assign({}, params || {});
  delete out._label;
  return out;
}

function getMapMaxScanRows() {
  const v = parseInt(document.getElementById('f-map-max-scan')?.value || '20000', 10);
  if (!Number.isFinite(v) || v <= 0) return 20000;
  return Math.max(1000, Math.min(v, 100000));
}

async function fetchDataFairAllPages(params, fetcher, label) {
  const base = cleanDataFairParams(params);
  const requestedSize = parseInt(base.size || '10000', 10);
  const size = Math.max(100, Math.min(requestedSize, 10000));
  const maxScan = getMapMaxScanRows();
  base.size = String(size);

  const rowsById = new Map();
  let total = null;
  let pageCount = 1;
  const maxPages = Math.max(1, Math.ceil(maxScan / size));

  // DataFair accepte généralement size=10000. Pour les CP volumineux,
  // on tente page=2,3... jusqu'au plafond choisi dans l'interface.
  for (let page = 1; page <= maxPages; page++) {
    const p = page === 1 ? base : Object.assign({}, base, { page: String(page) });
    let data;
    try {
      data = await fetcher(p);
    } catch(e) {
      // DataFair refuse parfois les pages au-delà de la fenêtre de recherche maximale.
      // Si on a déjà récupéré des lignes, on conserve la collecte partielle au lieu de tout perdre.
      if (page === 1 || rowsById.size === 0) throw e;
      console.warn('[DPE Explorer] Pagination interrompue pour ' + label + ' page ' + page + ':', e.message);
      break;
    }
    const rows = data.results || [];
    if (total === null) total = Number(data.total || rows.length || 0);
    console.log('Candidats ' + label + ' pour', p, rows.length, 'sur total', data.total, 'scan', rowsById.size + '/' + maxScan);
    rows.forEach((r, idx) => {
      const id = r.numero_dpe || (r.n_audit ? (r.n_audit + '|' + (r.id_etape || r._id || idx)) : null) || r._id || JSON.stringify(r).slice(0,120);
      if (!rowsById.has(id) && rowsById.size < maxScan) rowsById.set(id, r);
    });
    // Mise à jour de la barre de progression après chaque page
    const isDpe = label && !label.toLowerCase().includes('audit');
    if (isDpe) {
      setSearchProgress(rowsById.size, _progressAudit, 'dpe');
    } else {
      setSearchProgress(_progressDpe, rowsById.size, 'audit');
    }
    pageCount = page;
    if (!rows.length || rowsById.size >= total || rows.length < size || rowsById.size >= maxScan || total <= size) break;
  }

  if (total && rowsById.size < total && total > rowsById.size) {
    console.warn('[DPE Explorer] Collecte partielle ' + label + ':', rowsById.size, '/', total, 'résultats récupérés. Augmente Scan max si besoin.');
  }
  return { rows:[...rowsById.values()], total, pageCount, maxScan };
}

async function fetchDpeNearbyCandidates(center, rue, ville, radius) {
  const seen = new Set();
  const byId = new Map();

  async function collectAttempt(rawParams) {
    if (!rawParams) return;
    const key = JSON.stringify(rawParams);
    if (seen.has(key)) return;
    seen.add(key);
    const params = cleanDataFairParams(rawParams);
    try {
      document.getElementById('url-addr').innerHTML = 'GET DPE &nbsp;<span>' + displayUrl(params) + '</span>';
      const collected = await fetchDataFairAllPages(rawParams, fetchJsonSmart, rawParams._label || 'DPE');
      collected.rows.forEach(d => {
        const id = d.numero_dpe || d._id || JSON.stringify(d).slice(0,80);
        if (!byId.has(id)) byId.set(id, d);
      });
    } catch(e) {
      console.warn('Tentative DPE échouée', params, e.message);
    }
  }

  // Recherche principale : bbox DataFair, validée par test réel.
  // Format impératif : bbox=lonMin,latMin,lonMax,latMax.
  const geoAttempt = buildGeoBboxParams(center, radius, 'dpe');
  console.log('[DPE Explorer] Tentative DPE géographique prioritaire', geoAttempt);
  await collectAttempt(geoAttempt);

  // Les recherches texte/qs ne sont utilisées qu'en secours si la bbox ne retourne rien.
  // Cela évite les 403 CORS/proxy et les scans très larges qui noyaient les bons DPE.
  if (byId.size === 0) {
    const attempts = buildStreetAttempts(center, rue, ville, 'dpe', radius).filter(a => !a.bbox);
    for (const rawParams of attempts) await collectAttempt(rawParams);
  }

  return [...byId.values()].map(d => {
    const ll = dpeLatLon(d);
    if (!ll) return null;
    return Object.assign({}, d, { _kind:'dpe', _distance_m: distanceMeters(center.lat, center.lon, ll.lat, ll.lon) });
  }).filter(Boolean).filter(d => d._distance_m <= radius).sort((a,b) => a._distance_m - b._distance_m);
}

function groupAuditRowsByNumber(rows) {
  const groups = new Map();
  (rows || []).forEach(r => {
    const id = String(r.n_audit || r._id || '').trim();
    if (!id) return;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(r);
  });
  return groups;
}

async function fetchAuditNearbyCandidates(center, rue, ville, radius) {
  const seen = new Set();
  const byRowId = new Map();

  async function collectAttempt(rawParams) {
    if (!rawParams) return;
    const key = JSON.stringify(rawParams);
    if (seen.has(key)) return;
    seen.add(key);
    const params = cleanDataFairParams(rawParams);
    try {
      document.getElementById('url-addr').innerHTML = 'GET Audit &nbsp;<span>' + (typeof displayAuditUrl === 'function' ? displayAuditUrl(params) : JSON.stringify(params)) + '</span>';
      const collected = await fetchDataFairAllPages(rawParams, fetchAuditJsonSmart, rawParams._label || 'Audit');
      collected.rows.forEach(r => {
        const id = (r.n_audit || '') + '|' + (r.id_etape || r._id || JSON.stringify(r).slice(0,80));
        if (!byRowId.has(id)) byRowId.set(id, r);
      });
    } catch(e) {
      console.warn('Tentative Audit échouée', params, e.message);
    }
  }

  const geoAttempt = buildGeoBboxParams(center, radius, 'audit');
  console.log('[DPE Explorer] Tentative Audit géographique prioritaire', geoAttempt);
  await collectAttempt(geoAttempt);

  if (byRowId.size === 0) {
    const attempts = buildStreetAttempts(center, rue, ville, 'audit', radius).filter(a => !a.bbox);
    for (const rawParams of attempts) await collectAttempt(rawParams);
  }

  const grouped = groupAuditRowsByNumber([...byRowId.values()]);
  const audits = [];
  grouped.forEach(groupRows => {
    const audit = typeof normalizeAuditRows === 'function' ? normalizeAuditRows(groupRows) : null;
    if (!audit) return;
    const ll = auditLatLon(audit) || auditLatLon(groupRows.find(r => r._geopoint) || groupRows[0]);
    if (!ll) return;
    audit._kind = 'audit';
    audit._distance_m = distanceMeters(center.lat, center.lon, ll.lat, ll.lon);
    if (audit._distance_m <= radius) audits.push(audit);
  });
  return audits.sort((a,b) => a._distance_m - b._distance_m);
}

function updateAddressInputsFromCenter(center) {
  const numEl = document.getElementById('inp-num');
  const rueEl = document.getElementById('inp-rue');
  const villeEl = document.getElementById('inp-ville');
  if (numEl) numEl.value = center.housenumber || '';
  if (rueEl) rueEl.value = center.street || '';
  if (villeEl) villeEl.value = [center.postcode, center.city].filter(Boolean).join(' ');
}

async function searchNearbyFromMapCenter(lat, lon) {
  const radius = parseInt(document.getElementById('f-map-radius')?.value || '50', 10);
  const includeDpe = document.getElementById('f-map-dpe')?.checked !== false;
  const includeAudit = document.getElementById('f-map-audit')?.checked !== false;
  const size = document.getElementById('inp-addr-size')?.value || '20';

  if (!includeDpe && !includeAudit) {
    setStatus('addr', 'err', '⚠ Sélectionnez au moins DPE ou Audits dans les options carte.');
    return;
  }

  setStatus('addr', 'info', '<span class="spin">↻</span> &nbsp;Recentrage carte puis recherche autour du point sélectionné...');
  resetSearchProgress();
  setSearchProgress(0, 0, 'geo');
  console.groupCollapsed('[DPE Explorer] Recentrage carte');
  try {
    const center = await reverseGeocodeBAN(lat, lon);
    if (!center.postcode) throw new Error('Impossible de déterminer le code postal du point cliqué.');
    updateAddressInputsFromCenter(center);

    // En exploration carte, on privilégie le CP pour éviter de dépendre d'une adresse ou d'une rue saisie.
    // Les résultats sont ensuite strictement filtrés par distance GPS.
    const rue = center.street || '';
    const ville = [center.postcode, center.city].filter(Boolean).join(' ');
    console.log('Nouveau centre carte', center);

    const dpes = includeDpe ? await fetchDpeNearbyCandidates(center, rue, ville, radius) : [];
    const audits = includeAudit ? await fetchAuditNearbyCandidates(center, rue, ville, radius) : [];

    console.log('DPE dans le rayon sans filtre visuel', dpes.length);
    console.table(dpes.map(d => Object.assign(compactDpeForLog(d), { distance_m: Math.round(d._distance_m), geopoint: d._geopoint })));
    console.log('Audits dans le rayon sans filtre visuel', audits.length);
    console.table(audits.map(a => ({
      n_audit:a.n_audit,
      numero_dpe:a.numero_dpe,
      adresse:a.address,
      classe_initiale:a.initial?.classe_bilan_dpe,
      classe_finale:a.final?.classe_bilan_dpe,
      distance_m:Math.round(a._distance_m || 0)
    })));

    addrMapState = { dpes, audits, center, radius, fullAddress:center.label, size, source:'map-click', selectionPolygon: null };
    resetMapSelectionState(true);
    clearStatus('addr');
    setSearchProgress(dpes.length, audits.length, 'done');
    applyMapDisplayFilters();
  } catch(e) {
    setStatus('addr', 'err', '✖ ' + e.message);
    resetSearchProgress();
    console.error(e);
  } finally {
    console.groupEnd();
  }
}

async function searchAddrNearbyMap(num, rue, ville, size, sort) {
  const radius = parseInt(document.getElementById('f-map-radius')?.value || '50', 10);
  const includeDpe = document.getElementById('f-map-dpe')?.checked !== false;
  const includeAudit = document.getElementById('f-map-audit')?.checked !== false;
  const fullAddress = [num, rue, ville].filter(Boolean).join(' ');
  if (!rue || !ville) {
    setStatus('addr', 'err', '⚠ En mode carte, renseignez au moins la rue et la ville ou le code postal.');
    return;
  }
  if (!includeDpe && !includeAudit) {
    setStatus('addr', 'err', '⚠ Sélectionnez au moins DPE ou Audits dans les options carte.');
    return;
  }

  hideAddrMap();
  document.getElementById('result-addr').innerHTML = '';
  const searchedTypes = [includeDpe ? 'DPE' : null, includeAudit ? 'audits' : null].filter(Boolean).join(' + ');
  setStatus('addr', 'info', '<span class="spin">↻</span> &nbsp;Géocodage de l\'adresse puis recherche ' + searchedTypes + ' proches...');
  resetSearchProgress();
  setSearchProgress(0, 0, 'geo');
  console.groupCollapsed('[DPE Explorer] Mode carte proximité DPE + Audit');
  console.log('Saisie utilisateur', { numero:num, rue, ville, radius, includeDpe, includeAudit });
  try {
    const center = await geocodeAddressBAN(fullAddress);
    console.log('Adresse BAN retenue', center);

    const dpes = includeDpe ? await fetchDpeNearbyCandidates(center, rue, ville, radius) : [];
    const audits = includeAudit ? await fetchAuditNearbyCandidates(center, rue, ville, radius) : [];

    console.log('DPE dans le rayon sans filtre visuel', dpes.length);
    console.table(dpes.map(d => Object.assign(compactDpeForLog(d), { distance_m: Math.round(d._distance_m), geopoint: d._geopoint })));
    console.log('Audits dans le rayon sans filtre visuel', audits.length);
    console.table(audits.map(a => ({
      n_audit:a.n_audit,
      numero_dpe:a.numero_dpe,
      adresse:a.address,
      classe_initiale:a.initial?.classe_bilan_dpe,
      classe_finale:a.final?.classe_bilan_dpe,
      cout_final:a.final?.couts_cumules_travaux || a.final?.cout_travaux,
      distance_m:Math.round(a._distance_m || 0)
    })));

    addrMapState = { dpes, audits, center, radius, fullAddress, size, source:'address', selectionPolygon: null };
    resetMapSelectionState(true);
    clearStatus('addr');
    setSearchProgress(dpes.length, audits.length, 'done');
    applyMapDisplayFilters();
  } catch(e) {
    setStatus('addr', 'err', '✖ ' + e.message);
    resetSearchProgress();
    console.error(e);
  } finally { console.groupEnd(); }
}

function itemLatLon(item) {
  return item && item._kind === 'audit' ? auditLatLon(item) : dpeLatLon(item);
}

function itemMapKey(item) {
  const ll = itemLatLon(item);
  if (!ll) return '';
  return ll.lat.toFixed(6) + ',' + ll.lon.toFixed(6);
}

function setupMapClickRecenter() {
  if (!addrLeafletMap || mapClickRecenterReady) return;
  mapClickRecenterReady = true;
  addrLeafletMap.on('click', e => {
    const enabled = document.getElementById('f-map-click-recenter')?.checked === true;
    if (!enabled || mapDrawingActive) return;
    if (!e || !e.latlng) return;
    searchNearbyFromMapCenter(e.latlng.lat, e.latlng.lng);
  });
}

function ensureDrawTools() {
  if (!addrLeafletMap || !window.L || !L.Control || !L.Control.Draw) return;
  if (!addrDrawnItems) {
    addrDrawnItems = new L.FeatureGroup();
    addrLeafletMap.addLayer(addrDrawnItems);
  }
  if (!addrDrawControl) {
    addrDrawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: { color:'#22d3ee', weight:2, fillColor:'#22d3ee', fillOpacity:0.12 }
        },
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false
      },
      edit: {
        featureGroup: addrDrawnItems,
        edit: true,
        remove: true
      }
    });
    addrLeafletMap.addControl(addrDrawControl);

    addrLeafletMap.on(L.Draw.Event.DRAWSTART, () => { mapDrawingActive = true; });
    addrLeafletMap.on(L.Draw.Event.DRAWSTOP, () => { setTimeout(() => { mapDrawingActive = false; }, 150); });
    addrLeafletMap.on(L.Draw.Event.CREATED, e => {
      if (!e || !e.layer) return;
      addrDrawnItems.clearLayers();
      addrDrawnItems.addLayer(e.layer);
      addrMapState.selectionPolygon = normalizePolygonLatLngs(e.layer.getLatLngs());
      console.log('[DPE Explorer] Zone libre dessinée', addrMapState.selectionPolygon);
      applyMapDisplayFilters();
    });
    addrLeafletMap.on(L.Draw.Event.EDITED, e => {
      let layer = null;
      e.layers.eachLayer(l => { layer = l; });
      if (layer) addrMapState.selectionPolygon = normalizePolygonLatLngs(layer.getLatLngs());
      applyMapDisplayFilters();
    });
    addrLeafletMap.on(L.Draw.Event.DELETED, () => {
      resetMapSelectionState(false);
      applyMapDisplayFilters();
    });
  }
}

function activateFreeZoneDrawing() {
  if (!addrLeafletMap) {
    setStatus('addr', 'err', '⚠ Lancez d’abord une recherche carte pour afficher la carte.');
    return;
  }
  ensureDrawTools();
  if (window.L && L.Draw && L.Draw.Polygon) {
    if (addrActiveDrawHandler) addrActiveDrawHandler.disable();
    addrActiveDrawHandler = new L.Draw.Polygon(addrLeafletMap, {
      allowIntersection:false,
      showArea:true,
      shapeOptions:{ color:'#22d3ee', weight:2, fillColor:'#22d3ee', fillOpacity:0.12 }
    });
    mapDrawingActive = true;
    addrActiveDrawHandler.enable();
    setStatus('addr', 'info', '✏️ Cliquez sur la carte pour dessiner la zone libre, puis fermez le polygone pour filtrer les DPE/Audits chargés.');
  } else {
    setStatus('addr', 'err', '⚠ Leaflet Draw n’est pas chargé. Vérifiez la connexion au CDN leaflet.draw.');
  }
}

function clearMapSelectionZone() {
  resetMapSelectionState(true);
  if (addrMapState.center) applyMapDisplayFilters();
}

function renderMixedNearbyMap(dpes, audits, center, radius) {
  const card = document.getElementById('addr-map-card');
  const info = document.getElementById('addr-map-info');
  if (!card || !window.L) return;
  card.style.display = 'block';
  if (info) info.textContent = dpes.length + ' DPE · ' + audits.length + ' audit(s)' + (addrMapState.selectionPolygon ? ' dans la zone libre' : ' dans ' + radius + ' m') + ' · ' + center.label;
  if (!addrLeafletMap) {
    addrLeafletMap = L.map('addr-map', { zoomControl:true, scrollWheelZoom:true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; OpenStreetMap' }).addTo(addrLeafletMap);
    setupMapClickRecenter();
    ensureDrawTools();
  } else {
    setupMapClickRecenter();
    ensureDrawTools();
  }
  if (addrLeafletLayer) addrLeafletLayer.clearLayers();
  addrLeafletLayer = L.layerGroup().addTo(addrLeafletMap);

  const targetIcon = L.divIcon({ className:'', html:'<div class="addr-target-marker"></div>', iconSize:[24,24], iconAnchor:[12,12] });
  L.marker([center.lat, center.lon], { icon: targetIcon }).addTo(addrLeafletLayer).bindPopup('<strong>' + (addrMapState.source === 'map-click' ? 'Centre carte' : 'Adresse recherchée') + '</strong><br>' + center.label);
  L.circle([center.lat, center.lon], { radius, color:'#22d3ee', weight:1, fillColor:'#22d3ee', fillOpacity:0.08 }).addTo(addrLeafletLayer);

  const groups = new Map();
  [...dpes, ...audits].forEach(item => {
    const key = itemMapKey(item);
    const ll = itemLatLon(item);
    if (!key || !ll) return;
    if (!groups.has(key)) groups.set(key, { lat:ll.lat, lon:ll.lon, rows:[] });
    groups.get(key).rows.push(item);
  });

  groups.forEach(g => {
    const rows = g.rows.sort((a,b) => (a._distance_m || 0) - (b._distance_m || 0));
    const nbDpe = rows.filter(x => x._kind !== 'audit').length;
    const nbAudit = rows.filter(x => x._kind === 'audit').length;
    let html, cls, label, color;
    if (nbDpe && nbAudit) {
      label = nbDpe + '/' + nbAudit;
      color = '#a78bfa';
      cls = 'mixed-marker multi';
      html = '<div class="' + cls + '" style="background:' + color + '">' + label + '</div>';
    } else if (nbAudit) {
      const firstAudit = rows.find(x => x._kind === 'audit');
      label = nbAudit > 1 ? nbAudit : (firstAudit?.final?.classe_bilan_dpe || firstAudit?.initial?.classe_bilan_dpe || '?');
      color = nbAudit > 1 ? '#a78bfa' : markerColor(firstAudit?.final?.classe_bilan_dpe || firstAudit?.initial?.classe_bilan_dpe);
      cls = nbAudit > 1 ? 'audit-marker multi' : 'audit-marker';
      html = '<div class="' + cls + '" style="background:' + color + '">' + label + '</div>';
    } else {
      const first = rows[0];
      label = rows.length > 1 ? rows.length : (first.etiquette_dpe || '?');
      color = rows.length > 1 ? '#22d3ee' : dpeMarkerColor(first.etiquette_dpe);
      cls = rows.length > 1 ? 'dpe-marker multi' : 'dpe-marker';
      html = '<div class="' + cls + '" style="background:' + color + '">' + label + '</div>';
    }
    const icon = L.divIcon({ className:'', html, iconSize:[36,36], iconAnchor:[18,18] });
    L.marker([g.lat, g.lon], { icon }).addTo(addrLeafletLayer).bindPopup(buildMixedMapPopup(rows), { maxWidth:370 });
  });

  const bounds = L.latLngBounds([[center.lat, center.lon]]);
  [...dpes, ...audits].forEach(item => { const ll = itemLatLon(item); if (ll) bounds.extend([ll.lat, ll.lon]); });
  addrLeafletMap.fitBounds(bounds.pad(0.25));
  setTimeout(() => addrLeafletMap.invalidateSize(), 80);
}


function numVal(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function avgVal(rows, field) {
  const vals = (rows || []).map(r => numVal(r[field])).filter(v => v !== null);
  if (!vals.length) return null;
  return vals.reduce((a,b) => a + b, 0) / vals.length;
}

function classScore(e) {
  const order = { A:1, B:2, C:3, D:4, E:5, F:6, G:7 };
  return order[String(e || '').toUpperCase()] || null;
}

function avgClass(rows) {
  const scores = (rows || []).map(r => classScore(r.etiquette_dpe)).filter(v => v !== null);
  if (!scores.length) return null;
  const avg = scores.reduce((a,b) => a + b, 0) / scores.length;
  const rounded = Math.max(1, Math.min(7, Math.round(avg)));
  return ['','A','B','C','D','E','F','G'][rounded];
}

function classDistribution(rows) {
  const dist = { A:0, B:0, C:0, D:0, E:0, F:0, G:0 };
  (rows || []).forEach(r => {
    const e = String(r.etiquette_dpe || '').toUpperCase();
    if (dist[e] !== undefined) dist[e]++;
  });
  return dist;
}

function betterShare(rows, selected, field, lowerIsBetter) {
  const selectedVal = numVal(selected[field]);
  if (selectedVal === null) return null;
  const vals = (rows || []).map(r => numVal(r[field])).filter(v => v !== null);
  if (!vals.length) return null;
  const better = vals.filter(v => lowerIsBetter ? selectedVal < v : selectedVal > v).length;
  return better / vals.length;
}

function getCurrentVisibleDpesForComparison() {
  // Source unique de vérité pour les comparaisons : les DPE réellement visibles actuellement.
  // Important : si une zone libre polygonale est active, on recalcule depuis la collecte brute
  // pour éviter de comparer par erreur avec tout le rayon initial.
  return (addrMapState.dpes || [])
    .filter(d => d && d._kind !== 'audit')
    .filter(passesMapVisualFilters)
    .filter(itemPassesSelectionZone);
}

function buildDpeNeighborhoodComparison(selected, referenceDpes) {
  const selectedId = String(selected?.numero_dpe || '');
  const zoneActive = !!(addrMapState.selectionPolygon && addrMapState.selectionPolygon.length >= 3);
  const sourceRows = zoneActive ? getCurrentVisibleDpesForComparison() : (referenceDpes || getCurrentVisibleDpesForComparison());
  const refs = (sourceRows || [])
    .filter(d => String(d?.numero_dpe || '') !== selectedId)
    .filter(d => d && d._kind !== 'audit');

  if (!selected || refs.length < 1) return null;

  return {
    radius: addrMapState.radius,
    zoneActive,
    scopeLabel: zoneActive ? 'zone libre dessinée' : 'rayon de ' + addrMapState.radius + ' m',
    address: addrMapState.center?.label || addrMapState.fullAddress || '',
    referenceCount: refs.length,
    selectedDistance: Math.round(selected._distance_m || 0),
    averageClass: avgClass(refs),
    distribution: classDistribution(refs),
    metrics: {
      consoEf: {
        label: 'Conso EF', unit: 'kWh/m²/an', lowerIsBetter: true,
        selected: numVal(selected.conso_5_usages_par_m2_ef),
        avg: avgVal(refs, 'conso_5_usages_par_m2_ef'),
        betterShare: betterShare(refs, selected, 'conso_5_usages_par_m2_ef', true)
      },
      consoEp: {
        label: 'Conso EP', unit: 'kWh/m²/an', lowerIsBetter: true,
        selected: numVal(selected.conso_5_usages_par_m2_ep),
        avg: avgVal(refs, 'conso_5_usages_par_m2_ep'),
        betterShare: betterShare(refs, selected, 'conso_5_usages_par_m2_ep', true)
      },
      ges: {
        label: 'GES', unit: 'kg CO₂/m²/an', lowerIsBetter: true,
        selected: numVal(selected.emission_ges_5_usages_par_m2),
        avg: avgVal(refs, 'emission_ges_5_usages_par_m2'),
        betterShare: betterShare(refs, selected, 'emission_ges_5_usages_par_m2', true)
      },
      cout: {
        label: 'Coût annuel', unit: '€/an', lowerIsBetter: true,
        selected: numVal(selected.cout_total_5_usages),
        avg: avgVal(refs, 'cout_total_5_usages'),
        betterShare: betterShare(refs, selected, 'cout_total_5_usages', true)
      },
      surface: {
        label: 'Surface', unit: 'm²', lowerIsBetter: false,
        selected: numVal(selected.surface_habitable_logement),
        avg: avgVal(refs, 'surface_habitable_logement'),
        betterShare: null
      },
      ubat: {
        label: 'Ubat', unit: 'W/m²K', lowerIsBetter: true,
        selected: numVal(selected.ubat_w_par_m2_k),
        avg: avgVal(refs, 'ubat_w_par_m2_k'),
        betterShare: betterShare(refs, selected, 'ubat_w_par_m2_k', true)
      }
    }
  };
}

function openDpeFromMapB64(b64) {
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const dpe = JSON.parse(json);
    dpe._neighborhoodComparison = buildDpeNeighborhoodComparison(dpe, getCurrentVisibleDpesForComparison());
    loadDpeFromAddr(JSON.stringify(dpe));
  } catch(e) {
    console.error('Erreur chargement DPE depuis carte:', e);
  }
}

function buildMixedMapPopup(rows) {
  const nbDpe = rows.filter(x => x._kind !== 'audit').length;
  const nbAudit = rows.filter(x => x._kind === 'audit').length;
  let html = '<div style="min-width:250px">';
  html += '<div style="font-weight:700;color:#22d3ee;margin-bottom:6px">' + nbDpe + ' DPE · ' + nbAudit + ' audit(s) à cette position</div>';
  rows.forEach(item => {
    html += '<div style="border-top:1px solid rgba(255,255,255,.12);padding-top:6px;margin-top:6px">';
    if (item._kind === 'audit') {
      const b64 = encodeObjForHtml(item);
      const before = item.initial?.classe_bilan_dpe || '?';
      const after = item.final?.classe_bilan_dpe || '?';
      const cost = item.final?.couts_cumules_travaux || item.final?.cout_travaux;
      html += '<strong style="color:#a78bfa">Audit ' + before + ' → ' + after + '</strong> · ' + (item.date_etablissement_audit || 'date ?') + '<br>';
      html += (item.surface_habitable_logement ? item.surface_habitable_logement + ' m² · ' : '') + (cost ? Math.round(cost).toLocaleString('fr-FR') + ' € travaux<br>' : '');
      html += '<span style="color:#94a3b8">' + (item.address || '') + '</span><br>';
      html += '<span style="color:#94a3b8">Distance : ' + Math.round(item._distance_m || 0) + ' m · N° ' + (item.n_audit || '') + '</span>';
      html += '<button class="map-popup-btn audit" onclick="loadAuditFromMapB64(\'' + b64 + '\')">🔎 Ouvrir la fiche audit</button>';
    } else {
      const b64 = encodeObjForHtml(item);
      html += '<strong>DPE ' + (item.etiquette_dpe || '?') + '</strong> · GES ' + (item.etiquette_ges || '?') + ' · ' + (item.date_etablissement_dpe || 'date ?') + '<br>';
      html += (item.surface_habitable_logement ? item.surface_habitable_logement + ' m² · ' : '') + (item.type_batiment || '') + '<br>';
      html += '<span style="color:#94a3b8">' + (item.adresse_ban || item.adresse_complete_brut || item.adresse_brut || '') + '</span><br>';
      html += '<span style="color:#94a3b8">Distance : ' + Math.round(item._distance_m || 0) + ' m · N° ' + (item.numero_dpe || '') + '</span>';
      html += '<button class="map-popup-btn" onclick="openDpeFromMapB64(\'' + b64 + '\')">🔍 Ouvrir la fiche DPE</button>';
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function renderMixedNearbyResults(dpes, audits, center, radius, fullAddress, size, meta) {
  const el = document.getElementById('result-addr');
  if (!el) return;
  const max = parseInt(size || '20', 10);
  let html = '<div style="font-family:var(--mono);font-size:12px;color:var(--muted);margin-bottom:12px">';
  html += '<span style="color:var(--accent);font-weight:600">' + dpes.length + '</span> DPE · ';
  html += '<span style="color:#a78bfa;font-weight:600">' + audits.length + '</span> audit(s) affiché(s)' + (meta && meta.zoneActive ? ' dans la zone libre' : ' dans ' + radius + ' m');
  if (meta && (meta.rawDpeCount !== dpes.length || meta.rawAuditCount !== audits.length)) {
    html += ' · <span style="color:var(--muted)">collectés : ' + meta.rawDpeCount + ' DPE / ' + meta.rawAuditCount + ' audit(s)</span>';
  }
  if (meta && meta.zoneActive) {
    html += ' · <span style="color:#22d3ee">filtre zone libre actif</span>';
  }
  html += '</div>';

  if (!dpes.length && !audits.length) {
    el.innerHTML = html + '<div class="card" style="color:var(--muted)">Aucun DPE ni audit trouvé dans le rayon.</div>';
    return;
  }

  if (audits.length) {
    html += '<div class="card"><div class="card-title">Audits énergétiques proches</div>';
    audits.slice(0, max).forEach(a => {
      const b64 = encodeObjForHtml(a);
      const before = a.initial?.classe_bilan_dpe || '?';
      const after = a.final?.classe_bilan_dpe || '?';
      const cost = a.final?.couts_cumules_travaux || a.final?.cout_travaux;
      html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">';
      html += '<div style="display:flex;align-items:center;gap:6px;min-width:72px"><span class="etiq ' + before + '">' + before + '</span><span style="color:var(--muted)">→</span><span class="etiq ' + after + '">' + after + '</span></div>';
      html += '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (a.address || '') + '</div>';
      html += '<div style="font-size:11px;color:var(--muted);font-family:var(--mono)">Audit ' + (a.n_audit || '') + ' · DPE associé ' + (a.numero_dpe || '—') + ' · ' + Math.round(a._distance_m || 0) + ' m' + (cost ? ' · ' + Math.round(cost).toLocaleString('fr-FR') + ' €' : '') + '</div></div>';
      html += '<button class="action-link action-btn" onclick="loadAuditFromMapB64(\'' + b64 + '\')">🔎 Détail audit</button>';
      html += '</div>';
    });
    html += '</div>';
  }

  if (dpes.length) {
    html += '<div class="card"><div class="card-title">DPE proches</div>';
    dpes.slice(0, max).forEach(d => {
      const b64 = encodeObjForHtml(d);
      html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">';
      html += '<span class="etiq ' + (d.etiquette_dpe || '') + '">' + (d.etiquette_dpe || '?') + '</span>';
      html += '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (d.adresse_ban || d.adresse_complete_brut || d.adresse_brut || '') + '</div>';
      html += '<div style="font-size:11px;color:var(--muted);font-family:var(--mono)">DPE ' + (d.numero_dpe || '') + ' · ' + (d.surface_habitable_logement || '—') + ' m² · ' + Math.round(d._distance_m || 0) + ' m</div></div>';
      html += '<button class="action-link action-btn" onclick="openDpeFromMapB64(\'' + b64 + '\')">🔍 Détail DPE</button>';
      html += '</div>';
    });
    html += '</div>';
  }
  el.innerHTML = html;
}

function loadAuditFromMapB64(b64) {
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const audit = JSON.parse(json);
    if (typeof activatePanel === 'function') activatePanel('audit');
    else {
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel-audit')?.classList.add('active');
    }
    const inp = document.getElementById('inp-audit');
    const url = document.getElementById('url-audit');
    const result = document.getElementById('result-audit');
    if (inp) inp.value = audit.n_audit || '';
    if (url) url.innerHTML = 'GET &nbsp;<span>Chargé depuis la carte proximité</span>';
    if (result) result.innerHTML = typeof renderAudit === 'function' ? renderAudit(audit) : '<div class="card">Audit chargé.</div>';
    window.scrollTo(0, 0);
  } catch(e) {
    console.error('Erreur chargement audit depuis carte:', e);
  }
}


function switchToAddressMapPanel() {
  if (typeof activatePanel === 'function') activatePanel('addr');
  else {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-addr')?.classList.add('active');
  }
  setTimeout(() => {
    if (addrLeafletMap) addrLeafletMap.invalidateSize();
    document.getElementById('addr-map-card')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }, 120);
}

function computeCenterFromMapItems(dpes, audits, label) {
  const pts = [];
  (dpes || []).forEach(d => { const ll = dpeLatLon(d); if (ll) pts.push(ll); });
  (audits || []).forEach(a => { const ll = auditLatLon(a); if (ll) pts.push(ll); });
  if (!pts.length) return null;
  const lat = pts.reduce((sum, p) => sum + p.lat, 0) / pts.length;
  const lon = pts.reduce((sum, p) => sum + p.lon, 0) / pts.length;
  return { lat, lon, label: label || 'Sélection ADEME', postcode:'', city:'', score:null, banId:'' };
}

function estimateRadiusForSelection(center, dpes, audits) {
  const distances = [];
  (dpes || []).forEach(d => { const ll = dpeLatLon(d); if (ll) distances.push(distanceMeters(center.lat, center.lon, ll.lat, ll.lon)); });
  (audits || []).forEach(a => { const ll = auditLatLon(a); if (ll) distances.push(distanceMeters(center.lat, center.lon, ll.lat, ll.lon)); });
  const max = distances.length ? Math.max(...distances) : 50;
  return Math.max(30, Math.ceil(max + 30));
}

function setMapFromAdemeSelection(dpes, audits, label) {
  const cleanDpes = (dpes || []).map(d => Object.assign({}, d, { _kind:'dpe' })).filter(d => dpeLatLon(d));
  const cleanAudits = (audits || []).map(a => Object.assign({}, a, { _kind:'audit' })).filter(a => auditLatLon(a));
  const center = computeCenterFromMapItems(cleanDpes, cleanAudits, label || 'Sélection ADEME');
  if (!center) {
    if (typeof setStatus === 'function') setStatus('search', 'err', 'Aucun élément de la sélection ne contient de coordonnées GPS exploitables.');
    return;
  }
  const radius = estimateRadiusForSelection(center, cleanDpes, cleanAudits);
  cleanDpes.forEach(d => {
    const ll = dpeLatLon(d);
    d._distance_m = ll ? distanceMeters(center.lat, center.lon, ll.lat, ll.lon) : 0;
  });
  cleanAudits.forEach(a => {
    const ll = auditLatLon(a);
    a._distance_m = ll ? distanceMeters(center.lat, center.lon, ll.lat, ll.lon) : 0;
  });
  addrMapState = {
    dpes: cleanDpes,
    audits: cleanAudits,
    visibleDpes: cleanDpes,
    visibleAudits: cleanAudits,
    center,
    radius,
    fullAddress: label || 'Sélection ADEME',
    size: String(Math.max(100, cleanDpes.length + cleanAudits.length)),
    source:'ademe-list',
    selectionPolygon: null
  };
  resetMapSelectionState(true);
  switchToAddressMapPanel();
  applyMapDisplayFilters();
  if (typeof setStatus === 'function') {
    setStatus('addr', 'ok', 'Sélection affichée sur la carte : ' + cleanDpes.length + ' DPE · ' + cleanAudits.length + ' audit(s). Cliquez une pastille pour comparer le DPE aux autres DPE de la sélection.');
  }
}

// Compatibilité : l'ancien nom continue d'exister pour d'éventuels appels.
function renderDpeMap(results, center, radius) {
  renderMixedNearbyMap(results || [], [], center, radius);
}

function buildMapPopup(rows) {
  return buildMixedMapPopup((rows || []).map(r => Object.assign({ _kind:'dpe' }, r)));
}

window.searchAddrNearbyMap = searchAddrNearbyMap;
window.renderDpeMap = renderDpeMap;
window.renderMixedNearbyMap = renderMixedNearbyMap;
window.hideAddrMap = hideAddrMap;
window.dpeLatLon = dpeLatLon;
window.distanceMeters = distanceMeters;
window.loadAuditFromMapB64 = loadAuditFromMapB64;
window.openDpeFromMapB64 = openDpeFromMapB64;
window.getAddrLeafletMap = () => addrLeafletMap;
window.applyMapDisplayFilters = applyMapDisplayFilters;
window.searchNearbyFromMapCenter = searchNearbyFromMapCenter;
window.activateFreeZoneDrawing = activateFreeZoneDrawing;
window.clearMapSelectionZone = clearMapSelectionZone;
window.pointInPolygon = pointInPolygon;
window.getCurrentVisibleDpesForComparison = getCurrentVisibleDpesForComparison;
window.setMapFromAdemeSelection = setMapFromAdemeSelection;
window.escapeQsValue = escapeQsValue;
