
// DPE Explorer — configuration globale centralisée
(function () {
  'use strict';

  window.DPE_CONFIG = {
    ADEME_BASE: 'https://data.ademe.fr/data-fair/api/v1/datasets',
    DATASETS: {
      DPE: 'dpe03existant',
      AUDIT: 'audit-opendata'
    },
    PROXY_BASE: 'https://dpe-proxy.lioneltissotbez.workers.dev',
    BAN_API: 'https://api-adresse.data.gouv.fr/search/',
    DEBUG: true
  };

  window.DPE_CONFIG.ADEME_DPE_LINES =
    window.DPE_CONFIG.ADEME_BASE + '/' + window.DPE_CONFIG.DATASETS.DPE + '/lines';

  window.DPE_CONFIG.ADEME_AUDIT_LINES =
    window.DPE_CONFIG.ADEME_BASE + '/' + window.DPE_CONFIG.DATASETS.AUDIT + '/lines';

  window.DPE_CONFIG.PROXY_CONFIGURED =
    window.DPE_CONFIG.PROXY_BASE && window.DPE_CONFIG.PROXY_BASE !== 'REMPLACER_PAR_URL_WORKER';
})();
