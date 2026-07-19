// ============================================================
// SOSGOUV - Vérification ciblée v39
// Verrouille : la sortie des modaux de la zone rognée (v36), les
// conflits CSS résolus en v37, la mécanique de modaux autonome du
// CSS Webflow (v38) et les deux mises en page distinctes de la v39 :
// pm = boîte centrée sur voile noir 45 %, croix blanche sur le voile ;
// bm = panneau pleine hauteur sous le header, fond blanc, croix à
// gauche, large comme le contenu principal.
// ============================================================
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css/sosgouv.css'), 'utf8');

let ok = 0, ko = 0;
function test(nom, cond) {
  if (cond) { ok++; console.log('  ✅ ' + nom); }
  else { ko++; console.log('  ❌ ' + nom); }
}

// Stub Supabase chainable : toute chaîne .from().select()... aboutit
// à une promesse { data: [], error: null }
function chain() {
  const p = Promise.resolve({ data: [], error: null });
  return new Proxy(function () {}, {
    get(_, prop) {
      if (prop === 'then') return p.then.bind(p);
      if (prop === 'catch') return p.catch.bind(p);
      if (prop === 'finally') return p.finally.bind(p);
      return chain();
    },
    apply() { return chain(); }
  });
}

async function main() {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://sosgouv.test/' });
  const { window } = dom;
  window.confirm = () => true;
  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  global.location = window.location;
  global.navigator = window.navigator;

  const mock = chain();
  window.sb = mock;
  global.sb = mock;

  const load = (f) => window.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  load('js/auth.js');
  load('js/ui.js');
  load('js/personnalites.js');
  load('js/gouvernement.js');
  window.sb = mock;
  window.eval('sb = window.sb;');
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  await new Promise(r => setTimeout(r, 50));

  const { UI } = window;
  const doc = window.document;
  const cssSansComm = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regles = (cssSansComm.match(/[^{}]+\{[^}]*\}/g) || []);
  const regle = (motif) => regles.filter(r => r.includes(motif));

  console.log('\n=== V36 : sortie des modaux de la zone rognée ===');
  const modaux = [...doc.querySelectorAll('.pm-parent, .bm-parent')];
  test('Des modaux existent dans la page (' + modaux.length + ')', modaux.length >= 10);
  test('Tous les pm/bm-parent sont enfants directs de <body>',
    modaux.every(m => m.parentElement === doc.body));
  const fond = doc.getElementById('fondModal');
  test('#fondModal est enfant direct de <body>', fond && fond.parentElement === doc.body);
  test('Aucun modal ne reste dans ._3-cont-body',
    !doc.querySelector('._3-cont-body .pm-parent, ._3-cont-body .bm-parent'));

  console.log('\n=== V38/V39 : mécanique des modaux autonome (CSS) ===');
  const regleSeule = (sel) => regles.find(r => r.substring(0, r.indexOf('{')).trim() === sel);
  const pmRule = regleSeule('.pm-parent');
  const bmRule = regleSeule('.bm-parent');
  test('Règles séparées .pm-parent et .bm-parent présentes', !!pmRule && !!bmRule);
  test('pm : position fixed !important, plein écran', pmRule
    && /position\s*:\s*fixed\s*!important/.test(pmRule) && /inset\s*:\s*0\s*!important/.test(pmRule));
  test('pm : boîte centrée (justify-content center !important)',
    pmRule && /justify-content\s*:\s*center\s*!important/.test(pmRule));
  test('pm : voile noir 45 % porté par le conteneur (background !important)',
    pmRule && /background\s*:\s*rgba\(0,\s*0,\s*0,\s*0?\.45\)\s*!important/.test(pmRule));
  test('bm : position fixed !important', bmRule && /position\s*:\s*fixed\s*!important/.test(bmRule));
  test('bm : calé sous le header (top: var(--sos-header-h) !important)',
    bmRule && /top\s*:\s*var\(--sos-header-h[^)]*\)\s*!important/.test(bmRule));
  test('bm : descend jusqu\'en bas (bottom 0 !important)', bmRule && /bottom\s*:\s*0\s*!important/.test(bmRule));
  test('bm : fond BLANC sans voile (background !important)',
    bmRule && /background\s*:\s*var\(--sos-white,\s*#fff\)\s*!important/.test(bmRule));
  test('bm : panneau pleine hauteur (align-items stretch !important)',
    bmRule && /align-items\s*:\s*stretch\s*!important/.test(bmRule));
  const zPm = pmRule && pmRule.match(/z-index\s*:\s*(\d+)\s*!important/);
  const zBm = bmRule && bmRule.match(/z-index\s*:\s*(\d+)\s*!important/);
  test('pm et bm : z-index !important au-dessus du header/footer/admin (≥ 4000)',
    zPm && zBm && Number(zPm[1]) >= 4000 && Number(zBm[1]) >= 4000);
  test('Fond intégré des pm neutralisé (le conteneur porte le voile)',
    /\.pm-parent \._3-fond-modal\s*\{\s*display\s*:\s*none\s*!important/.test(cssSansComm));
  test('Le fond intégré des bm reste neutralisé (v23)',
    /\.bm-parent \._3-fond-modal\s*\{\s*display\s*:\s*none\s*!important/.test(css));
  const boite = regle('.cont-flex-50-50').find(r => r.includes('display: block !important'));
  test('Boîte : bloc simple centré (display block + margin auto !important)',
    !!boite && /margin\s*:\s*0 auto\s*!important/.test(boite));
  const largeurBm = regleSeule('.bm-parent .cont-flex-50-50');
  test('bm : large comme le contenu principal (width var(--sos-content-w) !important)',
    largeurBm && /width\s*:\s*min\(var\(--sos-content-w[^)]*\)[^)]*\)\s*!important/.test(largeurBm)
    && /height\s*:\s*100%\s*!important/.test(largeurBm));
  const strokeBm = regleSeule('.bm-parent ._3-big-modal-stroke');
  test('bm : le panneau défile à l\'intérieur (height 100 %, max-height none)',
    strokeBm && /height\s*:\s*100%\s*!important/.test(strokeBm) && /max-height\s*:\s*none\s*!important/.test(strokeBm));
  const croixPm = regleSeule('.pm-parent ._3-close-bouton');
  test('pm : croix sur le voile, au-dessus du coin droit (top négatif, right 0 !important)',
    croixPm && /top\s*:\s*-\d+px\s*!important/.test(croixPm) && /right\s*:\s*0\s*!important/.test(croixPm)
    && /left\s*:\s*auto\s*!important/.test(croixPm));
  test('pm : croix sans cadre (background transparent, border none !important)',
    croixPm && /background\s*:\s*transparent\s*!important/.test(croixPm) && /border\s*:\s*none\s*!important/.test(croixPm));
  test('pm : croix blanche', /\.pm-parent \._3-close-bouton \.croix[^{]*\{[^}]*color\s*:\s*#fff\s*!important/.test(cssSansComm));
  const croixBm = regleSeule('.bm-parent ._3-close-bouton');
  test('bm : croix en haut à GAUCHE (top 0, left 0, right auto !important)',
    croixBm && /top\s*:\s*0\s*!important/.test(croixBm) && /left\s*:\s*0\s*!important/.test(croixBm)
    && /right\s*:\s*auto\s*!important/.test(croixBm));
  const toast = regle('#sosgouv-toast')[0];
  const zToast = toast && toast.match(/z-index\s*:\s*(\d+)/);
  test('Toast au-dessus des modaux', zToast && zPm && Number(zToast[1]) > Number(zPm[1]));

  console.log('\n=== Ouverture / fermeture des modaux ===');
  UI.openModal('modal-add-perso');
  const pm = doc.getElementById('modal-add-perso');
  test('Petit modal (pm) ouvert en flex', pm.style.display === 'flex');
  UI.closeModals();
  test('closeModals referme le pm', pm.style.display === 'none');

  UI.openModal('modal-infos');
  const bm = doc.getElementById('modal-infos');
  test('Grand modal (bm) ouvert en flex', bm.style.display === 'flex');
  test('Variable --sos-header-h posée à l\'ouverture (mesure du header)',
    /px$/.test(doc.documentElement.style.getPropertyValue('--sos-header-h')));
  UI.closeModals();
  test('closeModals referme le bm', bm.style.display === 'none');

  // Clic sur le voile sombre (le conteneur lui-même) : ferme le modal
  UI.openModal('modal-infos');
  bm.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  test('Clic sur le voile sombre : modal refermé', bm.style.display === 'none');
  // Clic à l'intérieur de la boîte : ne ferme pas
  UI.openModal('modal-infos');
  bm.querySelector('._3-big-modal-stroke').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  test('Clic dans la boîte blanche : modal toujours ouvert', bm.style.display === 'flex');
  UI.closeModals();

  console.log('\n=== Navigation sections ===');
  UI.showSection(3);
  test('Section 3 affichée', doc.getElementById('section-3').style.display === 'block');
  test('Section 0 masquée', doc.getElementById('section-0').style.display === 'none');
  UI.showSection(0);

  console.log('\n=== V37 : conflits CSS avec la maquette Webflow ===');
  const strokeRule = cssSansComm.match(/\._3-small-modal-stroke[^{]*\{[^}]*\}/g) || [];
  test('Plus aucun padding forcé sur ._3-small/big-modal-stroke',
    strokeRule.length > 0 && strokeRule.every(r => !/padding\s*:/.test(r)));
  const petitRules = regles.filter(r => r.includes('_3-petit-modal-content'));
  test('Plus de display forcé sur ._3-petit-modal-content (flex maquette respecté)',
    petitRules.length > 0 && petitRules.every(r => !/display\s*:/.test(r)));
  test('Opacité toujours garantie sur ._3-petit-modal-content dans les popups',
    petitRules.some(r => r.includes('.pm-parent') && /opacity\s*:\s*1\s*!important/.test(r)));
  test('Les strokes gardent leur garantie de visibilité (display + opacité)',
    /\.pm-parent \._3-small-modal-stroke[^{]*\{[^}]*display\s*:\s*block\s*!important/.test(css));

  console.log('\n=== Cache-busting ===');
  const versions = [...new Set(html.match(/\?v(\d+)/g) || [])];
  test('index.html : une seule version référencée partout (6 fois, ≥ v40)',
    versions.length === 1 && (html.match(/\?v\d+/g) || []).length === 6
    && Number(versions[0].slice(2)) >= 40);

  console.log('\n' + ok + ' OK, ' + ko + ' KO');
  process.exit(ko ? 1 : 0);
}

main().catch(e => { console.error('ERREUR FATALE:', e); process.exit(1); });
