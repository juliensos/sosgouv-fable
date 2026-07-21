// ============================================================
// SOSGOUV - personnalites.js
// Liste alphabétique groupée par lettre, filtres (statut,
// ordre alpha/métier), like/unlike, épingler, fiche détaillée,
// ajout simple, édition admin.
// Statuts : 0 néant | 1 jamais | 2 sous condition | 3 ok
// ============================================================
const Perso = {
  all: [],
  likes: new Set(),
  epingles: new Set(),
  filtreStatut: 'tous',
  ordre: 'alpha', // 'alpha' | 'metier'

  STATUTS: { 0: 'néant', 1: 'jamais', 2: 'sous condition', 3: 'ok' },
  STATUT_CLASSES: { 0: 'statut-neant', 1: 'statut-jamais', 2: 'statut-cond', 3: 'statut-ok' },

  // ---------- Chargement ----------
  async loadList() {
    const cont = document.getElementById('liste-personnalites');
    if (cont) cont.innerHTML = '<div class="loading">Chargement…</div>';
    try {
      const { data, error } = await sb
        .from('personnalites')
        .select('*')
        .order('nom', { ascending: true });
      if (error) throw error;
      this.all = data || [];
      await this.loadBrouillons();
      await this.loadUserMarks();
      this.render();
    } catch (err) {
      if (cont) cont.innerHTML = '<div class="error-msg">Erreur de chargement : ' + err.message + '</div>';
    }
  },

  async loadUserMarks() {
    this.likes = new Set();
    this.epingles = new Set();
    this.likesCount = {};
    // Compteur public de likes (toutes personnalités)
    try {
      const { data: allLikes } = await sb.from('personnalites_likes').select('personnalite_id');
      (allLikes || []).forEach(r => {
        this.likesCount[r.personnalite_id] = (this.likesCount[r.personnalite_id] || 0) + 1;
      });
    } catch (err) { /* compteur facultatif */ }
    if (!Auth.isLoggedIn()) return;
    const uid = Auth.currentUser.id;
    const [lk, ep] = await Promise.all([
      sb.from('personnalites_likes').select('personnalite_id').eq('user_id', uid),
      sb.from('personnalites_epingles').select('personnalite_id').eq('user_id', uid)
    ]);
    (lk.data || []).forEach(r => this.likes.add(r.personnalite_id));
    (ep.data || []).forEach(r => this.epingles.add(r.personnalite_id));
  },

  // ---------- Rendu ----------
  filtered() {
    let list = this.all.slice();
    if (this.filtreStatut !== 'tous') {
      list = list.filter(p => p.statut === Number(this.filtreStatut));
    }
    if (this.ordre === 'metier') {
      list.sort((a, b) => ((a.metiers || [])[0] || '').localeCompare((b.metiers || [])[0] || '', 'fr'));
    } else {
      list.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
    }
    return list;
  },

  render() {
    const cont = document.getElementById('liste-personnalites');
    if (!cont) return;
    const list = this.filtered();
    if (!list.length) {
      cont.innerHTML = '<div class="empty-msg">Aucune personnalité.</div>';
      return;
    }

    let html = '';
    let currentGroup = null;
    for (const p of list) {
      const groupKey = this.ordre === 'metier'
        ? ((p.metiers || [])[0] || 'Sans métier')
        : (p.nom || '?').charAt(0).toUpperCase();
      if (groupKey !== currentGroup) {
        currentGroup = groupKey;
        html += '<h2 class="heading-31 groupe-lettre">' + this.esc(groupKey) + '</h2>';
      }
      html += this.cardHTML(p);
    }
    cont.innerHTML = html;
    this.bindCards(cont);
  },

  cardHTML(p) {
    const liked = this.likes.has(p.id);
    const pinned = this.epingles.has(p.id);
    const metiers = (p.metiers || []).join(', ');
    return `
    <div class="perso-card _3-grid-perso" data-id="${p.id}">
      <div class="nom-prenom-metier">
        <a href="#" class="w-inline-block btn-fiche">
          <div class="nom-pr-nom">
            <h4 class="heading-4-nom-prenom">${this.esc(p.nom)}</h4>
            <h4 class="heading-4-nom-prenom">${this.esc(p.prenom || '')}</h4>
          </div>
        </a>
        <div class="bloc-metier">
          <h4 class="heading-4-nom-prenom grey">${this.esc(metiers)}</h4>
        </div>
        <div class="fontello-statut _${p.statut}" title="${this.STATUTS[p.statut] || ''}">${[ICO.cross, ICO.cross, ICO.cond, ICO.check2][p.statut] || ''}</div>
      </div>
      <div class="boutons-perso-group">
        <a href="#" class="like-bloc btn-like ${liked ? 'active' : ''}" title="Like">
          <div class="_2-picto-fontello-bouton black-stroke">${liked ? ICO.likeFull : ICO.like}</div>
          <div class="_w-courant _w-bold _w-pink"><sup class="like-count">${this.likesCount[p.id] || 0}</sup></div>
        </a>
        <a href="#" class="_2-mini-bouton mini w-inline-block btn-pin ${pinned ? 'active' : ''}" title="Épingler">
          <div class="_2-picto-fontello-bouton">${ICO.pin}</div>
        </a>
        ${(this._brouillons && this._brouillons.length) ? `<a href="#" class="_2-mini-bouton mini w-inline-block btn-draft" title="Ajouter à un de mes brouillons">
          <div class="_2-picto-fontello-bouton">${ICO.draft}</div>
        </a>` : ''}
        ${Auth.isAdmin() ? '<a href="#" class="_2-mini-bouton mini w-inline-block btn-edit" title="Modifier (admin)"><div class="_2-picto-fontello-bouton">' + ICO.edit + '</div></a>' : ''}
        ${(Auth.isAdmin() || (Auth.isLoggedIn() && p.ajoute_par === Auth.currentUser.id)) ? '<a href="#" class="_2-mini-bouton mini w-inline-block btn-del-perso" title="Supprimer"><div class="_2-picto-fontello-bouton">' + ICO.trash + '</div></a>' : ''}
      </div>
      ${p.short_bio ? '<p class="short-bio">' + this.esc(p.short_bio) + '</p>' : ''}
    </div>`;
  },

  // ---------- v44 : ajout d'une personnalité à un brouillon enregistré ----------
  async loadBrouillons() {
    this._brouillons = [];
    if (!Auth.isLoggedIn()) return;
    try {
      const { data } = await sb.from('gouvernements').select('id, titre')
        .eq('created_by', Auth.currentUser.id).eq('is_published', false);
      this._brouillons = data || [];
    } catch (err) { /* le picto sera simplement absent */ }
  },

  fermerChoixBrouillon() {
    const pop = document.getElementById('brouillon-pop');
    if (pop) pop.remove();
    if (this._fermePop) { document.removeEventListener('click', this._fermePop); this._fermePop = null; }
  },

  ouvrirChoixBrouillon(ancre, persoId) {
    if (!Auth.isLoggedIn()) return UI.toast('Connectez-vous.');
    if (!this._brouillons || !this._brouillons.length) return;
    this.fermerChoixBrouillon();
    const pop = document.createElement('div');
    pop.id = 'brouillon-pop';
    const r = ancre.getBoundingClientRect();
    pop.style.top = Math.round(r.bottom + 4) + 'px';
    pop.style.left = Math.round(Math.max(4, Math.min(r.left, (window.innerWidth || 1000) - 350))) + 'px';
    pop.innerHTML = '<div class="bp-titre">Ajouter à quel brouillon ?</div>' +
      this._brouillons.map(b =>
        '<a href="#" class="bp-item" data-bid="' + this.esc(b.id) + '">' + this.esc(b.titre || 'Sans titre') + '</a>').join('');
    document.body.appendChild(pop);
    pop.querySelectorAll('.bp-item').forEach(a => a.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.choisirPosteBrouillon(pop, a.dataset.bid, persoId);
    }));
    this._fermePop = (ev) => { if (!pop.contains(ev.target)) this.fermerChoixBrouillon(); };
    setTimeout(() => document.addEventListener('click', this._fermePop), 0);
  },

  async choisirPosteBrouillon(pop, brouillonId, persoId) {
    try {
      const { data: postes } = await sb.from('postes_gouvernement')
        .select('id, nom_poste_personnalise, personnalite_id, ordre')
        .eq('gouvernement_id', brouillonId).order('ordre', { ascending: true });
      if (!postes || !postes.length) {
        UI.toast('Ce brouillon n\'a aucun poste enregistré.');
        return this.fermerChoixBrouillon();
      }
      const nomDe = (pid) => {
        const p = (this.all || []).find(x => x.id === pid);
        return p ? ((p.prenom || '') + ' ' + p.nom).trim() : '?';
      };
      pop.innerHTML = '<div class="bp-titre">À quel poste ?</div>' + postes.map(po =>
        '<a href="#" class="bp-item" data-pid="' + this.esc(po.id) + '">' +
        this.esc(po.nom_poste_personnalise || 'Poste') +
        '<span class="bp-occupant">' + (po.personnalite_id ? this.esc(nomDe(po.personnalite_id)) : 'vacant') + '</span></a>').join('');
      pop.querySelectorAll('.bp-item').forEach(a => a.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try {
          const { error } = await sb.from('postes_gouvernement')
            .update({ personnalite_id: persoId }).eq('id', a.dataset.pid);
          if (error) throw error;
          const perso = (this.all || []).find(x => x.id === persoId);
          UI.toast((perso ? ((perso.prenom || '') + ' ' + perso.nom).trim() : 'Personnalité') + ' ajouté(e) au brouillon.');
        } catch (err) { UI.toast('Erreur : ' + err.message); }
        this.fermerChoixBrouillon();
      }));
    } catch (err) {
      UI.toast('Erreur : ' + err.message);
      this.fermerChoixBrouillon();
    }
  },

  bindCards(cont) {
    cont.querySelectorAll('.perso-card').forEach(card => {
      const id = card.dataset.id;
      const btnLike = card.querySelector('.btn-like');
      const btnDraft = card.querySelector('.btn-draft');
      if (btnDraft) btnDraft.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.ouvrirChoixBrouillon(btnDraft, id);
      });

      const btnPin = card.querySelector('.btn-pin');
      const btnFiche = card.querySelector('.btn-fiche');
      const btnEdit = card.querySelector('.btn-edit');
      if (btnLike) btnLike.addEventListener('click', () => this.toggleLike(id, btnLike));
      if (btnPin) btnPin.addEventListener('click', () => this.togglePin(id, btnPin));
      if (btnFiche) btnFiche.addEventListener('click', () => this.openFiche(id));
      if (btnEdit) btnEdit.addEventListener('click', () => this.openAdminEdit(id));
      const btnDel = card.querySelector('.btn-del-perso');
      if (btnDel) btnDel.addEventListener('click', () => this.deletePerso(id));
    });
  },

  // ---------- Like / Épingler ----------
  async toggleLike(id, btn) {
    if (!Auth.isLoggedIn()) return UI.toast('Connectez-vous pour liker.');
    const uid = Auth.currentUser.id;
    try {
      if (this.likes.has(id)) {
        await sb.from('personnalites_likes').delete()
          .eq('user_id', uid).eq('personnalite_id', id);
        this.likes.delete(id);
        this.likesCount[id] = Math.max(0, (this.likesCount[id] || 1) - 1);
        if (btn) {
          btn.classList.remove('active');
          const c = btn.querySelector('.like-count');
          if (c) c.textContent = this.likesCount[id];
        }
      } else {
        await sb.from('personnalites_likes').insert({ user_id: uid, personnalite_id: id });
        this.likesCount[id] = (this.likesCount[id] || 0) + 1;
        this.likes.add(id);
        if (btn) {
          btn.classList.add('active');
          const c = btn.querySelector('.like-count');
          if (c) c.textContent = this.likesCount[id];
        }
      }
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  async togglePin(id, btn) {
    if (!Auth.isLoggedIn()) return UI.toast('Connectez-vous pour épingler.');
    const uid = Auth.currentUser.id;
    try {
      if (this.epingles.has(id)) {
        await sb.from('personnalites_epingles').delete()
          .eq('user_id', uid).eq('personnalite_id', id);
        this.epingles.delete(id);
        if (btn) btn.classList.remove('active');
      } else {
        await sb.from('personnalites_epingles').insert({ user_id: uid, personnalite_id: id });
        this.epingles.add(id);
        if (btn) btn.classList.add('active');
      }
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  // ---------- Fiche détaillée ----------
  // v46 : mise en page reprise de la maquette (blocbio avec photo,
  // boutons d'action, sections en boldsimple, médias en bloc-video,
  // liens en bloc-links, mention d'assistance IA et sources).
  openFiche(id) {
    const p = this.all.find(x => x.id === id);
    if (!p) return;
    const cont = document.getElementById('fiche-contenu');
    if (!cont) return;
    const liensArr = Array.isArray(p.liens) ? p.liens : [];
    const videos = liensArr.filter(l => l && (l.type === 'video' || this.videoEmbedUrl(l.url)));
    const autres = liensArr.filter(l => l && l.type !== 'video' && !this.videoEmbedUrl(l.url));
    const videosHtml = videos.map(l => {
      const embed = this.videoEmbedUrl(l.url);
      if (embed) return '<div class="div-block-341"><div class="w-video w-embed fiche-video"><iframe src="' + this.esc(embed) + '" frameborder="0" allowfullscreen loading="lazy"></iframe></div><div class="legendesimple">' + this.esc(l.titre || '') + '</div></div>';
      return '<a class="liensimple" href="' + this.esc(l.url) + '" target="_blank" rel="noopener">' + this.esc(l.titre || l.url) + '</a>';
    }).join('');
    const liens = autres.map(l =>
      '<a class="liensimple" href="' + this.esc(l.url || l) + '" target="_blank" rel="noopener">' + this.esc(l.titre || l.url || l) + '</a>'
    ).join('');
    // Découpage de la bio en sections : récit narratif éventuel, puis les deux
    // sections structurées (voir Perso.decouperBio, utilisé aussi par la page
    // de validation des propositions IA pour prévisualiser à l'identique).
    const { narrative: bioNarrative, expertise, engagements, libre: bioLibre } = this.decouperBio(p.bio);
    const titreSection = (t) => '<div class="_3-title-bloc-padd-10-left"><h5><strong class="boldsimple">' + t + '</strong></h5></div>';
    const liked = this.likes.has(p.id);
    const pinned = this.epingles.has(p.id);
    const sources = Array.isArray(p.sources) ? p.sources.filter(Boolean) : [];
    const mentionIA = (sources.length || p.enrichi_par_ia_le)
      ? '<div class="filet _2v"></div><div class="div-block-340">' +
        '<div>La rédaction de cette fiche a été assistée par une IA' +
        (sources.length ? ' en utilisant les sources mentionnées ci-dessous' : '') +
        '. Si des informations vous semblent fausses, incomplètes ou erronées, merci de le signaler à l\'administrateur du site ' +
        '<a class="liensimple" href="mailto:etienneneville@gmail.com">etienneneville@gmail.com</a></div>' +
        sources.map(u => '<a class="liensimple" href="' + this.esc(u) + '" target="_blank" rel="noopener">' + this.esc(u) + '</a>').join('') +
        '</div>'
      : '';
    cont.innerHTML = `
      <div class="item">
        <div class="_3-title-bloc-padd-10-left">
          <div class="blocbio">
            <div class="image-fiche">${p.photo_url ? '<img src="' + this.esc(p.photo_url) + '" alt="' + this.esc((p.prenom ? p.prenom + ' ' : '') + p.nom) + '" loading="lazy"/>' : ''}</div>
            <div class="infobio">
              <div class="div-block-339">
                <div class="flex---gap-5">
                  <div class="flex---gap-0">
                    <h2 class="heading-4-nom-prenom">${this.esc(p.nom)}</h2>
                    <h2 class="heading-4-nom-prenom">${this.esc(p.prenom || '')}</h2>
                  </div>
                  <h2 class="heading-4-nom-prenom grey">${this.esc((p.metiers || []).join(', '))}</h2>
                </div>
                <div class="flex---gap-10">
                  <div class="flex---gap-5 fiche-statut">
                    <div>Statut :</div>
                    <div>${this.esc(this.STATUTS[p.statut] || 'néant')}</div>
                    <div class="fontello-statut _${p.statut}">${[ICO.cross, ICO.cross, ICO.cond, ICO.check2][p.statut] || ''}</div>
                  </div>
                  <div class="boutons-perso-group">
                    <a href="#" class="like-bloc fiche-btn-like ${liked ? 'active' : ''}" data-bulle="Like">
                      <div class="_2-picto-fontello-bouton black-stroke">${liked ? ICO.likeFull : ICO.like}</div>
                      <div class="_w-courant _w-bold _w-pink"><sup class="like-count">${(this.likesCount || {})[p.id] || 0}</sup></div>
                    </a>
                    <a href="#" class="_2-mini-bouton mini w-inline-block fiche-btn-pin ${pinned ? 'active' : ''}" data-bulle="Épingler dans mon activité">
                      <div class="_2-picto-fontello-bouton">${ICO.pin}</div>
                      <h6 class="heading-dyn mini">épingler</h6>
                    </a>
                    ${(this._brouillons && this._brouillons.length) ? `<a href="#" class="_2-mini-bouton mini w-inline-block fiche-btn-draft" data-bulle="Ajouter à un de mes brouillons">
                      <div class="_2-picto-fontello-bouton">${ICO.draft}</div>
                      <h6 class="heading-dyn mini">brouillon</h6>
                    </a>` : ''}
                    <a href="#" class="_2-mini-bouton mini w-inline-block fiche-btn-share" data-bulle="Faire suivre par email">
                      <div class="_2-picto-fontello-bouton">${ICO.shareMini}</div>
                      <h6 class="heading-dyn mini">faire suivre</h6>
                    </a>
                  </div>
                </div>
              </div>
              ${p.short_bio ? '<p>' + this.esc(p.short_bio) + '</p>' : ''}
              ${bioNarrative ? '<p>' + this.esc(bioNarrative) + '</p>' : ''}
            </div>
          </div>
        </div>
        ${expertise ? titreSection('Domaines de recherche et expertise') + '<p>' + this.esc(expertise) + '</p>' : ''}
        ${engagements ? titreSection('Engagements et positionnements politiques') + '<p>' + this.esc(engagements) + '</p>' : ''}
        ${bioLibre ? '<p>' + this.esc(bioLibre) + '</p>' : ''}
        <div id="fiche-propositions"></div>
        ${(videosHtml || liens) ? '<div class="filet _2v"></div>' + titreSection('médias') : ''}
        ${videosHtml ? '<div class="bloc-video">' + videosHtml + '</div>' : ''}
        ${liens ? '<div class="bloc-links">' + liens + '</div>' : ''}
        ${mentionIA}
      </div>
    `;
    // Boutons d'action de la fiche : mêmes mécaniques que sur les cartes
    const bLike = cont.querySelector('.fiche-btn-like');
    if (bLike) bLike.addEventListener('click', (e) => { e.preventDefault(); this.toggleLike(p.id, bLike); });
    const bPin = cont.querySelector('.fiche-btn-pin');
    if (bPin) bPin.addEventListener('click', (e) => { e.preventDefault(); this.togglePin(p.id, bPin); });
    const bDraft = cont.querySelector('.fiche-btn-draft');
    if (bDraft) bDraft.addEventListener('click', (e) => { e.preventDefault(); this.ouvrirChoixBrouillon(bDraft, p.id); });
    const bShare = cont.querySelector('.fiche-btn-share');
    if (bShare) bShare.addEventListener('click', (e) => {
      e.preventDefault();
      const nomComplet = ((p.prenom ? p.prenom + ' ' : '') + p.nom).trim();
      const corps = 'Découvre la fiche de ' + nomComplet + ' sur GOVLAB :\n' +
        (p.short_bio ? p.short_bio + '\n' : '') + '\nhttps://govlab.fr';
      window.location.href = 'mailto:?subject=' + encodeURIComponent('GOVLAB, ' + nomComplet) +
        '&body=' + encodeURIComponent(corps);
    });
    UI.openModal('modal-fiche');
    this.loadPropositions(id);
  },

  // Gouvernements publiés où la personnalité est proposée
  async loadPropositions(id) {
    const cont = document.getElementById('fiche-propositions');
    if (!cont) return;
    try {
      const [postes, gouvs, users] = await Promise.all([
        sb.from('postes_gouvernement').select('*').eq('personnalite_id', id),
        sb.from('gouvernements').select('id, titre, is_published, created_by'),
        sb.from('users').select('id, username')
      ]);
      const items = (postes.data || []).map(po => {
        const g = (gouvs.data || []).find(x => x.id === po.gouvernement_id && x.is_published);
        if (!g) return null;
        const u = (users.data || []).find(x => x.id === g.created_by);
        const role = po.nom_poste_personnalise || po.fonction_delegue || 'Membre';
        return '<div class="flex---gap-5"><div class="_w-courant">' + this.esc(role) + '</div>' +
          '<div class="_w-courant _w-mini">par</div>' +
          '<div class="_w-courant _2-code-link-button">' + this.esc(u ? u.username : '?') + '</div>' +
          '<div class="_w-courant _w-mini">(' + this.esc(g.titre || 'Sans titre') + ')</div></div>';
      }).filter(Boolean);
      if (items.length) {
        // v46 : bloc-proposition conforme à la maquette
        cont.innerHTML = '<div class="filet _2v"></div><div class="bloc-proposition">' +
          '<div class="_3-title-bloc-padd-10-left"><h5><strong class="boldsimple">Personnalité proposée au poste de</strong></h5></div>' +
          items.join('') + '</div>';
      }
    } catch (err) { /* section facultative */ }
  },

  // ---------- Anti-doublons (v44) ----------
  normaliserNom(s) {
    return String(s || '').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  },
  levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  },
  // Cherche une fiche déjà existante correspondant probablement à
  // nom/prénom : identique (casse et accents ignorés), proche (une ou
  // deux lettres d'écart), ou inversée (nom et prénom permutés).
  chercherDoublon(nom, prenom, liste) {
    const n = this.normaliserNom(nom), p = this.normaliserNom(prenom);
    const proches = (x, y) => x === y ||
      (!!x && !!y && Math.abs(x.length - y.length) <= 2 && this.levenshtein(x, y) <= (Math.min(x.length, y.length) >= 5 ? 2 : 1));
    for (const cand of (liste || [])) {
      const cn = this.normaliserNom(cand.nom), cp = this.normaliserNom(cand.prenom);
      if (proches(n, cn) && proches(p, cp)) {
        return { type: (n === cn && p === cp) ? 'identique' : 'proche', perso: cand };
      }
      if ((n || p) && proches(n, cp) && proches(p, cn)) return { type: 'inverse', perso: cand };
    }
    return null;
  },
  // true = on peut créer, false = abandon demandé par l'utilisateur
  async confirmerSiDoublon(nom, prenom) {
    try {
      let liste = (this.all && this.all.length) ? this.all : null;
      if (!liste) {
        const { data } = await sb.from('personnalites').select('id, nom, prenom');
        liste = data || [];
      }
      const d = this.chercherDoublon(nom, prenom, liste);
      if (!d) return true;
      const existant = ((d.perso.prenom || '') + ' ' + (d.perso.nom || '')).trim();
      const msgs = {
        identique: 'La fiche « ' + existant + ' » existe déjà dans la base. Créer quand même un doublon ?',
        proche: 'Une fiche très proche existe déjà : « ' + existant + ' » (faute de frappe ou d\'accent ?). Créer quand même une nouvelle fiche ?',
        inverse: 'Attention : « ' + existant + ' » existe déjà, avec le nom et le prénom dans l\'autre sens. Vérifiez vos champs nom et prénom. Créer quand même une nouvelle fiche ?'
      };
      return window.confirm(msgs[d.type]);
    } catch (err) { return true; /* en cas de pépin, ne pas bloquer l'ajout */ }
  },

  // ---------- Ajout simple (section 3, clone du modal du composer) ----------
  async addSimple() {
    if (!UI.requireAuth()) return;
    const nom = document.getElementById('pNom').value.trim();
    const prenom = document.getElementById('pPrenom').value.trim();
    if (!nom || !prenom) return UI.toast('Nom et prénom sont obligatoires.');
    if (!(await this.confirmerSiDoublon(nom, prenom))) return;
    const metier = document.getElementById('pMetier').value.trim();
    const wiki = document.getElementById('pWiki').value.trim();
    const liens = [];
    document.querySelectorAll('#pVideoRows .map-video-input').forEach(inp => {
      const v = inp.value.trim();
      if (v) liens.push({ type: 'video', titre: 'Vidéo', url: v });
    });
    document.querySelectorAll('#pLienRows .map-lien-input').forEach(inp => {
      const v = inp.value.trim();
      if (v) liens.push({ type: 'lien', titre: 'Document', url: v });
    });
    if (wiki) liens.push({ type: 'lien', titre: 'Fiche Wikipédia', url: wiki });
    try {
      const { error } = await sb.from('personnalites').insert({
        nom, prenom,
        metiers: metier ? [metier] : [],
        liens,
        statut: 0,
        ajoute_par: Auth.currentUser.id
      });
      if (error) throw error;
      ['pNom', 'pPrenom', 'pMetier', 'pWiki'].forEach(id => { document.getElementById(id).value = ''; });
      ['pVideoRows', 'pLienRows'].forEach(id => {
        const zone = document.getElementById(id);
        zone.querySelectorAll('.div-block-332').forEach((row, i) => { if (i > 0) row.remove(); });
        const premier = zone.querySelector('input');
        if (premier) premier.value = '';
      });
      if (window.Gouv) Gouv.persosCache = null;
      this.all = [];
      UI.toast('Personnalité « ' + prenom + ' ' + nom + ' » ajoutée !');
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  // ---------- Suppression ----------
  async deletePerso(id) {
    const p = this.all.find(x => x.id === id);
    if (!p) return;
    const droit = Auth.isAdmin() || (Auth.isLoggedIn() && p.ajoute_par === Auth.currentUser.id);
    if (!droit) return UI.toast('Vous ne pouvez supprimer que les personnalités que vous avez ajoutées.');
    const nomComplet = (p.prenom ? p.prenom + ' ' : '') + p.nom;
    try {
      // Protection : présence dans des gouvernements publiés
      const [postes, gouvs] = await Promise.all([
        sb.from('postes_gouvernement').select('gouvernement_id').eq('personnalite_id', id),
        sb.from('gouvernements').select('id, is_published')
      ]);
      const publies = new Set((gouvs.data || []).filter(g => g.is_published).map(g => g.id));
      const nbPublies = new Set((postes.data || [])
        .map(po => po.gouvernement_id)
        .filter(gid => publies.has(gid))).size;
      if (nbPublies > 0 && !Auth.isAdmin()) {
        return UI.toast(nomComplet + ' figure dans ' + nbPublies + ' gouvernement(s) publié(s) : suppression impossible.');
      }
      const message = nbPublies > 0
        ? 'Attention : ' + nomComplet + ' figure dans ' + nbPublies + ' gouvernement(s) publié(s). Les postes concernés deviendront vacants. Supprimer quand même ?'
        : 'Supprimer ' + nomComplet + ' ? Cette action est définitive.';
      if (!window.confirm(message)) return;
      const { error } = await sb.from('personnalites').delete().eq('id', id);
      if (error) throw error;
      UI.toast('Personnalité supprimée.');
      this.loadList();
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  // ---------- Edition admin ----------
  videoEmbedUrl(url) {
    if (!url) return null;
    let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
    if (m) return 'https://www.youtube.com/embed/' + m[1];
    m = url.match(/vimeo\.com\/(\d+)/);
    if (m) return 'https://player.vimeo.com/video/' + m[1];
    m = url.match(/dailymotion\.com\/video\/([\w]+)/);
    if (m) return 'https://www.dailymotion.com/embed/video/' + m[1];
    return null;
  },

  _admLiens: [],

  renderAdmLiens() {
    const cont = document.getElementById('admLiensListe');
    if (!cont) return;
    cont.innerHTML = this._admLiens.map((l, i) =>
      '<div class="adm-lien-item">' +
      '<span class="adm-lien-type">' + (l.type === 'video' ? '&#127916;' : '&#128279;') + '</span> ' +
      '<span class="adm-lien-titre">' + this.esc(l.titre || l.url) + '</span> ' +
      '<button class="btn-icone adm-lien-del" data-idx="' + i + '" title="Supprimer">&times;</button>' +
      '</div>'
    ).join('') || '<div class="adm-lien-vide">Aucun document pour le moment.</div>';
    cont.querySelectorAll('.adm-lien-del').forEach(btn => btn.addEventListener('click', (e) => {
      e.preventDefault();
      this._admLiens.splice(Number(btn.dataset.idx), 1);
      this.renderAdmLiens();
    }));
  },

  admAddLien() {
    const type = document.getElementById('admLienType').value;
    const titre = document.getElementById('admLienTitre').value.trim();
    let url = document.getElementById('admLienUrl').value.trim();
    if (!url) return UI.toast('Indiquez une URL.');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    this._admLiens.push({ type, titre, url });
    document.getElementById('admLienTitre').value = '';
    document.getElementById('admLienUrl').value = '';
    this.renderAdmLiens();
  },

  openAdminEdit(id) {
    if (!Auth.isAdmin()) return;
    const p = this.all.find(x => x.id === id);
    if (!p) return;
    document.getElementById('admNom').value = p.nom || '';
    document.getElementById('admPrenom').value = p.prenom || '';
    document.getElementById('admMetiers').value = (p.metiers || []).join(', ');
    const admPhoto = document.getElementById('admPhoto');
    if (admPhoto) admPhoto.value = p.photo_url || '';
    document.getElementById('admShortBio').value = p.short_bio || '';
    document.getElementById('admBio').value = p.bio || '';
    document.getElementById('admStatut').value = String(p.statut ?? 0);
    this._admLiens = Array.isArray(p.liens) ? p.liens.map(l => ({ ...l })) : [];
    this.renderAdmLiens();
    document.getElementById('admSaveBtn').dataset.id = id;
    UI.openModal('modal-admin-perso');
  },

  async adminSave() {
    const id = document.getElementById('admSaveBtn').dataset.id;
    if (!id) return;
    try {
      const { error } = await sb.from('personnalites').update({
        nom: document.getElementById('admNom').value.trim(),
        prenom: document.getElementById('admPrenom').value.trim(),
        metiers: document.getElementById('admMetiers').value.split(',').map(s => s.trim()).filter(Boolean),
        photo_url: (document.getElementById('admPhoto') || { value: '' }).value.trim() || null,
        short_bio: document.getElementById('admShortBio').value,
        bio: document.getElementById('admBio').value,
        liens: this._admLiens,
        statut: Number(document.getElementById('admStatut').value)
      }).eq('id', id);
      if (error) throw error;
      UI.toast('Fiche mise à jour.');
      UI.closeModals();
      this.loadList();
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  // ---------- Utilitaires ----------
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // Découpe une bio en {narrative, expertise, engagements, libre}. Repère les
  // marqueurs par leur position dans le texte, sans exiger de ligne vide
  // (l'agent d'enrichissement écrit tout en un seul bloc continu). `libre`
  // n'est renseigné que si aucun marqueur n'est trouvé du tout.
  decouperBio(bio) {
    let expertise = '', engagements = '', narrative = '', libre = '';
    if (bio) {
      const idxExp = bio.search(/Domaines de recherche et expertise\s*:/);
      if (idxExp !== -1) {
        narrative = bio.slice(0, idxExp).trim();
        const reste = bio.slice(idxExp).replace(/^Domaines de recherche et expertise\s*:\s*/, '');
        const idxEng = reste.search(/Engagements et positionnements politiques\s*:/);
        if (idxEng !== -1) {
          expertise = reste.slice(0, idxEng).trim();
          engagements = reste.slice(idxEng).replace(/^Engagements et positionnements politiques\s*:\s*/, '').trim();
        } else {
          expertise = reste.trim();
        }
      } else {
        libre = bio;
      }
    }
    return { narrative, expertise, engagements, libre };
  },

  // Réciproque de decouperBio : reconstruit une bio unique à partir des trois
  // parties, avec les marqueurs attendus, pour l'enregistrement en base.
  assemblerBio(narrative, expertise, engagements) {
    let out = (narrative || '').trim();
    if ((expertise || '').trim()) {
      out += (out ? '\n\n' : '') + 'Domaines de recherche et expertise : ' + expertise.trim();
    }
    if ((engagements || '').trim()) {
      out += (out ? '\n\n' : '') + 'Engagements et positionnements politiques : ' + engagements.trim();
    }
    return out;
  },

  init() {
    if (this._initDone) return;
    this._initDone = true;
    const btnAdd = document.getElementById('pAjouter');
    if (btnAdd) btnAdd.addEventListener('click', (e) => { e.preventDefault(); this.addSimple(); });
    // Boutons + : lignes de liens supplémentaires
    const dupliqueRow = (zoneId) => (e) => {
      e.preventDefault();
      const zone = document.getElementById(zoneId);
      if (!zone) return;
      const modele = zone.querySelector('.div-block-332');
      const copie = modele.cloneNode(true);
      const inp = copie.querySelector('input');
      inp.value = '';
      const btn = copie.querySelector('a');
      if (btn) btn.remove();
      zone.appendChild(copie);
      inp.focus();
    };
    const pAddVideo = document.getElementById('pAddVideo');
    if (pAddVideo) pAddVideo.addEventListener('click', dupliqueRow('pVideoRows'));
    const pAddLien = document.getElementById('pAddLien');
    if (pAddLien) pAddLien.addEventListener('click', dupliqueRow('pLienRows'));

    const selStatut = document.getElementById('filtreStatut');
    if (selStatut && selStatut.tagName === 'SELECT') selStatut.addEventListener('change', () => {
      this.filtreStatut = selStatut.value;
      this.render();
    });

    const selOrdre = document.getElementById('filtreOrdre');
    if (selOrdre && selOrdre.tagName === 'SELECT') selOrdre.addEventListener('change', () => {
      this.ordre = selOrdre.value;
      this.render();
    });

    // Dropdowns maquette (mêmes composants que la page gouvernements)
    const bindDrop = (toggleId, listId, labelId, attr, cb) => {
      const toggle = document.getElementById(toggleId);
      const list = document.getElementById(listId);
      if (!toggle || !list) return;
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.dropdown-list-4.w--open').forEach(l => { if (l !== list) l.classList.remove('w--open'); });
        list.classList.toggle('w--open');
      });
      document.addEventListener('click', (e) => {
        if (!list.contains(e.target) && !toggle.contains(e.target)) list.classList.remove('w--open');
      });
      list.querySelectorAll('[' + attr + ']').forEach(a => a.addEventListener('click', (e) => {
        e.preventDefault();
        const label = document.getElementById(labelId);
        if (label) label.textContent = a.textContent.trim();
        list.classList.remove('w--open');
        cb(a.getAttribute(attr));
      }));
    };
    bindDrop('filtreStatutToggle', 'filtreStatutList', 'filtreStatutLabel', 'data-statut', v => {
      this.filtreStatut = v === '' ? 'tous' : Number(v);
      this.render();
    });
    bindDrop('ordreListeToggle', 'ordreListeList', 'ordreListeLabel', 'data-ordre', v => {
      this.ordre = v;
      this.render();
    });

    const admSave = document.getElementById('admSaveBtn');
    if (admSave) admSave.addEventListener('click', (e) => { e.preventDefault(); this.adminSave(); });

    const admAddLien = document.getElementById('admLienAddBtn');
    if (admAddLien) admAddLien.addEventListener('click', (e) => { e.preventDefault(); this.admAddLien(); });
  }
};

window.Perso = Perso;
document.addEventListener('DOMContentLoaded', () => Perso.init());
