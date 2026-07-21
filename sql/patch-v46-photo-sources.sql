-- ============================================================
-- Patch v46 : photo et sources sur les fiches personnalités
-- ------------------------------------------------------------
-- 1. personnalites.sources : URLs consultées par l'agent
--    d'enrichissement, affichées publiquement en bas de la fiche
--    avec la mention d'assistance par IA. (photo_url existe déjà
--    dans le schéma initial.)
-- 2. personnalites_propositions_ia.photo_url : photo proposée par
--    l'agent, validée ou corrigée par l'admin avant application.
-- Idempotent : peut être rejoué sans risque.
-- ============================================================

ALTER TABLE personnalites
    ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]';

ALTER TABLE personnalites_propositions_ia
    ADD COLUMN IF NOT EXISTS photo_url TEXT;
