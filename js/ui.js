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
  starEmpty: '\ue807',  // icon-star-empty
  flecheDeleg: '\ue815' // icon-right-thin, petite flèche devant le nom d'un délégué
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
    const estBM = modal.classList.contains('bm-parent');
    // v43, conforme à la maquette : un bm est un PANNEAU dans la page,
    // affiché en bloc à l'intérieur de ._3-cont-body dont il occupe toute
    // la case (le menu d'onglets et les sections sont poussés hors de la
    // zone visible, rognés par le conteneur). Un pm est un calque fixe
    // centré sur voile sombre, sous <body>.
    modal.style.display = estBM ? 'block' : 'flex';
    modal.scrollTop = 0;
    const stroke = modal.querySelector('._3-big-modal-stroke, ._3-small-modal-stroke');
    if (stroke) stroke.scrollTop = 0;
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

    // Nom d'utilisateur dans le bouton compte du header.
    // Par défaut (non connecté), le libellé affiche « connexion » (v46).
    const userLabel = document.querySelector('.connected-username');
    if (userLabel) userLabel.textContent = logged ? Auth.currentUser.username : 'connexion';
    const siConnect = document.querySelector('.si-connect');
    if (siConnect) siConnect.style.display = 'flex';

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
      if (admin) this.refreshBadgePropositionsIA();
      // Le conteneur parent peut être masqué par le CSS Webflow : on force aussi
      let parent = adminFooter.parentElement;
      while (parent && parent !== document.body) {
        if (admin && getComputedStyle(parent).display === 'none') parent.style.display = 'block';
        parent = parent.parentElement;
      }
    }
  },

  // ---------- Page médias (v46) : toutes les vidéos des fiches ----------
  async loadMedias() {
    const cont = document.getElementById('medias-contenu');
    if (!cont) return;
    cont.innerHTML = '<div class="loading">Chargement…</div>';
    try {
      let persos = (window.Perso && Perso.all && Perso.all.length) ? Perso.all : null;
      if (!persos) {
        const { data, error } = await sb.from('personnalites')
          .select('id, nom, prenom, liens').order('nom', { ascending: true });
        if (error) throw error;
        persos = data || [];
      }
      const blocs = [];
      persos.forEach(p => {
        const liensArr = Array.isArray(p.liens) ? p.liens : [];
        liensArr.forEach(l => {
          const embed = l && window.Perso ? Perso.videoEmbedUrl(l.url) : null;
          if (!embed) return;
          const nomComplet = ((p.prenom ? p.prenom + ' ' : '') + p.nom).trim();
          const legende = nomComplet + (l.titre ? ', ' + l.titre : '');
          blocs.push('<div class="div-block-341">' +
            '<div class="w-video w-embed media-video"><iframe src="' + Perso.esc(embed) +
            '" frameborder="0" allowfullscreen loading="lazy"></iframe></div>' +
            '<div class="legendesimple"><a href="#" class="media-perso-lien" data-perso-id="' + p.id + '">' +
            Perso.esc(legende) + '</a></div></div>');
        });
      });
      cont.innerHTML = blocs.length ? blocs.join('')
        : '<div class="esp-vide">Aucune vidéo publiée pour le moment.</div>';
      // La légende ramène à la fiche de la personnalité
      cont.querySelectorAll('.media-perso-lien').forEach(a =>
        a.addEventListener('click', (e) => {
          e.preventDefault();
          if (window.Perso) {
            if (!Perso.all.length) { Perso.loadList().then(() => Perso.openFiche(a.dataset.persoId)); }
            else Perso.openFiche(a.dataset.persoId);
          }
        }));
    } catch (err) {
      cont.innerHTML = '<div class="error-msg">Erreur : ' + String(err.message || err) + '</div>';
    }
  },

  // ---------- Infobulles (v44) ----------
  // Toute cible portant un attribut title voit son infobulle native
  // remplacée par une étiquette stylée (noir, texte blanc, immédiate).
  initInfobulles() {
    if (document.getElementById('sos-bulle')) return;
    const bulle = document.createElement('div');
    bulle.id = 'sos-bulle';
    document.body.appendChild(bulle);
    const montrer = (el) => {
      const txt = el.getAttribute('data-bulle');
      if (!txt) return;
      bulle.textContent = txt;
      bulle.style.left = '0px';
      bulle.style.top = '0px';
      bulle.classList.add('visible');
      const r = el.getBoundingClientRect();
      const br = bulle.getBoundingClientRect();
      let x = r.left + r.width / 2 - br.width / 2;
      x = Math.max(4, Math.min(x, window.innerWidth - br.width - 4));
      let y = r.top - br.height - 6;
      if (y < 4) y = r.bottom + 6;
      bulle.style.left = Math.round(x) + 'px';
      bulle.style.top = Math.round(y) + 'px';
    };
    document.addEventListener('mouseover', (e) => {
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest('[title], [data-bulle]');
      if (!el) { bulle.classList.remove('visible'); return; }
      if (el.hasAttribute('title')) {
        // migre le title natif (et le neutralise pour éviter le doublon)
        el.setAttribute('data-bulle', el.getAttribute('title'));
        el.removeAttribute('title');
      }
      montrer(el);
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target instanceof Element && e.target.closest('[data-bulle]')) bulle.classList.remove('visible');
    });
    document.addEventListener('click', () => bulle.classList.remove('visible'), true);
  },

  // ---------- Étiquettes flottantes (v44, données personnelles) ----------
  // Le placeholder disparaît dès qu'un champ est rempli : on affiche alors
  // l'intitulé en petit au-dessus du champ, pour toujours savoir quoi est quoi.
  initEtiquettes() {
    this._etiquettes = [];
    document.querySelectorAll('#modal-infos input[placeholder]').forEach(inp => {
      const et = document.createElement('div');
      et.className = 'champ-etiquette';
      et.textContent = inp.getAttribute('placeholder').replace(/\*\s*$/, '');
      inp.parentElement.insertBefore(et, inp);
      const maj = () => et.classList.toggle('visible', !!inp.value);
      inp.addEventListener('input', maj);
      this._etiquettes.push(maj);
      maj();
    });
  },
  majEtiquettes() { (this._etiquettes || []).forEach(f => f()); },

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
    // ._3-cont-body (qui héberge les onglets) a un overflow:hidden dans la
    // maquette : même en position:fixed, un modal qui reste descendant de ce
    // conteneur se retrouve rogné visuellement (l'en-tête et le pied de page
    // ne sont alors jamais recouverts). On sort chaque modal pour qu'il
    // devienne enfant direct de <body>, hors de toute zone rognée, sans
    // toucher à la structure HTML gérée dans Webflow.
    // Seuls les pm (calques fixes) sortent de la zone rognée. Les bm
    // restent dans ._3-cont-body : c'est leur place, ils en occupent la
    // case entière une fois affichés (mécanique de la maquette).
    document.querySelectorAll('.pm-parent, #fondModal').forEach(el => {
      if (el.parentElement !== document.body) document.body.appendChild(el);
    });
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

    // Infobulles stylées + étiquettes flottantes (v44)
    this.initInfobulles();
    this.initEtiquettes();

    // Fermeture au clic sur la croix / les boutons annuler…
    document.querySelectorAll('[data-close-modal]').forEach(el =>
      el.addEventListener('click', (e) => { e.preventDefault(); this.closeModals(); }));
    // …et au clic sur le voile sombre (le conteneur pm/bm-parent lui-même,
    // qui porte le fond depuis la v38 ; les fonds intégrés de la maquette
    // ne sont plus affichés).
    document.querySelectorAll('.pm-parent, .bm-parent').forEach(m =>
      m.addEventListener('click', (e) => { if (e.target === m) this.closeModals(); }));

    // Menu utilisateur du footer (v46) : guide, FAQ, médias
    const openGuide = document.getElementById('openGuide');
    if (openGuide) openGuide.addEventListener('click', (e) => {
      e.preventDefault();
      this.openModal('modal-gu');
    });
    const openFaq = document.getElementById('openFaq');
    if (openFaq) openFaq.addEventListener('click', (e) => {
      e.preventDefault();
      this.openModal('modal-faq');
    });
    const openMedias = document.getElementById('openMedias');
    if (openMedias) openMedias.addEventListener('click', (e) => {
      e.preventDefault();
      this.openModal('modal-medias');
      this.loadMedias();
    });
    // FAQ : accordéon questions/réponses + envoi d'une question par email
    document.querySelectorAll('#modal-faq .q-r-bloc .question').forEach(q =>
      q.addEventListener('click', (e) => {
        e.preventDefault();
        const rep = q.parentElement.querySelector('.reponses');
        if (rep) rep.style.display = rep.style.display === 'block' ? 'none' : 'block';
      }));
    const faqEnvoyer = document.getElementById('faqEnvoyer');
    if (faqEnvoyer) faqEnvoyer.addEventListener('click', (e) => {
      e.preventDefault();
      const q = (document.getElementById('faqQuestion') || {}).value || '';
      const mail = (document.getElementById('faqEmail') || {}).value || '';
      if (!q.trim()) { this.toast('Écrivez votre question avant d\'envoyer.'); return; }
      const corps = q.trim() + (mail.trim() ? '\n\nPour me répondre : ' + mail.trim() : '');
      window.location.href = 'mailto:etienneneville@gmail.com?subject=' +
        encodeURIComponent('Question REZEDA') + '&body=' + encodeURIComponent(corps);
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
    const admPropositions = document.getElementById('openPropositionsIA');
    if (admPropositions) admPropositions.addEventListener('click', (e) => {
      e.preventDefault();
      if (!Auth.isAdmin()) return;
      this.openModal('modal-propositions-ia');
      this.loadPropositionsIA();
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
      this.majEtiquettes();
      this.openModal('modal-infos');
      // Valeurs fraîches depuis la base (la session locale peut être en retard)
      try {
        const { data } = await sb.from('users').select('username, password, afficher_username, nom, prenom, email')
          .eq('id', Auth.currentUser.id).maybeSingle();
        if (data) {
          remplir(data);
          this.majEtiquettes();
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

  // ---------- Admin : propositions de l'agent d'enrichissement IA ----------
  async refreshBadgePropositionsIA() {
    const badge = document.getElementById('badgePropositionsIA');
    if (!badge) return;
    try {
      const { data } = await sb.from('personnalites_propositions_ia').select('id').eq('statut', 'en_attente');
      const n = (data || []).length;
      badge.textContent = String(n);
      badge.style.display = n > 0 ? 'inline-block' : 'none';
    } catch (err) { /* silencieux : simple compteur */ }
  },

  async loadPropositionsIA() {
    const cont = document.getElementById('propositions-ia-liste');
    if (!cont) return;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    try {
      const [{ data: props }, { data: persos }] = await Promise.all([
        sb.from('personnalites_propositions_ia').select('*').eq('statut', 'en_attente'),
        sb.from('personnalites').select('id, nom, prenom, metiers, short_bio, bio, liens')
      ]);
      if (!props || !props.length) {
        cont.innerHTML = '<div class="esp-vide">Aucune proposition en attente.</div>';
        return;
      }
      const ligneLien = (l) => {
        const type = (l && l.type) || 'lien';
        return '<div class="prop-lien-row">' +
          '<select class="prop-lien-type"><option value="video"' + (type === 'video' ? ' selected' : '') + '>vidéo</option>' +
          '<option value="lien"' + (type !== 'video' ? ' selected' : '') + '>lien</option></select>' +
          '<input type="text" class="prop-lien-titre" placeholder="titre" value="' + esc(l ? l.titre : '') + '">' +
          '<input type="text" class="prop-lien-url" placeholder="https://…" value="' + esc(l ? l.url : '') + '">' +
          '<a href="#" class="prop-lien-del" title="Supprimer ce lien">&#xe822;</a></div>';
      };
      cont.innerHTML = props.map(prop => {
        const p = (persos || []).find(x => x.id === prop.personnalite_id);
        const nomComplet = p ? esc((p.prenom ? p.prenom + ' ' : '') + p.nom) : '(personnalité supprimée)';
        const metiersAvant = p ? (p.metiers || []).join(', ') : '';
        const metiersApres = (prop.metiers || []).join(', ');
        const { narrative, expertise, engagements } = Perso.decouperBio(prop.bio || '');
        const hint = (avant, apres) => (avant && avant !== apres)
          ? '<div class="prop-hint">actuellement : ' + esc(avant) + '</div>' : '';
        return '<div class="prop-bloc" data-prop-id="' + prop.id + '">' +
          '<h4>' + nomComplet + '</h4>' +

          '<div class="prop-champ"><div class="prop-label">Photo (URL directe d\'une image libre de droits)</div>' +
          (prop.photo_url ? '<div class="prop-photo-apercu"><img src="' + esc(prop.photo_url) + '" alt="" loading="lazy"></div>' : '') +
          '<input type="text" class="mon-input5 w-input prop-photo" value="' + esc(prop.photo_url || '') + '" placeholder="https://… (jpg, png)"></div>' +

          '<div class="prop-champ"><div class="prop-label">Métiers</div>' +
          hint(metiersAvant, metiersApres) +
          '<input type="text" class="mon-input5 w-input prop-metiers" value="' + esc(metiersApres) + '" placeholder="séparés par une virgule"></div>' +

          '<div class="prop-champ"><div class="prop-label">Bio courte</div>' +
          hint(p ? p.short_bio : '', prop.short_bio) +
          '<textarea class="mon-input2 w-input prop-shortbio" rows="2">' + esc(prop.short_bio) + '</textarea></div>' +

          '<div class="prop-champ"><div class="prop-label">Récit biographique</div>' +
          '<textarea class="mon-input2 w-input prop-narrative" rows="6">' + esc(narrative) + '</textarea></div>' +

          '<div class="prop-champ"><div class="prop-label">Domaines de recherche et expertise</div>' +
          '<textarea class="mon-input2 w-input prop-expertise" rows="3">' + esc(expertise) + '</textarea></div>' +

          '<div class="prop-champ"><div class="prop-label">Engagements et positionnements politiques</div>' +
          '<textarea class="mon-input2 w-input prop-engagements" rows="3" placeholder="laisser vide si non trouvé, ne rien supposer">' + esc(engagements) + '</textarea></div>' +

          '<div class="prop-champ"><div class="prop-label">Liens proposés</div>' +
          '<div class="prop-liens-liste">' + (prop.liens || []).map(ligneLien).join('') + '</div>' +
          '<a href="#" class="prop-lien-add">+ ajouter un lien</a></div>' +

          ((prop.sources || []).length ? '<div class="prop-sources"><em>Sources consultées, pour vérification :</em> ' +
            prop.sources.map(u => '<a href="' + esc(u) + '" target="_blank" rel="noopener" class="prop-source">' + esc(u) + '</a>').join(' · ') + '</div>' : '') +

          '<div class="prop-actions">' +
            '<a href="#" class="_w-link-bloc-button publier w-inline-block btn-valider-prop" data-id="' + prop.id + '"><div>valider</div></a>' +
            '<a href="#" class="_2-mini-bouton mini w-inline-block btn-rejeter-prop" data-id="' + prop.id + '" title="Rejeter"><div class="fontello-icon pink">' + ICO.cross + '</div></a>' +
          '</div></div>';
      }).join('');

      // Lien cassé ou inutile : suppression directe de sa ligne
      // Les champs texte grandissent avec leur contenu, pas d'ascenseur interne.
      // La mesure est différée après le rendu complet (requestAnimationFrame) :
      // sur mobile, mesurer immédiatement après avoir injecté le HTML peut
      // donner un scrollHeight encore incorrect, avant que la mise en page
      // n'ait fini de se calculer, ce qui tronquait le texte. Un filet de
      // sécurité (setTimeout à 150ms) repasse une seconde fois derrière au
      // cas où deux frames ne suffiraient pas sur certains mobiles, et un
      // ré-ajustement sur resize/rotation couvre le changement d'orientation
      // et la barre d'adresse mobile qui rétrécit après coup la fenêtre.
      const autoGrow = (ta) => { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; };
      const grandirTousLesChamps = () => {
        cont.querySelectorAll('.prop-champ textarea').forEach(autoGrow);
      };
      (window.requestAnimationFrame || setTimeout)(() => {
        (window.requestAnimationFrame || setTimeout)(grandirTousLesChamps);
      });
      setTimeout(grandirTousLesChamps, 150);
      if (this._resizePropIA) window.removeEventListener('resize', this._resizePropIA);
      this._resizePropIA = grandirTousLesChamps;
      window.addEventListener('resize', this._resizePropIA);
      cont.querySelectorAll('.prop-champ textarea').forEach(ta => {
        ta.addEventListener('input', () => autoGrow(ta));
      });

      cont.querySelectorAll('.prop-lien-del').forEach(a => a.addEventListener('click', (e) => {
        e.preventDefault();
        a.closest('.prop-lien-row').remove();
      }));
      // Ajouter un lien manquant que l'agent n'a pas trouvé
      cont.querySelectorAll('.prop-lien-add').forEach(a => a.addEventListener('click', (e) => {
        e.preventDefault();
        const liste = a.previousElementSibling;
        const div = document.createElement('div');
        div.innerHTML = '<div class="prop-lien-row"><select class="prop-lien-type"><option value="video">vidéo</option><option value="lien" selected>lien</option></select><input type="text" class="prop-lien-titre" placeholder="titre"><input type="text" class="prop-lien-url" placeholder="https://…"><a href="#" class="prop-lien-del" title="Supprimer ce lien">&#xe822;</a></div>';
        const ligne = div.firstElementChild;
        ligne.querySelector('.prop-lien-del').addEventListener('click', (ev) => { ev.preventDefault(); ligne.remove(); });
        liste.appendChild(ligne);
      }));

      cont.querySelectorAll('.btn-valider-prop').forEach(btn => btn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.validerPropositionIA(btn.dataset.id);
      }));
      cont.querySelectorAll('.btn-rejeter-prop').forEach(btn => btn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.rejeterPropositionIA(btn.dataset.id);
      }));
    } catch (err) {
      cont.innerHTML = '<div class="error-msg">Erreur : ' + esc(err.message) + '</div>';
    }
  },

  async validerPropositionIA(propId) {
    if (!Auth.isAdmin()) return;
    try {
      const bloc = document.querySelector('.prop-bloc[data-prop-id="' + propId + '"]');
      if (!bloc) throw new Error('Bloc de proposition introuvable à l\'écran.');
      // On applique ce que l'admin a sous les yeux, tel qu'il l'a corrigé,
      // pas ce que l'agent avait initialement proposé.
      const metiers = bloc.querySelector('.prop-metiers').value.split(',').map(s => s.trim()).filter(Boolean);
      const shortBio = bloc.querySelector('.prop-shortbio').value.trim();
      const narrative = bloc.querySelector('.prop-narrative').value;
      const expertise = bloc.querySelector('.prop-expertise').value;
      const engagements = bloc.querySelector('.prop-engagements').value;
      const bio = Perso.assemblerBio(narrative, expertise, engagements);
      const liens = Array.from(bloc.querySelectorAll('.prop-lien-row')).map(row => ({
        type: row.querySelector('.prop-lien-type').value,
        titre: row.querySelector('.prop-lien-titre').value.trim(),
        url: row.querySelector('.prop-lien-url').value.trim()
      })).filter(l => l.url);

      const photo = (bloc.querySelector('.prop-photo') || { value: '' }).value.trim();

      const { data: prop, error: e1 } = await sb.from('personnalites_propositions_ia')
        .select('personnalite_id, sources').eq('id', propId).single();
      if (e1 || !prop) throw new Error('Proposition introuvable.');
      const { data: perso } = await sb.from('personnalites').select('metiers').eq('id', prop.personnalite_id).maybeSingle();

      const champs = { enrichi_par_ia_le: new Date().toISOString() };
      champs.metiers = metiers.length ? metiers : (perso ? perso.metiers : []);
      if (shortBio) champs.short_bio = shortBio;
      if (bio) champs.bio = bio;
      champs.liens = liens;
      if (photo) champs.photo_url = photo;
      // Sources consultées par l'agent : conservées sur la fiche pour
      // affichage public (mention d'assistance IA, v46)
      champs.sources = prop.sources || [];

      const { error: e2 } = await sb.from('personnalites').update(champs).eq('id', prop.personnalite_id);
      if (e2) throw e2;
      // On garde une trace de la version réellement appliquée (après tes corrections)
      await sb.from('personnalites_propositions_ia').update({
        statut: 'validee', valide_par: Auth.currentUser.id, valide_le: new Date().toISOString(),
        metiers: champs.metiers, short_bio: shortBio || null, bio: bio || null, liens,
        photo_url: photo || null
      }).eq('id', propId);
      this.toast('Proposition validée et appliquée à la fiche.');
      this.loadPropositionsIA();
      this.refreshBadgePropositionsIA();
      if (window.Perso) { Perso.all = []; }
    } catch (err) { this.toast('Erreur : ' + err.message); }
  },

  async rejeterPropositionIA(propId) {
    if (!Auth.isAdmin()) return;
    try {
      const { error } = await sb.from('personnalites_propositions_ia').update({
        statut: 'rejetee', valide_par: Auth.currentUser.id, valide_le: new Date().toISOString()
      }).eq('id', propId);
      if (error) throw error;
      this.toast('Proposition rejetée.');
      this.loadPropositionsIA();
      this.refreshBadgePropositionsIA();
    } catch (err) { this.toast('Erreur : ' + err.message); }
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
      const [likes, epP, epG, votes, comms, persos, gouvs, postesPerso, stats, users] = await Promise.all([
        sb.from('personnalites_likes').select('personnalite_id').eq('user_id', uid),
        sb.from('personnalites_epingles').select('personnalite_id').eq('user_id', uid),
        sb.from('gouvernements_epingles').select('gouvernement_id').eq('user_id', uid),
        sb.from('gouvernements_votes').select('gouvernement_id, note').eq('user_id', uid),
        sb.from('commentaires').select('*').eq('user_id', uid),
        sb.from('personnalites').select('id, nom, prenom, ajoute_par'),
        sb.from('gouvernements').select('id, titre, is_published, created_by, created_at'),
        sb.from('postes_gouvernement').select('gouvernement_id, secteur_personnalise, sous_secteurs_personnalises'),
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
      // Mes secteurs et sous-secteurs personnalisés (portés par mes postes)
      const mesGouvIds = (gouvs.data || []).filter(g => g.created_by === uid).map(g => g.id);
      const persoLignes = [];
      (postesPerso.data || []).filter(p => mesGouvIds.includes(p.gouvernement_id)).forEach(p => {
        const g = gById(p.gouvernement_id);
        if (p.secteur_personnalise) persoLignes.push({ type: 'secteur', nom: p.secteur_personnalise, g });
        (p.sous_secteurs_personnalises || []).forEach(nom => persoLignes.push({ type: 'sous-secteur', nom, g }));
      });
      set('esp-personnalisations', persoLignes.map(l =>
        '<div class="div-block-331">' +
        '<div class="text-block-75">' + esc(l.nom) + '</div>' +
        '<div class="text-block-77">' + l.type + ' créé dans <a href="#" data-esp-gouv="' + esc(l.g ? l.g.id : '') + '">' + esc(l.g ? (l.g.titre || 'Sans titre') : '?') + '</a></div>' +
        '</div>').join(''));

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
