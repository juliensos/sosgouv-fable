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
    <div class="perso-card" data-id="${p.id}">
      <div class="perso-infos">
        <span class="perso-nom">${this.esc(p.nom)}</span>
        <span class="perso-prenom">${this.esc(p.prenom || '')}</span>
        <span class="perso-metier">${this.esc(metiers)}</span>
        <span class="badge-statut ${this.STATUT_CLASSES[p.statut] || ''}">${this.STATUTS[p.statut] || ''}</span>
      </div>
      <div class="perso-actions">
        <button class="btn-icone btn-like ${liked ? 'active' : ''}" title="Like">&#9829;</button>
        <button class="btn-icone btn-pin ${pinned ? 'active' : ''}" title="Épingler">&#128204;</button>
        <button class="btn-icone btn-fiche" title="Voir la fiche">&#128196;</button>
        ${Auth.isAdmin() ? '<button class="btn-icone btn-edit" title="Modifier (admin)">&#9998;</button>' : ''}
      </div>
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
        if (btn) btn.classList.remove('active');
      } else {
        await sb.from('personnalites_likes').insert({ user_id: uid, personnalite_id: id });
        this.likes.add(id);
        if (btn) btn.classList.add('active');
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
    const liens = (p.liens || []).map(l =>
      '<a href="' + this.esc(l.url || l) + '" target="_blank" rel="noopener">' + this.esc(l.titre || l.url || l) + '</a>'
    ).join('<br>');
    cont.innerHTML = `
      <h3>${this.esc(p.prenom || '')} ${this.esc(p.nom)}</h3>
      <div class="badge-statut ${this.STATUT_CLASSES[p.statut] || ''}">${this.STATUTS[p.statut] || ''}</div>
      <p class="fiche-metiers">${this.esc((p.metiers || []).join(', '))}</p>
      ${p.short_bio ? '<p class="fiche-shortbio">' + this.esc(p.short_bio) + '</p>' : ''}
      ${p.bio ? '<div class="fiche-bio">' + this.esc(p.bio) + '</div>' : ''}
      ${liens ? '<div class="fiche-liens">' + liens + '</div>' : ''}
    `;
    UI.openModal('modal-fiche');
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

  // ---------- Edition admin ----------
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
  }
};

window.Perso = Perso;
document.addEventListener('DOMContentLoaded', () => Perso.init());
