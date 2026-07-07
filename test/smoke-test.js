// ============================================================
// SOSGOUV - Test fonctionnel (jsdom + mock Supabase en mémoire)
// Simule : inscription, connexion, ajout personnalité, likes,
// épingles, composition + publication gouvernement, vote,
// commentaires, filtres, admin.
// ============================================================
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---------- Mock Supabase ----------
function makeMockSupabase() {
  const db = {
    users: [], personnalites: [], secteurs: [], sous_secteurs: [],
    secteurs_sous_secteurs_defaut: [], gouvernements: [], postes_gouvernement: [],
    postes_sous_secteurs: [], personnalites_likes: [], personnalites_epingles: [],
    gouvernements_votes: [], gouvernements_epingles: [], commentaires: [],
    commentaires_likes: [], messages: [], gouvernements_stats: []
  };
  let seq = 0;
  const uuid = () => 'uuid-' + (++seq);

  // Données de référence (comme schema.sql)
  const regs = ['Matignon', 'Intérieur', 'Justice', 'Défense', 'Affaires étrangères', 'Économie et Finances'];
  regs.forEach((nom, i) => db.secteurs.push({ id: uuid(), nom, intitule_poste_defaut: 'Ministre ' + nom, type: 'regalien', ordre: i + 1 }));
  ['Culture', 'Santé'].forEach((nom, i) => db.secteurs.push({ id: uuid(), nom, intitule_poste_defaut: 'Ministre ' + nom, type: 'non_regalien', ordre: 10 + i }));
  const ss1 = { id: uuid(), nom: 'Cyberdéfense' };
  db.sous_secteurs.push(ss1);
  db.secteurs_sous_secteurs_defaut.push({ secteur_id: db.secteurs[3].id, sous_secteur_id: ss1.id });

  function computeStats() {
    db.gouvernements_stats = db.gouvernements.map(g => {
      const votes = db.gouvernements_votes.filter(v => v.gouvernement_id === g.id);
      return {
        id: g.id, titre: g.titre,
        nb_votes: votes.length,
        note_moyenne: votes.length ? Math.round(votes.reduce((a, v) => a + v.note, 0) / votes.length * 10) / 10 : null,
        nb_commentaires: db.commentaires.filter(c => c.gouvernement_id === g.id).length
      };
    });
  }

  function resolveJoins(table, row, joins) {
    const out = { ...row };
    for (const j of joins) {
      if (j === 'users(username)' && table === 'gouvernements') {
        const u = db.users.find(u => u.id === row.created_by);
        out.users = u ? { username: u.username } : null;
      }
      if (j === 'users(username)' && table === 'commentaires') {
        const u = db.users.find(u => u.id === row.user_id);
        out.users = u ? { username: u.username } : null;
      }
      if (j.startsWith('postes_gouvernement(')) {
        out.postes_gouvernement = db.postes_gouvernement
          .filter(p => p.gouvernement_id === row.id)
          .map(p => ({
            ...p,
            personnalites: p.personnalite_id ? (() => { const x = db.personnalites.find(z => z.id === p.personnalite_id); return x ? { id: x.id, nom: x.nom, prenom: x.prenom } : null; })() : null,
            secteurs: p.secteur_id ? (() => { const s = db.secteurs.find(z => z.id === p.secteur_id); return s ? { nom: s.nom } : null; })() : null
          }));
      }
    }
    return out;
  }

  function from(table) {
    const state = { table, filters: [], orFilter: null, order: null, limit: null };
    const runSelect = (columns) => {
      computeStats();
      let rows = (db[table] || []).slice();
      for (const f of state.filters) rows = rows.filter(r => r[f.col] === f.val);
      if (state.orFilter) {
        const parts = state.orFilter.split(',').map(p => {
          const m = p.match(/^(\w+)\.ilike\.%(.*)%$/);
          return m ? { col: m[1], q: m[2].toLowerCase() } : null;
        }).filter(Boolean);
        rows = rows.filter(r => parts.some(p => String(r[p.col] || '').toLowerCase().includes(p.q)));
      }
      if (state.order) rows.sort((a, b) => {
        const va = a[state.order.col], vb = b[state.order.col];
        const cmp = String(va).localeCompare(String(vb));
        return state.order.asc ? cmp : -cmp;
      });
      if (state.limit) rows = rows.slice(0, state.limit);
      const joins = (columns || '*').split(',').map(s => s.trim()).filter(s => s.includes('('));
      if (joins.length) rows = rows.map(r => resolveJoins(table, r, joins));
      return rows;
    };

    const builder = {
      _columns: '*',
      select(cols) { this._columns = cols || '*'; this._isSelect = true; return this; },
      eq(col, val) { state.filters.push({ col, val }); return this; },
      or(f) { state.orFilter = f; return this; },
      order(col, opts) { state.order = { col, asc: !opts || opts.ascending !== false }; return this; },
      limit(n) { state.limit = n; return this; },
      maybeSingle() {
        const rows = runSelect(this._columns);
        return Promise.resolve({ data: rows[0] || null, error: null });
      },
      single() {
        const rows = this._pending || runSelect(this._columns);
        return Promise.resolve({ data: rows[0] || null, error: rows.length ? null : { message: 'no rows' } });
      },
      insert(payload) {
        const arr = Array.isArray(payload) ? payload : [payload];
        const inserted = arr.map(p => {
          const row = { id: uuid(), created_at: new Date().toISOString(), ...p };
          db[table].push(row);
          return row;
        });
        this._pending = inserted;
        const self = this;
        return {
          select() { return { single: () => Promise.resolve({ data: inserted[0], error: null }), then: (res) => res({ data: inserted, error: null }) }; },
          then(res) { res({ data: inserted, error: null }); }
        };
      },
      update(fields) {
        const self = this;
        return {
          eq(col, val) {
            state.filters.push({ col, val });
            const rows = db[table].filter(r => state.filters.every(f => r[f.col] === f.val));
            rows.forEach(r => Object.assign(r, fields));
            return {
              select() { return { single: () => Promise.resolve({ data: rows[0] || null, error: null }) }; },
              then(res) { res({ data: rows, error: null }); }
            };
          }
        };
      },
      upsert(payload) {
        const keys = Object.keys(payload).filter(k => k.endsWith('_id') || k === 'user_id');
        const existing = db[table].find(r => keys.every(k => r[k] === payload[k]));
        if (existing) Object.assign(existing, payload);
        else db[table].push({ ...payload });
        return Promise.resolve({ data: payload, error: null });
      },
      delete() {
        return {
          eq(col, val) {
            state.filters.push({ col, val });
            return {
              eq(col2, val2) {
                state.filters.push({ col: col2, val: val2 });
                db[state.table] = db[state.table].filter(r => !state.filters.every(f => r[f.col] === f.val));
                return Promise.resolve({ data: null, error: null });
              },
              then(res) {
                db[state.table] = db[state.table].filter(r => !state.filters.every(f => r[f.col] === f.val));
                res({ data: null, error: null });
              }
            };
          }
        };
      },
      then(resolve) { resolve({ data: runSelect(this._columns), error: null }); }
    };
    return builder;
  }

  return { from, _db: db };
}

// ---------- Environnement jsdom ----------
async function main() {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://sosgouv.test/' });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  global.location = window.location;
  global.navigator = window.navigator;

  const mock = makeMockSupabase();
  window.sb = mock;
  global.sb = mock;

  // Charger les modules applicatifs (sans config.js : on injecte le mock)
  const load = (f) => {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    window.eval(code);
  };
  load('js/auth.js');
  load('js/ui.js');
  load('js/personnalites.js');
  load('js/gouvernement.js');
  window.sb = mock; // s'assurer que les modules voient le mock
  window.eval('sb = window.sb;');

  // Déclencher DOMContentLoaded
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

  const { Auth, UI, Perso, Gouv } = window;
  const results = [];
  const test = (name, cond) => {
    results.push({ name, ok: !!cond });
    console.log((cond ? '  ✅ ' : '  ❌ ') + name);
  };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  console.log('\n=== 1. AUTHENTIFICATION ===');
  await Auth.signup('julien', 'test123');
  test('Inscription crée un utilisateur', mock._db.users.length === 1);
  test('Session active après inscription', Auth.isLoggedIn() && Auth.currentUser.username === 'julien');

  let dupError = null;
  try { await Auth.signup('julien', 'autre'); } catch (e) { dupError = e; }
  test('Pseudo en doublon refusé', dupError && dupError.message.includes('déjà utilisé'));

  Auth.logout();
  test('Déconnexion vide la session', !Auth.isLoggedIn());

  let badLogin = null;
  try { await Auth.login('julien', 'mauvais'); } catch (e) { badLogin = e; }
  test('Mauvais mot de passe refusé', badLogin !== null);

  await Auth.login('julien', 'test123');
  test('Connexion réussie', Auth.isLoggedIn());

  console.log('\n=== 2. UI / NAVIGATION ===');
  UI.updateMenu();
  test('Menu connecté affiché', document.getElementById('menuConnected').style.display === 'block');
  test('Footer admin caché (non admin)', document.getElementById('adminFooter').style.display === 'none');

  UI.showSection(3);
  test('Navigation section 3 (ajout perso)', document.getElementById('section-3').style.display === 'block'
    && document.getElementById('section-0').style.display === 'none');

  console.log('\n=== 3. PERSONNALITES ===');
  document.getElementById('addNom').value = 'JANCOVICI';
  document.getElementById('addPrenom').value = 'Jean-Marc';
  document.getElementById('addMetier').value = 'Ingénieur';
  await Perso.addSimple();
  document.getElementById('addNom').value = 'DESPENTES';
  document.getElementById('addPrenom').value = 'Virginie';
  document.getElementById('addMetier').value = 'Autrice';
  await Perso.addSimple();
  test('Deux personnalités ajoutées en base', mock._db.personnalites.length === 2);

  UI.showSection(4);
  await wait(20);
  test('Liste des personnalités rendue', document.querySelectorAll('.perso-card').length === 2);
  test('Groupement par lettre présent', document.querySelectorAll('.groupe-lettre').length === 2);

  const persoId = mock._db.personnalites[0].id;
  await Perso.toggleLike(persoId, null);
  test('Like enregistré', mock._db.personnalites_likes.length === 1);
  await Perso.toggleLike(persoId, null);
  test('Unlike supprime le like', mock._db.personnalites_likes.length === 0);
  await Perso.togglePin(persoId, null);
  test('Épinglage enregistré', mock._db.personnalites_epingles.length === 1);

  // Filtre statut
  mock._db.personnalites[0].statut = 3;
  Perso.all = mock._db.personnalites.slice();
  Perso.filtreStatut = '3';
  Perso.render();
  test('Filtre par statut "ok"', document.querySelectorAll('.perso-card').length === 1);
  Perso.filtreStatut = 'tous';

  // Fiche
  Perso.render();
  Perso.openFiche(persoId);
  test('Fiche personnalité ouverte', document.getElementById('modal-fiche').style.display === 'block'
    && document.getElementById('fiche-contenu').innerHTML.includes('JANCOVICI'));
  UI.closeModals();

  console.log('\n=== 4. COMPOSER UN GOUVERNEMENT ===');
  UI.showSection(2);
  await wait(30);
  test('6 postes régaliens initialisés', document.querySelectorAll('.poste-regalien').length === 6);

  Gouv.addMinistere();
  test('Ajout d\'un ministère non-régalien', document.querySelectorAll('.poste-non_regalien').length === 1);
  Gouv.addDelegue();
  test('Ajout d\'un délégué ministériel', document.querySelectorAll('.poste-delegue').length === 1);
  test('Total : 8 postes', Gouv.composerState.postes.length === 8);

  // Suppression d'un poste non-régalien
  const nbAvant = Gouv.composerState.postes.length;
  document.querySelector('.poste-non_regalien .btn-remove-poste').click();
  test('Suppression d\'un poste ajouté', Gouv.composerState.postes.length === nbAvant - 1);
  Gouv.addMinistere();

  // Attribution de personnalités
  Gouv.composerState.postes[0].personnalite = mock._db.personnalites[0];
  Gouv.composerState.postes[1].personnalite = mock._db.personnalites[1];

  // Sous-secteurs : le poste Défense doit avoir hérité de "Cyberdéfense"
  const posteDefense = Gouv.composerState.postes.find(p => p.secteur && p.secteur.nom === 'Défense');
  test('Sous-secteurs par défaut hérités (Défense → Cyberdéfense)',
    posteDefense && posteDefense.sousSecteurs.length === 1 && posteDefense.sousSecteurs[0].nom === 'Cyberdéfense');

  // Publication sans titre : refusée
  document.getElementById('gouvTitre').value = '';
  await Gouv.save(true);
  test('Publication sans titre bloquée', mock._db.gouvernements.length === 0);

  // Publication OK
  document.getElementById('gouvTitre').value = 'Gouvernement Test';
  document.getElementById('gouvDescription').value = 'Ma vision.';
  await Gouv.save(true);
  await wait(10);
  test('Gouvernement publié en base', mock._db.gouvernements.length === 1 && mock._db.gouvernements[0].is_published === true);
  test('8 postes enregistrés', mock._db.postes_gouvernement.length === 8);
  test('Sous-secteurs du poste enregistrés', mock._db.postes_sous_secteurs.length === 1);
  test('Composer réinitialisé après publication', document.getElementById('gouvTitre').value === '');

  // Brouillon
  UI.showSection(2);
  await wait(30);
  document.getElementById('gouvTitre').value = 'Brouillon Test';
  await Gouv.save(false);
  test('Brouillon enregistré (is_published=false)',
    mock._db.gouvernements.length === 2 && mock._db.gouvernements.find(g => g.titre === 'Brouillon Test').is_published === false);

  console.log('\n=== 5. LISTE PUBLIEE / VOTE / COMMENTAIRES ===');
  UI.showSection(1);
  await wait(30);
  test('Seuls les gouvernements publiés listés', document.querySelectorAll('.gouv-card').length === 1);
  test('Auteur affiché', document.querySelector('.gouv-auteur').textContent.includes('julien'));

  const gouvId = mock._db.gouvernements[0].id;
  await Gouv.vote(gouvId, 4);
  await wait(30);
  test('Vote 4/5 enregistré', mock._db.gouvernements_votes.length === 1 && mock._db.gouvernements_votes[0].note === 4);
  await Gouv.vote(gouvId, 5);
  await wait(30);
  test('Re-vote = mise à jour (pas de doublon)', mock._db.gouvernements_votes.length === 1 && mock._db.gouvernements_votes[0].note === 5);
  test('Note moyenne affichée', document.querySelector('.gouv-note').textContent.includes('5'));

  await Gouv.togglePin(gouvId, null);
  test('Gouvernement épinglé', mock._db.gouvernements_epingles.length === 1);

  await Gouv.openDetail(gouvId);
  await wait(20);
  test('Modal détail ouvert avec les postes',
    document.getElementById('modal-detail').style.display === 'block'
    && document.getElementById('detail-contenu').innerHTML.includes('Postes régaliens'));

  document.getElementById('newComment').value = 'Excellent choix pour la Défense !';
  await Gouv.addComment(gouvId);
  await wait(20);
  test('Commentaire enregistré', mock._db.commentaires.length === 1);
  test('Commentaire affiché avec auteur',
    document.getElementById('detail-commentaires').innerHTML.includes('julien'));
  UI.closeModals();

  console.log('\n=== 6. NON CONNECTE / ADMIN ===');
  Auth.logout();
  UI.updateMenu();
  await Gouv.vote(gouvId, 1);
  test('Vote refusé si non connecté', mock._db.gouvernements_votes[0].note === 5);
  await Perso.addSimple();
  test('Ajout personnalité refusé si non connecté', mock._db.personnalites.length === 2);

  await Auth.login('julien', 'test123');
  Auth.currentUser.is_admin = true;
  Auth.saveSession(Auth.currentUser);
  UI.updateMenu();
  test('Footer admin (jaune) visible pour admin', document.getElementById('adminFooter').style.display === 'flex');

  UI.showSection(4);
  await wait(20);
  test('Bouton édition admin présent sur les cartes', document.querySelectorAll('.btn-edit').length === 2);
  Perso.openAdminEdit(persoId);
  document.getElementById('admStatut').value = '2';
  await Perso.adminSave();
  await wait(20);
  test('Édition admin : statut mis à jour', mock._db.personnalites.find(p => p.id === persoId).statut === 2);

  console.log('\n=== 7. SECURITE (echappement HTML) ===');
  mock._db.personnalites.push({ id: 'xss-1', nom: '<script>alert(1)</script>', prenom: '', metiers: [], statut: 0 });
  await Perso.loadList();
  await wait(20);
  test('Injection HTML échappée dans la liste', !document.getElementById('liste-personnalites').innerHTML.includes('<script>alert'));

  // ---------- Bilan ----------
  const fails = results.filter(r => !r.ok);
  console.log('\n============================');
  console.log('TOTAL : ' + results.length + ' tests, ' + fails.length + ' échec(s)');
  if (fails.length) { fails.forEach(f => console.log('  ÉCHEC → ' + f.name)); process.exit(1); }
  console.log('TOUS LES TESTS PASSENT ✅');
}

main().catch(e => { console.error('ERREUR FATALE:', e); process.exit(1); });
