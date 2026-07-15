// Icônes Fontello de la maquette (codes extraits du site publié)
window.ICO = {
  pin: '\ue80a',        // icon-pin, épingler
  share: '\ue835',      // icon-mail-2, faire suivre (gouvernement)
  shareMini: '\ue833',  // icon-mail-1, faire suivre (personnalité)
  draft: '\ue89d',      // icon-folder-open-1, brouillon (mini)
  draftBig: '\uf068',   // icon-folder-open, brouillon (gros bouton)
  loupe: '\ue801',      // icon-search
  people: '\ue81f',     // icon-user-1
  like: '\ue808',       // icon-heart-empty
  likeFull: '\ue802',   // icon-heart, coeur plein (liké)
  comment: '\ue896',    // icon-comment-1
  check: '\ue891',      // icon-up-fat, valider / ajouter
  check2: '\ue821',     // icon-ok-1, statut ok
  cross: '\ue822',      // icon-cancel-1, croix / statut jamais
  cond: '\ue844',       // icon-dot-3, statut sous condition
  cancel: '\ue838',     // icon-cancel-3, annuler
  save: '\ue81b',       // icon-ok, enregistrer
  send: '\ue800',       // icon-paper-plane, envoyer
  addMin: '\ue823',     // icon-plus, ajouter ministère
  addDel: '\ue839',     // icon-plus-circle-1, ajouter délégué
  trash: '\uf083',      // icon-trash, corbeille
  edit: '\ue83e',       // icon-pencil, modifier
  starFull: '\ue806',   // icon-star
  starEmpty: '\ue807'   // icon-star-empty
};

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
    document.querySelectorAll('[id^="section-"]').forEach(s => s.style.display = 'none');
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
    const modal = document.getElementById(id);
    if (!modal) return;
    const estPM = modal.classList.contains('pm-parent');
    if (estPM) {
      // Les petits modaux maquette portent leur propre fond et se centrent seuls
      modal.style.display = 'flex';
      const fondInterne = modal.querySelector('._3-fond-modal');
      if (fondInterne) fondInterne.style.display = 'block';
    } else {
      const fond = document.getElementById('fondModal');
      if (fond) fond.style.display = 'block';
      modal.style.display = 'block';
    }
  },

  closeModals() {
    const fondGlobal = document.getElementById('fondModal');
    if (fondGlobal) fondGlobal.style.display = 'none';
    document.querySelectorAll('.modal-sosgouv, .pm-parent, .bm-parent').forEach(m => m.style.display = 'none');
  },

  // Modal "connectez-vous" : exigence de connexion avant une action
  requireAuth() {
    if (Auth.isLoggedIn()) return true;
    this.openModal('modal-connect-required');
    return false;
  },

  // ---------- Menu selon connexion ----------
  updateMenu() {
    const logged = Auth.isLoggedIn();

    // Nom d'utilisateur dans le bouton compte du header
    const userLabel = document.querySelector('.connected-username');
    if (userLabel) userLabel.textContent = logged ? Auth.currentUser.username : '';
    const siConnect = document.querySelector('.si-connect');
    if (siConnect) siConnect.style.display = logged ? 'flex' : 'none';

    // Liens du menu compte selon l'état de connexion
    const openConnect = document.getElementById('openConnect');
    if (openConnect) openConnect.style.display = logged ? 'none' : 'block';
    const logoutLink = document.getElementById('btnLogoutMenu');
    if (logoutLink) logoutLink.style.display = logged ? 'block' : 'none';
    ['openInfosPerso', 'openActivite'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = logged ? 'block' : 'none';
    });

    // Compat ancienne structure (version classique partage ce fichier)
    const notConnected = document.getElementById('menuNotConnected');
    const connected = document.getElementById('menuConnected');
    const oldLabel = document.getElementById('connectedUsername');
    if (notConnected) notConnected.style.display = logged ? 'none' : 'block';
    if (connected) connected.style.display = logged ? 'block' : 'none';
    if (oldLabel) oldLabel.textContent = logged ? Auth.currentUser.username : '';

    // Footer admin (jaune) visible uniquement pour les admins
    document.body.classList.toggle('admin-connecte', Auth.isAdmin());
    const adminFooter = document.getElementById('adminFooter');
    if (adminFooter) {
      const admin = Auth.isAdmin();
      adminFooter.style.display = admin ? 'flex' : 'none';
      // Le conteneur parent peut être masqué par le CSS Webflow : on force aussi
      let parent = adminFooter.parentElement;
      while (parent && parent !== document.body) {
        if (admin && getComputedStyle(parent).display === 'none') parent.style.display = 'block';
        parent = parent.parentElement;
      }
    }
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
    if (this._initDone) return;
    this._initDone = true;
    // Menus du header (compte + général), bascule manuelle
    const menus = [
      { btn: document.getElementById('btnCompte'), menu: document.getElementById('menuCompte') },
      { btn: document.getElementById('btnMenuGeneral'), menu: document.getElementById('menuGeneral') }
    ];
    menus.forEach(({ btn, menu }) => {
      if (!btn || !menu) return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const visible = menu.style.display === 'flex';
        menus.forEach(m => { if (m.menu) m.menu.style.display = 'none'; });
        menu.style.display = visible ? 'none' : 'flex';
      });
    });
    document.addEventListener('click', (e) => {
      menus.forEach(({ btn, menu }) => {
        if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) menu.style.display = 'none';
      });
    });
    document.querySelectorAll('#menuCompte a, #menuGeneral a').forEach(a =>
      a.addEventListener('click', () => menus.forEach(m => { if (m.menu) m.menu.style.display = 'none'; })));

    // Compat version classique : dropdown ☰ (ancienne structure)
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
        list.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
          list.classList.remove('w--open');
          toggle.classList.remove('w--open');
        }));
      }
    }

    // Les formulaires Webflow ne doivent jamais soumettre (rechargement de page)
    document.querySelectorAll('form').forEach(f => f.addEventListener('submit', (e) => e.preventDefault()));

    // Fond intégré des modaux maquette : ferme au clic
    document.querySelectorAll('.pm-parent ._3-fond-modal, [data-close-modal]').forEach(el =>
      el.addEventListener('click', (e) => { e.preventDefault(); this.closeModals(); }));

    // Guide utilisateur (public)
    const openGuide = document.getElementById('openGuide');
    if (openGuide) openGuide.addEventListener('click', (e) => {
      e.preventDefault();
      this.openModal('modal-gu');
    });

    // Raccourci "me connecter" du modal d'exigence de connexion
    const fromRequired = document.getElementById('btnConnectFromRequired');
    if (fromRequired) fromRequired.addEventListener('click', (e) => {
      e.preventDefault();
      this.closeModals();
      this.openModal('modal-connect');
    });

    // Logo : retour à l'état initial de la page
    document.querySelectorAll('.bloclogo a').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = window.location.pathname;
    }));

    // Liens de navigation
    document.querySelectorAll('[data-section]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSection(Number(link.dataset.section));
      });
    });

    // Fermeture des modaux (fond + croix)
    const fond = document.getElementById('fondModal');
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
    const openConnectLink = document.getElementById('openConnect');
    if (openConnectLink) openConnectLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openModal('modal-connect');
    });
    const openActivite = document.getElementById('openActivite');
    if (openActivite) openActivite.addEventListener('click', (e) => {
      e.preventDefault();
      if (!Auth.isLoggedIn()) return this.openModal('modal-connect');
      this.openModal('modal-activite');
      this.loadEspacePerso();
    });

    // Pages admin du footer
    const admMembres = document.getElementById('openAdminMembres');
    if (admMembres) admMembres.addEventListener('click', (e) => {
      e.preventDefault();
      if (!Auth.isAdmin()) return;
      this.openModal('modal-admin-membres');
      this.loadAdminMembres();
    });
    const admSecteurs = document.getElementById('openAdminSecteurs');
    if (admSecteurs) admSecteurs.addEventListener('click', (e) => {
      e.preventDefault();
      if (!Auth.isAdmin()) return;
      this.openModal('modal-admin-secteurs');
      this.loadAdminSecteurs();
    });
    const logoutMenu = document.getElementById('btnLogoutMenu');
    if (logoutMenu) logoutMenu.addEventListener('click', (e) => {
      e.preventDefault();
      Auth.logout();
      this.updateMenu();
      this.showSection(0);
      this.toast('Déconnexion réussie.');
    });

    // Données personnelles
    const saveInfoBtn = document.getElementById('btnSaveInfos');
    if (saveInfoBtn) saveInfoBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!Auth.isLoggedIn()) return this.toast('Vous devez être connecté.');
      const username = document.getElementById('diUsername').value.trim();
      const password = document.getElementById('diPassword').value;
      if (!username) return this.toast('Le nom d\'utilisateur est obligatoire.');
      if (!password) return this.toast('Le mot de passe ne peut pas être vide.');
      try {
        await Auth.updateProfile({
          username,
          password,
          afficher_username: document.getElementById('diAffUser').checked,
          nom: document.getElementById('infoNom').value || '',
          prenom: document.getElementById('infoPrenom').value || '',
          email: document.getElementById('infoEmail').value || ''
        });
        this.updateMenu();
        this.toast('Informations enregistrées.');
        this.closeModals();
      } catch (err) { this.toast('Erreur : ' + err.message); }
    });
    // Case à cocher visuelle Webflow
    const diAff = document.getElementById('diAffUser');
    if (diAff) diAff.addEventListener('change', () => {
      const visu = document.getElementById('diAffVisu');
      if (visu) visu.classList.toggle('w--redirected-checked', diAff.checked);
    });

    // Ouverture données personnelles
    const openInfos = document.getElementById('openInfosPerso');
    if (openInfos) openInfos.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!Auth.isLoggedIn()) return this.openModal('modal-connect');
      const remplir = (u) => {
        document.getElementById('diUsername').value = u.username || '';
        document.getElementById('diPassword').value = u.password || '';
        const aff = u.afficher_username !== false;
        document.getElementById('diAffUser').checked = aff;
        const visu = document.getElementById('diAffVisu');
        if (visu) visu.classList.toggle('w--redirected-checked', aff);
        document.getElementById('infoNom').value = u.nom || '';
        document.getElementById('infoPrenom').value = u.prenom || '';
        document.getElementById('infoEmail').value = u.email || '';
      };
      remplir(Auth.currentUser);
      this.openModal('modal-infos');
      // Valeurs fraîches depuis la base (la session locale peut être en retard)
      try {
        const { data } = await sb.from('users').select('username, password, afficher_username, nom, prenom, email')
          .eq('id', Auth.currentUser.id).maybeSingle();
        if (data) {
          remplir(data);
          Object.assign(Auth.currentUser, data);
          Auth.saveSession(Auth.currentUser);
        }
      } catch (err) { /* on garde les valeurs de session */ }
    });

    this.updateMenu();
    this.showSection(0);

    // La session locale peut être en retard sur la base (ex : passage admin) :
    // on rafraîchit le profil au chargement.
    if (Auth.isLoggedIn()) {
      sb.from('users').select('nom, prenom, email, is_admin')
        .eq('id', Auth.currentUser.id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            Object.assign(Auth.currentUser, data);
            Auth.saveSession(Auth.currentUser);
            this.updateMenu();
          }
        })
        .catch(() => { /* hors ligne : on garde la session */ });
    }
  },


  // ---------- Admin : membres ----------
  async loadAdminMembres() {
    const cont = document.getElementById('admin-membres-liste');
    if (!cont) return;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    try {
      const { data, error } = await sb.from('users').select('id, username, nom, prenom, email, is_admin, created_at');
      if (error) throw error;
      cont.innerHTML = (data || []).map(u =>
        '<div class="admin-membre-ligne">' +
        '<span class="am-user">' + esc(u.username) + (u.is_admin ? ' <span class="am-badge">admin</span>' : '') + '</span>' +
        '<span class="am-infos">' + esc([u.prenom, u.nom].filter(Boolean).join(' ')) + (u.email ? ' · ' + esc(u.email) : '') + '</span>' +
        (u.id !== Auth.currentUser.id
          ? '<a href="#" class="_2-mini-bouton w-inline-block am-del" data-id="' + esc(u.id) + '" data-username="' + esc(u.username) + '" title="Supprimer ce compte"><div class="_2-picto-fontello-bouton">' + ICO.trash + '</div></a>'
          : '<span class="am-moi">vous</span>') +
        '</div>'
      ).join('') || '<div class="empty-msg">Aucun membre.</div>';
      cont.querySelectorAll('.am-del').forEach(btn => btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const username = btn.dataset.username;
        if (!window.confirm('Supprimer le compte « ' + username + ' » ? Ses gouvernements, votes, likes et commentaires seront supprimés. Définitif.')) return;
        try {
          const { error } = await sb.from('users').delete().eq('id', btn.dataset.id);
          if (error) throw error;
          this.toast('Compte « ' + username + ' » supprimé.');
          this.loadAdminMembres();
        } catch (err) { this.toast('Erreur : ' + err.message); }
      }));
    } catch (err) {
      cont.innerHTML = '<div class="error-msg">Erreur : ' + esc(err.message) + '</div>';
    }
  },

  // ---------- Admin : secteurs et sous-secteurs par défaut ----------
  async loadAdminSecteurs() {
    const cont = document.getElementById('admin-secteurs-liste');
    if (!cont) return;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    try {
      const [sec, sous, liens] = await Promise.all([
        sb.from('secteurs').select('*').order('nom', { ascending: true }),
        sb.from('sous_secteurs').select('*').order('nom', { ascending: true }),
        sb.from('secteurs_sous_secteurs_defaut').select('*')
      ]);
      if (sec.error) throw sec.error;
      const sousById = {};
      (sous.data || []).forEach(s => sousById[s.id] = s);
      cont.innerHTML = (sec.data || []).map(s => {
        const assoc = (liens.data || []).filter(l => l.secteur_id === s.id);
        const tags = assoc.map(l => {
          const ss = sousById[l.sous_secteur_id];
          return ss ? '<span class="fusion-tag">' + esc(ss.nom) +
            ' <button class="btn-icone as-del" data-secteur="' + s.id + '" data-sous="' + ss.id + '" title="Retirer">&times;</button></span>' : '';
        }).join('');
        const options = (sous.data || [])
          .filter(ss => !assoc.some(l => l.sous_secteur_id === ss.id))
          .map(ss => '<option value="' + ss.id + '">' + esc(ss.nom) + '</option>').join('');
        return '<div class="admin-secteur-bloc">' +
          '<div class="as-titre-ligne">' +
          '<h4 class="fiche-h">' + esc(s.nom) + ' <span class="as-type">' + (s.type === 'regalien' ? 'régalien' : 'non régalien') + '</span></h4>' +
          '<a href="#" class="_2-mini-bouton w-inline-block as-rename" data-id="' + s.id + '" data-nom="' + esc(s.nom) + '" title="Renommer"><div class="_2-picto-fontello-bouton">' + ICO.edit + '</div></a>' +
          (s.type !== 'regalien'
            ? '<a href="#" class="_2-mini-bouton w-inline-block as-del-secteur" data-id="' + s.id + '" data-nom="' + esc(s.nom) + '" title="Supprimer ce secteur"><div class="_2-picto-fontello-bouton">' + ICO.trash + '</div></a>'
            : '') +
          '</div>' +
          '<div class="as-tags">' + (tags || '<span class="esp-vide">aucun sous-secteur par défaut</span>') + '</div>' +
          '<div class="as-form">' +
          '<select class="as-select mon-inputdrop" data-secteur="' + s.id + '"><option value="" disabled selected>associer un sous-secteur…</option>' + options + '</select>' +
          '<input type="text" class="mon-input5 w-input as-new" data-secteur="' + s.id + '" placeholder="ou créer : nom du nouveau sous-secteur"/>' +
          '<a href="#" class="_2-mini-bouton w-inline-block as-add" data-secteur="' + s.id + '"><div class="_2-picto-fontello-bouton">' + ICO.addMin + '</div></a>' +
          '</div></div>';
      }).join('') +
        '<div class="admin-secteur-bloc as-creation">' +
        '<h4 class="fiche-h">Créer un secteur</h4>' +
        '<div class="as-form">' +
        '<input type="text" class="mon-input5 w-input" id="asNewNom" placeholder="nom du secteur (ex : Culture)"/>' +
        '<input type="text" class="mon-input5 w-input" id="asNewIntitule" placeholder="intitulé du poste par défaut (ex : Ministre de la Culture)"/>' +
        '<select id="asNewType" class="as-select mon-inputdrop"><option value="non_regalien" selected>non régalien</option><option value="regalien">régalien</option></select>' +
        '<a href="#" class="_2-mini-bouton w-inline-block" id="asCreate"><div class="_2-picto-fontello-bouton">' + ICO.addMin + '</div></a>' +
        '</div></div>';

      // Renommer un secteur
      cont.querySelectorAll('.as-rename').forEach(btn => btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const nouveau = window.prompt('Nouveau nom du secteur :', btn.dataset.nom);
        if (!nouveau || !nouveau.trim() || nouveau.trim() === btn.dataset.nom) return;
        try {
          const { error } = await sb.from('secteurs').update({ nom: nouveau.trim() }).eq('id', btn.dataset.id);
          if (error) throw error;
          if (window.Gouv) Gouv.referentielsCharges = false;
          this.loadAdminSecteurs();
        } catch (err) { this.toast('Erreur : ' + err.message); }
      }));

      // Supprimer un secteur (non régalien uniquement)
      cont.querySelectorAll('.as-del-secteur').forEach(btn => btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!window.confirm('Supprimer le secteur « ' + btn.dataset.nom + ' » ? Les postes des gouvernements existants qui l\'utilisent perdront leur référence de secteur (le nom du poste est conservé). Définitif.')) return;
        try {
          const { error } = await sb.from('secteurs').delete().eq('id', btn.dataset.id);
          if (error) throw error;
          if (window.Gouv) Gouv.referentielsCharges = false;
          this.toast('Secteur supprimé.');
          this.loadAdminSecteurs();
        } catch (err) { this.toast('Erreur : ' + err.message); }
      }));

      // Créer un secteur
      const asCreate = document.getElementById('asCreate');
      if (asCreate) asCreate.addEventListener('click', async (e) => {
        e.preventDefault();
        const nom = document.getElementById('asNewNom').value.trim();
        const intitule = document.getElementById('asNewIntitule').value.trim();
        const type = document.getElementById('asNewType').value;
        if (!nom) return this.toast('Donnez un nom au secteur.');
        try {
          const { error } = await sb.from('secteurs').insert({
            nom, type, intitule_poste_defaut: intitule || ('Ministre : ' + nom)
          });
          if (error) throw error;
          if (window.Gouv) Gouv.referentielsCharges = false;
          this.toast('Secteur « ' + nom + ' » créé.');
          this.loadAdminSecteurs();
        } catch (err) { this.toast('Erreur : ' + err.message); }
      });

      // Retirer une association
      cont.querySelectorAll('.as-del').forEach(btn => btn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const { error } = await sb.from('secteurs_sous_secteurs_defaut').delete()
            .eq('secteur_id', btn.dataset.secteur).eq('sous_secteur_id', btn.dataset.sous);
          if (error) throw error;
          if (window.Gouv) Gouv.referentielsCharges = false;
          this.loadAdminSecteurs();
        } catch (err) { this.toast('Erreur : ' + err.message); }
      }));
      // Ajouter : depuis la liste, ou création d'un nouveau sous-secteur
      cont.querySelectorAll('.as-add').forEach(btn => btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const secId = btn.dataset.secteur;
        const bloc = btn.closest('.as-form');
        const sel = bloc.querySelector('.as-select');
        const inp = bloc.querySelector('.as-new');
        try {
          let sousId = sel.value || null;
          const nom = inp.value.trim();
          if (!sousId && nom) {
            const { data: created, error: cErr } = await sb.from('sous_secteurs').insert({ nom }).select().single();
            if (cErr) throw cErr;
            sousId = created.id;
          }
          if (!sousId) return this.toast('Choisissez un sous-secteur ou saisissez un nom.');
          const { error } = await sb.from('secteurs_sous_secteurs_defaut').insert({ secteur_id: secId, sous_secteur_id: sousId });
          if (error) throw error;
          if (window.Gouv) Gouv.referentielsCharges = false;
          this.loadAdminSecteurs();
        } catch (err) { this.toast('Erreur : ' + err.message); }
      }));
    } catch (err) {
      cont.innerHTML = '<div class="error-msg">Erreur : ' + esc(err.message) + '</div>';
    }
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
    const dateFr = d => d ? new Date(d).toLocaleDateString('fr-FR') : '';
    try {
      const [likes, epP, epG, votes, comms, persos, gouvs, stats, users] = await Promise.all([
        sb.from('personnalites_likes').select('personnalite_id').eq('user_id', uid),
        sb.from('personnalites_epingles').select('personnalite_id').eq('user_id', uid),
        sb.from('gouvernements_epingles').select('gouvernement_id').eq('user_id', uid),
        sb.from('gouvernements_votes').select('gouvernement_id, note').eq('user_id', uid),
        sb.from('commentaires').select('*').eq('user_id', uid),
        sb.from('personnalites').select('id, nom, prenom, ajoute_par'),
        sb.from('gouvernements').select('id, titre, is_published, created_by, created_at'),
        sb.from('v_gouvernements_stats').select('*'),
        sb.from('users').select('id, username')
      ]);
      const gById = id => (gouvs.data || []).find(x => x.id === id);
      const statsById = id => (stats.data || []).find(x => x.id === id) || {};
      const userName = id => ((users.data || []).find(u => u.id === id) || {}).username || '?';
      const pById = id => (persos.data || []).find(x => x.id === id);

      const icones = (g, opts) => {
        const st = statsById(g.id);
        const note = st.note_moyenne != null ? String(st.note_moyenne).replace('.', ',') : '–';
        let h = '';
        if (opts.vote != null) {
          h += '<div class="like-bloc esp-votation" data-esp-vote="' + esc(g.id) + '">' +
            [1, 2, 3, 4, 5].map(n =>
              '<span class="etoile fontello-icon esp-etoile ' + (opts.vote >= n ? 'pleine' : '') + '" data-note="' + n + '" title="' + n + '/5">' +
              (opts.vote >= n ? ICO.starFull : ICO.starEmpty) + '</span>').join('') + '</div>';
        } else {
          h += '<div class="like-bloc"><div class="_2-picto-fontello-bouton black-stroke yellow">' + ICO.starFull + '</div>' +
            '<div class="_w-courant _w-bold yellow"><sup>' + note + '</sup></div></div>';
        }
        h += '<div class="like-bloc"><div class="_2-picto-fontello-bouton black-stroke">' + ICO.cond + '</div>' +
          '<div class="_w-courant _w-bold"><sup>' + (st.nb_commentaires || 0) + '</sup></div></div>';
        if (opts.editable) {
          h += '<a href="#" class="_2-mini-bouton mini w-inline-block" data-esp-edit="' + esc(g.id) + '" title="Modifier">' +
            '<div class="_2-picto-fontello-bouton">' + ICO.edit + '</div></a>';
          h += '<a href="#" class="_2-mini-bouton mini w-inline-block" data-esp-del="' + esc(g.id) + '" title="Supprimer">' +
            '<div class="fontello-icon pink">' + ICO.cross + '</div></a>';
        }
        return h;
      };

      const ligneGouv = (g, opts) => {
        if (!g) return '';
        const meta = (g.is_published ? 'publié le ' : 'le ') + dateFr(g.created_at) +
          (opts.auteur ? ' par <code class="code-13">' + esc(userName(g.created_by)) + '</code>' : '');
        return '<div class="div-block-331">' +
          '<div class="text-block-75"><a href="#" data-esp-gouv="' + esc(g.id) + '">' + esc(g.titre || 'Sans titre') + '</a></div>' +
          '<div class="text-block-77">' + meta + '</div>' +
          '<div class="div-block-334">' + icones(g, opts) + '</div></div>';
      };

      const lignePerso = (id, ico) => {
        const p = pById(id);
        if (!p) return '';
        return '<div class="div-block-331">' +
          '<div class="text-block-75"><a href="#" data-esp-perso="' + esc(p.id) + '">' + esc((p.prenom ? p.prenom + ' ' : '') + p.nom) + '</a></div>' +
          '<div class="text-block-77">ajouté par <code class="code-13">' + esc(userName(p.ajoute_par)) + '</code></div>' +
          '<div class="div-block-334"><div class="like-bloc"><div class="_2-picto-fontello-bouton black-stroke pink">' + ico + '</div></div></div></div>';
      };

      const mesPublies = (gouvs.data || []).filter(g => g.created_by === uid && g.is_published);
      const mesBrouillons = (gouvs.data || []).filter(g => g.created_by === uid && !g.is_published);

      set('esp-publies', mesPublies.map(g => ligneGouv(g, { editable: true })).join(''));
      set('esp-brouillons', mesBrouillons.map(g => ligneGouv(g, { editable: true })).join(''));
      set('esp-epingles-gouv', (epG.data || []).map(l => ligneGouv(gById(l.gouvernement_id), { auteur: true })).filter(Boolean).join(''));
      set('esp-votes', (votes.data || []).map(v => ligneGouv(gById(v.gouvernement_id), { auteur: true, vote: v.note })).filter(Boolean).join(''));
      set('esp-commentaires', (comms.data || []).map(c => {
        const g = c.gouvernement_id ? gById(c.gouvernement_id) : null;
        return '<div class="div-block-331">' +
          '<div>&quot;' + esc(c.contenu) + '&quot;</div>' +
          (g ? '<div class="text-block-77 mini">sur <a href="#" data-esp-gouv="' + esc(g.id) + '">' + esc(g.titre || 'Sans titre') + '</a>' +
            ' publié par <code class="code-13">' + esc(userName(g.created_by)) + '</code></div>' : '') +
          '</div>';
      }).join(''));
      set('esp-likes', (likes.data || []).map(l => lignePerso(l.personnalite_id, ICO.likeFull)).filter(Boolean).join(''));
      set('esp-epingles-perso', (epP.data || []).map(l => lignePerso(l.personnalite_id, ICO.pin)).filter(Boolean).join(''));

      // Navigation et actions
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
      document.querySelectorAll('[data-esp-edit]').forEach(a => a.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeModals();
        if (window.Gouv) Gouv.editGouvernement(a.dataset.espEdit);
      }));
      document.querySelectorAll('[data-esp-del]').forEach(a => a.addEventListener('click', async (e) => {
        e.preventDefault();
        if (window.Gouv) {
          await Gouv.deleteGouv(a.dataset.espDel);
          this.loadEspacePerso();
        }
      }));
      // Votation directe dans "Mes votes"
      document.querySelectorAll('.esp-votation .esp-etoile').forEach(et => et.addEventListener('click', async (e) => {
        e.preventDefault();
        const gid = et.closest('[data-esp-vote]').dataset.espVote;
        const note = Number(et.dataset.note);
        try {
          const { data: existant } = await sb.from('gouvernements_votes')
            .select('id').eq('gouvernement_id', gid).eq('user_id', uid).maybeSingle();
          if (existant) await sb.from('gouvernements_votes').update({ note }).eq('id', existant.id);
          else await sb.from('gouvernements_votes').insert({ gouvernement_id: gid, user_id: uid, note });
          if (window.Gouv) Gouv.votesUser[gid] = note;
          this.loadEspacePerso();
        } catch (err) { this.toast('Erreur : ' + err.message); }
      }));
    } catch (err) {
      set('esp-likes', '<div class="esp-vide">Erreur de chargement : ' + esc(err.message) + '</div>');
    }
  }
};


// Nom affiché selon la préférence utilisateur (données personnelles)
window.displayUser = function(u) {
  if (!u) return '?';
  if (u.afficher_username === false && ((u.prenom || '') + (u.nom || '')).trim()) {
    return ((u.prenom || '') + ' ' + (u.nom || '')).trim();
  }
  return u.username || '?';
};
window.UI = UI;
document.addEventListener('DOMContentLoaded', () => UI.init());
