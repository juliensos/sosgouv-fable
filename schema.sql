-- ============================================================
-- SOSGOUV - Schéma complet de la base Supabase
-- Reconstruit depuis les conversations SOS-GOUV v3 / v4 (nov 2025)
-- A exécuter dans Supabase SQL Editor (projet lbcmwivxvzeortvftxsi)
-- ============================================================

-- ========== 1. UTILISATEURS (auth custom) ==========
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nom TEXT,
    prenom TEXT,
    email TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ========== 2. PERSONNALITES ==========
CREATE TABLE IF NOT EXISTS personnalites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    prenom TEXT,
    metiers TEXT[] DEFAULT '{}',
    fonction TEXT,
    date_naissance DATE,
    photo_url TEXT,
    sexe TEXT,
    short_bio TEXT,
    bio TEXT,
    liens JSONB DEFAULT '[]',
    -- statut : 0 = néant, 1 = jamais, 2 = sous condition, 3 = ok
    statut INTEGER DEFAULT 0 CHECK (statut BETWEEN 0 AND 3),
    ajoute_par UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_personnalites_nom ON personnalites(nom);

-- ========== 3. SECTEURS (référence, pré-remplie) ==========
CREATE TABLE IF NOT EXISTS secteurs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    intitule_poste_defaut TEXT,
    type TEXT NOT NULL CHECK (type IN ('regalien', 'non_regalien')),
    ordre INTEGER DEFAULT 0
);

-- ========== 4. SOUS-SECTEURS (référence) ==========
CREATE TABLE IF NOT EXISTS sous_secteurs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sous_secteurs_nom ON sous_secteurs(nom);

-- ========== 5. ASSOCIATION SECTEURS <-> SOUS-SECTEURS PAR DEFAUT ==========
CREATE TABLE IF NOT EXISTS secteurs_sous_secteurs_defaut (
    secteur_id UUID REFERENCES secteurs(id) ON DELETE CASCADE,
    sous_secteur_id UUID REFERENCES sous_secteurs(id) ON DELETE CASCADE,
    PRIMARY KEY (secteur_id, sous_secteur_id)
);

-- ========== 6. GOUVERNEMENTS ==========
CREATE TABLE IF NOT EXISTS gouvernements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titre TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gouv_created_by ON gouvernements(created_by);
CREATE INDEX IF NOT EXISTS idx_gouv_published ON gouvernements(is_published);

-- ========== 7. POSTES D'UN GOUVERNEMENT ==========
CREATE TABLE IF NOT EXISTS postes_gouvernement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gouvernement_id UUID NOT NULL REFERENCES gouvernements(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('regalien', 'non_regalien', 'delegue')),
    personnalite_id UUID REFERENCES personnalites(id) ON DELETE SET NULL,
    secteur_id UUID REFERENCES secteurs(id) ON DELETE SET NULL,
    nom_poste_personnalise TEXT,
    fonction_delegue TEXT,
    ministeres_rattachement UUID[],
    note_auteur TEXT,
    ordre INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_postes_gouv ON postes_gouvernement(gouvernement_id);
CREATE INDEX IF NOT EXISTS idx_postes_type ON postes_gouvernement(type);
CREATE INDEX IF NOT EXISTS idx_postes_perso ON postes_gouvernement(personnalite_id);

-- ========== 8. SOUS-SECTEURS ASSOCIES A UN POSTE ==========
CREATE TABLE IF NOT EXISTS postes_sous_secteurs (
    poste_id UUID REFERENCES postes_gouvernement(id) ON DELETE CASCADE,
    sous_secteur_id UUID REFERENCES sous_secteurs(id) ON DELETE CASCADE,
    est_secteur_principal BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (poste_id, sous_secteur_id)
);

-- ========== 9. SECTEURS FUSIONNES SUR UN POSTE ==========
CREATE TABLE IF NOT EXISTS postes_secteurs_fusionnes (
    poste_id UUID REFERENCES postes_gouvernement(id) ON DELETE CASCADE,
    secteur_id UUID REFERENCES secteurs(id) ON DELETE CASCADE,
    PRIMARY KEY (poste_id, secteur_id)
);

-- ========== 10. LIKES DE PERSONNALITES ==========
CREATE TABLE IF NOT EXISTS personnalites_likes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    personnalite_id UUID REFERENCES personnalites(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, personnalite_id)
);

-- ========== 11. EPINGLAGE DE PERSONNALITES ==========
CREATE TABLE IF NOT EXISTS personnalites_epingles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    personnalite_id UUID REFERENCES personnalites(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, personnalite_id)
);

-- ========== 12. VOTES SUR LES GOUVERNEMENTS (1-5) ==========
CREATE TABLE IF NOT EXISTS gouvernements_votes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    gouvernement_id UUID REFERENCES gouvernements(id) ON DELETE CASCADE,
    note INTEGER NOT NULL CHECK (note BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, gouvernement_id)
);

-- ========== 13. EPINGLAGE DE GOUVERNEMENTS ==========
CREATE TABLE IF NOT EXISTS gouvernements_epingles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    gouvernement_id UUID REFERENCES gouvernements(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, gouvernement_id)
);

-- ========== 14. COMMENTAIRES (gouvernements et postes) ==========
CREATE TABLE IF NOT EXISTS commentaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    gouvernement_id UUID REFERENCES gouvernements(id) ON DELETE CASCADE,
    poste_id UUID REFERENCES postes_gouvernement(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES commentaires(id) ON DELETE CASCADE,
    contenu TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comm_gouv ON commentaires(gouvernement_id);

-- ========== 15. LIKES SUR LES COMMENTAIRES ==========
CREATE TABLE IF NOT EXISTS commentaires_likes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    commentaire_id UUID REFERENCES commentaires(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, commentaire_id)
);

-- ========== 16. MESSAGERIE ENTRE UTILISATEURS ==========
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user UUID REFERENCES users(id) ON DELETE CASCADE,
    to_user UUID REFERENCES users(id) ON DELETE CASCADE,
    contenu TEXT NOT NULL,
    lu BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== VUES STATISTIQUES ==========
CREATE OR REPLACE VIEW personnalites_stats AS
SELECT
    p.id,
    p.nom,
    p.prenom,
    (SELECT COUNT(*) FROM personnalites_likes l WHERE l.personnalite_id = p.id) AS nb_likes,
    (SELECT COUNT(*) FROM personnalites_epingles e WHERE e.personnalite_id = p.id) AS nb_epingles,
    (SELECT COUNT(*) FROM postes_gouvernement pg WHERE pg.personnalite_id = p.id) AS nb_propositions
FROM personnalites p;

CREATE OR REPLACE VIEW gouvernements_stats AS
SELECT
    g.id,
    g.titre,
    (SELECT COUNT(*) FROM gouvernements_votes v WHERE v.gouvernement_id = g.id) AS nb_votes,
    (SELECT ROUND(AVG(v.note)::numeric, 1) FROM gouvernements_votes v WHERE v.gouvernement_id = g.id) AS note_moyenne,
    (SELECT COUNT(*) FROM commentaires c WHERE c.gouvernement_id = g.id) AS nb_commentaires
FROM gouvernements g;

-- ========== RLS ==========
-- Auth custom via la table users + clé anon : politiques permissives,
-- le contrôle applicatif se fait côté front (comme dans les versions précédentes).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','personnalites','secteurs','sous_secteurs','secteurs_sous_secteurs_defaut',
    'gouvernements','postes_gouvernement','postes_sous_secteurs','postes_secteurs_fusionnes',
    'personnalites_likes','personnalites_epingles','gouvernements_votes','gouvernements_epingles',
    'commentaires','commentaires_likes','messages']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon full access" ON %I', t);
    EXECUTE format('CREATE POLICY "anon full access" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ========== DONNEES DE REFERENCE : SECTEURS REGALIENS ==========
INSERT INTO secteurs (nom, intitule_poste_defaut, type, ordre)
SELECT * FROM (VALUES
    ('Matignon', 'Premier ministre', 'regalien', 1),
    ('Intérieur', 'Ministre de l''Intérieur', 'regalien', 2),
    ('Justice', 'Garde des Sceaux, ministre de la Justice', 'regalien', 3),
    ('Défense', 'Ministre des Armées', 'regalien', 4),
    ('Affaires étrangères', 'Ministre de l''Europe et des Affaires étrangères', 'regalien', 5),
    ('Économie et Finances', 'Ministre de l''Économie et des Finances', 'regalien', 6)
) AS v(nom, intitule, type, ordre)
WHERE NOT EXISTS (SELECT 1 FROM secteurs WHERE type = 'regalien');

-- ========== DONNEES DE REFERENCE : SECTEURS NON-REGALIENS ==========
INSERT INTO secteurs (nom, intitule_poste_defaut, type, ordre)
SELECT * FROM (VALUES
    ('Éducation nationale', 'Ministre de l''Éducation nationale', 'non_regalien', 10),
    ('Santé', 'Ministre de la Santé', 'non_regalien', 11),
    ('Environnement', 'Ministre de la Transition écologique', 'non_regalien', 12),
    ('Agriculture', 'Ministre de l''Agriculture', 'non_regalien', 13),
    ('Culture', 'Ministre de la Culture', 'non_regalien', 14),
    ('Travail', 'Ministre du Travail', 'non_regalien', 15),
    ('Enseignement supérieur et Recherche', 'Ministre de l''Enseignement supérieur et de la Recherche', 'non_regalien', 16),
    ('Transports', 'Ministre des Transports', 'non_regalien', 17),
    ('Logement', 'Ministre du Logement', 'non_regalien', 18),
    ('Numérique', 'Ministre du Numérique', 'non_regalien', 19),
    ('Sports', 'Ministre des Sports', 'non_regalien', 20),
    ('Outre-mer', 'Ministre des Outre-mer', 'non_regalien', 21)
) AS v(nom, intitule, type, ordre)
WHERE NOT EXISTS (SELECT 1 FROM secteurs WHERE type = 'non_regalien');

-- ========== SOUS-SECTEURS PAR DEFAUT (exemples, à compléter) ==========
INSERT INTO sous_secteurs (nom)
SELECT v.nom FROM (VALUES
    ('Cyberdéfense'), ('Renseignement'), ('Police nationale'), ('Sécurité civile'),
    ('Administration pénitentiaire'), ('Protection judiciaire de la jeunesse'),
    ('Diplomatie économique'), ('Francophonie'), ('Commerce extérieur'),
    ('Budget'), ('Industrie'), ('PME et artisanat'),
    ('Biodiversité'), ('Énergie'), ('Forêts'), ('Mer et littoral'),
    ('Patrimoine'), ('Création artistique'), ('Audiovisuel'),
    ('Formation professionnelle'), ('Emploi'), ('Dialogue social')
) AS v(nom)
WHERE NOT EXISTS (SELECT 1 FROM sous_secteurs);
