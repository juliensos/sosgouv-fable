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
        html += '<div class="groupe-lettre">' + this.esc(groupKey) + '</div>';
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
          <h6 class="heading-dyn mini">épingler</h6>
        </a>
        ${Auth.isAdmin() ? '<a href="#" class="_2-mini-bouton mini w-inline-block btn-edit" title="Modifier (admin)"><div class="_2-picto-fontello-bouton">' + ICO.edit + '</div></a>' : ''}
        ${(Auth.isAdmin() || (Auth.isLoggedIn() && p.ajoute_par === Auth.currentUser.id)) ? '<a href="#" class="_2-mini-bouton mini w-inline-block btn-del-perso" title="Supprimer"><div class="_2-picto-fontello-bouton">' + ICO.trash + '</div></a>' : ''}
      </div>
      ${p.short_bio ? '<p class="short-bio">' + this.esc(p.short_bio) + '</p>' : ''}
    </div>`;
  },

  bindCards(cont) {
    cont.querySelectorAll('.perso-card').forEach(card => {
      const id = card.dataset.id;
      const btnLike = card.querySelector('.btn-like');
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
  openFiche(id) {
    const p = this.all.find(x => x.id === id);
    if (!p) return;
    const cont = document.getElementById('fiche-contenu');
    if (!cont) return;
    const liensArr = Array.isArray(p.liens) ? p.liens : [];
    const videos = liensArr.filter(l => l && l.type === 'video');
    const autres = liensArr.filter(l => !l || l.type !== 'video');
    const videosHtml = videos.map(l => {
      const embed = this.videoEmbedUrl(l.url);
      if (embed) return '<div class="fiche-video"><iframe src="' + this.esc(embed) + '" frameborder="0" allowfullscreen loading="lazy"></iframe><div class="fiche-video-titre">' + this.esc(l.titre || '') + '</div></div>';
      return '<a class="fiche-lien fiche-lien-video" href="' + this.esc(l.url) + '" target="_blank" rel="noopener">&#127916; ' + this.esc(l.titre || l.url) + '</a>';
    }).join('');
    const liens = autres.map(l =>
      '<a class="fiche-lien" href="' + this.esc(l.url || l) + '" target="_blank" rel="noopener">&#128279; ' + this.esc(l.titre || l.url || l) + '</a>'
    ).join('');
    // Découpage de la bio en sections (format des fiches importées)
    let expertise = '', engagements = '', bioLibre = '';
    if (p.bio) {
      const m = p.bio.match(/Domaines de recherche et expertise\s*:\s*([\s\S]*?)(?:\n\s*\n|$)(?:Engagements et positionnements politiques\s*:\s*([\s\S]*))?/);
      if (m) {
        expertise = (m[1] || '').trim();
        engagements = (m[2] || '').trim();
      } else {
        bioLibre = p.bio;
      }
    }
    cont.innerHTML = `
      <div class="fiche-entete">
        <h1 class="fiche-nom">${this.esc(p.nom)} ${this.esc(p.prenom || '')}</h1>
        <span class="fiche-metier-grey">${this.esc((p.metiers || []).join(', '))}</span>
        <span class="fontello-statut _${p.statut}" title="${this.STATUTS[p.statut] || ''}">${[ICO.cross, ICO.cross, ICO.cond, ICO.check2][p.statut] || ''}</span>
      </div>
      ${p.short_bio ? '<p class="fiche-para">' + this.esc(p.short_bio) + '</p>' : ''}
      ${expertise ? '<h4 class="fiche-h">Domaines de recherche et expertise</h4><p class="fiche-para">' + this.esc(expertise) + '</p>' : ''}
      ${engagements ? '<h4 class="fiche-h">Engagements et positionnements politiques</h4><p class="fiche-para">' + this.esc(engagements) + '</p>' : ''}
      ${bioLibre ? '<p class="fiche-para">' + this.esc(bioLibre) + '</p>' : ''}
      <div id="fiche-propositions"></div>
      ${(videosHtml || liens) ? '<div class="fiche-filet"></div><h4 class="fiche-h">Médias</h4>' : ''}
      ${videosHtml ? '<div class="grid-video fiche-videos">' + videosHtml + '</div>' : ''}
      ${liens ? '<div class="fiche-liens">' + liens + '</div>' : ''}
    `;
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
        return '<div class="fiche-proposition"><span class="fp-poste">' + this.esc(role) + '</span>' +
          ' <span class="fp-par">par</span> <span class="fp-user">' + this.esc(u ? u.username : '?') + '</span>' +
          ' <span class="fp-gouv">(' + this.esc(g.titre || 'Sans titre') + ')</span></div>';
      }).filter(Boolean);
      if (items.length) {
        cont.innerHTML = '<div class="fiche-filet"></div><h4 class="fiche-h">Personnalité proposée au poste de</h4>' + items.join('');
      }
    } catch (err) { /* section facultative */ }
  },

  // ---------- Ajout simple (section 3) ----------
  async addSimple() {
    if (!Auth.isLoggedIn()) return UI.toast('Connectez-vous pour ajouter une personnalité.');
    const nom = document.getElementById('addNom').value.trim();
    const prenom = document.getElementById('addPrenom').value.trim();
    const metier = document.getElementById('addMetier').value.trim();
    if (!nom) return UI.toast('Le nom est requis.');
    try {
      const { error } = await sb.from('personnalites').insert({
        nom, prenom,
        metiers: metier ? [metier] : [],
        statut: 0,
        ajoute_par: Auth.currentUser.id
      });
      if (error) throw error;
      document.getElementById('addNom').value = '';
      document.getElementById('addPrenom').value = '';
      document.getElementById('addMetier').value = '';
      UI.toast('Personnalité ajoutée !');
    } catch (err) { UI.toast('Erreur : ' + err.message); }
  },

  // ---------- Suppression ----------
  async deletePerso(id) {
    const p = this.all.find(x => x.id === id);
    if (!p) return;
    const droit = Auth.isAdmin() || (Auth.isLoggedIn() && p.ajoute_par === Auth.currentUser.id);
    if (!droit) return UI.toast('Vous ne pouvez supprimer que les personnalités que vous avez ajoutées.');
    if (!window.confirm('Supprimer ' + ((p.prenom ? p.prenom + ' ' : '') + p.nom) + ' ? Cette action est définitive.')) return;
    try {
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

  init() {
    const btnAdd = document.getElementById('btnAddPerso');
    if (btnAdd) btnAdd.addEventListener('click', (e) => { e.preventDefault(); this.addSimple(); });

    const selStatut = document.getElementById('filtreStatut');
    if (selStatut) selStatut.addEventListener('change', () => {
      this.filtreStatut = selStatut.value;
      this.render();
    });

    const selOrdre = document.getElementById('filtreOrdre');
    if (selOrdre) selOrdre.addEventListener('change', () => {
      this.ordre = selOrdre.value;
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
