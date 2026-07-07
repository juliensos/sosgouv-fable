// ============================================================
// SOSGOUV - ui.js
// Navigation par sections (simulation de pages), gestion des
// modaux, menu selon connexion, footer admin jaune.
// Sections : 0 A propos | 1 Gouvernements publiés |
//            2 Composer | 3 Ajouter personnalité | 4 Liste
// ============================================================
const UI = {
  currentSection: 0,

  // ---------- Navigation par sections ----------
  showSection(n) {
    document.querySelectorAll('.section-page').forEach(s => s.style.display = 'none');
    const target = document.getElementById('section-' + n);
    if (target) target.style.display = 'block';
    this.currentSection = n;

    document.querySelectorAll('[data-section]').forEach(link => {
      link.classList.toggle('active', Number(link.dataset.section) === n);
    });

    // Chargements associés
    if (n === 1 && window.Gouv) Gouv.loadPublished();
    if (n === 2 && window.Gouv) Gouv.initComposer();
    if (n === 4 && window.Perso) Perso.loadList();
  },

  // ---------- Modaux ----------
  openModal(id) {
    const fond = document.querySelector('._3-fond-modal');
    const modal = document.getElementById(id);
    if (fond) fond.style.display = 'block';
    if (modal) modal.style.display = 'block';
  },

  closeModals() {
    const fond = document.querySelector('._3-fond-modal');
    if (fond) fond.style.display = 'none';
    document.querySelectorAll('.modal-sosgouv').forEach(m => m.style.display = 'none');
  },

  // ---------- Menu selon connexion ----------
  updateMenu() {
    const notConnected = document.getElementById('menuNotConnected');
    const connected = document.getElementById('menuConnected');
    const userLabel = document.getElementById('connectedUsername');
    const logged = Auth.isLoggedIn();

    if (notConnected) notConnected.style.display = logged ? 'none' : 'block';
    if (connected) connected.style.display = logged ? 'block' : 'none';
    if (userLabel) userLabel.textContent = logged ? Auth.currentUser.username : '';

    // Footer admin (jaune) visible uniquement pour les admins
    const adminFooter = document.getElementById('adminFooter');
    if (adminFooter) adminFooter.style.display = Auth.isAdmin() ? 'flex' : 'none';
  },

  // ---------- Messages ----------
  toast(msg) {
    let t = document.getElementById('sosgouv-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'sosgouv-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 3000);
  },

  // ---------- Initialisation ----------
  init() {
    // Dropdown compte (icône menu) : bascule manuelle, sans webflow.js
    const dd = document.querySelector('.dropdown-menu.w-dropdown');
    if (dd) {
      const toggle = dd.querySelector('.w-dropdown-toggle');
      const list = dd.querySelector('.w-dropdown-list');
      if (toggle && list) {
        toggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          list.classList.toggle('w--open');
          toggle.classList.toggle('w--open');
        });
        document.addEventListener('click', (e) => {
          if (!dd.contains(e.target)) {
            list.classList.remove('w--open');
            toggle.classList.remove('w--open');
          }
        });
        // Fermer le menu après un clic sur un de ses liens
        list.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
          list.classList.remove('w--open');
          toggle.classList.remove('w--open');
        }));
      }
    }

    // Liens de navigation
    document.querySelectorAll('[data-section]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSection(Number(link.dataset.section));
      });
    });

    // Fermeture des modaux (fond + croix)
    const fond = document.querySelector('._3-fond-modal');
    if (fond) fond.addEventListener('click', () => this.closeModals());
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); this.closeModals(); });
    });

    // Connexion
    const loginBtn = document.getElementById('btnLogin');
    if (loginBtn) loginBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await Auth.login(
          document.getElementById('loginUsername').value,
          document.getElementById('loginPassword').value
        );
        this.closeModals();
        this.updateMenu();
        this.toast('Connexion réussie, bienvenue ' + Auth.currentUser.username + ' !');
      } catch (err) { this.toast('Erreur : ' + err.message); }
    });

    // Création de compte
    const signupBtn = document.getElementById('btnSignup');
    if (signupBtn) signupBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await Auth.signup(
          document.getElementById('signupUsername').value,
          document.getElementById('signupPassword').value
        );
        this.closeModals();
        this.updateMenu();
        this.toast('Compte créé, bienvenue ' + Auth.currentUser.username + ' !');
      } catch (err) { this.toast('Erreur : ' + err.message); }
    });

    // Déconnexion
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      Auth.logout();
      this.updateMenu();
      this.showSection(0);
      this.toast('Déconnexion réussie.');
    });

    // Ouverture du modal de connexion
    document.querySelectorAll('[data-open-connect]').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); this.openModal('modal-connect'); });
    });

    // Données personnelles
    const saveInfoBtn = document.getElementById('btnSaveInfos');
    if (saveInfoBtn) saveInfoBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!Auth.isLoggedIn()) return this.toast('Vous devez être connecté.');
      try {
        await Auth.updateProfile({
          nom: document.getElementById('infoNom').value || '',
          prenom: document.getElementById('infoPrenom').value || '',
          email: document.getElementById('infoEmail').value || ''
        });
        this.toast('Informations enregistrées.');
        this.closeModals();
      } catch (err) { this.toast('Erreur : ' + err.message); }
    });

    // Ouverture données personnelles
    const openInfos = document.getElementById('openInfosPerso');
    if (openInfos) openInfos.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!Auth.isLoggedIn()) return this.openModal('modal-connect');
      document.getElementById('infoNom').value = Auth.currentUser.nom || '';
      document.getElementById('infoPrenom').value = Auth.currentUser.prenom || '';
      document.getElementById('infoEmail').value = Auth.currentUser.email || '';
      this.openModal('modal-infos');
      // Valeurs fraîches depuis la base (la session locale peut être en retard)
      try {
        const { data } = await sb.from('users').select('nom, prenom, email')
          .eq('id', Auth.currentUser.id).maybeSingle();
        if (data) {
          document.getElementById('infoNom').value = data.nom || '';
          document.getElementById('infoPrenom').value = data.prenom || '';
          document.getElementById('infoEmail').value = data.email || '';
          Object.assign(Auth.currentUser, data);
          Auth.saveSession(Auth.currentUser);
        }
      } catch (err) { /* on garde les valeurs de session */ }
      this.loadEspacePerso();
    });

    this.updateMenu();
    this.showSection(0);
  },

  // ---------- Espace personnel : mon activité ----------
  async loadEspacePerso() {
    if (!Auth.isLoggedIn()) return;
    const uid = Auth.currentUser.id;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const set = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html || '<div class="esp-vide">Rien pour le moment.</div>';
    };
    try {
      const [likes, epP, epG, votes, comms, persos, gouvs] = await Promise.all([
        sb.from('personnalites_likes').select('personnalite_id').eq('user_id', uid),
        sb.from('personnalites_epingles').select('personnalite_id').eq('user_id', uid),
        sb.from('gouvernements_epingles').select('gouvernement_id').eq('user_id', uid),
        sb.from('gouvernements_votes').select('gouvernement_id, note').eq('user_id', uid),
        sb.from('commentaires').select('*').eq('user_id', uid),
        sb.from('personnalites').select('id, nom, prenom'),
        sb.from('gouvernements').select('id, titre, is_published, created_by')
      ]);
      const mesBrouillons = (gouvs.data || []).filter(g => g.created_by === uid && !g.is_published);
      const pName = id => {
        const p = (persos.data || []).find(x => x.id === id);
        return p ? ((p.prenom ? p.prenom + ' ' : '') + p.nom) : null;
      };
      const gTitre = id => {
        const g = (gouvs.data || []).find(x => x.id === id);
        return g ? (g.titre || 'Sans titre') : null;
      };
      const persoItem = id => {
        const n = pName(id);
        return n ? '<a href="#" class="esp-item" data-esp-perso="' + esc(id) + '">' + esc(n) + '</a>' : '';
      };
      const gouvItem = (id, extra) => {
        const t = gTitre(id);
        return t ? '<a href="#" class="esp-item" data-esp-gouv="' + esc(id) + '">' + esc(t) + (extra || '') + '</a>' : '';
      };
      set('esp-likes', (likes.data || []).map(l => persoItem(l.personnalite_id)).filter(Boolean).join(''));
      set('esp-epingles-perso', (epP.data || []).map(l => persoItem(l.personnalite_id)).filter(Boolean).join(''));
      set('esp-epingles-gouv', (epG.data || []).map(l => gouvItem(l.gouvernement_id)).filter(Boolean).join(''));
      set('esp-brouillons', mesBrouillons.map(g =>
        '<div class="esp-brouillon">&#128221; ' + esc(g.titre || 'Sans titre') + '</div>'
      ).join(''));
      set('esp-votes', (votes.data || []).map(v => gouvItem(v.gouvernement_id, ' <span class="esp-note">' + '&#9733;'.repeat(v.note) + '</span>')).filter(Boolean).join(''));
      set('esp-commentaires', (comms.data || []).map(c => {
        const cible = c.gouvernement_id ? gTitre(c.gouvernement_id) : null;
        return '<div class="esp-comm">' + (cible ? '<span class="esp-comm-cible">sur ' + esc(cible) + ' :</span> ' : '') + esc(c.contenu) + '</div>';
      }).join(''));
      // Navigation vers les fiches et détails
      document.querySelectorAll('[data-esp-perso]').forEach(a => a.addEventListener('click', async (e) => {
        e.preventDefault();
        this.closeModals();
        if (window.Perso) {
          if (!Perso.all || !Perso.all.length) await Perso.loadList();
          Perso.openFiche(a.dataset.espPerso);
        }
      }));
      document.querySelectorAll('[data-esp-gouv]').forEach(a => a.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeModals();
        this.showSection(1);
        if (window.Gouv && Gouv.openDetail) Gouv.openDetail(a.dataset.espGouv);
      }));
    } catch (err) {
      set('esp-likes', '<div class="esp-vide">Erreur de chargement : ' + esc(err.message) + '</div>');
    }
  }
};

window.UI = UI;
document.addEventListener('DOMContentLoaded', () => UI.init());
