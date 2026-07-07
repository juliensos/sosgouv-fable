// ============================================================
// SOSGOUV - Configuration Supabase
// Projet : lbcmwivxvzeortvftxsi (dernière version, nov 2025)
// ============================================================
const SUPABASE_URL = 'https://lbxuxhizuffgrwdhohut.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxieHV4aGl6dWZmZ3J3ZGhvaHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDQxNDIsImV4cCI6MjA5ODk4MDE0Mn0.jpG-S5HxAi4ZoQebl61LXqC4ysq5NReFWb4BD2gf6Ic';

// Client global (supabase-js v2 chargé via CDN dans index.html)
var sb = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
window.sb = sb;
