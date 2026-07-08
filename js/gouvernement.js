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
    <div class="poste-bloc poste-${p.type} _3-bloc-min-r" id="poste-${p.uid}">
      <div class="_3-gov-line-1 poste-perso-row">
        <input class="mon-input3 w-input poste-perso-search" maxlength="256" placeholder="nom du ministre" type="text" value="${perso}" autocomplete="off"/>
        <div class="_3-gov-mini-buttons">
          <a href="#" class="_2-mini-bouton loupe w-inline-block btn-loupe" title="Parcourir toutes les personnalités">
            <div class="_2-picto-fontello-bouton">${ICO.loupe}</div>
          </a>
          ${p.type !== 'regalien' ? '<a href="#" class="_2-mini-bouton w-inline-block btn-remove-poste" title="Supprimer ce poste"><div class="_2-picto-fontello-bouton ico">&times;</div></a>' : ''}
        </div>
        <div class="autocomplete-results" style="display:none"></div>
      </div>
      <div class="_3-gov-line-2">
        ${p.type === 'regalien'
          ? '<div class="poste-intitule-verrou"><h3 class="heading-23 intitule-base">' + Perso.esc(p.intitule) + '</h3>' +
            (p.secteur && p.secteur.nom === 'Matignon'
              ? ''
              : '<input type="text" class="mon-input3 w-input poste-suffixe" value="' + Perso.esc(p.suffixe || '') + '" placeholder="Compléter">') +
            '</div>'
          : ''}
        ${p.type === 'non_regalien'
          ? '<div class="poste-intitule-verrou">' +
            '<select class="poste-secteur-select mon-inputdrop' + (p.secteur ? '' : ' placeholder') + '">' +
            '<option value="" disabled' + (p.secteur ? '' : ' selected') + '>Secteur</option>' +
            this.nonRegaliens().map(s =>
              '<option value="' + s.id + '"' + (p.secteur && p.secteur.id === s.id ? ' selected' : '') + '>' + Perso.esc(s.nom) + '</option>'
            ).join('') + '</select>' +
            (p.secteur
              ? (p.fusion || []).map((s, fi) =>
                  '<span class="fusion-tag">+ ' + Perso.esc(s.nom) + ' <button class="btn-icone btn-fusion-del" data-fi="' + fi + '" title="Retirer">&times;</button></span>'
                ).join('') +
                '<select class="poste-fusion-select mon-inputdrop placeholder">' +
                '<option value="" disabled selected>+ fusionner avec…</option>' +
                this.nonRegaliens()
                  .filter(s => s.id !== p.secteur.id && !(p.fusion || []).some(f => f.id === s.id))
                  .map(s => '<option value="' + s.id + '">' + Perso.esc(s.nom) + '</option>').join('') +
                '</select>' +
                '<input type="text" class="mon-input3 w-input poste-intitule intitule" value="' + Perso.esc(p.intitule) + '" placeholder="Intitulé du poste">'
              : '')
            + '</div>'
          : ''}
        ${p.type === 'delegue'
          ? '<div class="poste-intitule-verrou">' +
            '<input type="text" class="mon-input3 w-input poste-intitule intitule" value="' + Perso.esc(p.intitule) + '" placeholder="Intitulé du poste">' +
            '<input type="text" class="mon-input3 w-input poste-fonction" value="' + Perso.esc(p.fonction || '') + '" placeholder="Fonction (ex : chargé de la transition énergétique)">' +
            '</div>'
          : ''}
        ${p.type !== 'delegue'
          ? '<div class="_3-sous-secteur poste-sous-secteurs">' + (sous || '<em>Aucun sous-secteur</em>') +
            ' <a href="#" class="_2-code-link-button btn-edit-sous">modifier</a></div>'
          : ''}
      </div>
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

  estPret(g) {
    const postes = g.postes_gouvernement || [];
    return postes.length > 0
      && postes.every(p => p.personnalite_id)
      && postes.every(p => p.personnalites && p.personnalites.statut === 3);
  },

  renderPublished() {
    const cont = document.getElementById('liste-gouvernements');
    if (!cont) return;
    const liste = this.onlyReady ? this.published.filter(g => this.estPret(g)) : this.published;
    if (!liste.length) {
      cont.innerHTML = '<div class="empty-msg">' +
        (this.onlyReady && this.published.length
          ? 'Aucun gouvernement "prêt à gouverner" pour le moment (décochez le filtre pour tout voir).'
          : 'Aucun gouvernement publié pour le moment.') + '</div>';
      return;
    }
    cont.innerHTML = liste.map(g => {
      const st = (this.stats && this.stats[g.id]) || {};
      // Seuls les postes pourvus apparaissent sur la carte
      const postes = (g.postes_gouvernement || []).slice()
        .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
      const pret = this.estPret(g);
      const membres = postes.map(p => {
        const perso = p.personnalites;
        const role = p.secteurs ? p.secteurs.nom
          : (p.type === 'delegue' ? (p.fonction_delegue || 'Délégué') : (p.nom_poste_personnalise || ''));
        return '<div class="gouv-membre"><span class="gm-nom">' +
          (perso ? Perso.esc((perso.prenom || '') + ' ' + perso.nom) : '<em>non attribué</em>') +
          '</span><span class="gm-secteur">' + Perso.esc(role) + '</span></div>';
      }).join('');
      const pinned = this.epingles.has(g.id);
      const note = st.note_moyenne != null ? String(st.note_moyenne).replace('.', ',') : null;
      const pourvus = postes.filter(p => p.personnalites);
      const regs = pourvus.filter(p => p.type === 'regalien');
      const autres = pourvus.filter(p => p.type !== 'regalien');
      const ligne = p => {
        const perso = p.personnalites;
        const role = p.secteurs ? p.secteurs.nom
          : (p.type === 'delegue' ? (p.fonction_delegue || 'délégué') : (p.nom_poste_personnalise || ''));
        return '<div class="fonction-perso gouv-membre">' +
          '<a href="#" class="w-inline-block membre-fiche" data-perso-id="' + (perso ? perso.id : '') + '"><div class="_3-name-gov-pub gm-nom">' +
          Perso.esc((perso.prenom || '') + ' ' + perso.nom) +
          '</div></a> <div class="secteurs gm-secteur">' + Perso.esc(role) + '</div></div>';
      };
      const maNote = this.votesUser[g.id] || 0;
      return `
      <div class="gouv-card gov-compact-bloc" data-id="${g.id}">
        <div class="gov-title">
          <div class="filet govlinedetails">
            <h1 class="heading-4-nom-prenom d gouv-titre">${Perso.esc(g.titre)}</h1>
            ${pret ? '<div class="badge-pret">prêt à gouverner</div>' : ''}
            <div class="bouton-gov-detail">
              <a href="#" class="_2-mini-bouton w-inline-block btn-gouv-detail"><h6 class="heading-dyn"><strong class="heading-bold-text">détails</strong></h6></a>
              <a href="#" class="_2-mini-bouton w-inline-block btn-gouv-share" title="Faire suivre"><div class="_2-picto-fontello-bouton">${ICO.share}</div></a>
              <a href="#" class="_2-mini-bouton w-inline-block btn-gouv-pin ${pinned ? 'active' : ''}" title="Épingler"><div class="_2-picto-fontello-bouton">${ICO.pin}</div></a>
              ${Auth.isAdmin() ? '<a href="#" class="_2-mini-bouton w-inline-block btn-gouv-del" title="Supprimer (admin)"><div class="_2-picto-fontello-bouton picto-svg">${ICO.trash}</div></a>' : ''}
            </div>
            <div class="radio-button-form">
              <div class="div-block-323 gouv-vote" data-id="${g.id}">
                ${[1,2,3,4,5].map(n =>
                  '<span class="radio-button-3 w-radio-input etoile ' + (maNote >= n ? 'pleine active w--redirected-checked' : '') + '" data-note="' + n + '" title="' + n + '/5"></span>'
                ).join('')}
              </div>
              <div class="_w-courant mini-jaune">Votre note <span class="gouv-nbvotes">(${st.nb_votes || 0})</span></div>
            </div>
            <div class="_3-star-bloc">
              ${note != null
                ? '<div class="_w-courant _w-bold _w-pink note note-moy">' + note + '</div>' +
                  '<div class="star w-embed"><div class="star"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="100%" height="auto"><polygon points="150 41.3 190.19 0 204.35 55.86 259.81 40.19 244.14 95.65 300 109.81 258.7 150 300 190.19 244.14 204.35 259.81 259.81 204.35 244.14 190.19 300 150 258.7 109.81 300 95.65 244.14 40.19 259.81 55.86 204.35 0 190.19 41.3 150 0 109.81 55.86 95.65 40.19 40.19 95.65 55.86 109.81 0 150 41.3" fill="currentColor"/></svg></div></div>'
                : ''}
            </div>
          </div>
        </div>
        <div class="cr-e-par">
          <div class="_w-courant _w-mini-grey">gouvernement créé par</div>
          <a href="#" class="_w-courant _w-bold cap gouv-auteur">${Perso.esc(g.users ? g.users.username : '?')}</a>
          <div class="_w-courant _w-mini-grey">&bull; ${st.nb_commentaires || 0} commentaire(s)</div>
        </div>
        <div class="gouv-membres membres-regaliens">${regs.map(ligne).join('')}</div>
        ${autres.length ? '<div class="filet pointille"></div><div class="gouv-membres membres-autres">' + autres.map(ligne).join('') + '</div>' : ''}
        ${g.description ? '<p class="gouv-desc">' + Perso.esc(g.description) + '</p>' : ''}
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
      card.querySelectorAll('.membre-fiche').forEach(a => a.addEventListener('click', async (e) => {
        e.preventDefault();
        const pid = a.dataset.persoId;
        if (!pid || !window.Perso) return;
        if (!Perso.all || !Perso.all.length) await Perso.loadList();
        Perso.openFiche(pid);
      }));
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
      '<h1 class="detail-titre">' + Perso.esc(g.titre) + '</h1>' +
      '<div class="vote gouv-vote detail-vote">' +
      [1,2,3,4,5].map(n =>
        '<span class="etoile detail-etoile ' + ((this.votesUser[g.id] || 0) >= n ? 'pleine active' : '') + '" data-note="' + n + '" title="' + n + '/5">&#9733;</span>'
      ).join('') + '</div>' +
      '<div class="cr-e-par"><span class="_w-courant _w-mini-grey">créé par</span> <span class="_w-courant _w-bold cap">' + Perso.esc(g.users ? g.users.username : '?') + '</span></div>' +
      (g.description ? '<p class="detail-desc">' + Perso.esc(g.description) + '</p>' : '') +
      bloc('Ministres régaliens', postes.filter(p => p.type === 'regalien')) +
      bloc('Ministres', postes.filter(p => p.type === 'non_regalien')) +
      bloc('Délégués ministériels', postes.filter(p => p.type === 'delegue')) +
      '<h4>Commentaires</h4><div id="detail-commentaires"><div class="loading">Chargement…</div></div>' +
      '<div class="comm-add-row"><input type="text" id="newComment" class="mon-input5 w-input champ-texte" placeholder="Votre commentaire…">' +
      '<a href="#" class="_2-mini-bouton w-inline-block btn-envoyer-comm" id="btnAddComment"><div class="_2-picto-fontello-bouton">' + ICO.send + '</div></a></div>';

    UI.openModal('modal-detail');
    this.loadComments(id);
    cont.querySelector('#btnAddComment').addEventListener('click', (e) => { e.preventDefault(); this.addComment(id); });
    cont.querySelectorAll('.etoile').forEach(star => {
      star.addEventListener('click', () => this.vote(id, Number(star.dataset.note)));
    });
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

    // Dropdown de tri (maquette) : bascule + choix
    const triToggle = document.getElementById('triGouvToggle');
    const triList = document.getElementById('triGouvList');
    if (triToggle && triList) {
      triToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        triList.classList.toggle('w--open');
      });
      document.addEventListener('click', (e) => {
        if (!triList.contains(e.target) && !triToggle.contains(e.target)) triList.classList.remove('w--open');
      });
      triList.querySelectorAll('[data-tri]').forEach(a => a.addEventListener('click', (e) => {
        e.preventDefault();
        this.tri = a.dataset.tri;
        const label = document.getElementById('triGouvLabel');
        if (label) label.textContent = a.textContent.trim();
        triList.classList.remove('w--open');
        this.sortPublished();
        this.renderPublished();
      }));
    }

    // Filtre "prêt à gouverner"
    const pretBox = document.getElementById('filtrePret');
    if (pretBox) {
      this.onlyReady = pretBox.checked;
      pretBox.addEventListener('change', () => {
        this.onlyReady = pretBox.checked;
        const visu = pretBox.closest('label') && pretBox.closest('label').querySelector('.w-checkbox-input');
        if (visu) visu.classList.toggle('w--redirected-checked', pretBox.checked);
        this.renderPublished();
      });
    }
  }
};

window.Gouv = Gouv;
document.addEventListener('DOMContentLoaded', () => Gouv.init());
