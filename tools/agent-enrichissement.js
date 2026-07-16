#!/usr/bin/env node
/**
 * Agent d'enrichissement des fiches personnalités — SOSGOUV
 * ============================================================
 * Ce script tourne de façon autonome (cron GitHub Actions ou autre
 * ordonnanceur). Il ne modifie JAMAIS la table `personnalites`
 * directement : il dépose des propositions dans
 * `personnalites_propositions_ia`, qu'un administrateur valide ou
 * rejette depuis le site (bandeau admin → "propositions IA").
 *
 * Variables d'environnement requises :
 *   SUPABASE_URL           URL du projet Supabase
 *   SUPABASE_KEY           clé anon (ou service_role) du projet
 *   ANTHROPIC_API_KEY      clé API Anthropic
 *
 * Variables optionnelles :
 *   AGENT_MAX_PERSONNES    nombre de fiches traitées par exécution (défaut 5)
 *   AGENT_MODEL            modèle Claude à utiliser (défaut claude-sonnet-4-6)
 *
 * Exécution : node tools/agent-enrichissement.js
 */

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MAX_PERSONNES = Number(process.env.AGENT_MAX_PERSONNES || 5);
const MODEL = process.env.AGENT_MODEL || 'claude-sonnet-5';

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_API_KEY) {
  console.error('Variables d\'environnement manquantes : SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY sont requises.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ------------------------------------------------------------
// 1. Sélection des fiches à enrichir
// ------------------------------------------------------------
async function selectionnerCandidats() {
  const { data: persos, error } = await sb
    .from('personnalites')
    .select('id, nom, prenom, metiers, short_bio, bio, liens');
  if (error) throw error;

  const { data: enAttente } = await sb
    .from('personnalites_propositions_ia')
    .select('personnalite_id')
    .eq('statut', 'en_attente');
  const idsEnAttente = new Set((enAttente || []).map(p => p.personnalite_id));

  return (persos || [])
    .filter(p => !idsEnAttente.has(p.id)) // pas de doublon de proposition
    .filter(p => !p.short_bio || !p.bio || !(p.metiers && p.metiers.length)) // fiche incomplète
    .slice(0, MAX_PERSONNES);
}

// ------------------------------------------------------------
// 2. Recherche + rédaction via Claude (avec l'outil web_search)
// ------------------------------------------------------------
const SCHEMA_ATTENDU = `Réponds UNIQUEMENT avec un objet JSON (aucun texte avant/après, aucun bloc markdown), au format exact :
{
  "metiers": ["métier principal", "autre métier éventuel"],
  "short_bio": "une phrase de présentation, factuelle",
  "bio": "biographie de plusieurs paragraphes. Termine par deux sections introduites EXACTEMENT par ces marqueurs, chacune sur sa propre ligne : 'Domaines de recherche et expertise : ...' puis 'Engagements et positionnements politiques : ...'. Si l'un des deux n'est pas trouvé ou n'a pas lieu d'être, laisse la phrase avec une valeur vide après les deux points plutôt que d'inventer.",
  "liens": [
    {"type": "lien", "titre": "Fiche Wikipédia", "url": "https://..."},
    {"type": "video", "titre": "Intervention ou interview", "url": "https://www.youtube.com/watch?v=..."}
  ],
  "sources": ["https://...", "https://..."]
}
Règles impératives :
- N'invente RIEN. Si une information n'est pas trouvée avec certitude, omets-la plutôt que de deviner.
- Le champ "Engagements et positionnements politiques" doit rester factuel et sourcé (prises de position publiques documentées), jamais une supposition sur les opinions probables de la personne.
- "sources" doit lister les URLs réellement consultées pour rédiger la fiche, pour permettre une vérification humaine.
- Les liens vidéo doivent pointer vers une plateforme d'hébergement reconnue (YouTube, Vimeo, Dailymotion) si disponible.`;

async function rechercherEtRediger(perso) {
  const nomComplet = `${perso.prenom || ''} ${perso.nom}`.trim();
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `Recherche des informations factuelles et vérifiables sur "${nomComplet}" ` +
        `(personnalité de la société civile française : chercheur, expert, praticien ou créateur). ` +
        `Rédige une fiche pour un site citoyen de composition de gouvernements imaginaires.\n\n${SCHEMA_ATTENDU}`
    }]
  });

  const texte = message.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();

  const nettoye = texte.replace(/^```json\s*|```$/g, '').trim();
  let proposition;
  try {
    proposition = JSON.parse(nettoye);
  } catch (err) {
    throw new Error(`Réponse non-JSON pour "${nomComplet}" : ${err.message}\n---\n${texte.slice(0, 500)}`);
  }
  return proposition;
}

// ------------------------------------------------------------
// 3. Dépôt de la proposition (staging, jamais d'écriture directe)
// ------------------------------------------------------------
async function deposerProposition(perso, proposition) {
  const { error } = await sb.from('personnalites_propositions_ia').insert({
    personnalite_id: perso.id,
    metiers: proposition.metiers || [],
    short_bio: proposition.short_bio || null,
    bio: proposition.bio || null,
    liens: proposition.liens || [],
    sources: proposition.sources || [],
    statut: 'en_attente'
  });
  if (error) throw error;
}

// ------------------------------------------------------------
// Boucle principale
// ------------------------------------------------------------
async function main() {
  console.log(`Agent d'enrichissement SOSGOUV — modèle ${MODEL}, jusqu'à ${MAX_PERSONNES} fiche(s).`);
  const candidats = await selectionnerCandidats();
  if (!candidats.length) {
    console.log('Aucune fiche à enrichir pour le moment.');
    return;
  }
  console.log(`${candidats.length} fiche(s) sélectionnée(s) : ${candidats.map(p => p.nom).join(', ')}`);

  let ok = 0, echecs = 0;
  for (const perso of candidats) {
    const nomComplet = `${perso.prenom || ''} ${perso.nom}`.trim();
    try {
      console.log(`→ Recherche : ${nomComplet}…`);
      const proposition = await rechercherEtRediger(perso);
      await deposerProposition(perso, proposition);
      console.log(`  ✓ Proposition déposée pour ${nomComplet} (en attente de validation admin).`);
      ok++;
    } catch (err) {
      console.error(`  ✗ Échec pour ${nomComplet} : ${err.message}`);
      echecs++;
    }
    // Pause légère pour rester raisonnable sur le débit d'appels
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log(`Terminé : ${ok} proposition(s) déposée(s), ${echecs} échec(s).`);
  if (echecs > 0 && ok === 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('Erreur fatale de l\'agent :', err);
  process.exit(1);
});
