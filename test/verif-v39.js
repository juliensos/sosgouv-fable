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

  console.log('\n=== Placement des modaux dans le DOM (v36, revu en v43) ===');
  const pms = [...doc.querySelectorAll('.pm-parent')];
  const bms = [...doc.querySelectorAll('.bm-parent')];
  test('Des modaux existent dans la page (' + (pms.length + bms.length) + ')', pms.length + bms.length >= 10);
  test('Tous les pm-parent (calques fixes) sont enfants directs de <body>',
    pms.every(m => m.parentElement === doc.body));
  const fond = doc.getElementById('fondModal');
  test('#fondModal est enfant direct de <body>', fond && fond.parentElement === doc.body);
  test('Tous les bm-parent (panneaux) restent DANS ._3-cont-body',
    bms.length > 0 && bms.every(m => m.closest('._3-cont-body')));
  test('Aucun pm ne reste dans ._3-cont-body', !doc.querySelector('._3-cont-body .pm-parent'));

  console.log('\n=== V38/V39 : mécanique des modaux autonome (CSS) ===');
  const regleSeule = (sel) => regles.find(r => r.substring(0, r.indexOf('{')).trim() === sel);
  const pmRule = regleSeule('.pm-parent');
  const bmRule = regleSeule('.bm-parent');
  test('Règles séparées .pm-parent et .bm-parent présentes', !!pmRule && !!bmRule);
  test('pm : position fixed !important, plein écran', pmRule
    && /position\s*:\s*fixed\s*!important/.test(pmRule) && /inset\s*:\s*0\s*!important/.test(pmRule));
  test('pm : boîte centrée (justify-content center !important)',
    pmRule && /justify-content\s*:\s*center\s*!important/.test(pmRule));
  test('pm : voile noir 70 % comme le fond-modal maquette (background !important)',
    pmRule && /background\s*:\s*rgba\(0,\s*0,\s*0,\s*0?\.7\)\s*!important/.test(pmRule));
  test('pm : boîte centrée verticalement (align-items center !important)',
    pmRule && /align-items\s*:\s*center\s*!important/.test(pmRule));
  test('bm : PANNEAU dans la page (position relative !important, pas fixed)',
    bmRule && /position\s*:\s*relative\s*!important/.test(bmRule) && !/fixed/.test(bmRule));
  test('bm : remplit la case de contenu (width et height 100 % !important)',
    bmRule && /width\s*:\s*100%\s*!important/.test(bmRule) && /height\s*:\s*100%\s*!important/.test(bmRule));
  test('bm : fond blanc, défilement interne (overflow auto !important)',
    bmRule && /background\s*:\s*var\(--sos-white,\s*#fff\)/.test(bmRule) && /overflow\s*:\s*auto\s*!important/.test(bmRule));
  const zPm = pmRule && pmRule.match(/z-index\s*:\s*(\d+)\s*!important/);
  test('pm : z-index !important au-dessus du header/footer/admin (≥ 4000)',
    zPm && Number(zPm[1]) >= 4000);
  test('Fond intégré des pm neutralisé (le conteneur porte le voile)',
    /\.pm-parent \._3-fond-modal\s*\{\s*display\s*:\s*none\s*!important/.test(cssSansComm));
  test('Le fond intégré des bm reste neutralisé (v23)',
    /\.bm-parent \._3-fond-modal\s*\{\s*display\s*:\s*none\s*!important/.test(css));
  const boite = regle('.cont-flex-50-50').find(r => r.includes('display: block !important'));
  test('Boîte : bloc simple centré (display block + margin auto !important)',
    !!boite && /margin\s*:\s*0 auto\s*!important/.test(boite));
  const largeurBm = regleSeule('.bm-parent .cont-flex-50-50');
  test('bm : la boîte remplit le panneau (100 %, le 500px maquette neutralisé)',
    largeurBm && /width\s*:\s*100%\s*!important/.test(largeurBm)
    && /max-width\s*:\s*none\s*!important/.test(largeurBm)
    && /height\s*:\s*100%\s*!important/.test(largeurBm));
  const strokeBm = regleSeule('.bm-parent ._3-big-modal-stroke');
  test('bm : le panneau défile à l\'intérieur (height 100 %, max-height none)',
    strokeBm && /height\s*:\s*100%\s*!important/.test(strokeBm) && /max-height\s*:\s*none\s*!important/.test(strokeBm));
  const croixPm = regleSeule('.pm-parent ._3-close-bouton');
  test('pm : croix collée au coin haut-droit de la boîte (top 0, right 0 !important)',
    croixPm && /top\s*:\s*0\s*!important/.test(croixPm) && /right\s*:\s*0\s*!important/.test(croixPm)
    && /left\s*:\s*auto\s*!important/.test(croixPm));
  test('pm : croix sur carré noir, sans contour (background noir, border none !important)',
    croixPm && /background\s*:\s*var\(--black-100,\s*#000\)\s*!important/.test(croixPm) && /border\s*:\s*none\s*!important/.test(croixPm));
  test('pm : croix blanche', /\.pm-parent \._3-close-bouton \.croix[^{]*\{[^}]*color\s*:\s*#fff\s*!important/.test(cssSansComm));
  const croixBm = regleSeule('.bm-parent ._3-close-bouton');
  test('bm : croix en haut à GAUCHE (top 0, left 0, right auto !important)',
    croixBm && /top\s*:\s*0\s*!important/.test(croixBm) && /left\s*:\s*0\s*!important/.test(croixBm)
    && /right\s*:\s*auto\s*!important/.test(croixBm));
  test('pm : pas de défilement horizontal (overflow-x hidden !important)',
    /\.pm-parent \._3-small-modal-stroke\s*\{\s*overflow-x\s*:\s*hidden\s*!important/.test(cssSansComm));
  const grille = regle('.grid-collection-list').find(r => r.includes('grid-template-columns'));
  test('Grilles de cases : colonnes souples minmax(0, 1fr), 2 colonnes max',
    grille && /repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(grille));
  console.log('\n=== V44 : onze modifications ===');
  test('Onglet actif stylé via .active, couleur rose maquette (fiable Safari)',
    /\._2-menu-bouton\.active\s*\{[^}]*background-color\s*:\s*var\(--sos-rose1/.test(cssSansComm));
  test('Bloc gouvernement : contour 3px et cotes maquette',
    /\.gov-compact-bloc\s*\{[^}]*border\s*:\s*3px solid/.test(cssSansComm));
  test('Conteneur des gouvernements sans retrait (padding/margin 0 !important)',
    /#section-1 \._3-gov-content\s*\{[^}]*padding\s*:\s*0\s*!important/.test(cssSansComm));
  test('Composer : trait vertical porté par les groupes, plus par le conteneur',
    /\.compo-groupe\s*\{[^}]*border-left\s*:\s*3px solid/.test(cssSansComm)
    && /_3-bloc-minsteres\s*\{\s*border-left\s*:\s*none\s*!important/.test(cssSansComm));
  test('Séparateur « Ministères par défaut » centré',
    /\.compo-sep\s*\{[^}]*text-align\s*:\s*center/.test(cssSansComm));
  test('Infobulles stylées (#sos-bulle) définies',
    /#sos-bulle\s*\{[^}]*position\s*:\s*fixed/.test(cssSansComm) && !!doc.getElementById('sos-bulle'));
  test('Menu de choix du brouillon stylé (#brouillon-pop)',
    /#brouillon-pop\s*\{[^}]*position\s*:\s*fixed/.test(cssSansComm));
  test('Champ de recherche des sous-secteurs présent avec la phrase demandée',
    html.includes('id="ssRecherche"')
    && html.includes('ou cherchez dans le champ de texte ci-dessous'));
  const etiquettes = doc.querySelectorAll('#modal-infos .champ-etiquette');
  test('Étiquettes flottantes injectées sur les 5 champs des données personnelles', etiquettes.length === 5);
  const champU = doc.getElementById('diUsername');
  champU.value = 'neville';
  champU.dispatchEvent(new window.Event('input', { bubbles: true }));
  test('Étiquette visible dès que le champ est rempli',
    champU.previousElementSibling.classList.contains('visible'));
  champU.value = '';
  champU.dispatchEvent(new window.Event('input', { bubbles: true }));
  test('Étiquette masquée quand le champ est vide',
    !champU.previousElementSibling.classList.contains('visible'));
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
  test('Grand modal (bm) ouvert en block (panneau dans la page)', bm.style.display === 'block');
  UI.closeModals();
  test('closeModals referme le bm', bm.style.display === 'none');

  // Clic sur le voile sombre d'un pm (le conteneur lui-même) : ferme
  UI.openModal('modal-add-perso');
  pm.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  test('Clic sur le voile sombre : pm refermé', pm.style.display === 'none');
  // Clic à l'intérieur de la boîte : ne ferme pas
  UI.openModal('modal-add-perso');
  pm.querySelector('._3-small-modal-stroke').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  test('Clic dans la boîte : pm toujours ouvert', pm.style.display === 'flex');
  UI.closeModals();

  console.log('\n=== Navigation sections ===');
  UI.showSection(3);
  test('Section 3 affichée', doc.getElementById('section-3').style.display === 'block');
  test('Section 0 masquée', doc.getElementById('section-0').style.display === 'none');
  UI.showSection(0);


  console.log('\n=== V46 : maquette 644157cc6, footer, fiche, agent ===');
  test('index.html : CSS Webflow republié (hash 644157cc6)',
    html.includes('sosgouv.webflow.shared.644157cc6.css'));
  test('Header : logo REZEDA et nouvelle signature',
    /logofont">REZEDA</.test(html) && html.includes('Composez votre gouvernement idéal'));
  const btnAjout = doc.querySelector('[data-section="3"]');
  const btnListe = doc.querySelector('[data-section="4"]');
  test('Menu : « ajouter une personnalité » en bouton picto (personne + plus) avec infobulle',
    !!btnAjout && btnAjout.classList.contains('_2-mini-bouton')
    && btnAjout.classList.contains('people') && btnAjout.classList.contains('menu')
    && btnAjout.textContent.includes('') && btnAjout.textContent.includes('')
    && (btnAjout.getAttribute('data-bulle') || '').includes('ajouter'));
  test('Menu : « liste des personnalités » en bouton picto (groupe) avec infobulle',
    !!btnListe && btnListe.classList.contains('_2-mini-bouton')
    && btnListe.textContent.includes('')
    && (btnListe.getAttribute('data-bulle') || '').includes('liste'));
  test('Onglet actif des boutons picto stylé comme les onglets texte',
    /\._2-mini-bouton\.people\.menu\.active\s*\{[^}]*background-color\s*:\s*var\(--sos-rose1/.test(cssSansComm));
  const foot338 = doc.querySelector('.div-block-338');
  test('Footer : bloc div-block-338 avec Guide utilisateur / Faq / Médias (linkblack)',
    !!foot338 && !!doc.getElementById('openGuide') && !!doc.getElementById('openFaq')
    && !!doc.getElementById('openMedias')
    && foot338.querySelectorAll('a.linkblack').length === 3);
  const lienAgent = doc.querySelector('#adminFooter a[href*="agent-enrichissement.yml"]');
  test('Footer admin : lien « lancer l\'agent IA » vers le workflow GitHub (nouvel onglet)',
    !!lienAgent && lienAgent.getAttribute('target') === '_blank');
  const faqModal = doc.getElementById('modal-faq');
  test('Modal FAQ : bm-parent avec formulaire de question et accordéon',
    !!faqModal && faqModal.classList.contains('bm-parent')
    && !!doc.getElementById('faqQuestion') && !!doc.getElementById('faqEnvoyer')
    && faqModal.querySelectorAll('.q-r-bloc').length >= 3);
  const mediasModal = doc.getElementById('modal-medias');
  test('Modal Médias : bm-parent avec grille bloc-video',
    !!mediasModal && mediasModal.classList.contains('bm-parent')
    && !!doc.getElementById('medias-contenu')
    && doc.getElementById('medias-contenu').classList.contains('bloc-video'));
  const gu = doc.getElementById('modal-gu');
  const guTitres = gu ? [...gu.querySelectorAll('.titre-para-gu h5')].map(h => h.textContent) : [];
  test('Guide : 5 sections dans l\'ordre demandé',
    guTitres.length === 5
    && /Composer un gouvernement/.test(guTitres[0]) && /Gouvernements publiés/.test(guTitres[1])
    && /Ajouter une personnalité/.test(guTitres[2]) && /Liste des personnalités/.test(guTitres[3])
    && /Mon activité/.test(guTitres[4]));
  test('Guide : chaque fonctionnalité listée avec son picto/lien (gu-ligne + gu-icone)',
    gu && gu.querySelectorAll('.gu-ligne').length >= 20
    && gu.querySelectorAll('.gu-icone').length === gu.querySelectorAll('.gu-ligne').length);
  test('Gouvernement détail : noms et prénoms forcés en majuscules',
    /\.nom-prenom-gov-detail\s*\{\s*text-transform\s*:\s*uppercase/.test(cssSansComm));
  test('Fiche : la photo remplit le carré .image-fiche',
    /\.image-fiche img\s*\{[^}]*object-fit\s*:\s*cover/.test(cssSansComm));
  test('Champ photo dans l\'édition admin (admPhoto)',
    !!doc.getElementById('admPhoto'));
  const uiSrc = fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8');
  test('Bouton compte : « connexion » par défaut quand personne n\'est connecté',
    /:\s*'connexion'/.test(uiSrc));
  test('Page médias : agrégation des vidéos de toutes les fiches (UI.loadMedias)',
    /async loadMedias\(\)/.test(uiSrc) && /medias-contenu/.test(uiSrc));
  test('Validation d\'une proposition IA : photo et sources appliquées à la fiche',
    /champs\.photo_url\s*=\s*photo/.test(uiSrc) && /champs\.sources\s*=\s*prop\.sources/.test(uiSrc));
  const persoSrc = fs.readFileSync(path.join(ROOT, 'js/personnalites.js'), 'utf8');
  test('Fiche : mise en page maquette (blocbio, image-fiche, div-block-340, sources)',
    /blocbio/.test(persoSrc) && /image-fiche/.test(persoSrc)
    && /div-block-340/.test(persoSrc) && /etienneneville@gmail\.com/.test(persoSrc));
  test('Fiche : postes proposés au format maquette (bloc-proposition)',
    /bloc-proposition/.test(persoSrc));
  const agentSrc = fs.readFileSync(path.join(ROOT, 'tools/agent-enrichissement.js'), 'utf8');
  test('Agent : photo_url demandé, règles de licence, et déposé dans la proposition',
    /"photo_url"/.test(agentSrc) && /Wikimedia Commons/.test(agentSrc)
    && /photo_url:\s*proposition\.photo_url/.test(agentSrc));
  const consignes = fs.readFileSync(path.join(ROOT, 'tools/consignes-agent.txt'), 'utf8');
  test('Consignes de l\'agent : photo et sources documentées',
    /photo_url/.test(consignes) && /[Ss]ources/.test(consignes));
  const patch = fs.readFileSync(path.join(ROOT, 'sql/patch-v46-photo-sources.sql'), 'utf8');
  test('Patch SQL v46 idempotent (sources + photo_url des propositions)',
    /ADD COLUMN IF NOT EXISTS sources/.test(patch)
    && /personnalites_propositions_ia\s*[\s\S]*photo_url/.test(patch));

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
