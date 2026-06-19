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

    // ── Cas fréquent : chargé depuis la carte, une seule ligne (étape finale) ──
    // L'API retourne une ligne par étape. Si on n'en a qu'une et qu'elle n'est
    // pas l'état initial, on reconstitue l'état initial depuis les champs
    // gains_cumules_* présents dans la même ligne.
    let workingRows = safeRows.slice();
    const hasInitial = workingRows.some(r => {
      const e = normText(r.etape_travaux || '');
      const c = normText(r.categorie_scenario || '');
      return e.includes('etat initial') || c === 'etat initial';
    });

    if (!hasInitial && workingRows.length < 3) {
      // Prendre la ligne avec le plus grand couts_cumules_travaux comme référence finale
      const refRow = workingRows.slice().sort((a, b) =>
        (asNumber(b.couts_cumules_travaux) || 0) - (asNumber(a.couts_cumules_travaux) || 0)
      )[0];

      const efFinal  = asNumber(refRow.conso_5_usages_m2);
      const epFinal  = asNumber(refRow.ep_conso_5_usages_m2);
      const gesFinal = asNumber(refRow.emission_ges_5_usages_m2);
      const gainEf   = asNumber(refRow.gains_cumules_conso_5_usages_m2_ef);
      const gainEp   = asNumber(refRow.gains_cumules_conso_5_usages_m2_ep);
      const gainGes  = asNumber(refRow.gains_cumules_emission_ges_5_usages_m2);
      const coutCum  = asNumber(refRow.couts_cumules_travaux);
      const coutFin  = asNumber(refRow.cout_travaux);

      const efInitial  = (efFinal  !== null && gainEf  !== null) ? efFinal  - gainEf  : null;
      const epInitial  = (epFinal  !== null && gainEp  !== null) ? epFinal  - gainEp  : null;
      const gesInitial = (gesFinal !== null && gainGes !== null) ? gesFinal - gainGes : null;

      // Étiquette initiale : déduire depuis la conso EP initiale reconstituée
      function epToClasse(ep) {
        if (ep === null) return '';
        if (ep < 70)  return 'A';
        if (ep < 110) return 'B';
        if (ep < 180) return 'C';
        if (ep < 250) return 'D';
        if (ep < 330) return 'E';
        if (ep < 420) return 'F';
        return 'G';
      }

      // Construire la ligne synthétique de l'état initial
      const initialRow = Object.assign({}, refRow, {
        etape_travaux: 'État initial',
        categorie_scenario: 'etat initial',
        travaux_realises: '',
        conso_5_usages_m2:    Math.round(efInitial),
        ep_conso_5_usages_m2: Math.round(epInitial),
        emission_ges_5_usages_m2: gesInitial !== null ? Math.round(gesInitial) : null,
        classe_bilan_dpe: epToClasse(epInitial),
        etiquette_ges:    epToClasse(epInitial), // approximation
        cout_travaux: 0,
        couts_cumules_travaux: 0,
        gains_relatifs_cumules_conso_5_usages_m2_ef: 0,
        gains_relatifs_cumules_conso_5_usages_m2_ep: 0,
        gains_relatifs_cumules_emission_ges_5_usages_m2: 0,
        gains_cumules_conso_5_usages_m2_ef: 0,
        gains_cumules_conso_5_usages_m2_ep: 0,
        gains_cumules_emission_ges_5_usages_m2: 0,
        id_etape: 'initial-synthetic',
        _synthetic: true
      });

      // Si on a exactement 1 ligne finale et un coût cumulé > coût étape :
      // il y avait une étape intermédiaire — on la reconstitue aussi
      if (workingRows.length === 1 && coutCum !== null && coutFin !== null && coutCum > coutFin) {
        const coutEtape1 = coutCum - coutFin;
        // Conso intermédiaire : gain proportionnel (estimation linéaire)
        const efEtape1  = efInitial  !== null ? efInitial  + (efFinal  - efInitial)  * (coutEtape1 / coutCum) : null;
        const epEtape1  = epInitial  !== null ? epInitial  + (epFinal  - epInitial)  * (coutEtape1 / coutCum) : null;
        const gesEtape1 = gesInitial !== null ? gesInitial + (gesFinal - gesInitial) * (coutEtape1 / coutCum) : null;

        const etape1Row = Object.assign({}, refRow, {
          etape_travaux: 'étape première',
          travaux_realises: [
            refRow.travaux_realises || '',
            // Inverser : les travaux de l'étape finale ne sont pas dans l'étape 1
          ].join(''),
          conso_5_usages_m2:    efEtape1  !== null ? Math.round(efEtape1)  : null,
          ep_conso_5_usages_m2: epEtape1  !== null ? Math.round(epEtape1)  : null,
          emission_ges_5_usages_m2: gesEtape1 !== null ? Math.round(gesEtape1) : null,
          classe_bilan_dpe: epToClasse(epEtape1),
          etiquette_ges:    epToClasse(gesEtape1),
          cout_travaux: coutEtape1,
          couts_cumules_travaux: coutEtape1,
          id_etape: 'step1-synthetic',
          _synthetic: true
        });
        workingRows = [initialRow, etape1Row, ...workingRows];
      } else {
        workingRows = [initialRow, ...workingRows];
      }
    }

    const sortedRows = workingRows.slice().sort((a, b) =>
      stepRank(a, workingRows.indexOf(a)) - stepRank(b, workingRows.indexOf(b))
    );
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
