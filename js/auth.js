// ============================================================
// SOSGOUV - auth.js
// Authentification custom : table users (username + password),
// session persistée en localStorage, mode admin (is_admin).
// ============================================================
const Auth = {
  currentUser: null,
  STORAGE_KEY: 'sosgouv_user',

  // Restaure la session au chargement
  restoreSession() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      this.currentUser = raw ? JSON.parse(raw) : null;
    } catch (e) {
      this.currentUser = null;
    }
    return this.currentUser;
  },

  saveSession(user) {
    this.currentUser = user;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
  },

  isLoggedIn() { return !!this.currentUser; },
  isAdmin() { return !!(this.currentUser && this.currentUser.is_admin); },

  // Création de compte
  async signup(username, password) {
    username = (username || '').trim();
    if (!username || !password) throw new Error('Pseudo et mot de passe requis.');

    const { data: existing, error: checkErr } = await sb
      .from('users').select('id').eq('username', username).maybeSingle();
    if (checkErr) throw checkErr;
    if (existing) throw new Error('Ce pseudo est déjà utilisé.');

    const { data, error } = await sb
      .from('users')
      .insert({ username, password })
      .select()
      .single();
    if (error) throw error;

    this.saveSession(data);
    return data;
  },

  // Connexion
  async login(username, password) {
    username = (username || '').trim();
    if (!username || !password) throw new Error('Pseudo et mot de passe requis.');

    const { data, error } = await sb
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Pseudo ou mot de passe incorrect.');

    this.saveSession(data);
    return data;
  },

  // Déconnexion
  logout() {
    this.currentUser = null;
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem('pending_username');
  },

  // Mise à jour du profil (données personnelles)
  async updateProfile(fields) {
    if (!this.currentUser) throw new Error('Vous devez être connecté.');
    const { data, error } = await sb
      .from('users')
      .update(fields)
      .eq('id', this.currentUser.id)
      .select()
      .single();
    if (error) throw error;
    this.saveSession({ ...this.currentUser, ...data });
    return data;
  }
};

window.Auth = Auth;
Auth.restoreSession();
