// DPE Explorer - rendu des fiches DPE
// Dépendances globales conservées pendant le refactoring progressif : fmt, fmtN, colorizeJson.

function renderDpeCard(d, total) {
  const eDpe = d['etiquette_dpe'] || '';
  const eGes = d['etiquette_ges'] || '';

  const etiqColors = {
    A:{bg:'#1a5c3a',tx:'#4ade80'}, B:{bg:'#2d5e16',tx:'#86efac'},
    C:{bg:'#4d6b0f',tx:'#bef264'}, D:{bg:'#7c5a08',tx:'#fde68a'},
    E:{bg:'#7c3a08',tx:'#fdba74'}, F:{bg:'#7c1212',tx:'#fca5a5'},
    G:{bg:'#500d0d',tx:'#ef4444'}
  };

  function badge(v, size) {
    if (!v) return '<span style="color:var(--muted)">—</span>';
    const c = etiqColors[v] || {bg:'#333',tx:'#fff'};
    const sz = size === 'lg' ? '52px;font-size:28px' : '28px;font-size:14px';
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:' + sz + ';height:' + (size==='lg'?'52':'28') + 'px;border-radius:8px;font-weight:700;font-family:var(--mono);background:' + c.bg + ';color:' + c.tx + '">' + v + '</span>';
  }

  function row(label, value) {
    const v = (value !== null && value !== undefined && value !== '') ? value : '—';
    return '<div style="display:contents"><span style="color:var(--muted);font-size:11px;font-family:var(--mono);padding:6px 0;border-bottom:1px solid var(--border)">' + label + '</span><span style="font-size:12px;font-weight:500;color:var(--text);padding:6px 0;border-bottom:1px solid var(--border);word-break:break-word">' + v + '</span></div>';
  }

  function block(title, color, rows) {
    return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">'
      + '<div style="background:' + color + ';padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7)">' + title + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;padding:4px 14px">'
      + rows
      + '</div></div>';
  }

  function metricBox(value, label, color) {
    return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">'
      + '<div style="font-size:24px;font-weight:700;color:' + (color||'var(--text)') + ';font-family:var(--mono);line-height:1">' + (value||'—') + '</div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:5px;text-transform:uppercase;letter-spacing:.08em">' + label + '</div>'
      + '</div>';
  }


  function energyLabelForPost(poste) {
    const pick = keys => {
      for (const k of keys) {
        const v = d[k];
        if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };
    if (poste === 'chauffage') return pick([
      'type_energie_principale_chauffage',
      'type_energie_generateur_n1_installation_n1',
      'type_energie_n1'
    ]);
    if (poste === 'ecs') return pick([
      'type_energie_principale_ecs',
      'type_energie_generateur_n1_ecs_n1',
      'type_energie_n2',
      'type_energie_n1'
    ]);
    if (poste === 'eclairage') return 'Électricité';
    if (poste === 'auxiliaires') return 'Électricité';
    if (poste === 'refroidissement') return pick([
      'type_energie_principale_refroidissement',
      'type_energie_refroidissement'
    ]) || 'Électricité';
    return '';
  }

  function renderEnergyByTypeSummary() {
    const items = [
      { idx: 1, energy: d['type_energie_n1'], ef: d['conso_5_usages_ef_energie_n1'], ep: d['conso_5_usages_ep_energie_n1'], cost: d['cout_total_5_usages_energie_n1'], ges: d['emission_ges_5_usages_energie_n1'] },
      { idx: 2, energy: d['type_energie_n2'], ef: d['conso_5_usages_ef_energie_n2'], ep: d['conso_5_usages_ep_energie_n2'], cost: d['cout_total_5_usages_energie_n2'], ges: d['emission_ges_5_usages_energie_n2'] },
      { idx: 3, energy: d['type_energie_n3'], ef: d['conso_5_usages_ef_energie_n3'], ep: d['conso_5_usages_ep_energie_n3'], cost: d['cout_total_5_usages_energie_n3'], ges: d['emission_ges_5_usages_energie_n3'] }
    ].filter(x => x.energy || x.ef || x.ep || x.cost || x.ges);

    if (!items.length) return '';
    const totalEf = items.reduce((a,x) => a + (parseFloat(x.ef) || 0), 0);
    const totalCost = items.reduce((a,x) => a + (parseFloat(x.cost) || 0), 0);

    return '<div class="expert-only expert-section" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">'
      + '<div style="background:#17301f;padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.75)">🔋 Synthèse des consommations par type d’énergie</div>'
      + '<div style="display:grid;grid-template-columns:repeat(' + Math.min(Math.max(items.length,1),3) + ',1fr);gap:1px;background:var(--border)">'
      + items.map(x => {
          const ef = parseFloat(x.ef) || 0;
          const cost = parseFloat(x.cost) || 0;
          const pctEf = totalEf > 0 ? Math.round((ef / totalEf) * 100) : null;
          const pctCost = totalCost > 0 ? Math.round((cost / totalCost) * 100) : null;
          return '<div style="background:var(--surface2);padding:16px 14px">'
            + '<div style="font-size:15px;font-weight:700;color:var(--accent);margin-bottom:8px">' + fmt(x.energy || ('Énergie ' + x.idx)) + '</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-family:var(--mono);font-size:12px">'
            + '<span style="color:var(--muted)">Conso EF</span><strong style="text-align:right">' + (x.ef ? fmtN(x.ef) + ' kWh' : '—') + '</strong>'
            + '<span style="color:var(--muted)">Part EF</span><strong style="text-align:right">' + (pctEf !== null ? pctEf + ' %' : '—') + '</strong>'
            + '<span style="color:var(--muted)">Conso EP</span><strong style="text-align:right">' + (x.ep ? fmtN(x.ep) + ' kWh' : '—') + '</strong>'
            + '<span style="color:var(--muted)">Coût</span><strong style="text-align:right;color:#f59e0b">' + (x.cost ? fmtN(x.cost) + ' €' : '—') + '</strong>'
            + '<span style="color:var(--muted)">Part coût</span><strong style="text-align:right">' + (pctCost !== null ? pctCost + ' %' : '—') + '</strong>'
            + '<span style="color:var(--muted)">GES</span><strong style="text-align:right;color:#f87171">' + (x.ges ? fmtN(x.ges) + ' kg CO₂' : '—') + '</strong>'
            + '</div></div>';
        }).join('')
      + '</div>'
      + '<div style="padding:10px 14px;font-size:11px;color:var(--muted);font-family:var(--mono);border-top:1px solid var(--border)">Répartition calculée à partir des champs ADEME par énergie n1/n2/n3 quand ils sont disponibles.</div>'
      + '</div>';
  }

  function housingHeaderLabel() {
    const type = d['type_batiment'] || d['type_logement'] || '';
    const floorRaw = d['numero_etage_appartement'] ?? d['n_etage_appart'] ?? d['numero_etage'] ?? null;
    const levelsRaw = d['nombre_niveau_logement'] ?? d['nb_niveau_logement'] ?? null;
    const parts = [];
    if (type) parts.push(String(type).charAt(0).toUpperCase() + String(type).slice(1));
    if (floorRaw !== null && floorRaw !== undefined && floorRaw !== '') {
      const f = parseInt(floorRaw, 10);
      if (!isNaN(f)) parts.push(f === 0 ? 'rez-de-chaussée' : 'étage ' + f);
    }
    if (levelsRaw !== null && levelsRaw !== undefined && levelsRaw !== '') {
      const n = parseInt(levelsRaw, 10);
      if (!isNaN(n) && n > 0) parts.push(n + ' niveau' + (n > 1 ? 'x' : ''));
    }
    return parts.length ? parts.join(' · ') : 'Type de logement non renseigné';
  }


  function renderDpeNeighborhoodComparison(comp) {
    if (!comp || !comp.referenceCount) return '';

    function localFmtNumber(v, dec) {
      if (v === null || v === undefined || isNaN(parseFloat(v))) return '—';
      const n = parseFloat(v);
      return dec ? n.toFixed(dec).replace('.', ',') : Math.round(n).toLocaleString('fr-FR');
    }

    function pctDelta(m) {
      if (!m || m.selected === null || m.avg === null || m.avg === 0) return null;
      return ((m.selected - m.avg) / m.avg) * 100;
    }

    function metricImpact(m) {
      const pct = pctDelta(m);
      if (pct === null) return { label:'Écart non calculable', color:'var(--muted)', tone:'neutral', text:'—' };
      const abs = Math.abs(pct);
      const lowerIsBetter = !!m.lowerIsBetter;
      const selectedBetter = lowerIsBetter ? pct < 0 : pct > 0;
      const selectedEqual = abs < 1;
      if (selectedEqual) return { label:'Équivalent à la moyenne', color:'var(--muted)', tone:'neutral', text:'≈ 0 %' };

      if (m.semantic === 'cost') {
        return selectedBetter
          ? { label:'Moins coûteux que la moyenne', color:'var(--accent)', tone:'good', text:'-' + localFmtNumber(abs, 0) + ' %' }
          : { label:'Plus coûteux que la moyenne', color:'#fca5a5', tone:'bad', text:'+' + localFmtNumber(abs, 0) + ' %' };
      }
      if (m.semantic === 'surface') {
        return pct > 0
          ? { label:'Surface supérieure à la moyenne', color:'var(--accent2)', tone:'neutral', text:'+' + localFmtNumber(abs, 0) + ' %' }
          : { label:'Surface inférieure à la moyenne', color:'var(--muted)', tone:'neutral', text:'-' + localFmtNumber(abs, 0) + ' %' };
      }
      if (m.semantic === 'ubat') {
        return selectedBetter
          ? { label:'Enveloppe plus performante que la moyenne', color:'var(--accent)', tone:'good', text:'-' + localFmtNumber(abs, 0) + ' %' }
          : { label:'Enveloppe moins performante que la moyenne', color:'#fca5a5', tone:'bad', text:'+' + localFmtNumber(abs, 0) + ' %' };
      }
      if (m.semantic === 'ges') {
        return selectedBetter
          ? { label:'Moins émissif que la moyenne', color:'var(--accent)', tone:'good', text:'-' + localFmtNumber(abs, 0) + ' %' }
          : { label:'Plus émissif que la moyenne', color:'#fca5a5', tone:'bad', text:'+' + localFmtNumber(abs, 0) + ' %' };
      }
      return selectedBetter
        ? { label:'Moins énergivore que la moyenne', color:'var(--accent)', tone:'good', text:'-' + localFmtNumber(abs, 0) + ' %' }
        : { label:'Plus énergivore que la moyenne', color:'#fca5a5', tone:'bad', text:'+' + localFmtNumber(abs, 0) + ' %' };
    }

    function positionText(m) {
      if (!m || m.betterShare === null || m.betterShare === undefined) return null;
      const lessGood = Math.round(m.betterShare * 100);
      const moreGood = 100 - lessGood;
      return {
        lessGood,
        moreGood,
        text: lessGood + ' % moins performants · ' + moreGood + ' % plus performants'
      };
    }

    function syntheticSentence(metric, label) {
      if (!metric || metric.selected === null || metric.avg === null) return '';
      const imp = metricImpact(metric);
      const pos = positionText(metric);
      let txt = '<div style="padding:8px 10px;border-radius:7px;background:rgba(0,0,0,.16);border:1px solid rgba(255,255,255,.07)">';
      txt += '<strong style="color:' + imp.color + '">' + label + ' : ' + imp.label.toLowerCase() + ' (' + imp.text + ')</strong>';
      if (pos) txt += '<br><span style="color:var(--muted);font-family:var(--mono);font-size:10px">' + pos.moreGood + ' % des autres DPE sont meilleurs sur cet indicateur.</span>';
      txt += '</div>';
      return txt;
    }

    const metrics = [
      Object.assign({ semantic:'energy' }, comp.metrics?.consoEf || {}),
      Object.assign({ semantic:'energy' }, comp.metrics?.consoEp || {}),
      Object.assign({ semantic:'ges' }, comp.metrics?.ges || {}),
      Object.assign({ semantic:'cost' }, comp.metrics?.cout || {}),
      Object.assign({ semantic:'surface' }, comp.metrics?.surface || {}),
      Object.assign({ semantic:'ubat' }, comp.metrics?.ubat || {})
    ].filter(m => m && m.label);

    const mainConso = metrics.find(m => m.label === 'Conso EF');
    const mainGes = metrics.find(m => m.label === 'GES');
    const mainCost = metrics.find(m => m.label === 'Coût annuel');

    let html = '<div class="neighborhood-block" style="background:linear-gradient(135deg,rgba(34,211,238,.08),rgba(74,222,128,.05));border:1px solid rgba(34,211,238,.25);border-radius:10px;padding:18px 20px">';
    html += '<div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px">';
    html += '<div style="font-size:22px">📍</div>';
    html += '<div style="flex:1;min-width:220px"><div class="neighborhood-title" style="font-size:14px;font-weight:700;color:var(--text)">Comparaison avec le quartier</div>';
    const scopeText = comp.scopeLabel || ('rayon de ' + comp.radius + ' m');
    html += '<div style="font-family:var(--mono);font-size:11px;color:var(--muted)">Bien comparé à ' + comp.referenceCount + ' autre(s) DPE affiché(s) dans la sélection : ' + scopeText + (comp.selectedDistance !== undefined ? ' · distance centre : ' + comp.selectedDistance + ' m' : '') + '</div></div>';
    html += '<div style="text-align:right"><div style="font-size:10px;color:var(--muted);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em">Étiquette moyenne</div>' + badge(comp.averageClass || '—') + '</div>';
    html += '</div>';

    function narrativeLevel(m) {
      if (!m || m.selected === null || m.avg === null || m.avg === 0) return { level:'neutral', word:'non déterminé', pct:null };
      const pct = pctDelta(m);
      const abs = Math.abs(pct || 0);
      const lowerIsBetter = !!m.lowerIsBetter;
      const bad = lowerIsBetter ? pct > 1 : pct < -1;
      const good = lowerIsBetter ? pct < -1 : pct > 1;
      let intensity = 'proche de la moyenne';
      if (abs >= 40) intensity = bad ? 'nettement défavorable' : 'nettement favorable';
      else if (abs >= 20) intensity = bad ? 'défavorable' : 'favorable';
      else if (abs >= 8) intensity = bad ? 'légèrement défavorable' : 'légèrement favorable';
      return { level: bad ? 'bad' : (good ? 'good' : 'neutral'), word:intensity, pct };
    }

    function metricPhrase(m, name) {
      if (!m || m.selected === null || m.avg === null) return '';
      const imp = metricImpact(m);
      const pos = positionText(m);
      const color = imp.tone === 'bad' ? '#fca5a5' : (imp.tone === 'good' ? 'var(--accent)' : 'var(--muted)');
      let txt = '<div style="padding:8px 10px;border-radius:7px;background:rgba(0,0,0,.16);border:1px solid rgba(255,255,255,.07)">';
      txt += '<strong style="color:' + color + '">' + name + ' : ' + imp.label.toLowerCase() + ' (' + imp.text + ')</strong>';
      if (pos) txt += '<br><span style="color:var(--muted);font-family:var(--mono);font-size:10px">' + pos.moreGood + ' % des autres DPE sont plus performants.</span>';
      txt += '</div>';
      return txt;
    }

    function generateLocalSynthesis() {
      const energy = narrativeLevel(mainConso);
      const ges = narrativeLevel(mainGes);
      const cost = narrativeLevel(mainCost);
      const ubatMetric = metrics.find(m => m.label === 'Ubat');
      const ubat = narrativeLevel(ubatMetric);
      const surfaceMetric = metrics.find(m => m.label === 'Surface');

      const badCount = [energy, ges, cost, ubat].filter(x => x.level === 'bad').length;
      const goodCount = [energy, ges, cost, ubat].filter(x => x.level === 'good').length;
      let verdict = 'Le bien présente un profil globalement équilibré par rapport aux DPE visibles dans la zone.';
      let verdictColor = 'var(--accent2)';
      if (badCount >= 3) { verdict = 'Le bien se situe globalement en retrait par rapport aux références locales affichées.'; verdictColor = '#fca5a5'; }
      else if (goodCount >= 3) { verdict = 'Le bien se positionne favorablement par rapport aux références locales affichées.'; verdictColor = 'var(--accent)'; }
      else if (energy.level === 'bad' && ges.level === 'good') { verdict = 'Le bien consomme davantage que la moyenne locale, mais reste plutôt vertueux sur les émissions de CO₂.'; verdictColor = '#f59e0b'; }
      else if (energy.level === 'good' && cost.level === 'bad') { verdict = 'Le bien consomme moins que la moyenne, mais son coût annuel estimé reste supérieur au secteur.'; verdictColor = '#f59e0b'; }

      function sentenceFor(m, label, goodText, badText) {
        if (!m || m.selected === null || m.avg === null) return '';
        const imp = metricImpact(m);
        const pos = positionText(m);
        const color = imp.tone === 'bad' ? '#fca5a5' : (imp.tone === 'good' ? 'var(--accent)' : 'var(--muted)');
        let s = '<li><strong style="color:' + color + '">' + label + '</strong> : ' + (imp.tone === 'good' ? goodText : (imp.tone === 'bad' ? badText : 'niveau proche de la moyenne locale')) + ' <strong style="color:' + color + '">' + imp.text + '</strong>';
        if (pos) s += ' · ' + pos.moreGood + ' % des autres DPE sont plus performants.';
        s += '</li>';
        return s;
      }

      let html2 = '<div style="height:100%">';
      html2 += '<div style="font-size:10px;color:var(--muted);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Synthèse quartier locale</div>';
      html2 += '<div style="font-size:13px;line-height:1.55;color:var(--text);margin-bottom:10px"><strong style="color:' + verdictColor + '">' + verdict + '</strong></div>';
      html2 += '<ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.65;color:var(--muted)">';
      html2 += sentenceFor(mainConso, 'Énergie', 'consommation inférieure à la moyenne', 'consommation supérieure à la moyenne');
      html2 += sentenceFor(mainGes, 'GES', 'émissions inférieures à la moyenne', 'émissions supérieures à la moyenne');
      html2 += sentenceFor(mainCost, 'Coût', 'coût annuel inférieur à la moyenne', 'coût annuel supérieur à la moyenne');
      html2 += sentenceFor(ubatMetric, 'Enveloppe', 'Ubat plus performant que la moyenne', 'Ubat moins performant que la moyenne');
      html2 += '</ul>';
      if (surfaceMetric && surfaceMetric.selected !== null && surfaceMetric.avg !== null) {
        const surfImp = metricImpact(surfaceMetric);
        html2 += '<div style="margin-top:10px;font-size:11px;color:var(--muted);font-family:var(--mono)">Surface : ' + surfImp.label.toLowerCase() + ' (' + surfImp.text + ') — utile pour vérifier la pertinence de la comparaison.</div>';
      }
      html2 += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);font-size:10px;color:var(--muted);line-height:1.5">Analyse générée localement à partir des DPE visibles. Aucun appel IA externe.</div>';
      html2 += '</div>';
      return html2;
    }

    html += '<div class="neighborhood-synthesis-block" style="background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px 16px;margin-bottom:12px">';
    html += generateLocalSynthesis();
    html += '</div>';

    html += '<div class="neighborhood-metrics-grid immo-expert-only" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">';
    metrics.forEach(m => {
      const imp = metricImpact(m);
      const pos = positionText(m);
      html += '<div class="neighborhood-metric-card" style="background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px 14px">';
      html += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-family:var(--mono);margin-bottom:6px">' + m.label + '</div>';
      html += '<div style="display:flex;justify-content:space-between;gap:8px;font-family:var(--mono);font-size:12px"><span>Bien</span><strong style="color:var(--text)">' + localFmtNumber(m.selected, m.label === 'Ubat' ? 2 : 0) + ' ' + m.unit + '</strong></div>';
      html += '<div style="display:flex;justify-content:space-between;gap:8px;font-family:var(--mono);font-size:12px;color:var(--muted)"><span>Moyenne quartier</span><strong style="color:var(--muted)">' + localFmtNumber(m.avg, m.label === 'Ubat' ? 2 : 0) + ' ' + m.unit + '</strong></div>';
      html += '<div style="margin-top:8px;font-size:11px;font-family:var(--mono);color:' + imp.color + '">' + imp.label + ' : ' + imp.text + '</div>';
      if (pos) html += '<div style="font-size:10px;color:var(--muted);margin-top:3px">' + pos.text + '</div>';
      html += '</div>';
    });
    html += '</div>';

    const dist = comp.distribution || {};
    const max = Math.max(1, ...['A','B','C','D','E','F','G'].map(e => dist[e] || 0));
    html += '<div class="immo-expert-only" style="margin-top:14px;border-top:1px solid rgba(255,255,255,.08);padding-top:12px">';
    html += '<div style="font-size:10px;color:var(--muted);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Répartition des autres DPE affichés</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">';
    ['A','B','C','D','E','F','G'].forEach(e => {
      const c = dist[e] || 0;
      const h = Math.max(4, Math.round((c / max) * 38));
      html += '<div style="text-align:center"><div style="height:42px;display:flex;align-items:flex-end;justify-content:center"><div style="width:100%;max-width:28px;height:' + h + 'px;border-radius:4px 4px 0 0;background:' + (etiqColors[e]?.bg || '#333') + ';border:1px solid rgba(255,255,255,.08)"></div></div><div style="margin-top:4px">' + badge(e) + '</div><div style="font-size:10px;color:var(--muted);font-family:var(--mono)">' + c + '</div></div>';
    });
    html += '</div></div>';
    html += '</div>';
    return html;
  }


  function renderUserDpePresentation() {
    const address = fmt(d['adresse_ban'] || d['adresse_complete_brut'] || d['adresse_brut']);
    const city = [d['code_postal_ban'] || d['code_postal_brut'], d['nom_commune_ban'] || d['nom_commune_brut']].filter(Boolean).join(' ');
    const type = fmt(d['type_batiment']);
    const surf = fmtN(d['surface_habitable_logement']) + ' m²';
    const consoEp = fmtN(d['conso_5_usages_par_m2_ep']) + ' kWhEP/m²/an';
    const consoEf = fmtN(d['conso_5_usages_par_m2_ef']) + ' kWhEF/m²/an';
    const ges = fmtN(d['emission_ges_5_usages_par_m2']) + ' kgCO₂/m²/an';
    const cout = fmtN(d['cout_total_5_usages']) + ' €/an';

    const heatingEnergy = fmt(d['type_energie_principale_chauffage'] || d['type_energie_n1']);
    const heatingSystem = fmt(d['type_generateur_n1_installation_n1'] || d['description_generateur_chauffage_n1_installation_n1'] || d['configuration_installation_chauffage_n1']);
    const ecsEnergy = fmt(d['type_energie_principale_ecs']);
    const ecsSystem = fmt(d['type_generateur_n1_ecs_n1'] || d['description_generateur_n1_ecs_n1'] || d['configuration_installation_ecs_n1']);
    const ventilation = fmt(d['type_ventilation']);
    const housingLabel = housingHeaderLabel();

    function clean(v) { return (v === null || v === undefined || v === '' || v === '—') ? 'Non renseigné' : String(v); }
    function shortText(v, n) { v = clean(v); return v.length > n ? v.slice(0, n-1) + '…' : v; }
    function qualityTone(v) {
      v = String(v || '').toLowerCase();
      if (v.includes('très bonne') || v.includes('bonne')) return { cls:'good', txt:'Bonne' };
      if (v.includes('moyenne')) return { cls:'warn', txt:'Moyenne' };
      if (v.includes('insuffisante') || v.includes('mauvaise')) return { cls:'bad', txt:'À améliorer' };
      return { cls:'neutral', txt:clean(v) };
    }
    function simpleCard(icon, title, main, sub, note) {
      return '<div class="user-info-card">'
        + '<div class="user-info-icon">' + icon + '</div>'
        + '<div class="user-info-body"><div class="user-info-title">' + title + '</div>'
        + '<div class="user-info-main" title="' + clean(main).replace(/"/g,'&quot;') + '">' + shortText(main, 72) + '</div>'
        + (sub ? '<div class="user-info-sub">' + sub + '</div>' : '')
        + (note ? '<div class="user-info-note">' + note + '</div>' : '')
        + '</div></div>';
    }
    function isoLine(label, value) {
      const q = qualityTone(value);
      return '<div class="user-iso-line"><span>' + label + '</span><strong class="tone-' + q.cls + '">' + q.txt + '</strong></div>';
    }

    const strengths = [];
    const alerts = [];
    const dpeRank = 'ABCDEFG'.indexOf(eDpe);
    const gesRank = 'ABCDEFG'.indexOf(eGes);
    if (dpeRank >= 0 && dpeRank <= 2) strengths.push('Classe énergétique favorable pour le secteur.');
    if (dpeRank >= 5) alerts.push('Étiquette DPE faible : le logement peut être énergivore.');
    if (gesRank >= 0 && gesRank <= 1) strengths.push('Émissions de CO₂ faibles.');
    if (gesRank >= 4) alerts.push('Émissions de CO₂ élevées.');
    const heatTxt = String(heatingSystem + ' ' + heatingEnergy).toLowerCase();
    if (heatTxt.includes('pac') || heatTxt.includes('pompe à chaleur')) strengths.push('Système de chauffage performant identifié.');
    if (heatTxt.includes('fioul')) alerts.push('Chauffage fioul : point de vigilance énergétique et économique.');
    if (String(ventilation).toLowerCase().includes('naturelle')) alerts.push('Ventilation naturelle : amélioration possible selon le projet.');
    if (String(ventilation).toLowerCase().includes('hygro')) strengths.push('Ventilation mécanique hygroréglable identifiée.');
    ['qualite_isolation_murs','qualite_isolation_menuiseries','qualite_isolation_plancher_bas','qualite_isolation_plancher_haut_comble_perdu'].forEach(k => {
      const v = String(d[k] || '').toLowerCase();
      if (v.includes('insuffisante')) alerts.push('Isolation ' + k.replace('qualite_isolation_','').replaceAll('_',' ') + ' à surveiller.');
    });
    if (!strengths.length) strengths.push('Données disponibles suffisantes pour situer le bien dans son quartier.');
    if (!alerts.length) alerts.push('Aucun point d’alerte majeur détecté dans les indicateurs principaux.');

    const gp = d['_geopoint'] || '';
    let lat = null, lon = null;
    if (gp) { const parts = gp.split(','); lat = parseFloat(parts[0]); lon = parseFloat(parts[1]); }
    const maps = lat && lon ? 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lon : '';
    const sv = lat && lon ? 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + lat + ',' + lon : '';
    const ademe = d['numero_dpe'] ? 'https://observatoire-dpe-audit.ademe.fr/afficher-dpe/' + d['numero_dpe'] : '';

    let html = '<section class="user-dpe-card user-only">';
    html += '<div class="user-hero">';
    html += '<div class="user-hero-main"><div class="user-address">' + address + '</div><div class="user-city">' + city + '</div><div class="user-housing-meta">' + housingLabel + '</div></div>';
    html += '<div class="user-badges"><div><span class="user-label">DPE</span>' + badge(eDpe, 'lg') + '</div><div><span class="user-label">GES</span>' + badge(eGes, 'lg') + '</div></div>';
    html += '</div>';

    html += '<div class="user-kpi-grid">';
    html += '<div class="user-kpi"><span>Conso énergie</span><strong>' + consoEp + '</strong><small>' + consoEf + '</small></div>';
    html += '<div class="user-kpi"><span>Émissions CO₂</span><strong>' + ges + '</strong><small>par m² et par an</small></div>';
    html += '<div class="user-kpi"><span>Coût estimé</span><strong>' + cout + '</strong><small>5 usages / an</small></div>';
    html += '<div class="user-kpi"><span>Logement</span><strong>' + surf + '</strong><small>' + housingLabel + '</small></div>';
    html += '</div>';

    html += '<div class="user-section-title">Fonctionnement du logement</div>';
    html += '<div class="user-info-grid">';
    html += simpleCard('🔥','Chauffage', heatingSystem, 'Énergie : ' + heatingEnergy, d['type_emetteur_installation_chauffage_n1'] ? 'Émetteur : ' + shortText(d['type_emetteur_installation_chauffage_n1'], 70) : '');
    html += simpleCard('🚿','Eau chaude', ecsSystem, 'Énergie : ' + ecsEnergy, d['type_installation_ecs_n1'] ? 'Installation : ' + shortText(d['type_installation_ecs_n1'], 70) : '');
    html += simpleCard('🌬️','Ventilation', ventilation, d['ventilation_posterieure_2012'] ? 'Système postérieur à 2012' : 'Système ancien ou non renseigné', '');
    html += '</div>';

    html += '<div class="user-section-title">Isolation lisible</div>';
    html += '<div class="user-isolation-grid">';
    html += isoLine('Murs', d['qualite_isolation_murs']);
    html += isoLine('Menuiseries', d['qualite_isolation_menuiseries']);
    html += isoLine('Plancher bas', d['qualite_isolation_plancher_bas']);
    html += isoLine('Toiture / plancher haut', d['qualite_isolation_plancher_haut_comble_perdu']);
    html += '</div>';

    html += '<div class="user-points-grid">';
    html += '<div class="user-points good"><h3>✅ Points forts</h3><ul>' + strengths.slice(0,4).map(x => '<li>' + x + '</li>').join('') + '</ul></div>';
    html += '<div class="user-points warn"><h3>⚠️ Points de vigilance</h3><ul>' + alerts.slice(0,4).map(x => '<li>' + x + '</li>').join('') + '</ul></div>';
    html += '</div>';

    html += '<div class="user-links">';
    if (maps) html += '<a href="' + maps + '" target="_blank" rel="noopener">🗺 Google Maps</a>';
    if (sv) html += '<a href="' + sv + '" target="_blank" rel="noopener">👁 Street View</a>';
    if (ademe) html += '<a href="' + ademe + '" target="_blank" rel="noopener">🏛 Fiche ADEME</a>';
    html += '</div>';
    html += '</section>';
    return html;
  }

  return '<div style="display:flex;flex-direction:column;gap:16px">'
    + renderUserDpePresentation()
    + '<div class="user-immo-only">' + renderDpeNeighborhoodComparison(d._neighborhoodComparison) + '</div>'
    + '<div class="immo-expert-only" style="display:flex;flex-direction:column;gap:16px">'

    // ── ENTÊTE ──
    + '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px 24px">'
    + '<div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">'
    + '<div style="display:flex;gap:12px;align-items:center">'
    + badge(eDpe, 'lg')
    + '<div style="display:flex;flex-direction:column;gap:4px"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">Énergie</div>'
    + badge(eGes, 'lg')
    + '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:4px">GES</div></div>'
    + '</div>'
    + '<div style="flex:1;min-width:180px">'
    + '<div style="font-size:15px;font-weight:700;margin-bottom:4px;line-height:1.3">' + fmt(d['adresse_brut']) + '</div>'
    + '<div style="font-family:var(--mono);font-size:12px;color:var(--muted);margin-bottom:2px">' + fmt(d['code_postal_ban']) + ' ' + fmt(d['nom_commune_ban']) + '</div>'
    + '<div style="font-family:var(--mono);font-size:11px;color:var(--muted)">' + fmt(d['methode_application_dpe']) + '</div>'
    + '<div style="font-size:12px;color:var(--accent2);font-weight:600;margin-top:6px">' + housingHeaderLabel() + '</div>'
    + '</div>'
    + '<div style="text-align:right;min-width:100px">'
    + '<div style="font-size:10px;color:var(--muted);font-family:var(--mono);margin-bottom:4px">N° DPE</div>'
    + '<div style="font-size:12px;font-weight:600;color:var(--accent);font-family:var(--mono)">' + fmt(d['numero_dpe']) + '</div>'
    + '<div style="font-size:10px;color:var(--muted);font-family:var(--mono);margin-top:8px">Visité le</div>'
    + '<div style="font-size:12px;font-weight:500;font-family:var(--mono)">' + fmt(d['date_visite_diagnostiqueur']) + '</div>'
    + '<div style="font-size:10px;color:var(--muted);font-family:var(--mono);margin-top:4px">Valide jusqu&#39;au</div>'
    + '<div style="font-size:12px;font-weight:500;font-family:var(--mono);color:#4ade80">' + fmt(d['date_fin_validite_dpe']) + '</div>'
    + '</div>'
    // Liens externes dans l'entête fiche
    + (function() {
        const _gp = d['_geopoint'] || '';
        let _lat = null, _lon = null;
        if (_gp) { const _p = _gp.split(','); _lat = parseFloat(_p[0]); _lon = parseFloat(_p[1]); }
        const _rnbId = d['id_rnb'] || '';
        // Cadastre : cadastre.gouv.fr ne permet pas toujours un lien direct stable par coordonnées.
        // On utilise Géoportail avec la couche parcellaire cadastrale.
        const _cad  = _lat && _lon ? 'https://www.geoportail.gouv.fr/carte?c=' + _lon + ',' + _lat + '&z=19&l0=CADASTRALPARCELS.PARCELLAIRE_EXPRESS::GEOPORTAIL:OGC:WMTS(1)&l1=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2::GEOPORTAIL:OGC:WMTS(1)&permalink=yes' : '';
        const _maps = _lat && _lon ? 'https://www.google.com/maps/search/?api=1&query=' + _lat + ',' + _lon : '';
        const _sv   = _lat && _lon ? 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + _lat + ',' + _lon : '';
        const _ademe = d['numero_dpe'] ? 'https://observatoire-dpe-audit.ademe.fr/afficher-dpe/' + d['numero_dpe'] : '';
        let links = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)">';
        if (_maps)  links += '<a href="' + _maps  + '" target="_blank" rel="noopener" class="action-link">🗺 Maps</a>';
        if (_sv)    links += '<a href="' + _sv    + '" target="_blank" rel="noopener" class="action-link">👁 Street View</a>';
        if (_ademe) links += '<a href="' + _ademe + '" target="_blank" rel="noopener" class="action-link" style="color:var(--accent2)">🏛 ADEME</a>';
        if (_cad)   links += '<a href="' + _cad   + '" target="_blank" rel="noopener" class="action-link" style="color:#f59e0b">📐 Parcelle IGN/Cadastre</a>';
        if (_rnbId) links += '<span class="action-link" title="ID RNB exposé par ADEME — lien direct désactivé car /batiment/<id> peut renvoyer 404" style="color:#22d3ee;cursor:default">🏗 ID RNB ' + (_rnbId || '') + '</span>';
        links += '</div>';
        return links;
      })()
    + '</div></div>'

    // ── KPIs principaux ──
    + '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px">'
    + metricBox(fmtN(d['conso_5_usages_par_m2_ef']) + ' kWh', 'Conso EF / m²/an', '#22d3ee')
    + metricBox(fmtN(d['conso_5_usages_par_m2_ep']) + ' kWh', 'Conso EP / m²/an', '#a78bfa')
    + metricBox(fmtN(d['emission_ges_5_usages_par_m2']) + ' kg', 'CO₂ / m²/an', '#f87171')
    + metricBox(fmtN(d['surface_habitable_logement']) + ' m²', 'Surface habitable', 'var(--text)')
    + metricBox(fmtN(d['cout_total_5_usages']) + ' €', 'Coût total/an', '#f59e0b')
    + metricBox(fmtN(d['ubat_w_par_m2_k']) + ' W/m²K', 'Ubat', 'var(--muted)')
    + '</div>'
    + '</div>'


    // ── Coûts détaillés ──
    + '<div class="immo-expert-only immo-section" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">'
    + '<div style="background:#3b2a0a;padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7)">💰 Détail des coûts annuels</div>'
    + '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--border)">'
    + ['chauffage|Chauffage|#f59e0b','ecs|Eau chaude|#22d3ee','eclairage|Éclairage|#a78bfa','auxiliaires|Auxiliaires|#6b7280','total_5_usages|Total|#4ade80'].map(s => {
        const [k, label, col] = s.split('|');
        const v = d['cout_' + k];
        return '<div style="background:var(--surface2);padding:16px 14px;text-align:center">'
          + '<div style="font-size:20px;font-weight:700;color:' + col + ';font-family:var(--mono)">' + (v ? fmtN(v) + ' €' : '—') + '</div>'
          + '<div style="font-size:10px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.08em">' + label + '</div>'
          + '</div>';
      }).join('')
    + '</div></div>'

    // ── Consommations détaillées par poste ──
    + '<div class="expert-only expert-section" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">'
    + '<div style="background:#102a3b;padding:8px 14px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.75)">⚡ Détail des consommations par poste</div>'
    + '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:var(--border)">'
    + [
        'chauffage|Chauffage|#f59e0b|conso_chauffage_ef|conso_chauffage_ep',
        'ecs|Eau chaude|#22d3ee|conso_ecs_ef|conso_ecs_ep',
        'eclairage|Éclairage|#a78bfa|conso_eclairage_ef|conso_eclairage_ep',
        'auxiliaires|Auxiliaires|#6b7280|conso_auxiliaires_ef|conso_auxiliaires_ep',
        'refroidissement|Refroid.|#60a5fa|conso_refroidissement_ef|conso_refroidissement_ep',
        'total|Total 5 usages|#4ade80|conso_5_usages_ef|conso_5_usages_ep'
      ].map(s => {
        const parts = s.split('|');
        const poste = parts[0], label = parts[1], col = parts[2], efKey = parts[3], epKey = parts[4];
        const ef = d[efKey];
        const ep = d[epKey];
        const energy = poste === 'total' ? 'Toutes énergies' : energyLabelForPost(poste);
        return '<div style="background:var(--surface2);padding:16px 14px;text-align:center">'
          + '<div style="font-size:18px;font-weight:700;color:' + col + ';font-family:var(--mono)">' + (ef !== null && ef !== undefined && ef !== '' ? fmtN(ef) + ' kWh EF' : '—') + '</div>'
          + '<div style="font-size:12px;color:var(--muted);font-family:var(--mono);margin-top:3px">' + (ep !== null && ep !== undefined && ep !== '' ? fmtN(ep) + ' kWh EP' : '—') + '</div>'
          + '<div style="font-size:10px;color:var(--muted);margin-top:6px;text-transform:uppercase;letter-spacing:.08em">' + label + '</div>'
          + '<div style="font-size:11px;color:var(--accent2);margin-top:5px;font-weight:600;line-height:1.25">' + (energy || 'Énergie non renseignée') + '</div>'
          + '</div>';
      }).join('')
    + '</div>'
    + '<div style="padding:10px 14px;font-size:11px;color:var(--muted);font-family:var(--mono);border-top:1px solid var(--border)">EF = énergie finale consommée · EP = énergie primaire utilisée pour l’étiquette DPE.</div>'
    + '</div>'

    // ── Synthèse par énergie ──
    + renderEnergyByTypeSummary()

    // ── GRILLE 3 colonnes ──
    + '<details open class="expert-only expert-details expert-section" style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden"><summary style="padding:14px 18px;cursor:pointer;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-family:var(--mono)">Détails techniques ADEME</summary><div class="ademe-detail-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px">'

    // Bloc logement
    + block('🏠 Logement', '#1e3a5f', 
        row('Type', d['type_batiment'])
      + row('Période construction', d['periode_construction'])
      + row('Nb niveaux', d['nombre_niveau_logement'])
      + row('Hauteur plafond', d['hauteur_sous_plafond'] ? d['hauteur_sous_plafond'] + ' m' : '')
      + row('Classe inertie', d['classe_inertie_batiment'])
      + row('Zone climatique', d['zone_climatique'])
      + row('Classe altitude', d['classe_altitude'])
      + row('Traversant', d['logement_traversant'] ? 'Oui' : 'Non')
    )

    // Bloc chauffage
    + block('🔥 Chauffage', '#3b1c1c',
        row('Énergie principale', d['type_energie_principale_chauffage'])
      + row('Générateur', d['type_generateur_n1_installation_n1'])
      + row('Configuration', d['configuration_installation_chauffage_n1'])
      + row('Émetteur', d['type_emetteur_installation_chauffage_n1'] ? d['type_emetteur_installation_chauffage_n1'].split(' sur')[0] : '')
      + row('Surface chauffée', d['surface_chauffee_installation_chauffage_n1'] ? d['surface_chauffee_installation_chauffage_n1'] + ' m²' : '')
      + row('Conso EF ch.', d['conso_chauffage_ef'] ? fmtN(d['conso_chauffage_ef']) + ' kWh' : '')
      + row('Coût chauffage', d['cout_chauffage'] ? fmtN(d['cout_chauffage']) + ' €/an' : '')
      + row('Émissions GES ch.', d['emission_ges_chauffage'] ? fmtN(d['emission_ges_chauffage']) + ' kg CO₂' : '')
    )

    // Bloc ECS
    + block('🚿 Eau Chaude Sanitaire', '#1c2e3b',
        row('Énergie ECS', d['type_energie_principale_ecs'])
      + row('Générateur ECS', d['type_generateur_n1_ecs_n1'])
      + row('Configuration', d['configuration_installation_ecs_n1'])
      + row('Type production', d['type_installation_ecs_n1'])
      + row('Conso EF ECS', d['conso_ecs_ef'] ? fmtN(d['conso_ecs_ef']) + ' kWh' : '')
      + row('Coût ECS', d['cout_ecs'] ? fmtN(d['cout_ecs']) + ' €/an' : '')
      + row('Émissions GES ECS', d['emission_ges_ecs'] ? fmtN(d['emission_ges_ecs']) + ' kg CO₂' : '')
      + row('Volume stockage', d['volume_stockage_generateur_n1_ecs_n1'] ? d['volume_stockage_generateur_n1_ecs_n1'] + ' L' : 'N/A')
    )

    // Bloc ventilation & éclairage
    + block('💨 Ventilation & Auxiliaires', '#1c2b1c',
        row('Type ventilation', d['type_ventilation'])
      + row('Post 2012', d['ventilation_posterieure_2012'] ? 'Oui' : 'Non')
      + row('Surface ventilée', d['surface_ventilee'] ? d['surface_ventilee'] + ' m²' : '')
      + row('Conso éclairage EF', d['conso_eclairage_ef'] ? fmtN(d['conso_eclairage_ef']) + ' kWh' : '')
      + row('Conso auxiliaires EF', d['conso_auxiliaires_ef'] ? fmtN(d['conso_auxiliaires_ef']) + ' kWh' : '')
      + row('Coût éclairage', d['cout_eclairage'] ? fmtN(d['cout_eclairage']) + ' €/an' : '')
      + row('Coût auxiliaires', d['cout_auxiliaires'] ? fmtN(d['cout_auxiliaires']) + ' €/an' : '')
      + row('Émissions éclairage', d['emission_ges_eclairage'] ? fmtN(d['emission_ges_eclairage']) + ' kg CO₂' : '')
    )

    // Bloc isolation
    + block('🧱 Isolation & Enveloppe', '#2a1f0a',
        row('Murs', d['qualite_isolation_murs'])
      + row('Menuiseries', d['qualite_isolation_menuiseries'])
      + row('Plancher bas', d['qualite_isolation_plancher_bas'])
      + row('Plancher haut', d['qualite_isolation_plancher_haut_comble_perdu'])
      + row('Enveloppe globale', d['qualite_isolation_enveloppe'])
      + row('Isolation toiture', d['isolation_toiture'] ? 'Oui' : 'Non')
      + row('Brasseur air', d['presence_brasseur_air'] ? 'Oui' : 'Non')
      + row('Protection solaire ext.', d['protection_solaire_exterieure'] ? 'Oui' : 'Non')
    )

    // Bloc déperditions
    + block('📉 Déperditions (%)', '#1f1f2e',
        row('Murs', d['deperditions_murs'] ? d['deperditions_murs'] + ' %' : '')
      + row('Baies vitrées', d['deperditions_baies_vitrees'] ? d['deperditions_baies_vitrees'] + ' %' : '')
      + row('Planchers bas', d['deperditions_planchers_bas'] ? d['deperditions_planchers_bas'] + ' %' : '')
      + row('Planchers hauts', d['deperditions_planchers_hauts'] ? d['deperditions_planchers_hauts'] + ' %' : '')
      + row('Ponts thermiques', d['deperditions_ponts_thermiques'] ? d['deperditions_ponts_thermiques'] + ' %' : '')
      + row('Portes', d['deperditions_portes'] ? d['deperditions_portes'] + ' %' : '')
      + row('Renouvellement air', d['deperditions_renouvellement_air'] ? d['deperditions_renouvellement_air'] + ' %' : '')
      + row('Enveloppe totale', d['deperditions_enveloppe'] ? d['deperditions_enveloppe'] + ' %' : '')
    )

    // Bloc apports & besoins
    + block('☀️ Apports & Besoins', '#1a2a1a',
        row('Besoin chauffage', d['besoin_chauffage'] ? fmtN(d['besoin_chauffage']) + ' kWh' : '')
      + row('Besoin ECS', d['besoin_ecs'] ? fmtN(d['besoin_ecs']) + ' kWh' : '')
      + row('Besoin refroid.', d['besoin_refroidissement'] ? fmtN(d['besoin_refroidissement']) + ' kWh' : '0')
      + row('Apports solaires (chauffe)', d['apport_solaire_saison_chauffe'] ? fmtN(d['apport_solaire_saison_chauffe']) + ' kWh' : '')
      + row('Apports internes (chauffe)', d['apport_interne_saison_chauffe'] ? fmtN(d['apport_interne_saison_chauffe']) + ' kWh' : '')
      + row('Confort été', d['indicateur_confort_ete'])
      + row('Prod. PV (kWhep/an)', d['production_electricite_pv_kwhep_par_an'] ? fmtN(d['production_electricite_pv_kwhep_par_an']) : '0')
      + row('Logement traversant', d['logement_traversant'] ? 'Oui' : 'Non')
    )

    // Bloc émissions totales
    + block('💨 Émissions GES totales', '#1f1515',
        row('Total 5 usages', d['emission_ges_5_usages'] ? fmtN(d['emission_ges_5_usages']) + ' kg CO₂/an' : '')
      + row('Par m²', d['emission_ges_5_usages_par_m2'] ? fmtN(d['emission_ges_5_usages_par_m2']) + ' kg/m²/an' : '')
      + row('Chauffage', d['emission_ges_chauffage'] ? fmtN(d['emission_ges_chauffage']) + ' kg' : '')
      + row('ECS', d['emission_ges_ecs'] ? fmtN(d['emission_ges_ecs']) + ' kg' : '')
      + row('Éclairage', d['emission_ges_eclairage'] ? fmtN(d['emission_ges_eclairage']) + ' kg' : '')
      + row('Auxiliaires', d['emission_ges_auxiliaires'] ? fmtN(d['emission_ges_auxiliaires']) + ' kg' : '')
      + row('Refroid.', d['emission_ges_refroidissement'] ? fmtN(d['emission_ges_refroidissement']) + ' kg' : '0')
      + row('Énergie n1', d['type_energie_n1'] || '')
    )

    + '</div></details>'  // fin détails techniques

    + '<div class="expert-only">' + renderDpeNeighborhoodComparison(d._neighborhoodComparison) + '</div>'

    // ── JSON brut : déplacé tout en bas et fermé par défaut ──
    + '<details class="expert-only expert-details" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">'
    + '<summary style="padding:10px 16px;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;cursor:pointer;font-family:var(--mono)">JSON brut · ' + Object.keys(d).length + ' champs</summary>'
    + '<div class="raw" style="margin:0;border-radius:0;border:none;border-top:1px solid var(--border)">' + colorizeJson(JSON.stringify(d, null, 2)) + '</div>'
    + '</details>'
    + '</div>';
}

window.renderDpeCard = renderDpeCard;
