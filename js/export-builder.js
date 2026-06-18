// DPE Explorer - Export Builder
// Sélection de DPE, constructeur de colonnes, sauvegarde modèle et exports CSV/XLSX.
(function(){
  'use strict';

  const EXPORT_STORAGE_KEY = 'dpe_export_builder_template_v1';

  const FIELD_CATALOG = [
    {
      category:'Identification',
      fields:[
        ['numero_dpe','N° DPE'], ['numero_dpe_remplace','DPE remplacé'], ['date_etablissement_dpe','Date DPE'],
        ['date_visite_diagnostiqueur','Date visite'], ['date_fin_validite_dpe','Fin validité'], ['modele_dpe','Modèle DPE'],
        ['methode_application_dpe','Méthode application'], ['version_dpe','Version DPE'], ['date_derniere_modification_dpe','Dernière modification']
      ]
    },
    {
      category:'Adresse / localisation',
      fields:[
        ['adresse_ban','Adresse BAN'], ['adresse_brut','Adresse brute'], ['adresse_complete_brut','Adresse complète brute'],
        ['numero_voie_ban','N° voie BAN'], ['nom_rue_ban','Rue BAN'], ['code_postal_ban','Code postal'], ['nom_commune_ban','Commune'],
        ['code_insee_ban','Code INSEE'], ['id_rnb','ID RNB'], ['identifiant_ban','Identifiant BAN'], ['_geopoint','Coordonnées GPS'],
        ['statut_geocodage','Statut géocodage'], ['score_ban','Score BAN']
      ]
    },
    {
      category:'Performance énergétique',
      fields:[
        ['etiquette_dpe','Étiquette DPE'], ['etiquette_ges','Étiquette GES'], ['conso_5_usages_par_m2_ef','Conso EF / m²'],
        ['conso_5_usages_par_m2_ep','Conso EP / m²'], ['conso_5_usages_ef','Conso EF totale'], ['conso_5_usages_ep','Conso EP totale'],
        ['emission_ges_5_usages_par_m2','GES / m²'], ['emission_ges_5_usages','GES total'], ['ubat_w_par_m2_k','Ubat'],
        ['indicateur_confort_ete','Confort été']
      ]
    },
    {
      category:'Coûts',
      fields:[
        ['cout_total_5_usages','Coût total annuel'], ['cout_chauffage','Coût chauffage'], ['cout_ecs','Coût ECS'],
        ['cout_eclairage','Coût éclairage'], ['cout_auxiliaires','Coût auxiliaires'], ['cout_refroidissement','Coût refroidissement']
      ]
    },
    {
      category:'Logement / bâtiment',
      fields:[
        ['type_batiment','Type bâtiment'], ['surface_habitable_logement','Surface habitable'], ['annee_construction','Année construction'],
        ['periode_construction','Période construction'], ['nombre_niveau_logement','Nombre niveaux'], ['numero_etage_appartement','Étage appartement'],
        ['hauteur_sous_plafond','Hauteur sous plafond'], ['classe_inertie_batiment','Classe inertie'], ['logement_traversant','Logement traversant'],
        ['zone_climatique','Zone climatique'], ['classe_altitude','Classe altitude']
      ]
    },
    {
      category:'Chauffage',
      fields:[
        ['type_energie_principale_chauffage','Énergie principale chauffage'], ['type_installation_chauffage','Type installation chauffage'],
        ['configuration_installation_chauffage_n1','Configuration chauffage'], ['type_generateur_n1_installation_n1','Générateur chauffage n1'],
        ['description_generateur_chauffage_n1_installation_n1','Description générateur ch. n1'], ['type_emetteur_installation_chauffage_n1','Émetteur chauffage'],
        ['surface_chauffee_installation_chauffage_n1','Surface chauffée'], ['conso_chauffage_ef','Conso chauffage EF'], ['conso_chauffage_ep','Conso chauffage EP'],
        ['emission_ges_chauffage','GES chauffage']
      ]
    },
    {
      category:'Eau chaude sanitaire',
      fields:[
        ['type_energie_principale_ecs','Énergie principale ECS'], ['type_installation_ecs','Type installation ECS'], ['configuration_installation_ecs_n1','Configuration ECS'],
        ['type_generateur_n1_ecs_n1','Générateur ECS n1'], ['description_generateur_n1_ecs_n1','Description générateur ECS'],
        ['volume_stockage_generateur_n1_ecs_n1','Volume stockage ECS'], ['conso_ecs_ef','Conso ECS EF'], ['conso_ecs_ep','Conso ECS EP'],
        ['emission_ges_ecs','GES ECS']
      ]
    },
    {
      category:'Ventilation / auxiliaires',
      fields:[
        ['type_ventilation','Type ventilation'], ['ventilation_posterieure_2012','Ventilation postérieure 2012'], ['surface_ventilee','Surface ventilée'],
        ['conso_auxiliaires_ef','Conso auxiliaires EF'], ['conso_auxiliaires_ep','Conso auxiliaires EP'], ['emission_ges_auxiliaires','GES auxiliaires'],
        ['conso_eclairage_ef','Conso éclairage EF'], ['conso_eclairage_ep','Conso éclairage EP'], ['emission_ges_eclairage','GES éclairage']
      ]
    },
    {
      category:'Isolation / enveloppe',
      fields:[
        ['qualite_isolation_enveloppe','Qualité enveloppe'], ['qualite_isolation_murs','Isolation murs'], ['qualite_isolation_menuiseries','Isolation menuiseries'],
        ['qualite_isolation_plancher_bas','Isolation plancher bas'], ['qualite_isolation_plancher_haut_comble_perdu','Isolation plancher haut'],
        ['isolation_toiture','Isolation toiture'], ['protection_solaire_exterieure','Protection solaire extérieure'], ['presence_brasseur_air','Brasseur air']
      ]
    },
    {
      category:'Déperditions',
      fields:[
        ['deperditions_enveloppe','Déperditions enveloppe'], ['deperditions_murs','Déperditions murs'], ['deperditions_baies_vitrees','Déperditions baies'],
        ['deperditions_planchers_bas','Déperditions planchers bas'], ['deperditions_planchers_hauts','Déperditions planchers hauts'],
        ['deperditions_ponts_thermiques','Déperditions ponts thermiques'], ['deperditions_portes','Déperditions portes'], ['deperditions_renouvellement_air','Déperditions renouvellement air']
      ]
    },
    {
      category:'Colonnes calculées',
      fields:[
        ['__cout_m2','Coût annuel / m²'], ['__conso_ef_total_m2','Conso EF totale / m²'], ['__position_gps_lat','Latitude'], ['__position_gps_lon','Longitude'],
        ['__lien_ademe_dpe','Lien ADEME DPE'], ['__lien_maps','Lien Google Maps'], ['__lien_streetview','Lien Street View']
      ]
    }
  ];

  const state = {
    rows: [],
    selectedColumns: [],
    lastSource: '',
    draggedIndex: null
  };

  function byId(id){ return document.getElementById(id); }
  function safe(v){ return v === undefined || v === null || v === '' ? '' : v; }
  function toNumber(v){ const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; }
  function fmtInt(v){ const n = toNumber(v); return n === null ? '—' : Math.round(n).toLocaleString('fr-FR'); }
  function getFieldLabel(field){
    for (const group of FIELD_CATALOG) {
      const found = group.fields.find(f => f[0] === field);
      if (found) return found[1];
    }
    return field;
  }
  function unique(arr){ return [...new Set(arr.filter(Boolean))]; }

  function flattenCatalogFields(){
    const a = [];
    FIELD_CATALOG.forEach(g => g.fields.forEach(f => a.push({ category:g.category, field:f[0], label:f[1] })));
    return a;
  }

  function defaultColumns(){
    return [
      { field:'numero_dpe', title:'N° DPE' },
      { field:'adresse_ban', title:'Adresse' },
      { field:'code_postal_ban', title:'CP' },
      { field:'nom_commune_ban', title:'Commune' },
      { field:'type_batiment', title:'Type' },
      { field:'surface_habitable_logement', title:'Surface' },
      { field:'etiquette_dpe', title:'DPE' },
      { field:'etiquette_ges', title:'GES' },
      { field:'conso_5_usages_par_m2_ef', title:'Conso EF/m²' },
      { field:'emission_ges_5_usages_par_m2', title:'GES/m²' },
      { field:'cout_total_5_usages', title:'Coût annuel' }
    ];
  }

  function initExportBuilder(){
    state.selectedColumns = defaultColumns();
    renderFieldCatalog();
    renderSelectedColumns();
    renderExportPreview();
  }

  function renderFieldCatalog(){
    const host = byId('export-field-catalog');
    if (!host) return;
    const allLoadedFields = unique(state.rows.flatMap(r => Object.keys(r || {}))).sort();
    const known = new Set(flattenCatalogFields().map(f => f.field));
    const unknown = allLoadedFields.filter(f => !known.has(f));

    let html = '';
    FIELD_CATALOG.forEach(group => {
      html += `<details class="export-field-group" open><summary>${group.category}</summary><div class="export-field-list">`;
      group.fields.forEach(([field,label]) => {
        const present = !state.rows.length || state.rows.some(r => r && Object.prototype.hasOwnProperty.call(r, field));
        html += `<button class="export-field-pill${present ? '' : ' muted'}" onclick="addExportColumn('${escapeAttr(field)}')" title="${escapeAttr(field)}"><span>${label}</span><small>${field}</small></button>`;
      });
      html += '</div></details>';
    });

    if (unknown.length) {
      html += '<details class="export-field-group"><summary>Autres champs détectés dans les données chargées</summary><div class="export-field-list">';
      unknown.forEach(field => {
        html += `<button class="export-field-pill" onclick="addExportColumn('${escapeAttr(field)}')" title="${escapeAttr(field)}"><span>${field}</span><small>champ ADEME brut</small></button>`;
      });
      html += '</div></details>';
    }
    host.innerHTML = html;
  }

  function escapeAttr(s){ return String(s || '').replace(/&/g,'&amp;').replace(/'/g,'&#39;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function addExportColumn(field){
    state.selectedColumns.push({ field, title:getFieldLabel(field) });
    renderSelectedColumns();
    renderExportPreview();
  }

  function removeExportColumn(i){
    state.selectedColumns.splice(i, 1);
    renderSelectedColumns();
    renderExportPreview();
  }

  function updateExportColumnTitle(i, title){
    if (state.selectedColumns[i]) state.selectedColumns[i].title = title;
  }

  function updateExportColumnField(i, field){
    if (state.selectedColumns[i]) state.selectedColumns[i].field = field;
    renderExportPreview();
  }

  function clearExportColumns(){
    state.selectedColumns = [];
    renderSelectedColumns();
    renderExportPreview();
  }

  function resetExportColumns(){
    state.selectedColumns = defaultColumns();
    renderSelectedColumns();
    renderExportPreview();
  }

  function renderSelectedColumns(){
    const host = byId('export-selected-columns');
    if (!host) return;
    if (!state.selectedColumns.length) {
      host.innerHTML = '<div class="export-empty">Ajoutez des champs depuis le catalogue de gauche.</div>';
      return;
    }
    host.innerHTML = state.selectedColumns.map((col, i) => `
      <div class="export-column-row" draggable="true" ondragstart="exportColumnDragStart(${i})" ondragover="event.preventDefault()" ondrop="exportColumnDrop(${i})">
        <div class="export-drag">☰</div>
        <div class="export-col-index">${i + 1}</div>
        <div class="export-col-inputs">
          <input value="${escapeAttr(col.title)}" onchange="updateExportColumnTitle(${i}, this.value)" placeholder="Titre colonne">
          <input value="${escapeAttr(col.field)}" onchange="updateExportColumnField(${i}, this.value)" placeholder="champ_ademe">
        </div>
        <button class="export-mini-btn danger" onclick="removeExportColumn(${i})">Supprimer</button>
      </div>
    `).join('');
  }

  function exportColumnDragStart(i){ state.draggedIndex = i; }
  function exportColumnDrop(i){
    const from = state.draggedIndex;
    if (from === null || from === undefined || from === i) return;
    const [moved] = state.selectedColumns.splice(from, 1);
    state.selectedColumns.splice(i, 0, moved);
    state.draggedIndex = null;
    renderSelectedColumns();
    renderExportPreview();
  }

  function parseDpeNumbers(text){
    return unique(String(text || '').split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean));
  }

  async function loadExportFromNumbers(){
    const nums = parseDpeNumbers(byId('export-dpe-numbers')?.value || '');
    if (!nums.length) { setExportStatus('err', 'Collez au moins un numéro DPE ADEME.'); return; }
    state.rows = [];
    state.lastSource = nums.length + ' numéro(s) ADEME collé(s)';
    setExportStatus('info', '<span class="spin">↻</span> Chargement des DPE ADEME...');
    const loaded = [];
    const errors = [];
    for (let i = 0; i < nums.length; i++) {
      const num = nums[i];
      try {
        const data = typeof fetchAdemeDirect === 'function'
          ? await fetchAdemeDirect({ q:num, size:1 })
          : await fetchJson(directDpeUrl({ q:num, size:1 }), 'export-dpe');
        const row = data?.results?.[0];
        if (row) loaded.push(row); else errors.push(num + ' introuvable');
        setExportStatus('info', `<span class="spin">↻</span> Chargement ${i+1}/${nums.length} · ${loaded.length} trouvé(s)`);
      } catch(e) {
        console.warn('[Export Builder] Erreur chargement DPE', num, e);
        errors.push(num + ' erreur API');
      }
    }
    state.rows = dedupeDpeRows(loaded);
    setExportStatus(state.rows.length ? 'ok' : 'err', `${state.rows.length} DPE chargé(s).${errors.length ? ' ' + errors.length + ' erreur(s) ou introuvable(s).' : ''}`);
    renderExportDashboard();
    renderFieldCatalog();
    renderExportPreview();
  }

  function dedupeDpeRows(rows){
    const map = new Map();
    (rows || []).forEach(r => {
      const id = r?.numero_dpe || r?._id || JSON.stringify(r);
      if (!map.has(id)) map.set(id, r);
    });
    return [...map.values()];
  }

  function loadExportFromVisibleMap(){
    if (typeof getCurrentVisibleDpesForComparison !== 'function') {
      setExportStatus('err', 'Aucune carte active ou fonction de sélection indisponible.');
      return;
    }
    const rows = getCurrentVisibleDpesForComparison() || [];
    state.rows = dedupeDpeRows(rows);
    state.lastSource = 'DPE visibles sur la carte';
    setExportStatus(state.rows.length ? 'ok' : 'err', `${state.rows.length} DPE récupéré(s) depuis la carte.`);
    renderExportDashboard();
    renderFieldCatalog();
    renderExportPreview();
  }

  function setExportStatus(type, msg){
    if (typeof setStatus === 'function') setStatus('export', type, msg);
    else {
      const el = byId('st-export');
      if (el) { el.className = 'status ' + type; el.innerHTML = msg; }
    }
  }

  function metricAverage(field){
    const vals = state.rows.map(r => toNumber(r[field])).filter(v => v !== null);
    return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : null;
  }

  function classDist(field){
    const d = { A:0,B:0,C:0,D:0,E:0,F:0,G:0 };
    state.rows.forEach(r => { const e = String(r[field] || '').toUpperCase(); if (d[e] !== undefined) d[e]++; });
    return d;
  }

  function avgClass(){
    const score = { A:1,B:2,C:3,D:4,E:5,F:6,G:7 };
    const vals = state.rows.map(r => score[String(r.etiquette_dpe || '').toUpperCase()]).filter(Boolean);
    if (!vals.length) return '—';
    const avg = Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
    return ['','A','B','C','D','E','F','G'][Math.max(1, Math.min(7, avg))];
  }

  function renderExportDashboard(){
    const host = byId('export-dashboard');
    if (!host) return;
    const n = state.rows.length;
    if (!n) { host.innerHTML = '<div class="card" style="color:var(--muted)">Aucune donnée chargée pour le moment.</div>'; return; }
    const dist = classDist('etiquette_dpe');
    const max = Math.max(...Object.values(dist), 1);
    host.innerHTML = `
      <div class="export-dashboard-grid">
        <div class="metric accent"><div class="v">${n.toLocaleString('fr-FR')}</div><div class="l">DPE sélectionnés</div></div>
        <div class="metric"><div class="v">${avgClass()}</div><div class="l">Étiquette moyenne</div></div>
        <div class="metric cyan"><div class="v">${fmtInt(metricAverage('conso_5_usages_par_m2_ef'))}</div><div class="l">kWh EF/m² moyen</div></div>
        <div class="metric amber"><div class="v">${fmtInt(metricAverage('cout_total_5_usages'))} €</div><div class="l">Coût annuel moyen</div></div>
        <div class="metric"><div class="v">${fmtInt(metricAverage('surface_habitable_logement'))} m²</div><div class="l">Surface moyenne</div></div>
      </div>
      <div class="export-dist-card">
        <div class="card-title">Répartition des étiquettes</div>
        ${['A','B','C','D','E','F','G'].map(e => `
          <div class="bar-row"><div class="bar-label">${e}</div><div class="bar-track"><div class="bar-fill dpe-${e}" style="width:${Math.round((dist[e]/max)*100)}%"></div></div><div class="bar-count">${dist[e]}</div></div>
        `).join('')}
      </div>
    `;
  }

  function computedValue(row, field){
    if (!row) return '';
    if (field === '__cout_m2') {
      const c = toNumber(row.cout_total_5_usages), s = toNumber(row.surface_habitable_logement);
      return c !== null && s ? Math.round(c / s) : '';
    }
    if (field === '__conso_ef_total_m2') {
      const c = toNumber(row.conso_5_usages_ef), s = toNumber(row.surface_habitable_logement);
      return c !== null && s ? Math.round(c / s) : '';
    }
    if (field === '__position_gps_lat' || field === '__position_gps_lon') {
      const gp = String(row._geopoint || '').split(',');
      return field === '__position_gps_lat' ? (gp[0] || '') : (gp[1] || '');
    }
    if (field === '__lien_ademe_dpe') return row.numero_dpe ? 'https://observatoire-dpe-audit.ademe.fr/afficher-dpe/' + row.numero_dpe : '';
    if (field === '__lien_maps') {
      const gp = String(row._geopoint || '').split(',');
      return gp.length >= 2 ? 'https://www.google.com/maps/search/?api=1&query=' + gp[0] + ',' + gp[1] : '';
    }
    if (field === '__lien_streetview') {
      const gp = String(row._geopoint || '').split(',');
      return gp.length >= 2 ? 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + gp[0] + ',' + gp[1] : '';
    }
    return safe(row[field]);
  }

  function buildExportTableRows(){
    return state.rows.map(row => {
      const out = {};
      state.selectedColumns.forEach(col => { out[col.title || col.field] = computedValue(row, col.field); });
      return out;
    });
  }

  function renderExportPreview(){
    const host = byId('export-preview');
    if (!host) return;
    const rows = buildExportTableRows().slice(0, 25);
    if (!state.selectedColumns.length) { host.innerHTML = '<div class="export-empty">Aucune colonne sélectionnée.</div>'; return; }
    if (!state.rows.length) { host.innerHTML = '<div class="export-empty">Chargez une liste de DPE ou récupérez les DPE visibles sur la carte.</div>'; return; }
    const headers = state.selectedColumns.map(c => c.title || c.field);
    host.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px;font-family:var(--mono)">Aperçu : ${rows.length} ligne(s) affichée(s) sur ${state.rows.length}</div>
      <div class="tbl-wrap"><table><thead><tr>${headers.map(h => `<th>${escapeAttr(h)}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(r => `<tr>${headers.map(h => `<td title="${escapeAttr(r[h])}">${escapeAttr(r[h]) || '<span style="color:var(--muted)">—</span>'}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
    `;
  }

  function exportCsv(){
    const rows = buildExportTableRows();
    if (!rows.length) { setExportStatus('err', 'Aucune donnée à exporter.'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(';')].concat(rows.map(r => headers.map(h => csvCell(r[h])).join(';'))).join('\n');
    downloadBlob(new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8' }), 'export_dpe.csv');
  }

  function csvCell(v){
    const s = String(v ?? '');
    if (/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportXlsx(){
    const rows = buildExportTableRows();
    if (!rows.length) { setExportStatus('err', 'Aucune donnée à exporter.'); return; }
    if (!window.XLSX) { setExportStatus('err', 'Bibliothèque XLSX indisponible.'); return; }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'DPE');
    XLSX.writeFile(wb, 'export_dpe.xlsx');
  }

  function downloadBlob(blob, filename){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function getExportTemplate(){
    return { name: byId('export-template-name')?.value || 'Configuration export DPE', columns: state.selectedColumns, created_at: new Date().toISOString() };
  }

  function saveExportTemplateLocal(){
    localStorage.setItem(EXPORT_STORAGE_KEY, JSON.stringify(getExportTemplate(), null, 2));
    setExportStatus('ok', 'Configuration sauvegardée dans le navigateur.');
  }

  function loadExportTemplateLocal(){
    const raw = localStorage.getItem(EXPORT_STORAGE_KEY);
    if (!raw) { setExportStatus('err', 'Aucune configuration locale trouvée.'); return; }
    applyExportTemplateJson(raw);
  }

  function downloadExportTemplate(){
    downloadBlob(new Blob([JSON.stringify(getExportTemplate(), null, 2)], { type:'application/json' }), 'configuration_export_dpe.json');
  }

  function importExportTemplate(input){
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => applyExportTemplateJson(e.target.result);
    reader.readAsText(file);
    input.value = '';
  }

  function applyExportTemplateJson(raw){
    try {
      const tpl = JSON.parse(raw);
      if (!Array.isArray(tpl.columns)) throw new Error('Le JSON ne contient pas de tableau columns.');
      state.selectedColumns = tpl.columns.map(c => ({ field:String(c.field || ''), title:String(c.title || c.field || '') })).filter(c => c.field);
      if (byId('export-template-name') && tpl.name) byId('export-template-name').value = tpl.name;
      renderSelectedColumns();
      renderExportPreview();
      setExportStatus('ok', 'Configuration chargée.');
    } catch(e) {
      setExportStatus('err', 'Configuration JSON invalide : ' + e.message);
    }
  }

  window.initExportBuilder = initExportBuilder;
  window.addExportColumn = addExportColumn;
  window.removeExportColumn = removeExportColumn;
  window.updateExportColumnTitle = updateExportColumnTitle;
  window.updateExportColumnField = updateExportColumnField;
  window.clearExportColumns = clearExportColumns;
  window.resetExportColumns = resetExportColumns;
  window.exportColumnDragStart = exportColumnDragStart;
  window.exportColumnDrop = exportColumnDrop;
  window.loadExportFromNumbers = loadExportFromNumbers;
  window.loadExportFromVisibleMap = loadExportFromVisibleMap;
  window.renderExportPreview = renderExportPreview;
  window.exportCsv = exportCsv;
  window.exportXlsx = exportXlsx;
  window.saveExportTemplateLocal = saveExportTemplateLocal;
  window.loadExportTemplateLocal = loadExportTemplateLocal;
  window.downloadExportTemplate = downloadExportTemplate;
  window.importExportTemplate = importExportTemplate;

  document.addEventListener('DOMContentLoaded', initExportBuilder);
})();
