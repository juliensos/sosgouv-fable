// ============================================================
// SOSGOUV - gouvernement.js
// Composition d'un gouvernement : postes régaliens fixes,
// ministères non-régaliens ajoutables, délégués ministériels,
// autocomplete personnalités, sous-secteurs modifiables,
// brouillon / publication. Liste des gouvernements publiés,
// détail, vote 1-5, épinglage, commentaires.
// ============================================================
const Gouv = {
  secteurs: [],
  sousSecteursDefaut: {},   // secteur_id -> [sous_secteur]
  composerState: null,
  published: [],
  votesUser: {},            // gouvernement_id -> note
  epingles: new Set(),
  refLoaded: false,

  // ================== REFERENTIELS ==================
  async loadReferentiels() {
    if (this.refLoaded) return;
    const [sec, liaison, sousSec] = await Promise.all([
      sb.from('secteurs').select('*').order('ordre', { ascending: true }),
      sb.from('secteurs_sous_secteurs_defaut').select('*'),
      sb.from('sous_secteurs').select('*')
    ]);
    if (sec.error) throw sec.error;
    this.secteurs = sec.data || [];
    const sousById = {};
    (sousSec.data || []).forEach(s => sousById[s.id] = s);
    this.sousSecteursDefaut = {};
    (liaison.data || []).forEach(l => {
      if (!this.sousSecteursDefaut[l.secteur_id]) this.sousSecteursDefaut[l.secteur_id] = [];
      const s = sousById[l.sous_secteur_id];
      if (s) this.sousSecteursDefaut[l.secteur_id].push(s);
    });
    this.refLoaded = true;
  },

  regaliens() { return this.secteurs.filter(s => s.type === 'regalien'); },
  nonRegaliens() { return this.secteurs.filter(s => s.type === 'non_regalien'); },

  // Cache des personnalités pour la recherche locale (insensible casse et accents)
  persosCache: null,
  norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  },
  async loadPersosCache() {
    const { data, error } = await sb
      .from('personnalites')
      .select('id, nom, prenom, metiers')
      .order('nom', { ascending: true });
    if (error) throw error;
    this.persosCache = data || [];
  },
  searchPersos(q) {
    const nq = this.norm(q);
    return (this.persosCache || []).filter(x =>
      this.norm(x.nom).includes(nq) || this.norm(x.prenom).includes(nq) ||
      this.norm((x.prenom || '') + ' ' + x.nom).includes(nq)
    );
  },

  // ================== COMPOSER (section 2) ==================
  async initComposer() {
    const cont = document.getElementById('composer-postes');
    if (!cont) return;
    if (this.composerState) return; // déjà initialisé, on garde l'état en cours
    cont.innerHTML = '<div class="loading">Chargement…</div>';
    try {
      await this.loadReferentiels();
      await this.loadPersosCache();
    } catch (err) {
      cont.innerHTML = '<div class="error-msg">Erreur : ' + err.message + '</div>';
      return;
    }

    this.composerState = {
      titre: '',
      description: '',
      postes: this.regaliens().map((s, i) => ({
        uid: 'reg-' + i,
        type: 'regalien',
        secteur: s,
        intitule: s.intitule_poste_defaut || s.nom,
        personnalite: null,
        sousSecteurs: (this.sousSecteursDefaut[s.id] || []).slice()
      }))
    };
    this.renderComposer();
  },

  resetComposer() {
    this.composerState = null;
    this.initComposer();
  },

  // Reprendre un brouillon existant dans le composer
  async loadDraft(id) {
    UI.showSection(2);
    try {
      await this.loadReferentiels();
      await this.loadPersosCache();
      const [gRes, ssRes, fusRes, allSous] = await Promise.all([
        sb.from('gouvernements')
          .select('*, users!created_by(username), postes_gouvernement(*, personnalites!personnalite_id(id, nom, prenom, statut), secteurs!secteur_id(nom))')
          .eq('id', id).single(),
        sb.from('postes_sous_secteurs').select('*'),
        sb.from('postes_secteurs_fusionnes').select('*'),
        sb.from('sous_secteurs').select('*')
      ]);
      if (gRes.error) throw gRes.error;
      const g = gRes.data;
      if (!g) return UI.toast('Brouillon introuvable.');
      const sousById = {};
      (allSous.data || []).forEach(s => sousById[s.id] = s);
      const postes = (g.postes_gouvernement || []).slice().sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
      this.composerState = {
        editingId: g.id,
        titre: g.titre || '',
        description: g.description || '',
        postes: postes.map((po, i) => {
          const secteur = po.secteur_id ? this.secteurs.find(s => s.id === po.secteur_id) : null;
          let intitule = po.nom_poste_personnalise || (secteur ? (secteur.intitule_poste_defaut || secteur.nom) : '');
          let suffixe = '';
          if (po.type === 'regalien' && secteur) {
            const base = secteur.intitule_poste_defaut || secteur.nom;
            if (intitule.startsWith(base)) {
              suffixe = intitule.slice(base.length).trim();
              intitule = base;
            }
          }
          return {
            uid: 'load-' + i,
            type: po.type,
            secteur,
            intitule,
            suffixe,
            fonction: po.fonction_delegue || '',
            personnalite: po.personnalites || null,
            sousSecteurs: (ssRes.data || [])
              .filter(r => r.poste_id === po.id)
              .map(r => sousById[r.sous_secteur_id])
              .filter(Boolean),
            fusion: (fusRes.data || [])
              .filter(r => r.poste_id === po.id)
              .map(r => this.secteurs.find(s => s.id === r.secteur_id))
              .filter(Boolean)
          };
        })
      };
      document.getElementById('gouvTitre').value = this.composerState.titre;
      document.getElementById('gouvDescription').value = this.composerState.description;
      this.renderComposer();
      UI.toast('Brouillon « ' + (g.titre || 'Sans titre') + ' » chargé. Modifiez puis enregistrez ou publiez.');
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  renderComposer() {
    const cont = document.getElementById('composer-postes');
    if (!cont || !this.composerState) return;
    cont.innerHTML = this.composerState.postes.map(p => this.posteHTML(p)).join('');
    this.composerState.postes.forEach(p => this.bindPoste(p));
  },

  posteHTML(p) {
    const perso = p.personnalite
      ? Perso.esc((p.personnalite.prenom || '') + ' ' + p.personnalite.nom)
      : '';
    const sous = (p.sousSecteurs || []).map(s => Perso.esc(s.nom)).join(' · ');
    const typeLabel = { regalien: 'Régalien', non_regalien: 'Ministère', delegue: 'Délégué ministériel' }[p.type];
    return `
    <div class="poste-bloc poste-${p.type}" id="poste-${p.uid}">
      <div class="poste-entete">
        <span class="poste-type">${typeLabel}</span>
        ${p.type === 'non_regalien'
          ? '<select class="poste-secteur-select' + (p.secteur ? '' : ' placeholder') + '">' +
            '<option value="" disabled' + (p.secteur ? '' : ' selected') + '>Secteur</option>' +
            this.nonRegaliens().map(s =>
              '<option value="' + s.id + '"' + (p.secteur && p.secteur.id === s.id ? ' selected' : '') + '>' + Perso.esc(s.nom) + '</option>'
            ).join('') + '</select>' +
            (p.secteur
              ? (p.fusion || []).map((s, fi) =>
                  '<span class="fusion-tag">+ ' + Perso.esc(s.nom) + ' <button class="btn-icone btn-fusion-del" data-fi="' + fi + '" title="Retirer">&times;</button></span>'
                ).join('') +
                '<select class="poste-fusion-select placeholder">' +
                '<option value="" disabled selected>+ fusionner avec…</option>' +
                this.nonRegaliens()
                  .filter(s => s.id !== p.secteur.id && !(p.fusion || []).some(f => f.id === s.id))
                  .map(s => '<option value="' + s.id + '">' + Perso.esc(s.nom) + '</option>').join('') +
                '</select>'
              : '')
          : '<span class="poste-secteur">' + (p.secteur ? Perso.esc(p.secteur.nom) : '') + '</span>'}
        ${p.type !== 'regalien' ? '<button class="btn-icone btn-remove-poste" title="Supprimer">&times;</button>' : ''}
      </div>
      ${p.type === 'regalien'
        ? '<div class="poste-intitule-verrou"><span class="intitule-base">' + Perso.esc(p.intitule) + '</span>' +
          (p.secteur && p.secteur.nom === 'Matignon'
            ? ''
            : '<input type="text" class="champ-texte poste-suffixe" value="' + Perso.esc(p.suffixe || '') + '" placeholder="Compléter">') +
          '</div>'
        : '<input type="text" class="champ-texte poste-intitule" value="' + Perso.esc(p.intitule) + '" placeholder="Intitulé du poste">'}
      ${p.type === 'delegue' ? '<input type="text" class="champ-texte poste-fonction" value="' + Perso.esc(p.fonction || '') + '" placeholder="Fonction (ex : chargé de la transition énergétique)">' : ''}
      <div class="poste-perso-row">
        <input type="text" class="champ-texte poste-perso-search" value="${perso}" placeholder="Rechercher une personnalité…" autocomplete="off">
        <button class="btn-loupe" title="Parcourir toutes les personnalités">&#128269;</button>
        <div class="autocomplete-results" style="display:none"></div>
      </div>
      ${p.type !== 'delegue' ? '<div class="poste-sous-secteurs">' + (sous || '<em>Aucun sous-secteur</em>') + ' <button class="btn-mini btn-edit-sous">modifier</button></div>' : ''}
    </div>`;
  },

  bindPoste(p) {
    const bloc = document.getElementById('poste-' + p.uid);
    if (!bloc) return;

    const intitule = bloc.querySelector('.poste-intitule');
    if (intitule) intitule.addEventListener('input', () => p.intitule = intitule.value);

    const secteurSelect = bloc.querySelector('.poste-secteur-select');
    if (secteurSelect) secteurSelect.addEventListener('change', () => {
      const s = this.nonRegaliens().find(x => x.id === secteurSelect.value);
      if (!s) return;
      p.secteur = s;
      p.fusion = [];
      p.intitule = s.intitule_poste_defaut || s.nom;
      p.sousSecteurs = (this.sousSecteursDefaut[s.id] || []).slice();
      this.renderComposer();
    });

    const fusionSelect = bloc.querySelector('.poste-fusion-select');
    if (fusionSelect) fusionSelect.addEventListener('change', () => {
      const s = this.nonRegaliens().find(x => x.id === fusionSelect.value);
      if (!s) return;
      p.fusion = p.fusion || [];
      p.fusion.push(s);
      this.recomputeFusion(p);
      this.renderComposer();
    });
    bloc.querySelectorAll('.btn-fusion-del').forEach(btn => btn.addEventListener('click', (e) => {
      e.preventDefault();
      p.fusion.splice(Number(btn.dataset.fi), 1);
      this.recomputeFusion(p);
      this.renderComposer();
    }));

    const suffixe = bloc.querySelector('.poste-suffixe');
    if (suffixe) suffixe.addEventListener('input', () => p.suffixe = suffixe.value);

    const fonction = bloc.querySelector('.poste-fonction');
    if (fonction) fonction.addEventListener('input', () => p.fonction = fonction.value);

    const removeBtn = bloc.querySelector('.btn-remove-poste');
    if (removeBtn) removeBtn.addEventListener('click', () => {
      this.composerState.postes = this.composerState.postes.filter(x => x.uid !== p.uid);
      this.renderComposer();
    });

    const editSous = bloc.querySelector('.btn-edit-sous');
    if (editSous) editSous.addEventListener('click', (e) => {
      e.preventDefault();
      this.openSousSecteursModal(p);
    });

    // Autocomplete personnalités (recherche locale, insensible casse et accents)
    const search = bloc.querySelector('.poste-perso-search');
    const results = bloc.querySelector('.autocomplete-results');
    const showResults = (data) => {
      if (!data || !data.length) { results.style.display = 'none'; return; }
      results.innerHTML = data.map(x =>
        '<div class="autocomplete-item" data-id="' + x.id + '">' +
        Perso.esc((x.prenom || '') + ' ' + x.nom) +
        ' <span class="ac-metier">' + Perso.esc((x.metiers || [])[0] || '') + '</span></div>'
      ).join('');
      results.style.display = 'block';
      results.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          const found = data.find(d => d.id === item.dataset.id);
          p.personnalite = found;
          search.value = (found.prenom || '') + ' ' + found.nom;
          results.style.display = 'none';
        });
      });
    };
    let timer = null;
    search.addEventListener('input', () => {
      p.personnalite = null;
      clearTimeout(timer);
      const q = search.value.trim();
      if (q.length < 2) { results.style.display = 'none'; return; }
      timer = setTimeout(() => showResults(this.searchPersos(q).slice(0, 8)), 150);
    });

    // Loupe : parcourir toutes les personnalités
    const loupe = bloc.querySelector('.btn-loupe');
    if (loupe) loupe.addEventListener('click', (e) => {
      e.preventDefault();
      if (results.style.display === 'block') { results.style.display = 'none'; return; }
      showResults((this.persosCache || []).slice());
    });
    document.addEventListener('click', (e) => {
      if (!bloc.contains(e.target)) results.style.display = 'none';
    });
  },

  // ---------- Sous-secteurs (modal) ----------
  openSousSecteursModal(p) {
    const cont = document.getElementById('sous-secteurs-contenu');
    if (!cont) return;
    const render = () => {
      cont.innerHTML =
        '<h4>Sous-secteurs : ' + Perso.esc(p.secteur ? p.secteur.nom : p.intitule) + '</h4>' +
        (p.sousSecteurs.length
          ? p.sousSecteurs.map((s, i) =>
              '<div class="sous-item">' + Perso.esc(s.nom) +
              ' <button class="btn-mini btn-del-sous" data-i="' + i + '">supprimer</button></div>'
            ).join('')
          : '<em>Aucun sous-secteur</em>') +
        '<div class="sous-add-row"><input type="text" id="newSousSecteur" class="champ-texte" placeholder="Ajouter un sous-secteur…">' +
        '<button class="btn-mini" id="btnAddSous">ajouter</button></div>';
      cont.querySelectorAll('.btn-del-sous').forEach(btn => {
        btn.addEventListener('click', () => {
          p.sousSecteurs.splice(Number(btn.dataset.i), 1);
          render();
        });
      });
      cont.querySelector('#btnAddSous').addEventListener('click', () => {
        const val = cont.querySelector('#newSousSecteur').value.trim();
        if (val) { p.sousSecteurs.push({ id: null, nom: val }); render(); }
      });
    };
    render();
    const closeBtn = document.getElementById('btnCloseSous');
    if (closeBtn) closeBtn.onclick = () => { UI.closeModals(); this.renderComposer(); };
    UI.openModal('modal-sous-secteurs');
  },

  // ---------- Ajout de blocs ----------
  // Recalcule intitulé et sous-secteurs d'un ministère fusionné
  recomputeFusion(p) {
    if (!p.secteur) return;
    const noms = [p.secteur.nom, ...(p.fusion || []).map(s => s.nom)];
    p.intitule = (p.secteur.intitule_poste_defaut || p.secteur.nom) +
      ((p.fusion || []).length ? ' + ' + (p.fusion || []).map(s => s.nom).join(' + ') : '');
    const vus = new Set();
    p.sousSecteurs = [p.secteur, ...(p.fusion || [])].flatMap(s => this.sousSecteursDefaut[s.id] || [])
      .filter(s => { if (vus.has(s.id)) return false; vus.add(s.id); return true; });
  },

  addMinistere() {
    if (!this.composerState) return;
    if (!this.nonRegaliens().length) return UI.toast('Aucun secteur non-régalien disponible.');
    this.composerState.postes.push({
      uid: 'min-' + Date.now(),
      type: 'non_regalien',
      secteur: null,
      intitule: '',
      personnalite: null,
      sousSecteurs: []
    });
    this.renderComposer();
  },

  addDelegue() {
    if (!this.composerState) return;
    this.composerState.postes.push({
      uid: 'del-' + Date.now(),
      type: 'delegue',
      secteur: null,
      intitule: 'Délégué ministériel',
      fonction: '',
      personnalite: null,
      sousSecteurs: []
    });
    this.renderComposer();
  },

  // ---------- Sauvegarde ----------
  async save(publish) {
    if (!Auth.isLoggedIn()) return UI.toast('Vous devez être connecté pour publier.');
    if (!this.composerState) return;

    const titre = document.getElementById('gouvTitre').value.trim();
    const description = document.getElementById('gouvDescription').value.trim();
    if (!titre) return UI.toast('Donnez un nom à votre gouvernement.');

    if (publish) {
      const manquants = this.composerState.postes
        .filter(p => p.type === 'regalien' && !p.personnalite)
        .map(p => p.secteur ? p.secteur.nom : p.intitule);
      if (manquants.length) {
        return UI.toast('Pour publier, nommez une personnalité à chaque poste régalien. Manquant : ' + manquants.join(', ') + '.');
      }
    }

    try {
      // 1. Gouvernement (création, ou mise à jour si on édite un brouillon)
      let gouv;
      if (this.composerState.editingId) {
        const { data, error: uErr } = await sb
          .from('gouvernements')
          .update({ titre, description, is_published: !!publish })
          .eq('id', this.composerState.editingId)
          .select()
          .single();
        if (uErr) throw uErr;
        gouv = data;
        // On repart de zéro sur les postes du brouillon
        await sb.from('postes_gouvernement').delete().eq('gouvernement_id', gouv.id);
      } else {
        const { data, error: gErr } = await sb
          .from('gouvernements')
          .insert({
            titre, description,
            created_by: Auth.currentUser.id,
            is_published: !!publish
          })
          .select()
          .single();
        if (gErr) throw gErr;
        gouv = data;
      }

      // 2. Postes
      const postesRows = this.composerState.postes.map((p, i) => ({
        gouvernement_id: gouv.id,
        type: p.type,
        personnalite_id: p.personnalite ? p.personnalite.id : null,
        secteur_id: p.secteur ? p.secteur.id : null,
        nom_poste_personnalise: (p.type === 'regalien'
          ? (p.intitule + (p.suffixe && p.suffixe.trim() ? ' ' + p.suffixe.trim() : ''))
          : p.intitule) || null,
        fonction_delegue: p.type === 'delegue' ? (p.fonction || null) : null,
        ordre: i
      }));
      const { data: postes, error: pErr } = await sb
        .from('postes_gouvernement')
        .insert(postesRows)
        .select();
      if (pErr) throw pErr;

      // 3. Sous-secteurs de chaque poste (création des nouveaux si besoin)
      const sousRows = [];
      const fusionRows = [];
      for (let i = 0; i < (postes || []).length; i++) {
        const row = postes[i];
        const p = this.composerState.postes[i];
        (p.fusion || []).forEach(s => fusionRows.push({ poste_id: row.id, secteur_id: s.id }));
        for (const s of (p.sousSecteurs || [])) {
          if (!s.id && s.nom) {
            const { data: created, error: cErr } = await sb
              .from('sous_secteurs').insert({ nom: s.nom }).select().single();
            if (!cErr && created) s.id = created.id;
          }
          if (s.id) sousRows.push({ poste_id: row.id, sous_secteur_id: s.id });
        }
      }
      if (sousRows.length) {
        const { error: sErr } = await sb.from('postes_sous_secteurs').insert(sousRows);
        if (sErr) throw sErr;
      }
      if (fusionRows.length) {
        const { error: fErr } = await sb.from('postes_secteurs_fusionnes').insert(fusionRows);
        if (fErr) throw fErr;
      }

      UI.toast(publish
        ? 'Gouvernement publié : « ' + titre + ' » (' + postesRows.length + ' postes)'
        : 'Brouillon enregistré : « ' + titre + ' »');
      document.getElementById('gouvTitre').value = '';
      document.getElementById('gouvDescription').value = '';
      this.resetComposer();
      if (publish) UI.showSection(1);
    } catch (err) {
      UI.toast('Erreur lors de la sauvegarde : ' + err.message);
    }
  },

  // ================== LISTE PUBLIEE (section 1) ==================
  async loadPublished() {
    const cont = document.getElementById('liste-gouvernements');
    if (!cont) return;
    cont.innerHTML = '<div class="loading">Chargement…</div>';
    try {
      await this.loadReferentiels();
      const [gRes, statsRes] = await Promise.all([
        sb.from('gouvernements')
          .select('*, users!created_by(username), postes_gouvernement(*, personnalites!personnalite_id(id, nom, prenom, statut), secteurs!secteur_id(nom))')
          .eq('is_published', true)
          .order('created_at', { ascending: false }),
        sb.from('gouvernements_stats').select('*')
      ]);
      if (gRes.error) throw gRes.error;
      this.published = gRes.data || [];
      const stats = {};
      (statsRes.data || []).forEach(s => stats[s.id] = s);
      this.stats = stats;
      await this.loadUserVotes();
      this.sortPublished();
      this.renderPublished();
    } catch (err) {
      cont.innerHTML = '<div class="error-msg">Erreur de chargement : ' + err.message + '</div>';
    }
  },

  async loadUserVotes() {
    this.votesUser = {};
    this.epingles = new Set();
    if (!Auth.isLoggedIn()) return;
    const uid = Auth.currentUser.id;
    const [v, e] = await Promise.all([
      sb.from('gouvernements_votes').select('gouvernement_id, note').eq('user_id', uid),
      sb.from('gouvernements_epingles').select('gouvernement_id').eq('user_id', uid)
    ]);
    (v.data || []).forEach(r => this.votesUser[r.gouvernement_id] = r.note);
    (e.data || []).forEach(r => this.epingles.add(r.gouvernement_id));
  },

  tri: 'note',
  sortPublished() {
    const st = id => (this.stats && this.stats[id]) || {};
    const epingleDabord = (a, b) => {
      const ea = this.epingles.has(a.id) ? 1 : 0;
      const eb = this.epingles.has(b.id) ? 1 : 0;
      return eb - ea;
    };
    const cmp = {
      note: (a, b) => (Number(st(b.id).note_moyenne) || 0) - (Number(st(a.id).note_moyenne) || 0),
      votes: (a, b) => (st(b.id).nb_votes || 0) - (st(a.id).nb_votes || 0),
      popularite: (a, b) =>
        ((st(b.id).nb_votes || 0) + (st(b.id).nb_commentaires || 0)) -
        ((st(a.id).nb_votes || 0) + (st(a.id).nb_commentaires || 0)),
      date: (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    }[this.tri] || (() => 0);
    this.published.sort((a, b) => epingleDabord(a, b) || cmp(a, b));
  },

  renderPublished() {
    const cont = document.getElementById('liste-gouvernements');
    if (!cont) return;
    if (!this.published.length) {
      cont.innerHTML = '<div class="empty-msg">Aucun gouvernement publié pour le moment.</div>';
      return;
    }
    cont.innerHTML = this.published.map(g => {
      const st = (this.stats && this.stats[g.id]) || {};
      const postes = (g.postes_gouvernement || []).slice().sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
      // Prêt à gouverner : tous les postes pourvus ET tous les membres en statut "ok"
      const pret = postes.length > 0
        && postes.every(p => p.personnalite_id)
        && postes.every(p => p.personnalites && p.personnalites.statut === 3);
      const membres = postes.map(p => {
        const perso = p.personnalites;
        const role = p.secteurs ? p.secteurs.nom
          : (p.type === 'delegue' ? (p.fonction_delegue || 'Délégué') : (p.nom_poste_personnalise || ''));
        return '<div class="gouv-membre"><span class="gm-nom">' +
          (perso ? Perso.esc((perso.prenom || '') + ' ' + perso.nom) : '<em>non attribué</em>') +
          '</span><span class="gm-secteur">' + Perso.esc(role) + '</span></div>';
      }).join('');
      const pinned = this.epingles.has(g.id);
      return `
      <div class="gouv-card" data-id="${g.id}">
        <div class="gouv-entete">
          <span class="gouv-titre">${Perso.esc(g.titre)}</span>
          <span class="gouv-note">&#9733; ${st.note_moyenne ?? '·'} <span class="gouv-nbvotes">(${st.nb_votes || 0})</span></span>
          ${pret ? '<span class="badge-pret">prêt à gouverner</span>' : ''}
        </div>
        <div class="gouv-auteur">par ${Perso.esc(g.users ? g.users.username : '?')}</div>
        <div class="gouv-membres">${membres}</div>
        <div class="gouv-actions">
          <div class="gouv-vote" data-id="${g.id}">
            ${[1,2,3,4,5].map(n =>
              '<span class="etoile ' + ((this.votesUser[g.id] || 0) >= n ? 'active' : '') + '" data-note="' + n + '">&#9733;</span>'
            ).join('')}
          </div>
          <button class="btn-icone btn-gouv-pin ${pinned ? 'active' : ''}" title="Épingler">&#128204;</button>
          <button class="btn-icone btn-gouv-share" title="Partager">&#128279;</button>
          <button class="btn-mini btn-gouv-detail">Détail</button>
          ${Auth.isAdmin() ? '<button class="btn-icone btn-gouv-del" title="Supprimer (admin)">&#128465;</button>' : ''}
        </div>
        <div class="gouv-nbcomm">${st.nb_commentaires || 0} commentaire(s)</div>
      </div>`;
    }).join('');
    this.bindPublished(cont);
  },

  bindPublished(cont) {
    cont.querySelectorAll('.gouv-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelectorAll('.etoile').forEach(star => {
        star.addEventListener('click', () => this.vote(id, Number(star.dataset.note)));
      });
      const pin = card.querySelector('.btn-gouv-pin');
      if (pin) pin.addEventListener('click', () => this.togglePin(id, pin));
      const share = card.querySelector('.btn-gouv-share');
      if (share) share.addEventListener('click', () => this.share(id));
      const detail = card.querySelector('.btn-gouv-detail');
      if (detail) detail.addEventListener('click', () => this.openDetail(id));
      const del = card.querySelector('.btn-gouv-del');
      if (del) del.addEventListener('click', () => this.deleteGouv(id));
    });
  },

  async deleteGouv(id) {
    if (!Auth.isAdmin()) return;
    const g = this.published.find(x => x.id === id);
    if (!window.confirm('Supprimer le gouvernement « ' + (g ? g.titre : '') + ' » ? Cette action est définitive (postes, votes et commentaires inclus).')) return;
    try {
      const { error } = await sb.from('gouvernements').delete().eq('id', id);
      if (error) throw error;
      UI.toast('Gouvernement supprimé.');
      this.loadPublished();
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  async vote(id, note) {
    if (!Auth.isLoggedIn()) return UI.toast('Connectez-vous pour voter.');
    try {
      const { error } = await sb.from('gouvernements_votes').upsert({
        user_id: Auth.currentUser.id,
        gouvernement_id: id,
        note
      });
      if (error) throw error;
      this.votesUser[id] = note;
      UI.toast('Vote enregistré : ' + note + '/5');
      this.loadPublished();
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  async togglePin(id, btn) {
    if (!Auth.isLoggedIn()) return UI.toast('Connectez-vous pour épingler.');
    const uid = Auth.currentUser.id;
    try {
      if (this.epingles.has(id)) {
        await sb.from('gouvernements_epingles').delete()
          .eq('user_id', uid).eq('gouvernement_id', id);
        this.epingles.delete(id);
        if (btn) btn.classList.remove('active');
      } else {
        await sb.from('gouvernements_epingles').insert({ user_id: uid, gouvernement_id: id });
        this.epingles.add(id);
        if (btn) btn.classList.add('active');
      }
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  share(id) {
    const url = location.origin + location.pathname + '#gouv-' + id;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => UI.toast('Lien copié !'));
    } else {
      UI.toast(url);
    }
  },

  // ---------- Détail + commentaires ----------
  async openDetail(id) {
    const g = this.published.find(x => x.id === id);
    if (!g) return;
    const cont = document.getElementById('detail-contenu');
    if (!cont) return;

    // Secteurs fusionnés éventuels
    let fusionsParPoste = {};
    try {
      const { data: fus } = await sb.from('postes_secteurs_fusionnes').select('*');
      (fus || []).forEach(r => {
        const s = this.secteurs.find(x => x.id === r.secteur_id);
        if (!s) return;
        (fusionsParPoste[r.poste_id] = fusionsParPoste[r.poste_id] || []).push(s.nom);
      });
    } catch (err) { /* facultatif */ }

    const postes = (g.postes_gouvernement || []).slice().sort((a, b) => a.ordre - b.ordre);
    const bloc = (label, list) => list.length
      ? '<h4>' + label + '</h4>' + list.map(p => {
          const perso = p.personnalites;
          const fusion = (fusionsParPoste[p.id] || []).map(n => ' + ' + Perso.esc(n)).join('');
          return '<div class="detail-poste"><span class="dp-intitule">' +
            Perso.esc(p.nom_poste_personnalise || (p.secteurs ? p.secteurs.nom : '')) + fusion +
            (p.fonction_delegue ? ', ' + Perso.esc(p.fonction_delegue) : '') +
            '</span><span class="dp-perso">' +
            (perso ? Perso.esc((perso.prenom || '') + ' ' + perso.nom) : '<em>non attribué</em>') +
            '</span></div>';
        }).join('')
      : '';

    cont.innerHTML =
      '<h3>' + Perso.esc(g.titre) + '</h3>' +
      (g.description ? '<p class="detail-desc">' + Perso.esc(g.description) + '</p>' : '') +
      bloc('Postes régaliens', postes.filter(p => p.type === 'regalien')) +
      bloc('Ministères', postes.filter(p => p.type === 'non_regalien')) +
      bloc('Délégués ministériels', postes.filter(p => p.type === 'delegue')) +
      '<h4>Commentaires</h4><div id="detail-commentaires"><div class="loading">Chargement…</div></div>' +
      '<div class="comm-add-row"><input type="text" id="newComment" class="champ-texte" placeholder="Votre commentaire…">' +
      '<button class="btn-mini" id="btnAddComment">envoyer</button></div>';

    UI.openModal('modal-detail');
    this.loadComments(id);
    cont.querySelector('#btnAddComment').addEventListener('click', () => this.addComment(id));
  },

  async loadComments(gouvId) {
    const cont = document.getElementById('detail-commentaires');
    if (!cont) return;
    try {
      const { data, error } = await sb
        .from('commentaires')
        .select('*, users!user_id(username)')
        .eq('gouvernement_id', gouvId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      cont.innerHTML = (data && data.length)
        ? data.map(c =>
            '<div class="comm-item"><span class="comm-auteur">' +
            Perso.esc(c.users ? c.users.username : '?') + '</span> ' +
            Perso.esc(c.contenu) + '</div>'
          ).join('')
        : '<div class="empty-msg">Aucun commentaire.</div>';
    } catch (err) {
      cont.innerHTML = '<div class="error-msg">Erreur : ' + err.message + '</div>';
    }
  },

  async addComment(gouvId) {
    if (!Auth.isLoggedIn()) return UI.toast('Connectez-vous pour commenter.');
    const input = document.getElementById('newComment');
    const contenu = input.value.trim();
    if (!contenu) return;
    try {
      const { error } = await sb.from('commentaires').insert({
        user_id: Auth.currentUser.id,
        gouvernement_id: gouvId,
        contenu
      });
      if (error) throw error;
      input.value = '';
      this.loadComments(gouvId);
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  // ================== INIT ==================
  init() {
    const btnMin = document.getElementById('btnAddMinistere');
    if (btnMin) btnMin.addEventListener('click', (e) => { e.preventDefault(); this.addMinistere(); });
    const btnDel = document.getElementById('btnAddDelegue');
    if (btnDel) btnDel.addEventListener('click', (e) => { e.preventDefault(); this.addDelegue(); });
    const btnDraft = document.getElementById('btnBrouillon');
    if (btnDraft) btnDraft.addEventListener('click', (e) => { e.preventDefault(); this.save(false); });
    const btnPub = document.getElementById('btnPublier');
    if (btnPub) btnPub.addEventListener('click', (e) => { e.preventDefault(); this.save(true); });
    const tri = document.getElementById('triGouv');
    if (tri) tri.addEventListener('change', () => {
      this.tri = tri.value;
      this.sortPublished();
      this.renderPublished();
    });
  }
};

window.Gouv = Gouv;
document.addEventListener('DOMContentLoaded', () => Gouv.init());
