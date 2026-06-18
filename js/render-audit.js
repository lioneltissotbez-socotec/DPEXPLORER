// DPE Explorer — Lot 4C : rendu Audit énergétique aligné sur la fiche DPE
(function () {
  'use strict';

  const ETIQ_COLORS = {
    A:{bg:'#1a5c3a',tx:'#4ade80'}, B:{bg:'#2d5e16',tx:'#86efac'},
    C:{bg:'#4d6b0f',tx:'#bef264'}, D:{bg:'#7c5a08',tx:'#fde68a'},
    E:{bg:'#7c3a08',tx:'#fdba74'}, F:{bg:'#7c1212',tx:'#fca5a5'},
    G:{bg:'#500d0d',tx:'#ef4444'}
  };

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmt(v, fallback) {
    return (v !== null && v !== undefined && v !== '') ? v : (fallback || '—');
  }

  function fmtN(v, unit, dec) {
    const n = Number(String(v ?? '').replace(',', '.'));
    if (!Number.isFinite(n)) return '—';
    const max = dec ?? (Math.abs(n) < 10 && n !== 0 ? 1 : 0);
    return n.toLocaleString('fr-FR', { maximumFractionDigits:max, minimumFractionDigits:0 }) + (unit || '');
  }

  function pctFromRatio(v) {
    const n = Number(String(v ?? '').replace(',', '.'));
    if (!Number.isFinite(n)) return '—';
    return Math.abs(n * 100).toLocaleString('fr-FR', { maximumFractionDigits:0 }) + ' %';
  }

  function pctFromGain(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return Math.round(n * 100) + ' %';
  }

  function badge(v, size) {
    const val = String(v || '').trim().toUpperCase();
    if (!val) return '<span style="color:var(--muted)">—</span>';
    const c = ETIQ_COLORS[val] || {bg:'#333',tx:'#fff'};
    const px = size === 'lg' ? 52 : 28;
    const fs = size === 'lg' ? 28 : 14;
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:' + px + 'px;height:' + px + 'px;border-radius:8px;font-size:' + fs + 'px;font-weight:700;font-family:var(--mono);background:' + c.bg + ';color:' + c.tx + '">' + esc(val) + '</span>';
  }

  function metricBox(value, label, color) {
    return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">'
      + '<div style="font-size:24px;font-weight:700;color:' + (color || 'var(--text)') + ';font-family:var(--mono);line-height:1">' + value + '</div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:5px;text-transform:uppercase;letter-spacing:.08em">' + esc(label) + '</div>'
      + '</div>';
  }

  function kv(label, value) {
    return '<div style="display:contents">'
      + '<span style="color:var(--muted);font-size:11px;font-family:var(--mono);padding:6px 0;border-bottom:1px solid var(--border)">' + esc(label) + '</span>'
      + '<span style="font-size:12px;font-weight:500;color:var(--text);padding:6px 0;border-bottom:1px solid var(--border);word-break:break-word">' + value + '</span>'
      + '</div>';
  }

  function block(title, color, rows) {
    return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">'
      + '<div style="background:' + color + ';padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.72)">' + esc(title) + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;padding:4px 14px">' + rows.join('') + '</div>'
      + '</div>';
  }

  function getGeo(audit) {
    if (audit && Number.isFinite(Number(audit.lat)) && Number.isFinite(Number(audit.lon))) {
      return { lat:Number(audit.lat), lon:Number(audit.lon) };
    }
    const gp = audit?.rawRows?.[0]?._geopoint;
    if (!gp) return { lat:null, lon:null };
    const p = String(gp).split(',').map(x => Number(x.trim()));
    return Number.isFinite(p[0]) && Number.isFinite(p[1]) ? { lat:p[0], lon:p[1] } : { lat:null, lon:null };
  }

  function renderExternalLinks(audit) {
    const geo = getGeo(audit);
    const lat = geo.lat;
    const lon = geo.lon;
    const address = audit.address || '';
    const cp = audit.code_postal_ban || '';
    const city = audit.nom_commune_ban || '';
    const addressQuery = encodeURIComponent([address, cp, city].filter(Boolean).join(' '));
    const maps = lat && lon
      ? 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lon
      : 'https://www.google.com/maps/search/?api=1&query=' + addressQuery;
    const street = lat && lon
      ? 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + lat + ',' + lon
      : 'https://www.google.com/maps/search/?api=1&query=' + addressQuery;
    const auditUrl = audit.n_audit
      ? 'https://observatoire-dpe-audit.ademe.fr/afficher-audit/' + encodeURIComponent(audit.n_audit)
      : '';
    const dpeUrl = audit.numero_dpe
      ? 'https://observatoire-dpe-audit.ademe.fr/afficher-dpe/' + encodeURIComponent(audit.numero_dpe)
      : '';
    const rnbId = audit.id_rnb || '';
    // Le site RNB ne garantit pas d'URL publique stable /batiment/<id> pour tous les ID exposés par ADEME.
    // On affiche donc l'ID en badge non cliquable pour éviter les liens 404.
    const cadastre = lat && lon
      ? 'https://www.geoportail.gouv.fr/carte?c=' + lon + ',' + lat + '&z=19&l0=CADASTRALPARCELS.PARCELLAIRE_EXPRESS::GEOPORTAIL:OGC:WMTS(1)&l1=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2::GEOPORTAIL:OGC:WMTS(1)&permalink=yes'
      : '';
    const ign = lat && lon
      ? 'https://www.geoportail.gouv.fr/carte?c=' + lon + ',' + lat + '&z=20&l0=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2::GEOPORTAIL:OGC:WMTS(1)&l1=CADASTRALPARCELS.PARCELLAIRE_EXPRESS::GEOPORTAIL:OGC:WMTS(1)&permalink=yes'
      : '';

    let links = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)">';
    if (maps)     links += '<a href="' + maps + '" target="_blank" rel="noopener" class="action-link">🗺 Maps</a>';
    if (street)   links += '<a href="' + street + '" target="_blank" rel="noopener" class="action-link">👁 Street View</a>';
    if (auditUrl) links += '<a href="' + auditUrl + '" target="_blank" rel="noopener" class="action-link" style="color:var(--accent2)">📋 Audit ADEME</a>';
    if (dpeUrl)   links += '<a href="' + dpeUrl + '" target="_blank" rel="noopener" class="action-link" style="color:var(--accent2)">🏛 DPE associé</a>';
    if (cadastre) links += '<a href="' + cadastre + '" target="_blank" rel="noopener" class="action-link" style="color:#f59e0b">📐 Parcelle IGN/Cadastre</a>';
    if (rnbId)    links += '<span class="action-link" title="ID RNB exposé par ADEME — lien direct désactivé car /batiment/<id> peut renvoyer 404" style="color:#22d3ee;cursor:default">🏗 ID RNB ' + esc(rnbId) + '</span>';
    links += '</div>';
    return links;
  }

  function renderTravauxList(txt) {
    const parts = String(txt || '')
      .split(/,|\n|;/)
      .map(x => x.trim())
      .filter(Boolean);
    if (!parts.length) return '<span style="color:var(--muted)">Travaux non renseignés</span>';
    return parts.map(x => '• ' + esc(x)).join('<br>');
  }

  function renderStep(step, i) {
    const r = step.raw || {};
    const label = step.label || step.etape_travaux || ('Étape ' + (i + 1));
    const isInitial = step.role === 'initial';
    const isFinal = step.role === 'final';
    const accent = isInitial ? 'var(--muted)' : (isFinal ? 'var(--accent)' : 'var(--accent2)');

    return '<div class="reno-card">'
      + '<div class="reno-card-head">'
        + '<div class="scenario-num" style="background:rgba(74,222,128,.12);color:' + accent + '">' + (i + 1) + '</div>'
        + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:13px;font-weight:700;color:var(--text)">' + esc(label) + '</div>'
          + '<div style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:2px">' + esc(step.categorie_scenario || 'scénario') + '</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:8px">' + badge(step.classe_bilan_dpe) + badge(step.etiquette_ges) + '</div>'
      + '</div>'
      + '<div class="reno-card-body">'
        + '<div style="font-size:12px;color:var(--text);line-height:1.6;margin-bottom:10px">' + (isInitial ? '<span style="color:var(--muted)">État initial avant travaux</span>' : renderTravauxList(step.travaux)) + '</div>'
        + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">'
          + '<div class="kpi-box"><div class="v" style="color:#22d3ee">' + fmtN(step.conso_5_usages_m2, ' kWh/m²') + '</div><div class="l">Conso EF</div></div>'
          + '<div class="kpi-box"><div class="v" style="color:#f87171">' + fmtN(step.emission_ges_5_usages_m2, ' kgCO₂/m²') + '</div><div class="l">GES</div></div>'
          + '<div class="kpi-box"><div class="v" style="color:#f59e0b">' + fmtN(step.cout_travaux, ' €') + '</div><div class="l">Coût étape</div></div>'
          + '<div class="kpi-box"><div class="v" style="color:var(--accent)">' + fmtN(step.couts_cumules_travaux, ' €') + '</div><div class="l">Coût cumulé</div></div>'
        + '</div>'
        + (!isInitial ? '<div style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:10px">Gain cumulé EF : <span style="color:var(--accent)">' + pctFromRatio(r.gains_relatifs_cumules_conso_5_usages_m2_ef ?? r.gain_relatif_conso_5_usages_m2_ef) + '</span> · Gain GES : <span style="color:var(--accent)">' + pctFromRatio(r.gains_relatifs_cumules_emission_ges_5_usages_m2 ?? r.gain_relatif_emission_ges_5_usages_m2) + '</span></div>' : '')
      + '</div>'
    + '</div>';
  }

  function renderAudit(audit) {
    if (!audit) return '<div class="card" style="color:var(--muted)">Aucun audit normalisé.</div>';

    const initial = audit.initial || audit.steps?.[0] || {};
    const final = audit.final || audit.steps?.[audit.steps.length - 1] || initial;
    const rows = audit.rawRows || [];
    const gainEf = Number(initial.conso_5_usages_m2) && Number(final.conso_5_usages_m2)
      ? ((Number(initial.conso_5_usages_m2) - Number(final.conso_5_usages_m2)) / Number(initial.conso_5_usages_m2))
      : null;
    const gainGes = Number(initial.emission_ges_5_usages_m2) && Number(final.emission_ges_5_usages_m2)
      ? ((Number(initial.emission_ges_5_usages_m2) - Number(final.emission_ges_5_usages_m2)) / Number(initial.emission_ges_5_usages_m2))
      : null;
    const finalCost = final.couts_cumules_travaux || final.cout_travaux || null;

    let html = '<div style="display:flex;flex-direction:column;gap:16px">';

    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px 24px">'
      + '<div class="audit-hero" style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">'
        + '<div class="audit-hero-badges" style="display:flex;gap:12px;align-items:center;flex-shrink:0">'
          + badge(initial.classe_bilan_dpe, 'lg')
          + '<span style="font-size:22px;color:var(--muted)">→</span>'
          + badge(final.classe_bilan_dpe, 'lg')
          + '<div style="display:flex;flex-direction:column;gap:4px;margin-left:4px">'
            + '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">DPE avant / après</div>'
            + '<div style="display:flex;gap:6px;align-items:center">' + badge(initial.etiquette_ges) + '<span style="color:var(--muted)">→</span>' + badge(final.etiquette_ges) + '</div>'
            + '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">GES</div>'
          + '</div>'
        + '</div>'
        + '<div class="audit-hero-addr" style="flex:1;min-width:0">'
          + '<div style="font-size:15px;font-weight:700;margin-bottom:4px;line-height:1.3">' + esc(fmt(audit.address)) + '</div>'
          + '<div style="font-family:var(--mono);font-size:12px;color:var(--muted);margin-bottom:2px">' + esc(fmt(audit.code_postal_ban)) + ' ' + esc(fmt(audit.nom_commune_ban)) + '</div>'
          + '<div style="font-family:var(--mono);font-size:11px;color:var(--muted)">' + esc(fmt(audit.method)) + '</div>'
        + '</div>'
        + '<div class="audit-hero-meta" style="text-align:right;min-width:0;flex-shrink:0">'
          + '<div style="font-size:10px;color:var(--muted);font-family:var(--mono);margin-bottom:4px">N° AUDIT</div>'
          + '<div style="font-size:12px;font-weight:600;color:var(--blue-main);font-family:var(--mono);word-break:break-all">' + esc(fmt(audit.n_audit)) + '</div>'
          + '<div style="font-size:10px;color:var(--muted);font-family:var(--mono);margin-top:8px">DPE associé</div>'
          + '<div style="font-size:12px;font-weight:500;font-family:var(--mono);color:var(--blue-light);word-break:break-all">' + esc(fmt(audit.numero_dpe)) + '</div>'
          + '<div style="font-size:10px;color:var(--muted);font-family:var(--mono);margin-top:8px">Valide jusqu’au</div>'
          + '<div style="font-size:12px;font-weight:500;font-family:var(--mono);color:var(--success)">' + esc(fmt(audit.date_fin_validite_audit)) + '</div>'
        + '</div>'
      + '</div>'
      + renderExternalLinks(audit)
    + '</div>';

    html += '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px">'
      + metricBox(fmtN(initial.conso_5_usages_m2, ' kWh'), 'Conso initiale / m²', '#f59e0b')
      + metricBox(fmtN(final.conso_5_usages_m2, ' kWh'), 'Conso finale / m²', 'var(--accent)')
      + metricBox(pctFromGain(gainEf), 'Gain énergie', 'var(--accent2)')
      + metricBox(fmtN(initial.emission_ges_5_usages_m2, ' kg'), 'GES initial / m²', '#f87171')
      + metricBox(fmtN(final.emission_ges_5_usages_m2, ' kg'), 'GES final / m²', 'var(--accent)')
      + metricBox(fmtN(finalCost, ' €'), 'Coût travaux cumulé', '#f59e0b')
    + '</div>';

    html += '<details open class="expert-only expert-details expert-section" style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden"><summary style="padding:14px 18px;cursor:pointer;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-family:var(--mono)">Détails techniques de l’audit</summary><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px">'
      + block('🏠 Logement audité', '#1e3a5f', [
          kv('Surface', esc(fmtN(audit.surface_habitable_logement, ' m²'))),
          kv('Année construction', esc(fmt(audit.annee_construction))),
          kv('Période construction', esc(fmt(audit.periode_construction))),
          kv('Nb lignes audit', esc(rows.length)),
          kv('Identifiant BAN', esc(fmt(audit.identifiant_ban))),
          kv('ID RNB', esc(fmt(audit.id_rnb)))
        ])
      + block('🔥 Systèmes initial / final', '#3b1c1c', [
          kv('Chauffage initial', esc(fmt(initial.type_energie_principale_chauffage))),
          kv('Chauffage final', esc(fmt(final.type_energie_principale_chauffage))),
          kv('ECS initiale', esc(fmt(initial.type_energie_principale_ecs))),
          kv('ECS finale', esc(fmt(final.type_energie_principale_ecs))),
          kv('Méthode', esc(fmt(audit.method))),
          kv('Date audit', esc(fmt(audit.date_etablissement_audit)))
        ])
      + block('🧱 Enveloppe finale', '#2a1f0a', [
          kv('Murs', esc(fmt(final.qualite_isolation_murs))),
          kv('Menuiseries', esc(fmt(final.qualite_isolation_menuiseries))),
          kv('Plancher bas', esc(fmt(final.qualite_isolation_plancher_bas))),
          kv('Plancher haut', esc(fmt(final.qualite_isolation_plancher_haut_comble_perdu))),
          kv('Toiture isolée', esc(final.isolation_toiture === 1 || final.isolation_toiture === '1' ? 'Oui' : fmt(final.isolation_toiture))),
          kv('Ubat final', esc(fmtN(final.ubat_w_m2_k, ' W/m²K', 2)))
        ])
    + '</div></details>';

    html += '<div style="font-size:15px;font-weight:700;margin:4px 0 -4px">🧭 Parcours de rénovation</div>';
    html += (audit.steps || []).map(renderStep).join('');

    const raw = JSON.stringify(rows, null, 2);
    html += '<details open class="expert-only expert-details" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">'
      + '<summary style="padding:10px 16px;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;cursor:pointer;font-family:var(--mono)">JSON brut Audit · ' + rows.length + ' ligne(s)</summary>'
      + '<div class="raw" style="margin:0;border-radius:0;border:none;border-top:1px solid var(--border)">' + (typeof window.colorizeJson === 'function' ? window.colorizeJson(raw) : esc(raw)) + '</div>'
      + '</details>';

    html += '</div>';
    return html;
  }

  window.renderAudit = renderAudit;
})();
