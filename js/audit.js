// DPE Explorer — Lot 4B : normaliseur Audit énergétique
(function () {
  'use strict';

  function normText(v) {
    return String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function asNumber(v) {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function pickFirst(rows, field) {
    for (const r of rows) {
      if (r && r[field] !== undefined && r[field] !== null && r[field] !== '') return r[field];
    }
    return null;
  }

  function getAuditStepRole(row, index) {
    const e = normText(row.etape_travaux);
    const c = normText(row.categorie_scenario);
    if (e.includes('etat initial') || c === 'etat initial') return 'initial';
    if (e.includes('finale') || e.includes('final')) return 'final';
    if (c.includes('une etape') && !e.includes('etat initial')) return 'final';
    return 'step';
  }

  function stepRank(row, index) {
    const role = getAuditStepRole(row, index);
    const e = normText(row.etape_travaux);
    if (role === 'initial') return -1000;
    if (e.includes('premiere') || e.includes('première')) return 10;
    if (e.includes('intermediaire')) return 20 + index;
    if (role === 'final') return 1000;
    return 100 + index;
  }

  function normalizeAuditRow(row, index) {
    const role = getAuditStepRole(row, index);
    return {
      role,
      id_etape: row.id_etape || row._id || String(index),
      label: row.etape_travaux || (role === 'initial' ? 'État initial' : 'Étape travaux'),
      categorie_scenario: row.categorie_scenario || '',
      travaux: row.travaux_realises || '',
      classe_bilan_dpe: row.classe_bilan_dpe || '',
      etiquette_ges: row.etiquette_ges || '',
      conso_5_usages_m2: asNumber(row.conso_5_usages_m2),
      ep_conso_5_usages_m2: asNumber(row.ep_conso_5_usages_m2),
      emission_ges_5_usages_m2: asNumber(row.emission_ges_5_usages_m2),
      cout_travaux: asNumber(row.cout_travaux),
      couts_cumules_travaux: asNumber(row.couts_cumules_travaux),
      type_energie_principale_chauffage: row.type_energie_principale_chauffage || '',
      type_energie_principale_ecs: row.type_energie_principale_ecs || '',
      qualite_isolation_enveloppe: row.qualite_isolation_enveloppe || '',
      qualite_isolation_murs: row.qualite_isolation_murs || '',
      qualite_isolation_menuiseries: row.qualite_isolation_menuiseries || '',
      qualite_isolation_plancher_bas: row.qualite_isolation_plancher_bas || '',
      qualite_isolation_plancher_haut_comble_perdu: row.qualite_isolation_plancher_haut_comble_perdu || '',
      isolation_toiture: row.isolation_toiture,
      ubat_w_m2_k: asNumber(row.ubat_w_m2_k),
      raw: row
    };
  }

  function parseGeoPoint(v) {
    if (!v) return { lat:null, lon:null };
    const p = String(v).split(',').map(x => Number(x.trim()));
    return Number.isFinite(p[0]) && Number.isFinite(p[1]) ? { lat:p[0], lon:p[1] } : { lat:null, lon:null };
  }

  function normalizeAuditRows(rows) {
    const safeRows = (rows || []).filter(Boolean);
    if (!safeRows.length) return null;

    const sortedRows = safeRows.slice().sort((a, b) => stepRank(a, safeRows.indexOf(a)) - stepRank(b, safeRows.indexOf(b)));
    const steps = sortedRows.map((row, index) => normalizeAuditRow(row, index));
    const initial = steps.find(s => s.role === 'initial') || steps[0] || null;
    const final = [...steps].reverse().find(s => s.role === 'final') || steps[steps.length - 1] || initial;
    const geo = parseGeoPoint(pickFirst(safeRows, '_geopoint'));

    return {
      type: 'audit',
      n_audit: pickFirst(safeRows, 'n_audit'),
      numero_dpe: pickFirst(safeRows, 'numero_dpe'),
      id_rnb: pickFirst(safeRows, 'id_rnb'),
      identifiant_ban: pickFirst(safeRows, 'identifiant_ban'),
      address: pickFirst(safeRows, 'adresse_ban') || pickFirst(safeRows, 'adresse_brut'),
      code_postal_ban: pickFirst(safeRows, 'code_postal_ban'),
      nom_commune_ban: pickFirst(safeRows, 'nom_commune_ban'),
      n_voie_ban: pickFirst(safeRows, 'n_voie_ban'),
      nom_voie_ban: pickFirst(safeRows, 'nom_voie_ban'),
      lat: geo.lat,
      lon: geo.lon,
      date_etablissement_audit: pickFirst(safeRows, 'date_etablissement_audit'),
      date_fin_validite_audit: pickFirst(safeRows, 'date_fin_validite_audit'),
      method: pickFirst(safeRows, 'methode_application_dpe'),
      surface_habitable_logement: asNumber(pickFirst(safeRows, 'surface_habitable_logement')),
      annee_construction: pickFirst(safeRows, 'annee_construction'),
      periode_construction: pickFirst(safeRows, 'periode_constuction') || pickFirst(safeRows, 'periode_construction'),
      initial,
      final,
      steps,
      rawRows: safeRows
    };
  }

  async function searchAuditByNumber() {
    const input = document.getElementById('inp-audit');
    const btn = document.getElementById('btn-audit');
    const result = document.getElementById('result-audit');
    const urlEl = document.getElementById('url-audit');
    const nAudit = input ? input.value.trim() : '';
    if (!nAudit) {
      if (typeof window.setStatus === 'function') window.setStatus('audit', 'err', '⚠ Renseignez un numéro d’audit.');
      return;
    }

    // size volontairement large : un audit est multi-lignes.
    const params = { q: nAudit, size: '50' };
    const urlLabel = typeof window.displayAuditUrl === 'function'
      ? window.displayAuditUrl(params)
      : (window.DPE_CONFIG.ADEME_AUDIT_LINES + '?' + new URLSearchParams(params).toString());
    if (urlEl) urlEl.innerHTML = 'GET &nbsp;<span>' + urlLabel + '</span>';

    try {
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Recherche…'; }
      if (typeof window.setStatus === 'function') window.setStatus('audit', 'info', '<span class="spin">↻</span> &nbsp;Recherche audit-opendata…');

      const data = typeof window.fetchAuditDirect === 'function'
        ? await window.fetchAuditDirect(params)
        : await window.fetchJson(urlLabel, 'audit-number');
      const rows = (data.results || []).filter(r => String(r.n_audit || '').toUpperCase() === nAudit.toUpperCase());

      console.group('[DPE Explorer] Audit normalizer');
      console.log('Paramètres', params);
      console.log('Total API', data.total);
      console.log('Lignes retournées', data.results?.length || 0);
      console.log('Lignes conservées n_audit exact', rows.length);
      console.table(rows.map(r => ({
        n_audit: r.n_audit,
        id_etape: r.id_etape,
        categorie_scenario: r.categorie_scenario,
        etape_travaux: r.etape_travaux,
        classe_bilan_dpe: r.classe_bilan_dpe,
        conso_5_usages_m2: r.conso_5_usages_m2,
        cout_travaux: r.cout_travaux,
        couts_cumules_travaux: r.couts_cumules_travaux,
        travaux_realises: r.travaux_realises
      })));

      const audit = normalizeAuditRows(rows.length ? rows : (data.results || []));
      console.log('Audit normalisé', audit);
      console.groupEnd();

      if (typeof window.clearStatus === 'function') window.clearStatus('audit');
      if (!audit) {
        if (result) result.innerHTML = '<div class="card" style="color:var(--muted)">Aucun audit trouvé pour ce numéro.</div>';
        return;
      }
      if (result) result.innerHTML = typeof window.renderAudit === 'function'
        ? window.renderAudit(audit)
        : '<div class="card">Audit normalisé disponible en console.</div>';
    } catch (e) {
      console.error('[DPE Explorer] Recherche audit — erreur', e);
      if (typeof window.setStatus === 'function') window.setStatus('audit', 'err', '✖ ' + e.message + '<br><span style="font-size:11px;color:var(--muted)">Voir la console navigateur.</span>');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '→ Rechercher'; }
    }
  }

  window.normalizeAuditRows = normalizeAuditRows;
  window.searchAuditByNumber = searchAuditByNumber;
})();
