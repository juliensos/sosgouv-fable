// ============================================================
// SOSGOUV - Vérification ciblée v38
// Verrouille : la sortie des modaux de la zone rognée (v36), les
// conflits CSS résolus en v37, et surtout la mécanique de modaux
// entièrement autonome de la v38 (centrage, voile sombre, croix,
// empilement), indépendante du CSS Webflow resynchronisé chaque
// nuit par l'action GitHub.
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

  console.log('\n=== V38 : mécanique des modaux autonome (CSS) ===');
  const overlay = regle('.pm-parent, .bm-parent')
    .find(r => r.trim().startsWith('.pm-parent, .bm-parent'));
  test('Règle unique .pm-parent, .bm-parent présente', !!overlay);
  test('Overlay : position fixed !important', overlay && /position\s*:\s*fixed\s*!important/.test(overlay));
  test('Overlay : inset 0 !important (plein écran)', overlay && /inset\s*:\s*0\s*!important/.test(overlay));
  test('Overlay : centrage forcé (justify-content center !important)',
    overlay && /justify-content\s*:\s*center\s*!important/.test(overlay));
  test('Overlay : voile sombre porté par le conteneur (background !important)',
    overlay && /background\s*:\s*rgba\(0,\s*0,\s*0,\s*0?\.45\)\s*!important/.test(overlay));
  const zOverlay = overlay && overlay.match(/z-index\s*:\s*(\d+)\s*!important/);
  test('Overlay : z-index !important au-dessus du header/footer/admin (≥ 4000)',
    zOverlay && Number(zOverlay[1]) >= 4000);
  test('Fond intégré des pm neutralisé (le conteneur porte le voile)',
    /\.pm-parent \._3-fond-modal\s*\{\s*display\s*:\s*none\s*!important/.test(cssSansComm));
  test('Le fond intégré des bm reste neutralisé (v23)',
    /\.bm-parent \._3-fond-modal\s*\{\s*display\s*:\s*none\s*!important/.test(css));
  const boite = regle('.cont-flex-50-50').find(r => r.includes('display: block !important'));
  test('Boîte blanche : bloc simple centré (display block + margin auto !important)',
    !!boite && /margin\s*:\s*0 auto\s*!important/.test(boite));
  const croix = regle('._3-close-bouton').find(r => r.includes('.pm-parent') && r.includes('.bm-parent'));
  test('Croix de fermeture : règle locale présente (plus dépendante de la maquette)', !!croix);
  test('Croix : en haut à droite, forcé (top/right 0, left auto !important)',
    croix && /top\s*:\s*0\s*!important/.test(croix) && /right\s*:\s*0\s*!important/.test(croix)
    && /left\s*:\s*auto\s*!important/.test(croix));
  const toast = regle('#sosgouv-toast')[0];
  const zToast = toast && toast.match(/z-index\s*:\s*(\d+)/);
  test('Toast au-dessus des modaux', zToast && zOverlay && Number(zToast[1]) > Number(zOverlay[1]));

  console.log('\n=== Ouverture / fermeture des modaux ===');
  UI.openModal('modal-add-perso');
  const pm = doc.getElementById('modal-add-perso');
  test('Petit modal (pm) ouvert en flex', pm.style.display === 'flex');
  UI.closeModals();
  test('closeModals referme le pm', pm.style.display === 'none');

  UI.openModal('modal-infos');
  const bm = doc.getElementById('modal-infos');
  test('Grand modal (bm) ouvert en flex', bm.style.display === 'flex');
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
  test('index.html référence partout ?v38',
    (html.match(/\?v38/g) || []).length === 6 && !/\?v3[67]/.test(html));

  console.log('\n' + ok + ' OK, ' + ko + ' KO');
  process.exit(ko ? 1 : 0);
}

main().catch(e => { console.error('ERREUR FATALE:', e); process.exit(1); });
