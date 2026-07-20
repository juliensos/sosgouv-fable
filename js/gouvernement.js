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
  // force=true : recharge depuis la base même si le cache semble à jour.
  // v45 : les modaux qui listent secteurs/sous-secteurs l'utilisent à
  // chaque ouverture, car les ajouts faits en admin pendant qu'une
  // composition est en cours ne repassaient jamais par initComposer
  // (qui s'arrête dès qu'un composerState existe) : le référentiel
  // restait figé à son état d'ouverture du composer.
  async loadReferentiels(force) {
    if (!force && this.refLoaded && this.referentielsCharges !== false) return;
    this.referentielsCharges = true;
    const [sec, liaison, sousSec] = await Promise.all([
      sb.from('secteurs').select('*').order('ordre', { ascending: true }),
      sb.from('secteurs_sous_secteurs_defaut').select('*'),
      sb.from('sous_secteurs').select('*')
    ]);
    if (sec.error) throw sec.error;
    this.secteurs = sec.data || [];
    this.sousSecteursTous = sousSec.data || [];
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
      postes: [
        ...this.regaliens().map((s, i) => ({
          uid: 'reg-' + i,
          type: 'regalien',
          secteur: s,
          intitule: s.intitule_poste_defaut || s.nom,
          personnalite: null,
          sousSecteurs: (this.sousSecteursDefaut[s.id] || []).slice()
        })),
        ...this.nonRegaliens().filter(s => s.affiche_defaut !== false).map((s, i) => ({
          uid: 'nr-' + i,
          type: 'non_regalien',
          secteur: s,
          intitule: s.intitule_poste_defaut || s.nom,
          personnalite: null,
          fusion: [],
          sousSecteurs: (this.sousSecteursDefaut[s.id] || []).slice()
        }))
      ]
    };
    this.renderComposer();
  },

  resetComposer() {
    this.composerState = null;
    this.initComposer();
  },

  // Modifier un gouvernement (brouillon, ou publié tant que personne n'a voté)
  async editGouvernement(id) {
    try {
      const { data: votes } = await sb.from('gouvernements_votes').select('id').eq('gouvernement_id', id).limit(1);
      const { data: g } = await sb.from('gouvernements').select('is_published, created_by').eq('id', id).single();
      if (!g) return UI.toast('Gouvernement introuvable.');
      if (!Auth.isAdmin() && (!Auth.isLoggedIn() || g.created_by !== Auth.currentUser.id))
        return UI.toast('Vous ne pouvez modifier que vos propres gouvernements.');
      if (g.is_published && votes && votes.length)
        return UI.toast('Ce gouvernement a déjà reçu des votes : il n\'est plus modifiable.');
      await this.loadDraft(id);
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  // Reprendre un brouillon existant dans le composer
  async loadDraft(id) {
    UI.showSection(2);
    try {
      await this.loadReferentiels();
      await this.loadPersosCache();
      const [gRes, ssRes, fusRes, allSous] = await Promise.all([
        sb.from('gouvernements')
          .select('*, users!created_by(username, nom, prenom, afficher_username), postes_gouvernement(*, personnalites!personnalite_id(id, nom, prenom, statut), secteurs!secteur_id(nom))')
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
      // Correspondance id réel (base) -> uid synthétique du composer, pour
      // retrouver quel ministre porte chaque délégué une fois rechargé.
      const idVersUid = {};
      postes.forEach((po, i) => { idVersUid[po.id] = 'load-' + i; });
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
            attacheAUid: po.delegue_de_poste_id ? (idVersUid[po.delegue_de_poste_id] || null) : null,
            personnalite: po.personnalites || null,
            secteurManuelNom: po.secteur_personnalise || null,
            sousSecteurs: (ssRes.data || [])
              .filter(r => r.poste_id === po.id)
              .map(r => sousById[r.sous_secteur_id])
              .filter(Boolean)
              .concat((po.sous_secteurs_personnalises || []).map(nom => ({ id: null, nom }))),
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
    const regs = this.composerState.postes.filter(p => p.type === 'regalien');
    const autres = this.composerState.postes.filter(p => p.type !== 'regalien');
    const separateur = '<div class="bloc-title compo-sep"><h5 class="heading-10">Ministères par defaut<br/>' +
      '<code class="code-7">VOUS POUVEZ ajoutez, supprimer ou fusionnez les secteurs par defaut, et changeR les intitulés des ministères pour les faire correspondre à votre vision</code></h5></div>';
    // v44 : chaque groupe porte son propre trait vertical gauche, le
    // séparateur centré s'affiche entre les deux, hors trait.
    cont.innerHTML = '<div class="compo-groupe">' + regs.map(p => this.posteHTML(p)).join('') + '</div>'
      + (autres.length
        ? separateur + '<div class="compo-groupe">' + autres.map(p => this.posteHTML(p)).join('') + '</div>'
        : '');
    this.composerState.postes.forEach(p => this.bindPoste(p));
  },

  posteHTML(p) {
    const perso = p.personnalite
      ? Perso.esc((p.personnalite.prenom || '') + ' ' + p.personnalite.nom)
      : '';
    const sous = (p.sousSecteurs || []).map(s => Perso.esc(s.nom)).join(', ');
    const lies = p.secteur ? [p.secteur].concat(p.fusion || []).map(s => s.nom) : [];
    if (p.secteurManuelNom) lies.push(p.secteurManuelNom);
    const secteursLies = lies.map(n => Perso.esc(n)).join(' + ');
    const placeholder = p.type === 'delegue' ? 'nom. du delegué ministériel'
      : (p.type === 'regalien' ? 'nom du ministre*' : 'Nom du ministre');
    const ligne1 = `
      <div class="_3-gov-line-1 poste-perso-row">
        <input class="mon-input3 w-input poste-perso-search" maxlength="256" placeholder="${placeholder}" type="text" value="${perso}" autocomplete="off"/>
        <div class="_3-gov-mini-buttons">
          <a href="#" class="_2-mini-bouton loupe w-inline-block btn-loupe" title="Choisir dans la liste des personnalités">
            <div class="_2-picto-fontello-bouton">${ICO.loupe}</div>
          </a>
          <a href="#" class="_2-mini-bouton people w-inline-block btn-add-perso" title="Ajouter une nouvelle personnalité">
            <div class="_2-picto-fontello-bouton">${ICO.people}</div>
          </a>
          ${p.type !== 'regalien' ? '<a href="#" class="_2-picto-fontello-bouton x w-inline-block btn-remove-poste" title="Supprimer ce poste"><div class="fontello-icon pink">' + ICO.cross + '</div></a>' : ''}
        </div>
        <div class="autocomplete-results" style="display:none"></div>
      </div>`;
    if (p.type === 'regalien') {
      return `
    <div class="poste-bloc poste-regalien _3-bloc-min-r" id="poste-${p.uid}">
      <div class="_3-gov-line-0">
        <h3 class="heading-23 intitule-base">${Perso.esc(p.intitule)}</h3>
      </div>
      <div class="_3-gov-line-2">
        <div class="_3-sous-secteur poste-sous-secteurs">${sous || '<em>Aucun sous-secteur</em>'}</div>
        <a href="#" class="_2-code-link-button w-inline-block btn-edit-sous"><div>modifier</div></a>
      </div>
      ${ligne1}
    </div>`;
    }
    if (p.type === 'non_regalien') {
      return `
    <div class="poste-bloc poste-non_regalien _3-bloc-min-nr-step2 n" id="poste-${p.uid}">
      <div class="_3-gov-line-0">
        <h3 class="heading-23 intitule poste-intitule-txt">${Perso.esc(p.intitule)}</h3>
        <a href="#" class="_2-code-link-button w-inline-block btn-edit-intitule"><div>modifier l&#x27;intitulé</div></a>
      </div>
      ${secteursLies ? `
      <div class="_3-gov-line-0">
        <h3 class="heading-23 _2">${secteursLies}</h3>
        <a href="#" class="_2-code-link-button w-inline-block btn-edit-fusion"><div>modifier</div></a>
      </div>` : ''}
      <div class="_3-gov-line-2">
        <div class="_3-sous-secteur poste-sous-secteurs">${sous || '<em>Aucun sous-secteur</em>'}</div>
        <a href="#" class="_2-code-link-button w-inline-block btn-edit-sous"><div>modifier</div></a>
      </div>
      ${ligne1}
    </div>`;
    }
    // Délégué
    return `
    <div class="poste-bloc poste-delegue _3-bloc-del-nr-step2" id="poste-${p.uid}">
      <div class="_3-gov-line-0">
        <h3 class="heading-23 intitule poste-intitule-txt">${Perso.esc(p.intitule)}</h3>
        <a href="#" class="_2-code-link-button w-inline-block btn-edit-intitule"><div>modifier l&#x27;intitulé</div></a>
      </div>
      <input type="hidden" class="poste-fonction" value="${Perso.esc(p.fonction || '')}">
      ${ligne1}
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
      if (!UI.requireAuth()) return;
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

    // Loupe : modal liste des personnalités
    const loupe = bloc.querySelector('.btn-loupe');
    if (loupe) loupe.addEventListener('click', (e) => {
      e.preventDefault();
      if (!UI.requireAuth()) return;
      this.openListePerso(p.uid);
    });

    // Bouton personne : modal d'ajout d'une nouvelle personnalité
    const addPerso = bloc.querySelector('.btn-add-perso');
    if (addPerso) addPerso.addEventListener('click', (e) => {
      e.preventDefault();
      if (!UI.requireAuth()) return;
      this.openAddPersoModal(p.uid);
    });

    // Modifier les secteurs liés (fusion) d'un ministère
    const editFusion = bloc.querySelector('.btn-edit-fusion');
    if (editFusion) editFusion.addEventListener('click', (e) => {
      e.preventDefault();
      if (!UI.requireAuth()) return;
      this.openSecteurEditModal(p.uid);
    });

    // Modifier l'intitulé d'un poste (modal maquette)
    const editIntitule = bloc.querySelector('.btn-edit-intitule');
    if (editIntitule) editIntitule.addEventListener('click', (e) => {
      e.preventDefault();
      if (!UI.requireAuth()) return;
      this.openIntituleModal(p.uid);
    });
    document.addEventListener('click', (e) => {
      if (!bloc.contains(e.target)) results.style.display = 'none';
    });
  },

  // ---------- Sous-secteurs (modal) ----------
  async openSousSecteursModal(p) {
    const cont = document.getElementById('sous-secteurs-contenu');
    if (!cont) return;
    try { await this.loadReferentiels(true); } catch (err) { /* on affiche le cache */ }
    const actifs = (p.sousSecteurs || []).map(s => s.id).filter(Boolean);
    const nomsActifs = (p.sousSecteurs || []).map(s => s.nom);
    // Tous les sous-secteurs connus + ceux ajoutés manuellement à ce poste (id null)
    cont.innerHTML = (this.sousSecteursTous || []).map(s =>
      this._checkboxHTML(s.id, Perso.esc(s.nom), actifs.includes(s.id))
    ).join('') + (p.sousSecteurs || []).filter(s => !s.id).map(s =>
      this._checkboxHTML('manuel:' + s.nom, Perso.esc(s.nom), true)
    ).join('');
    this._bindChecks(cont, false);
    // v44 : champ de recherche qui filtre les sous-secteurs (casse et
    // accents ignorés) sans toucher aux cases déjà cochées.
    const recherche = document.getElementById('ssRecherche');
    if (recherche) {
      recherche.value = '';
      const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      recherche.oninput = () => {
        const q = norm(recherche.value.trim());
        cont.querySelectorAll('.w-dyn-item').forEach(item => {
          item.style.display = !q || norm(item.textContent).includes(q) ? '' : 'none';
        });
      };
    }
    const champ = document.getElementById('ssNouveau');
    if (champ) champ.value = '';
    const closeBtn = document.getElementById('btnCloseSous');
    if (closeBtn) closeBtn.onclick = async (e) => {
      e.preventDefault();
      const coches = Array.from(cont.querySelectorAll('input:checked')).map(ck => ck.dataset.value);
      const liste = [];
      coches.forEach(v => {
        if (v.startsWith('manuel:')) liste.push({ id: null, nom: v.slice(7) });
        else {
          const s = (this.sousSecteursTous || []).find(x => x.id === v);
          if (s) liste.push(s);
        }
      });
      const nouveau = champ ? champ.value.trim() : '';
      if (nouveau) liste.push({ id: null, nom: nouveau }); // personnalisation du poste, hors référentiel
      p.sousSecteurs = liste;
      UI.closeModals();
      this.renderComposer();
    };
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

  // ---------- Modaux du composer ----------
  _checkboxHTML(value, label, checked, name) {
    return '<div role="listitem" class="w-dyn-item"><label class="w-checkbox _w-checkbox">' +
      '<div class="w-checkbox-input w-checkbox-input--inputType-custom' + (checked ? ' w--redirected-checked' : '') + '"></div>' +
      '<input type="checkbox" data-value="' + value + '"' + (checked ? ' checked' : '') + (name ? ' data-groupe="' + name + '"' : '') + ' style="opacity:0;position:absolute;z-index:-1"/>' +
      '<span class="checkbox-label-2 w-form-label">' + label + '</span></label></div>';
  },

  _bindChecks(cont, single) {
    cont.querySelectorAll('input[type="checkbox"]').forEach(ck => {
      ck.addEventListener('change', () => {
        if (single && ck.checked) {
          cont.querySelectorAll('input[type="checkbox"]').forEach(autre => {
            if (autre !== ck) {
              autre.checked = false;
              const v = autre.parentElement.querySelector('.w-checkbox-input');
              if (v) v.classList.remove('w--redirected-checked');
            }
          });
        }
        const visu = ck.parentElement.querySelector('.w-checkbox-input');
        if (visu) visu.classList.toggle('w--redirected-checked', ck.checked);
      });
    });
  },

  addMinistere() {
    if (!UI.requireAuth()) return;
    this.openMinistereModal('add');
  },

  // ---------- Modal intitulé personnalisé ----------
  openIntituleModal(uid) {
    this._posteEnCours = uid;
    const p = this.composerState.postes.find(x => x.uid === uid);
    const champ = document.getElementById('miInput');
    if (!p || !champ) return;
    champ.value = p.intitule || '';
    UI.openModal('modal-intitule');
    champ.focus();
  },

  validerIntitule() {
    const p = this.composerState.postes.find(x => x.uid === this._posteEnCours);
    const champ = document.getElementById('miInput');
    if (!p || !champ) return;
    const v = champ.value.trim();
    if (!v) return UI.toast('L\'intitulé ne peut pas être vide.');
    p.intitule = v;
    UI.closeModals();
    this.renderComposer();
  },

  // ---------- Modal secteurs d'un ministère (choisir-secteur) ----------
  async openSecteurEditModal(uid) {
    this._posteEnCours = uid;
    const p = this.composerState.postes.find(x => x.uid === uid);
    const cont = document.getElementById('mcsSecteurs');
    try { await this.loadReferentiels(true); } catch (err) { /* on affiche le cache */ }
    const manuel = document.getElementById('mcsManuel');
    if (!p || !cont) return;
    const lies = [p.secteur, ...(p.fusion || [])].filter(Boolean).map(s => s.id);
    cont.innerHTML = this.nonRegaliens().map(s =>
      this._checkboxHTML(s.id, Perso.esc(s.nom), lies.includes(s.id))
    ).join('') || '<span class="esp-vide">Aucun secteur disponible.</span>';
    this._bindChecks(cont, false);
    if (manuel) manuel.value = p.secteurManuelNom || '';
    UI.openModal('modal-choisir-secteur');
  },

  validerSecteurEdit() {
    const p = this.composerState.postes.find(x => x.uid === this._posteEnCours);
    const cont = document.getElementById('mcsSecteurs');
    const manuel = document.getElementById('mcsManuel');
    if (!p || !cont) return;
    const coches = Array.from(cont.querySelectorAll('input:checked')).map(ck => ck.dataset.value);
    const secteurs = coches.map(id => this.nonRegaliens().find(s => s.id === id)).filter(Boolean);
    const nomManuel = manuel ? manuel.value.trim() : '';
    if (!secteurs.length && !nomManuel) return UI.toast('Choisissez au moins un secteur ou nommez-en un.');
    p.secteur = secteurs[0] || null;
    p.fusion = secteurs.slice(1);
    p.secteurManuelNom = nomManuel || null;
    if (p.secteur) this.recomputeFusion(p);
    UI.closeModals();
    this.renderComposer();
  },

  async openMinistereModal(mode, uid) {
    if (!this.composerState) return;
    this._ministereMode = mode || 'add';
    this._posteEnCours = uid || null;
    const cont = document.getElementById('mmSecteurs');
    if (mode !== 'edit') { try { await this.loadReferentiels(true); } catch (err) { /* cache */ } }
    const manuel = document.getElementById('mmManuel');
    if (!cont) return;
    if (mode === 'edit') {
      return this.openSecteurEditModal(uid);
    } else {
      const dejaPris = this.composerState.postes
        .filter(p => p.type === 'non_regalien' && p.secteur)
        .flatMap(p => [p.secteur.id, ...(p.fusion || []).map(f => f.id)]);
      const dispo = this.nonRegaliens().filter(s => !dejaPris.includes(s.id));
      cont.innerHTML = dispo.map(s =>
        this._checkboxHTML(s.id, Perso.esc(s.nom), false)
      ).join('') || '<span class="esp-vide">Tous les secteurs sont déjà dans votre gouvernement.</span>';
      if (manuel) { manuel.parentElement.style.display = ''; manuel.value = ''; }
    }
    this._bindChecks(cont, false);
    UI.openModal('modal-ministere');
  },

  validerMinistere() {
    const cont = document.getElementById('mmSecteurs');
    const manuel = document.getElementById('mmManuel');
    const coches = Array.from(cont.querySelectorAll('input:checked')).map(ck => ck.dataset.value);
    if (this._ministereMode === 'edit') {
      const p = this.composerState.postes.find(x => x.uid === this._posteEnCours);
      if (!p) return;
      const secteurs = coches.map(id => this.nonRegaliens().find(s => s.id === id)).filter(Boolean);
      if (!secteurs.length) return UI.toast('Choisissez au moins un secteur.');
      p.secteur = secteurs[0];
      p.fusion = secteurs.slice(1);
      this.recomputeFusion(p);
    } else {
      const aAjouter = coches.map(id => this.nonRegaliens().find(s => s.id === id)).filter(Boolean);
      const titreManuel = manuel ? manuel.value.trim() : '';
      const champIntitule = document.getElementById('mmManuelIntitule');
      const intituleManuel = champIntitule ? champIntitule.value.trim() : '';
      if (!aAjouter.length && !titreManuel && !intituleManuel) return UI.toast('Choisissez un secteur ou créez-en un.');
      aAjouter.forEach(s => {
        this.composerState.postes.push({
          uid: 'min-' + Date.now() + '-' + s.id.slice(0, 6),
          type: 'non_regalien',
          secteur: s,
          fusion: [],
          intitule: s.intitule_poste_defaut || s.nom,
          personnalite: null,
          sousSecteurs: (this.sousSecteursDefaut[s.id] || []).slice()
        });
      });
      if (titreManuel || intituleManuel) {
        this.composerState.postes.push({
          uid: 'min-' + Date.now() + '-manuel',
          type: 'non_regalien',
          secteur: null,
          fusion: [],
          secteurManuelNom: titreManuel || null,
          intitule: intituleManuel || ('Ministère : ' + titreManuel),
          personnalite: null,
          sousSecteurs: []
        });
        if (champIntitule) champIntitule.value = '';
      }
    }
    UI.closeModals();
    this.renderComposer();
  },

  addDelegue() {
    if (!UI.requireAuth()) return;
    this.openDelegueModal();
  },

  async openDelegueModal() {
    if (!this.composerState) return;
    const cont = document.getElementById('mdMinisteres');
    try { await this.loadReferentiels(true); } catch (err) { /* on affiche le cache */ }
    const selSous = document.getElementById('mdSousSecteur');
    const fonction = document.getElementById('mdFonction');
    if (!cont) return;
    const ministeres = this.composerState.postes.filter(p => p.type !== 'delegue');
    // v44 : on rattache un délégué à un MINISTÈRE, pas à un ministre :
    // le libellé affiché transforme « Ministre de… » en « Ministère de… »
    // (« Premier ministre » et les intitulés libres restent tels quels).
    const enMinistere = (t) => String(t || 'Ministère').replace(/^\s*ministre\s+/i, 'Ministère ');
    cont.innerHTML = ministeres.map(p =>
      this._checkboxHTML(p.uid, Perso.esc(enMinistere(p.intitule || (p.secteur ? p.secteur.nom : 'Ministère'))), false, 'md')
    ).join('');
    this._bindChecks(cont, true); // choix unique
    if (selSous) {
      selSous.innerHTML = '<option value="" selected>aucun sous-secteur</option>' +
        (this.sousSecteursTous || []).map(s => '<option value="' + s.id + '">' + Perso.esc(s.nom) + '</option>').join('');
    }
    if (fonction) fonction.value = '';
    const champNouveau = document.getElementById('mdSousNouveau');
    if (champNouveau) champNouveau.value = '';
    UI.openModal('modal-delegue');
  },

  validerDelegue() {
    const cont = document.getElementById('mdMinisteres');
    const coche = cont.querySelector('input:checked');
    if (!coche) return UI.toast('Sélectionnez le ministère de rattachement.');
    const ministre = this.composerState.postes.find(p => p.uid === coche.dataset.value);
    if (!ministre) return;
    const fonction = (document.getElementById('mdFonction').value || '').trim();
    const sousId = document.getElementById('mdSousSecteur').value;
    const champNouveau = document.getElementById('mdSousNouveau');
    const sousNouveau = champNouveau ? champNouveau.value.trim() : '';
    let sousSec = (this.sousSecteursTous || []).find(s => s.id === sousId);
    if (sousNouveau) sousSec = { id: null, nom: sousNouveau }; // personnalisation du poste
    this.composerState.postes.push({
      uid: 'del-' + Date.now(),
      type: 'delegue',
      secteur: ministre.secteur || null,
      // Le ministère de rattachement est déjà visible par la position du délégué
      // juste en dessous de lui : l'intitulé n'a plus besoin de le nommer.
      intitule: 'Délégué' + (fonction ? ' chargé de ' + fonction : ''),
      fonction: fonction,
      attacheAUid: ministre.uid,
      personnalite: null,
      sousSecteurs: sousSec ? [sousSec] : []
    });
    UI.closeModals();
    this.renderComposer();
  },

  // ---------- Modal liste des personnalités (loupe) ----------
  openListePerso(uid) {
    this._posteEnCours = uid;
    this._mlpOrdre = this._mlpOrdre || 'alpha';
    this.renderListePerso();
    UI.openModal('modal-liste-perso');
  },

  renderListePerso() {
    const cont = document.getElementById('mlpListe');
    if (!cont) return;
    const persos = (this.persosCache || []).slice();
    let html = '';
    if (this._mlpOrdre === 'metier') {
      persos.sort((a, b) => ((a.metiers || [])[0] || '').localeCompare((b.metiers || [])[0] || '', 'fr'));
      let groupe = null;
      persos.forEach(x => {
        const m = ((x.metiers || [])[0] || 'Autre');
        if (m !== groupe) { groupe = m; html += '<div class="mlp-lettre">' + Perso.esc(m) + '</div>'; }
        html += this._lignePerso(x);
      });
    } else {
      persos.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
      let lettre = null;
      persos.forEach(x => {
        const l = (x.nom || '?').charAt(0).toUpperCase();
        if (l !== lettre) { lettre = l; html += '<div class="mlp-lettre">' + l + '</div>'; }
        html += this._lignePerso(x);
      });
    }
    cont.innerHTML = html || '<div class="empty-msg">Aucune personnalité dans la base.</div>';
    cont.querySelectorAll('.div-block-296').forEach(ligne => ligne.addEventListener('click', (e) => {
      e.preventDefault();
      const found = (this.persosCache || []).find(x => x.id === ligne.dataset.id);
      if (!found) return;
      this.assignPerso(this._posteEnCours, found);
      UI.closeModals();
    }));
  },

  _lignePerso(x) {
    return '<div class="div-block-296" data-id="' + x.id + '">' +
      '<a href="#" class="_w-courant _w-bold _w-maj">' + Perso.esc(x.nom) + '</a>' +
      '<div class="_w-courant">' + Perso.esc(x.prenom || '') + '</div>' +
      '<div class="_w-courant grey-courant">' + Perso.esc((x.metiers || []).join(', ')) + '</div>' +
      '</div>';
  },

  assignPerso(uid, perso) {
    const p = (this.composerState && this.composerState.postes || []).find(x => x.uid === uid);
    if (!p) return;
    p.personnalite = perso;
    this.renderComposer();
  },

  // ---------- Modal ajout d'une personnalité depuis le composer ----------
  openAddPersoModal(uid) {
    this._posteEnCours = uid;
    ['mapNom', 'mapPrenom', 'mapMetier', 'mapWiki'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['mapVideoRows', 'mapLienRows'].forEach(id => {
      const zone = document.getElementById(id);
      if (!zone) return;
      zone.querySelectorAll('.div-block-332').forEach((row, i) => { if (i > 0) row.remove(); });
      const premier = zone.querySelector('input');
      if (premier) premier.value = '';
    });
    UI.openModal('modal-add-perso');
  },

  async validerAddPerso() {
    if (!Auth.isLoggedIn()) return UI.toast('Connectez-vous pour ajouter une personnalité.');
    const nom = document.getElementById('mapNom').value.trim();
    const prenom = document.getElementById('mapPrenom').value.trim();
    if (!nom || !prenom) return UI.toast('Nom et prénom sont obligatoires.');
    if (window.Perso && !(await Perso.confirmerSiDoublon(nom, prenom))) return;
    const metier = document.getElementById('mapMetier').value.trim();
    const wiki = document.getElementById('mapWiki').value.trim();
    const liens = [];
    document.querySelectorAll('#mapVideoRows .map-video-input').forEach(inp => {
      const v = inp.value.trim();
      if (v) liens.push({ type: 'video', titre: 'Vidéo', url: v });
    });
    document.querySelectorAll('#mapLienRows .map-lien-input').forEach(inp => {
      const v = inp.value.trim();
      if (v) liens.push({ type: 'lien', titre: 'Document', url: v });
    });
    if (wiki) liens.push({ type: 'lien', titre: 'Fiche Wikipédia', url: wiki });
    try {
      const { data: created, error } = await sb.from('personnalites').insert({
        nom, prenom,
        metiers: metier ? [metier] : [],
        liens,
        statut: 0,
        ajoute_par: Auth.currentUser.id
      }).select().single();
      if (error) throw error;
      this.persosCache = null;
      await this.loadPersosCache();
      if (window.Perso) { Perso.all = []; }
      if (this._posteEnCours) this.assignPerso(this._posteEnCours, created);
      UI.closeModals();
      UI.toast('Personnalité « ' + prenom + ' ' + nom + ' » ajoutée' + (this._posteEnCours ? ' et affectée au poste.' : '.'));
      this.renderComposer();
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  // ---------- Sauvegarde ----------
  async save(publish) {
    if (!UI.requireAuth()) return;
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
        const { data: votesActuels } = await sb.from('gouvernements_votes')
          .select('id').eq('gouvernement_id', this.composerState.editingId).limit(1);
        const { data: gActuel } = await sb.from('gouvernements')
          .select('is_published').eq('id', this.composerState.editingId).single();
        if (gActuel && gActuel.is_published && votesActuels && votesActuels.length) {
          return UI.toast('Ce gouvernement a reçu des votes entre-temps : il n\'est plus modifiable.');
        }
        const { data, error: uErr } = await sb
          .from('gouvernements')
          .update({ titre, description, is_published: !!publish })
          .eq('id', this.composerState.editingId)
          .select()
          .single();
        if (uErr) throw uErr;
        gouv = data;
        // On repart de zéro sur les postes du brouillon
        const { error: dErr } = await sb.from('postes_gouvernement').delete().eq('gouvernement_id', gouv.id);
        if (dErr) throw new Error('Impossible de remplacer les postes existants : ' + dErr.message);
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
        secteur_personnalise: p.secteurManuelNom || null,
        sous_secteurs_personnalises: (p.sousSecteurs || []).filter(s => !s.id && s.nom).map(s => s.nom),
        fonction_delegue: p.type === 'delegue' ? (p.fonction || null) : null,
        ordre: i
      }));
      const { data: postes, error: pErr } = await sb
        .from('postes_gouvernement')
        .insert(postesRows)
        .select();
      if (pErr) throw pErr;

      // 2bis. Rattachement réel des délégués à leur ministre (par id de base,
      // pas par ordre de sauvegarde) : deux postes ne partagent le même index
      // que dans ce même tableau, on peut donc les recroiser par position.
      const uidVersId = {};
      this.composerState.postes.forEach((p, i) => { if (postes[i]) uidVersId[p.uid] = postes[i].id; });
      const rattachements = [];
      this.composerState.postes.forEach((p, i) => {
        if (p.type === 'delegue' && p.attacheAUid && uidVersId[p.attacheAUid] && postes[i]) {
          rattachements.push({ id: postes[i].id, parentId: uidVersId[p.attacheAUid] });
        }
      });
      for (const r of rattachements) {
        const { error: rErr } = await sb.from('postes_gouvernement')
          .update({ delegue_de_poste_id: r.parentId }).eq('id', r.id);
        if (rErr) throw rErr;
      }

      // 3. Sous-secteurs de chaque poste (création des nouveaux si besoin)
      const sousRows = [];
      const fusionRows = [];
      for (let i = 0; i < (postes || []).length; i++) {
        const row = postes[i];
        const p = this.composerState.postes[i];
        (p.fusion || []).forEach(s => fusionRows.push({ poste_id: row.id, secteur_id: s.id }));
        for (const s of (p.sousSecteurs || [])) {
          if (s.id) sousRows.push({ poste_id: row.id, sous_secteur_id: s.id });
          // Les sous-secteurs personnalisés (sans id) sont déjà portés par la colonne du poste
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
        : 'Brouillon enregistré : « ' + titre + ' » — vous pouvez continuer à le modifier.');
      if (publish) {
        document.getElementById('gouvTitre').value = '';
        document.getElementById('gouvDescription').value = '';
        this.resetComposer();
        UI.showSection(1);
      } else {
        // Le composer reste tel quel ; la prochaine sauvegarde mettra à jour ce même brouillon
        this.composerState.editingId = gouv.id;
      }
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
          .select('*, users!created_by(username, nom, prenom, afficher_username), postes_gouvernement(*, personnalites!personnalite_id(id, nom, prenom, statut), secteurs!secteur_id(nom))')
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

  // Regroupe une liste de postes déjà triés par ordre : chaque délégué est
  // déplacé juste après le poste (ministre) auquel il est explicitement
  // rattaché (delegue_de_poste_id), plutôt que de rester à sa position brute
  // de sauvegarde. Les délégués orphelins (ministre supprimé, ancien
  // gouvernement sans rattachement enregistré) sont replacés à la fin.
  grouperAvecDelegues(postes) {
    const posteById = {};
    postes.forEach(p => { if (p.id) posteById[p.id] = p; });
    const nonDelegues = postes.filter(p => p.type !== 'delegue');
    const delegues = postes.filter(p => p.type === 'delegue');
    const parParent = {};
    const orphelins = [];
    delegues.forEach(d => {
      const parent = d.delegue_de_poste_id ? posteById[d.delegue_de_poste_id] : null;
      if (parent) (parParent[parent.id] = parParent[parent.id] || []).push(d);
      else orphelins.push(d);
    });
    const resultat = [];
    nonDelegues.forEach(p => {
      resultat.push(p);
      (parParent[p.id] || [])
        .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
        .forEach(d => resultat.push(d));
    });
    resultat.push(...orphelins);
    return resultat;
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
      const pinned = this.epingles.has(g.id);
      const note = st.note_moyenne != null ? String(st.note_moyenne).replace('.', ',') : null;
      const pourvus = postes.filter(p => p.personnalites);
      const posteById = {};
      pourvus.forEach(p => { if (p.id) posteById[p.id] = p; });
      const parentEstRegalien = d => d.delegue_de_poste_id && posteById[d.delegue_de_poste_id]
        && posteById[d.delegue_de_poste_id].type === 'regalien';
      const tousDelegues = pourvus.filter(p => p.type === 'delegue');
      const regs = this.grouperAvecDelegues(
        pourvus.filter(p => p.type === 'regalien').concat(tousDelegues.filter(parentEstRegalien))
      );
      const autres = this.grouperAvecDelegues(
        pourvus.filter(p => p.type === 'non_regalien').concat(tousDelegues.filter(d => !parentEstRegalien(d)))
      );
      const ligne = p => {
        const perso = p.personnalites;
        const estDelegue = p.type === 'delegue';
        // Pour un délégué, l'intitulé de son poste remplace le secteur ;
        // pour les autres, le secteur prime, sinon l'intitulé personnalisé.
        const role = estDelegue
          ? (p.nom_poste_personnalise || p.fonction_delegue || 'Délégué')
          : (p.secteurs ? p.secteurs.nom : (p.nom_poste_personnalise || ''));
        return '<div class="fonction-perso gouv-membre' + (estDelegue ? ' delegu' : '') + '">' +
          '<a href="#" class="w-inline-block membre-fiche" data-perso-id="' + (perso ? perso.id : '') + '">' +
          '<div class="_3-name-gov-pub gm-nom' + (estDelegue ? ' delegu' : '') + '">' +
          (estDelegue ? '<code class="fleche-fontello">' + ICO.flecheDeleg + '</code> ' : '') +
          Perso.esc((perso.prenom || '') + ' ' + perso.nom) +
          '</div></a> <div class="secteurs gm-secteur' + (estDelegue ? ' delegue' : '') + '">' + Perso.esc(role) + '</div></div>';
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
              ${Auth.isAdmin() ? '<a href="#" class="_2-mini-bouton w-inline-block btn-gouv-del" title="Supprimer (admin)"><div class="_2-picto-fontello-bouton">' + ICO.trash + '</div></a>' : ''}
            </div>
            <div class="radio-button-form">
              <div class="div-block-323 gouv-vote" data-id="${g.id}">
                ${[1,2,3,4,5].map(n =>
                  '<span class="radio-button-3 w-radio-input etoile ' + (maNote >= n ? 'pleine active w--redirected-checked' : '') + '" data-note="' + n + '" title="' + n + '/5"></span>'
                ).join('')}
              </div>
              <div class="_w-courant mini-jaune">Votre note <span class="gouv-nbvotes">(${st.nb_votes || 0})</span></div>
            </div>
            <div class="note-star-bloc">
              ${note != null
                ? '<svg class="note-star" viewBox="0 0 300 300" width="44" height="44" xmlns="http://www.w3.org/2000/svg">' +
                  '<polygon points="150 41.3 190.19 0 204.35 55.86 259.81 40.19 244.14 95.65 300 109.81 258.7 150 300 190.19 244.14 204.35 259.81 259.81 204.35 244.14 190.19 300 150 258.7 109.81 300 95.65 244.14 40.19 259.81 55.86 204.35 0 190.19 41.3 150 0 109.81 55.86 95.65 40.19 40.19 95.65 55.86 109.81 0 150 41.3" fill="#ffbb47"/>' +
                  '<text x="150" y="150" text-anchor="middle" dominant-baseline="central" font-size="88" font-weight="900" fill="#ffffff" font-family="Pinokiosanstrial, Arial, sans-serif" class="note-moy-svg">' + note + '</text>' +
                  '</svg><span class="note-moy" style="display:none">' + note + '</span>'
                : ''}
            </div>
          </div>
        </div>
        <div class="cr-e-par">
          <div class="_w-courant _w-mini-grey">gouvernement créé par</div>
          <a href="#" class="_w-courant _w-bold cap gouv-auteur">${Perso.esc(displayUser(g.users))}</a>
          <div class="_w-courant _w-mini-grey">&bull; ${st.nb_commentaires || 0} commentaire(s)</div>
        </div>
        ${g.description ? '<p class="paragraph-7 gouv-desc">' + Perso.esc(g.description) + ' <code class="code-14 btn-desc-toggle">+</code></p>' : ''}
        <div class="gouv-membres membres-regaliens">${regs.map(ligne).join('')}</div>
        ${autres.length ? '<div class="filet pointille"></div><div class="gouv-membres membres-autres">' + autres.map(ligne).join('') + '</div>' : ''}
      </div>`;
    }).join('');
    this.bindPublished(cont);
  },

  bindPublished(cont) {
    // Description : le "+" ne s'affiche que si le texte dépasse réellement 2 lignes
    cont.querySelectorAll('.gouv-desc').forEach(p => {
      const toggle = p.querySelector('.btn-desc-toggle');
      if (!toggle) return;
      if (p.scrollHeight <= p.clientHeight + 1) { toggle.style.display = 'none'; return; }
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const ouvert = p.classList.toggle('expanded');
        toggle.textContent = ouvert ? '−' : '+';
      });
    });
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
    const g = this.published.find(x => x.id === id);
    if (!g) return;
    const postes = (g.postes_gouvernement || []).slice()
      .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
      .filter(p => p.personnalites);
    const lignes = postes.map(p => {
      const role = p.nom_poste_personnalise || (p.secteurs ? p.secteurs.nom : '') || p.fonction_delegue || '';
      return '- ' + role + ' : ' + (p.personnalites.prenom || '') + ' ' + p.personnalites.nom;
    }).join('\n');
    const url = location.origin + location.pathname + '#gouv-' + id;
    const sujet = 'SOSGOUV : ' + (g.titre || 'un gouvernement à découvrir');
    const corps = 'Je te partage le gouvernement « ' + (g.titre || '') + ' » composé sur SOSGOUV :\n\n'
      + lignes + '\n\n'
      + (g.description ? g.description + '\n\n' : '')
      + 'À découvrir et noter ici : ' + url;
    window.location.href = 'mailto:?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);
  },

  // ---------- Détail + commentaires ----------
  async openDetail(id) {
    const g = this.published.find(x => x.id === id);
    if (!g) return;
    const cont = document.getElementById('detail-contenu');
    if (!cont) return;

    // Secteurs fusionnés et sous-secteurs de chaque poste
    let fusionsParPoste = {};
    let sousParPoste = {};
    try {
      const [fusRes, pssRes, ssRes] = await Promise.all([
        sb.from('postes_secteurs_fusionnes').select('*'),
        sb.from('postes_sous_secteurs').select('*'),
        sb.from('sous_secteurs').select('*')
      ]);
      (fusRes.data || []).forEach(r => {
        const s = this.secteurs.find(x => x.id === r.secteur_id);
        if (!s) return;
        (fusionsParPoste[r.poste_id] = fusionsParPoste[r.poste_id] || []).push(s.nom);
      });
      const ssById = {};
      (ssRes.data || []).forEach(s => ssById[s.id] = s.nom);
      (pssRes.data || []).forEach(r => {
        const nom = ssById[r.sous_secteur_id];
        if (!nom) return;
        (sousParPoste[r.poste_id] = sousParPoste[r.poste_id] || []).push(nom);
      });
    } catch (err) { /* facultatif */ }

    const st = (this.stats && this.stats[g.id]) || {};
    const note = st.note_moyenne != null ? String(st.note_moyenne).replace('.', ',') : null;
    const maNote = this.votesUser[g.id] || 0;
    const pinned = this.epingles.has(g.id);
    const postes = (g.postes_gouvernement || []).slice().sort((a, b) => a.ordre - b.ordre);

    const blocPoste = (p) => {
      const perso = p.personnalites;
      const estDelegue = p.type === 'delegue';
      const fusion = (fusionsParPoste[p.id] || []).map(n => ' + ' + Perso.esc(n)).join('');
      // Pour un délégué, l'intitulé du poste remplace déjà le secteur (même principe
      // que sur la carte de la liste publiée) : on ne réaffiche pas le secteur brut.
      const secteurNom = estDelegue ? ''
        : (p.secteurs ? Perso.esc(p.secteurs.nom) + fusion
          : (p.secteur_personnalise ? Perso.esc(p.secteur_personnalise) : ''));
      const sous = (sousParPoste[p.id] || []).concat(p.sous_secteurs_personnalises || []).map(n =>
        '<h6 class="h1-grey _2-soussect">' + Perso.esc(n) + '</h6>').join('');
      const intitule = p.nom_poste_personnalise || (p.secteurs ? p.secteurs.nom : '') || '';
      return '<div class="bloc-poste-gov-detail' + (estDelegue ? ' delegue-bloc' : '') + '">' +
        '<div class="div-block-336">' +
        (perso
          ? '<a href="#" class="nom-prenom-gov-detail membre-fiche" data-perso-id="' + perso.id + '">' +
            (estDelegue ? '<code class="fleche-fontello">' + ICO.flecheDeleg + '</code> ' : '') +
            Perso.esc((perso.prenom || '') + ' ' + perso.nom) + '</a>'
          : '<div class="nom-prenom-gov-detail non-attribue"><em>non attribué</em></div>') +
        '<h3 class="h1-color">' + Perso.esc(intitule) + (p.fonction_delegue ? ', ' + Perso.esc(p.fonction_delegue) : '') + '</h3>' +
        '</div>' +
        ((secteurNom || sous)
          ? '<div class="secteur-sous-secteurs">' +
            (secteurNom ? '<h6 class="h1-grey bold">' + secteurNom + '</h6>' : '') +
            (sous ? '<div class="div-block-317">' + sous + '</div>' : '') +
            '</div>'
          : '') +
        '</div>';
    };

    const posteByIdDetail = {};
    postes.forEach(p => { if (p.id) posteByIdDetail[p.id] = p; });
    const parentEstRegalienDetail = d => d.delegue_de_poste_id && posteByIdDetail[d.delegue_de_poste_id]
      && posteByIdDetail[d.delegue_de_poste_id].type === 'regalien';
    const tousDeleguesDetail = postes.filter(p => p.type === 'delegue');
    const regs = this.grouperAvecDelegues(
      postes.filter(p => p.type === 'regalien').concat(tousDeleguesDetail.filter(parentEstRegalienDetail))
    );
    const autres = this.grouperAvecDelegues(
      postes.filter(p => p.type === 'non_regalien').concat(tousDeleguesDetail.filter(d => !parentEstRegalienDetail(d)))
    );

    cont.innerHTML =
      '<div class="_4-content-gm"><div class="gov-compact-bloc detail2">' +
      '<div class="gov-title">' +
        '<div class="filet govlinedetails"><h1 class="heading-4-nom-prenom d">' + Perso.esc(g.titre) + '</h1></div>' +
        '<div class="bouton-gov-detail">' +
          '<a href="#" class="_2-mini-bouton w-inline-block" id="detailShare"><div class="_2-picto-fontello-bouton">' + ICO.send + '</div><h6 class="heading-dyn"><strong class="heading-bold-text">faire suivre</strong></h6></a>' +
          '<a href="#" class="_2-mini-bouton w-inline-block ' + (pinned ? 'active' : '') + '" id="detailPin"><div class="_2-picto-fontello-bouton">' + ICO.pin + '</div><h6 class="heading-dyn"><strong class="heading-bold-text">' + (pinned ? 'épinglé' : 'épingler') + '</strong></h6></a>' +
        '</div>' +
        '<div class="vote-bloc-detail">' +
          '<div class="div-block-323">' +
          [1,2,3,4,5].map(n =>
            '<span class="radio-button-3 w-radio-input etoile ' + (maNote >= n ? 'pleine active w--redirected-checked' : '') + '" data-note="' + n + '" title="' + n + '/5"></span>'
          ).join('') + '</div>' +
          '<div class="_w-courant mini-jaune">Votre note <span class="gouv-nbvotes">(' + (st.nb_votes || 0) + ')</span></div>' +
        '</div>' +
        '<div class="_3-star-bloc">' +
        (note != null
          ? '<svg class="note-star" viewBox="0 0 300 300" width="54" height="54" xmlns="http://www.w3.org/2000/svg">' +
            '<polygon points="150 41.3 190.19 0 204.35 55.86 259.81 40.19 244.14 95.65 300 109.81 258.7 150 300 190.19 244.14 204.35 259.81 259.81 204.35 244.14 190.19 300 150 258.7 109.81 300 95.65 244.14 40.19 259.81 55.86 204.35 0 190.19 41.3 150 0 109.81 55.86 95.65 40.19 40.19 95.65 55.86 109.81 0 150 41.3" fill="#ffbb47"/>' +
            '<text x="150" y="150" text-anchor="middle" dominant-baseline="central" font-size="88" font-weight="900" fill="#ffffff" font-family="Pinokiosanstrial, Arial, sans-serif">' + note + '</text></svg>'
          : '') +
        '</div>' +
      '</div>' +
      '<div class="cr-e-par"><span class="_w-courant _w-mini-grey">gouvernement créé par</span> <span class="_w-courant _w-bold cap">' + Perso.esc(displayUser(g.users)) + '</span></div>' +
      (g.description ? '<p class="detail-desc">' + Perso.esc(g.description) + '</p>' : '') +
      '<div class="note-comment">' +
        '<div class="bouton-comment">' +
        '<span class="_2-mini-bouton _2"><span class="_2-picto-fontello-bouton">' + ICO.starFull + '</span><span class="mini-current mini-bold">' + (st.nb_votes || 0) + '</span></span>' +
        '<span class="_2-mini-bouton _2"><span class="_2-picto-fontello-bouton">' + ICO.cond + '</span><span class="mini-current mini-bold">' + (st.nb_commentaires || 0) + ' commentaires</span></span>' +
        '</div></div>' +
      regs.map(blocPoste).join('') +
      (autres.length ? '<div class="div-block-337"></div>' + autres.map(blocPoste).join('') : '') +
      '<h4>Commentaires</h4><div id="detail-commentaires"><div class="loading">Chargement…</div></div>' +
      '<div class="comm-add-row"><input type="text" id="newComment" class="mon-input5 w-input champ-texte" placeholder="Votre commentaire…">' +
      '<a href="#" class="_2-mini-bouton w-inline-block btn-envoyer-comm" id="btnAddComment"><div class="_2-picto-fontello-bouton">' + ICO.send + '</div></a></div>' +
      '</div></div>';

    UI.openModal('modal-detail');
    this.loadComments(id);
    cont.querySelector('#btnAddComment').addEventListener('click', (e) => { e.preventDefault(); this.addComment(id); });
    cont.querySelectorAll('.etoile').forEach(star => {
      star.addEventListener('click', () => this.vote(id, Number(star.dataset.note)));
    });
    const dShare = cont.querySelector('#detailShare');
    if (dShare) dShare.addEventListener('click', (e) => { e.preventDefault(); this.share(id); });
    const dPin = cont.querySelector('#detailPin');
    if (dPin) dPin.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!UI.requireAuth()) return;
      await this.togglePin(id, dPin);
      this.openDetail(id);
    });
    cont.querySelectorAll('.membre-fiche').forEach(a => a.addEventListener('click', async (e) => {
      e.preventDefault();
      const pid = a.dataset.persoId;
      if (!pid || !window.Perso) return;
      if (!Perso.all || !Perso.all.length) await Perso.loadList();
      Perso.openFiche(pid);
    }));
  },

  async loadComments(gouvId) {
    const cont = document.getElementById('detail-commentaires');
    if (!cont) return;
    try {
      const { data, error } = await sb
        .from('commentaires')
        .select('*, users!user_id(username, nom, prenom, afficher_username)')
        .eq('gouvernement_id', gouvId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const tous = data || [];
      const racines = tous.filter(c => !c.parent_id);
      const reponsesDe = pid => tous.filter(c => c.parent_id === pid);
      const rend = (c, prof) =>
        '<div class="comm-item' + (prof ? ' comm-reponse' : '') + '">' +
        '<span class="comm-auteur">' + Perso.esc(displayUser(c.users)) + '</span> ' +
        Perso.esc(c.contenu) +
        ' <a href="#" class="comm-repondre">répondre</a>' +
        '<div class="comm-reponse-form" style="display:none">' +
        '<input type="text" class="mon-input5 w-input comm-reponse-input" placeholder="Votre réponse…">' +
        '<a href="#" class="_2-mini-bouton w-inline-block comm-reponse-send" data-cid="' + c.id + '"><div class="_2-picto-fontello-bouton">' + ICO.send + '</div></a>' +
        '</div></div>' +
        reponsesDe(c.id).map(r => rend(r, prof + 1)).join('');
      cont.innerHTML = racines.length
        ? racines.map(c => rend(c, 0)).join('')
        : '<div class="empty-msg">Aucun commentaire.</div>';

      cont.querySelectorAll('.comm-repondre').forEach(a => a.addEventListener('click', (e) => {
        e.preventDefault();
        if (!Auth.isLoggedIn()) return UI.toast('Connectez-vous pour répondre.');
        const form = a.parentElement.querySelector('.comm-reponse-form');
        if (form) form.style.display = form.style.display === 'none' ? 'flex' : 'none';
      }));
      cont.querySelectorAll('.comm-reponse-send').forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        const input = btn.parentElement.querySelector('.comm-reponse-input');
        this.addComment(gouvId, btn.dataset.cid, input ? input.value.trim() : '');
      }));
    } catch (err) {
      cont.innerHTML = '<div class="error-msg">Erreur : ' + err.message + '</div>';
    }
  },

  async addComment(gouvId, parentId, contenuDirect) {
    if (!Auth.isLoggedIn()) return UI.toast('Connectez-vous pour commenter.');
    let contenu = contenuDirect;
    if (contenu == null) {
      const input = document.getElementById('newComment');
      contenu = input ? input.value.trim() : '';
    }
    if (!contenu) return;
    try {
      const { error } = await sb.from('commentaires').insert({
        user_id: Auth.currentUser.id,
        gouvernement_id: gouvId,
        parent_id: parentId || null,
        contenu
      });
      if (error) throw error;
      const champ = document.getElementById('newComment');
      if (champ && contenuDirect == null) champ.value = '';
      this.loadComments(gouvId);
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  // ================== INIT ==================
  init() {
    if (this._initDone) return;
    this._initDone = true;
    const btnMin = document.getElementById('btnAddMinistere');
    if (btnMin) btnMin.addEventListener('click', (e) => { e.preventDefault(); this.addMinistere(); });
    const btnDel = document.getElementById('btnAddDelegue');
    if (btnDel) btnDel.addEventListener('click', (e) => { e.preventDefault(); this.addDelegue(); });

    // Boutons de validation des modaux du composer
    const mmValider = document.getElementById('mmValider');
    if (mmValider) mmValider.addEventListener('click', (e) => { e.preventDefault(); this.validerMinistere(); });
    const mdValider = document.getElementById('mdValider');
    if (mdValider) mdValider.addEventListener('click', (e) => { e.preventDefault(); this.validerDelegue(); });
    const mapAjouter = document.getElementById('mapAjouter');
    if (mapAjouter) mapAjouter.addEventListener('click', (e) => { e.preventDefault(); this.validerAddPerso(); });
    // Lignes de liens supplémentaires (vidéo, internet)
    const dupliqueRow = (zoneId) => (e) => {
      e.preventDefault();
      const zone = document.getElementById(zoneId);
      if (!zone) return;
      const modele = zone.querySelector('.div-block-332');
      const copie = modele.cloneNode(true);
      const inp = copie.querySelector('input');
      inp.value = '';
      inp.removeAttribute('id');
      const btn = copie.querySelector('a');
      if (btn) btn.remove();
      zone.appendChild(copie);
      inp.focus();
    };
    const addVideo = document.getElementById('mapAddVideo');
    if (addVideo) addVideo.addEventListener('click', dupliqueRow('mapVideoRows'));
    const addLien = document.getElementById('mapAddLien');
    if (addLien) addLien.addEventListener('click', dupliqueRow('mapLienRows'));

    // Tri du modal liste (dropdown maquette)
    const mlpToggle = document.getElementById('mlpOrdreToggle');
    const mlpList = document.getElementById('mlpOrdreList');
    if (mlpToggle && mlpList) {
      mlpToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        mlpList.classList.toggle('w--open');
      });
      document.addEventListener('click', (e) => {
        if (!mlpList.contains(e.target) && !mlpToggle.contains(e.target)) mlpList.classList.remove('w--open');
      });
      mlpList.querySelectorAll('[data-mlp-ordre]').forEach(a => a.addEventListener('click', (e) => {
        e.preventDefault();
        this._mlpOrdre = a.dataset.mlpOrdre;
        const label = document.getElementById('mlpOrdreLabel');
        if (label) label.textContent = a.textContent.trim();
        mlpList.classList.remove('w--open');
        this.renderListePerso();
      }));
    }

    const miValider = document.getElementById('miValider');
    if (miValider) miValider.addEventListener('click', (e) => { e.preventDefault(); this.validerIntitule(); });
    const mcsValider = document.getElementById('mcsValider');
    if (mcsValider) mcsValider.addEventListener('click', (e) => { e.preventDefault(); this.validerSecteurEdit(); });
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
