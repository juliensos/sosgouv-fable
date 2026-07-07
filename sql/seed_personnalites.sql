-- Seed : 26 personnalités (fiches_personnalites.docx)
-- Idempotent : n'insère que si (nom, prenom) absent.

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Védrine', 'Hubert', '{"Diplomate","Homme politique"}', 'Ancien ministre des Affaires étrangères (1997-2002) sous Lionel Jospin, Hubert Védrine a été une figure centrale de la diplomatie française.', 'Domaines de recherche et expertise : Expert en relations internationales et géopolitique, il analyse les rapports de force mondiaux, le multilatéralisme et la place de la France et de l''Europe dans le monde. Il prône un réalisme en politique étrangère et critique l''unilatéralisme américain. Ses réflexions portent sur l''équilibre des puissances, la construction européenne et les défis de la mondialisation.

Engagements et positionnements politiques : Socialiste, proche de François Mitterrand dont il fut le porte-parole puis le secrétaire général de l''Élysée (1991-1995). Défend une vision gaulliste de l''indépendance nationale et du rôle de la France. Critique du néoconservatisme et de l''interventionnisme occidental.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Védrine' AND prenom = 'Hubert');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Lecointre', 'François', '{"Général d''armée"}', 'Chef d''état-major des armées françaises de 2017 à 2021, le général François Lecointre a dirigé les forces armées pendant une période de tensions géopolitiques accrues.', 'Domaines de recherche et expertise : Spécialiste des opérations militaires et de la stratégie de défense. Expert des théâtres d''opération au Sahel, au Moyen-Orient et en Afghanistan. Analyse les mutations de la guerre moderne, la lutte antiterroriste, les cybermenaces et les enjeux de souveraineté militaire. Réfléchit aux doctrines d''emploi des forces et à l''autonomie stratégique européenne.

Engagements et positionnements politiques : Apolitique par fonction. Défend l''outil militaire français, plaide pour un budget de défense suffisant et pour le maintien des capacités opérationnelles face aux nouvelles menaces. Partisan de l''autonomie stratégique européenne.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Lecointre' AND prenom = 'François');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Trévidic', 'Marc', '{"Magistrat"}', 'Ancien juge d''instruction antiterroriste au pôle antiterroriste du tribunal de Paris (2006-2015), Marc Trévidic a instruit les principaux dossiers de terrorisme islamiste en France.', 'Domaines de recherche et expertise : Expert du terrorisme islamiste, des filières djihadistes et de la radicalisation. Analyse les réseaux terroristes, les mécanismes de passage à l''acte violent et les politiques de lutte antiterroriste. Travaille sur la compréhension des idéologies extrémistes et sur l''équilibre entre sécurité et libertés publiques.

Engagements et positionnements politiques : Indépendant. Critique des dérives sécuritaires tout en défendant la nécessité d''une justice antiterroriste efficace. Plaide pour une meilleure compréhension des phénomènes de radicalisation et pour des moyens renforcés pour la justice.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Trévidic' AND prenom = 'Marc');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Malka', 'Richard', '{"Avocat"}', 'Avocat au barreau de Paris, Richard Malka est notamment l''avocat de Charlie Hebdo. Il a défendu le journal après les attentats de janvier 2015.', 'Domaines de recherche et expertise : Spécialiste de la liberté d''expression, de la laïcité et du droit de la presse. Défend le droit au blasphème et la liberté de caricature. Analyse les tensions entre liberté d''expression et respect des convictions religieuses. Critique l''autocensure et les tentatives de limitation de la liberté de la presse.

Engagements et positionnements politiques : Républicain laïque. Défend fermement la laïcité à la française et la liberté d''expression contre toute forme de censure religieuse ou politique. S''oppose aux revendications communautaristes et à l''islamisme politique.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Malka' AND prenom = 'Richard');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Filiu', 'Jean-Pierre', '{"Historien","Politologue"}', 'Professeur à Sciences Po Paris, Jean-Pierre Filiu est un ancien diplomate français spécialiste du monde arabe et de l''islam contemporain.', 'Domaines de recherche et expertise : Expert du Moyen-Orient, des révolutions arabes, de l''islamisme et du djihadisme. Analyse l''histoire politique du monde arabe, les mouvements révolutionnaires, les guerres civiles (Syrie, Libye, Yémen) et les enjeux géopolitiques régionaux. Travaille sur l''apocalyptisme dans l''islam radical et sur les dynamiques de contestation dans le monde arabe.

Engagements et positionnements politiques : Progressiste. Soutient les aspirations démocratiques des peuples arabes. Critique des régimes autoritaires et de l''interventionnisme occidental. Défend une approche nuancée de l''islamisme, distinguant les différents courants.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Filiu' AND prenom = 'Jean-Pierre');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Duflo', 'Esther', '{"Économiste"}', 'Prix Nobel d''économie 2019, professeure au MIT, Esther Duflo est spécialisée dans l''économie du développement et la lutte contre la pauvreté.', 'Domaines de recherche et expertise : Pionnière de l''approche expérimentale en économie du développement. Utilise des essais randomisés contrôlés pour évaluer l''efficacité des politiques de développement. Travaille sur l''éducation, la santé, l''accès au crédit, la gouvernance et les inégalités dans les pays en développement. Co-fondatrice du J-PAL (Abdul Latif Jameel Poverty Action Lab).

Engagements et positionnements politiques : Progressiste, sociale-démocrate. Plaide pour des politiques publiques fondées sur des preuves empiriques. Critique les inégalités mondiales et défend l''aide au développement ciblée et efficace. Favorable à une redistribution plus équitable des richesses.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Duflo' AND prenom = 'Esther');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Parrique', 'Timothée', '{"Économiste"}', 'Chercheur en économie écologique, Timothée Parrique est l''un des principaux théoriciens de la décroissance en France.', 'Domaines de recherche et expertise : Spécialiste de la décroissance, de la soutenabilité écologique et de la critique de la croissance économique. Analyse les limites planétaires, l''empreinte écologique et les alternatives au productivisme. Travaille sur les modèles économiques post-croissance, l''économie circulaire et la transition écologique. Critique le PIB comme indicateur de progrès.

Engagements et positionnements politiques : Écologiste radical, décroissant. Remet en cause le capitalisme et le modèle de croissance infinie. Plaide pour une transformation radicale du système économique vers la sobriété, la réduction du temps de travail et la relocalisation. Critique le greenwashing et les solutions technologiques.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Parrique' AND prenom = 'Timothée');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Klein', 'Étienne', '{"Physicien","Philosophe des sciences"}', 'Directeur de recherche au CEA, Étienne Klein est spécialiste de physique des particules et de philosophie des sciences. Il anime l''émission "La Conversation scientifique" sur France Culture.', 'Domaines de recherche et expertise : Travaille sur la physique quantique, la question du temps en physique, l''histoire des sciences et l''épistémologie. Vulgarise les grandes questions scientifiques auprès du grand public. Réfléchit aux relations entre science et société, aux limites de la connaissance scientifique et aux enjeux éthiques de la recherche.

Engagements et positionnements politiques : Humaniste, rationaliste. Défend la démarche scientifique et la pensée critique. Alerte sur les dérives de la pensée magique et du relativisme. Partisan du nucléaire civil pour lutter contre le changement climatique. Encourage le débat entre science et philosophie.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Klein' AND prenom = 'Étienne');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Stiegler', 'Barbara', '{"Philosophe"}', 'Professeure de philosophie politique à l''Université Bordeaux Montaigne, Barbara Stiegler est spécialiste de la philosophie politique contemporaine.', 'Domaines de recherche et expertise : Travaille sur le néolibéralisme, la biopolitique, l''adaptation et les transformations du capitalisme. Analyse les politiques de santé publique, la gestion des corps et des populations. Critique la logique d''adaptation permanente imposée aux individus. Étudie les penseurs comme Foucault, Dewey et Lippmann. Réfléchit aux enjeux démocratiques face aux transformations néolibérales.

Engagements et positionnements politiques : De gauche, critique du néolibéralisme. Dénonce les politiques d''austérité et la marchandisation du vivant. Critique de la gestion de la crise sanitaire du Covid-19. Défend la démocratie radicale et les droits sociaux.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Stiegler' AND prenom = 'Barbara');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Duflot', 'Cécile', '{"Femme politique","Dirigeante associative"}', 'Ancienne ministre du Logement (2012-2014), ex-secrétaire nationale d''Europe Écologie Les Verts, Cécile Duflot est directrice générale d''Oxfam France depuis 2017.', 'Domaines de recherche et expertise : Experte des politiques du logement, de l''urbanisme et de la transition écologique. Travaille sur les inégalités sociales, la justice climatique, la solidarité internationale et le développement durable. Analyse les liens entre crise écologique et crise sociale.

Engagements et positionnements politiques : Écologiste de gauche. Défend la justice sociale et environnementale, la régulation du marché immobilier, la rénovation énergétique des logements. Militante pour les droits des plus pauvres et contre les inégalités mondiales. Féministe.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Duflot' AND prenom = 'Cécile');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Zaka', 'Serge', '{"Agroclimatologue"}', 'Docteur en agroclimatologie, Serge Zaka est consultant et chercheur spécialisé dans les impacts du changement climatique sur l''agriculture.', 'Domaines de recherche et expertise : Expert de la climatologie agricole, de l''adaptation de l''agriculture au changement climatique et des événements climatiques extrêmes (sécheresses, canicules, gel). Analyse les impacts du réchauffement sur les cultures, les rendements agricoles et la sécurité alimentaire. Vulgarise les enjeux climatiques liés à l''agriculture.

Engagements et positionnements politiques : Engagé pour la transition écologique et agricole. Alerte sur l''urgence climatique et ses impacts sur l''agriculture. Plaide pour une adaptation rapide des pratiques agricoles et pour des politiques ambitieuses de réduction des émissions de gaz à effet de serre.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Zaka' AND prenom = 'Serge');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Jancovici', 'Jean-Marc', '{"Ingénieur","Expert en énergie et climat"}', 'Ingénieur diplômé de l''École polytechnique, Jean-Marc Jancovici est président du Shift Project, think tank de la transition carbone. Co-créateur du bilan carbone.', 'Domaines de recherche et expertise : Expert de l''énergie, du climat et de la décarbonation. Analyse les flux énergétiques, la dépendance aux énergies fossiles et les scénarios de transition énergétique. Défend le nucléaire comme énergie bas-carbone indispensable. Travaille sur la comptabilité carbone, les ordres de grandeur énergétiques et la contrainte physique du changement climatique.

Engagements et positionnements politiques : Non partisan mais engagé pour la décarbonation. Critique la croissance économique basée sur les énergies fossiles. Plaide pour une décroissance énergétique et matérielle. Favorable au nucléaire. Appelle à une transformation radicale des modes de vie et de l''économie.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Jancovici' AND prenom = 'Jean-Marc');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Clément', 'Gilles', '{"Paysagiste","Jardinier","Écrivain"}', 'Ingénieur horticole et paysagiste conceptuel, Gilles Clément a développé les concepts de "jardin en mouvement", "jardin planétaire" et "tiers-paysage".', 'Domaines de recherche et expertise : Théoricien du paysage et de l''écologie. Développe une approche écologique du jardinage respectueuse de la biodiversité et des dynamiques naturelles. Critique le jardinage ornemental traditionnel. Réfléchit aux rapports entre nature et culture, à la gestion des espaces délaissés (friches) et à la diversité biologique comme patrimoine commun.

Engagements et positionnements politiques : Écologiste. Défend une approche respectueuse du vivant et de la diversité biologique. Critique la standardisation des paysages et l''artificialisation des sols. Prône une éthique de la responsabilité vis-à-vis du "jardin planétaire".', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Clément' AND prenom = 'Gilles');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Hamant', 'Olivier', '{"Biologiste"}', 'Directeur de recherche INRAE, biologiste du développement des plantes, Olivier Hamant travaille à l''École normale supérieure de Lyon.', 'Domaines de recherche et expertise : Spécialiste de la biologie végétale et de la morphogenèse. Étudie comment les plantes croissent et s''adaptent à leur environnement. Développe une réflexion philosophique sur la robustesse du vivant, la suboptimalité et la critique de l''efficacité maximale. Analyse les mécanismes de résilience dans la nature et leurs enseignements pour les sociétés humaines.

Engagements et positionnements politiques : Écologiste. Critique la quête d''optimisation et de performance. Plaide pour l''acceptation de la suboptimalité et de la redondance comme sources de robustesse et de résilience. Défend un modèle de développement plus sobre inspiré des stratégies du vivant.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Hamant' AND prenom = 'Olivier');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Calame', 'Matthieu', '{"Ingénieur agronome","Essayiste"}', 'Ingénieur agronome, directeur de la Fondation Charles Léopold Mayer, Matthieu Calame travaille sur les questions agricoles et alimentaires.', 'Domaines de recherche et expertise : Expert de l''agronomie, de la transition agricole et alimentaire. Analyse les systèmes agricoles, la souveraineté alimentaire, les politiques agricoles et l''agroécologie. Travaille sur la gouvernance des biens communs, l''innovation sociale et les alternatives au modèle agricole productiviste. Réfléchit aux liens entre agriculture, alimentation et démocratie.

Engagements et positionnements politiques : Écologiste, de gauche. Critique l''agriculture industrielle et la PAC. Défend l''agroécologie, les circuits courts, l''agriculture paysanne et la souveraineté alimentaire. Plaide pour une refonte des systèmes alimentaires vers plus de justice et de durabilité.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Calame' AND prenom = 'Matthieu');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Taddeï', 'Frédéric', '{"Journaliste","Animateur"}', 'Journaliste et animateur de radio et télévision, Frédéric Taddeï a notamment animé "Ce soir (ou jamais !)" sur France 2 et "Interdit d''interdire" sur RT France.', 'Domaines de recherche et expertise : Spécialiste du débat d''idées, de la médiation culturelle et intellectuelle. Défend le pluralisme des opinions et la liberté d''expression. S''intéresse aux questions philosophiques, politiques et culturelles. Critique la pensée unique et le conformisme médiatique.

Engagements et positionnements politiques : Indépendant, non aligné. Défend la liberté d''expression et le débat contradictoire. Critique les médias mainstream et la censure. Controversé pour avoir donné la parole à des personnalités polémiques. Partisan du débat ouvert sur tous les sujets.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Taddeï' AND prenom = 'Frédéric');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Gay', 'Fabien', '{"Homme politique"}', 'Sénateur communiste de Seine-Saint-Denis depuis 2017, secrétaire national du PCF, Fabien Gay est une figure de la gauche radicale française.', 'Domaines de recherche et expertise : Défenseur des services publics, de la fonction publique hospitalière et des droits sociaux. Analyse les politiques d''austérité, les privatisations et les inégalités. Travaille sur les questions de logement social, d''éducation et de santé publique. Critique les politiques néolibérales et le capitalisme financier.

Engagements et positionnements politiques : Communiste, de gauche radicale. Oppose à la politique d''Emmanuel Macron. Défend un programme de rupture avec le capitalisme, la nationalisation des grandes entreprises, le renforcement des services publics et la redistribution des richesses. Internationaliste.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Gay' AND prenom = 'Fabien');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Adler', 'Laure', '{"Journaliste","Écrivaine"}', 'Journaliste, productrice de radio (France Culture), essayiste et biographe, Laure Adler est une figure majeure de la vie intellectuelle française.', 'Domaines de recherche et expertise : Spécialiste de la littérature, de l''histoire des idées et des questions féministes. Biographe de personnalités comme Marguerite Duras, Hannah Arendt, Françoise Giroud. S''intéresse aux parcours de femmes intellectuelles et artistes. Analyse les transformations culturelles et sociales, notamment autour de la place des femmes.

Engagements et positionnements politiques : De gauche, progressiste. Féministe engagée. Défend l''égalité hommes-femmes, les droits des femmes et la mémoire des grandes figures féminines. Proche de la social-démocratie culturelle.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Adler' AND prenom = 'Laure');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Chevassus-au-Louis', 'Nicolas', '{"Journaliste scientifique","Biologiste"}', 'Docteur en biologie, journaliste scientifique indépendant, Nicolas Chevassus-au-Louis écrit sur les questions scientifiques et environnementales.', 'Domaines de recherche et expertise : Expert de l''histoire des sciences, de l''épistémologie et des controverses scientifiques. Analyse les fraudes scientifiques, les conflits d''intérêts dans la recherche et l''intégrité scientifique. Travaille sur les questions environnementales, la biodiversité et les pesticides. Critique l''influence de l''industrie sur la science.

Engagements et positionnements politiques : Écologiste, progressiste. Critique des lobbies industriels et de leur influence sur la recherche scientifique. Défend l''indépendance de la science et la transparence. Engagé pour la protection de l''environnement et la santé publique.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Chevassus-au-Louis' AND prenom = 'Nicolas');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Taubira', 'Christiane', '{"Femme politique"}', 'Ancienne garde des Sceaux (2012-2016), députée de Guyane (1993-2012), Christiane Taubira a porté la loi sur le mariage pour tous en 2013.', 'Domaines de recherche et expertise : Spécialiste de la justice, des droits humains et de la mémoire coloniale. A fait voter la loi reconnaissant la traite et l''esclavage comme crime contre l''humanité (loi Taubira, 2001). Travaille sur la réforme de la justice pénale, les alternatives à l''incarcération et la lutte contre les discriminations.

Engagements et positionnements politiques : De gauche, radicale. Défend la justice sociale, les droits des minorités, l''égalité des droits et la mémoire de l''esclavage. Féministe et antiraciste. Favorable aux politiques progressistes sur les questions de société. Candidate à l''élection présidentielle de 2022 (Primaire populaire).', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Taubira' AND prenom = 'Christiane');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Aubenas', 'Florence', '{"Journaliste","Écrivaine"}', 'Grand reporter au journal Le Monde, Florence Aubenas est l''une des journalistes françaises les plus reconnues. Elle a été otage en Irak en 2005.', 'Domaines de recherche et expertise : Spécialiste du journalisme d''immersion et d''investigation. Couvre les conflits, les crises sociales et les conditions de vie des plus précaires. Analyse les transformations du monde du travail, la précarité et les classes populaires. A notamment écrit "Le Quai de Ouistreham" sur l''expérience du travail précaire.

Engagements et positionnements politiques : De gauche, sociale. Attentive aux conditions de vie des classes populaires et des travailleurs précaires. Défend un journalisme engagé et au contact du terrain. Critique des inégalités sociales et de la précarisation du travail.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Aubenas' AND prenom = 'Florence');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Despentes', 'Virginie', '{"Écrivaine","Réalisatrice"}', 'Romancière, essayiste, réalisatrice, Virginie Despentes est l''auteure de "King Kong Théorie" (2006) et de la trilogie "Vernon Subutex". Prix Renaudot 2010.', 'Domaines de recherche et expertise : Figure du féminisme contemporain et de la contre-culture. Analyse les questions de genre, de sexualité, de violence faite aux femmes et de domination masculine. Critique le capitalisme, la gentrification et les transformations sociales. Donne la parole aux marges et aux exclus. Défend une écriture crue et transgressive.

Engagements et positionnements politiques : De gauche radicale, féministe. Critique le patriarcat, le capitalisme et le conformisme social. Défend les minorités sexuelles, les travailleurs du sexe et les personnes marginalisées. Antiraciste et anticapitaliste. Figure de la culture punk et alternative.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Despentes' AND prenom = 'Virginie');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Paquot', 'Thierry', '{"Philosophe","Urbaniste"}', 'Philosophe de l''urbain, professeur émérite, rédacteur en chef de la revue "Urbanisme", Thierry Paquot est spécialiste de la philosophie urbaine.', 'Domaines de recherche et expertise : Spécialiste de la philosophie de l''urbain, de l''utopie et de l''écologie urbaine. Analyse les transformations des villes, l''urbanisation, les modes d''habiter et les rapports entre ville et nature. Critique la ville-marchandise et la standardisation urbaine. Travaille sur les alternatives urbaines, l''écologie politique et la décroissance urbaine.

Engagements et positionnements politiques : Écologiste, décroissant. Critique l''urbanisation galopante, la densification excessive et la privatisation de l''espace public. Défend le droit à la ville, les communs urbains et une urbanité plus humaine et écologique. Partisan de la ville lente et sobre.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Paquot' AND prenom = 'Thierry');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Testot', 'Laurent', '{"Journaliste","Historien"}', 'Journaliste scientifique spécialisé en histoire globale, Laurent Testot a notamment dirigé la revue "Sciences Humaines" et écrit "Cataclysmes" (2017).', 'Domaines de recherche et expertise : Spécialiste d''histoire globale, d''histoire environnementale et des grandes transitions historiques. Analyse les effondrements de civilisations, les crises écologiques passées et les interactions entre sociétés humaines et environnement. Travaille sur l''Anthropocène, les limites planétaires et les scénarios d''avenir. Vulgarise l''histoire et les sciences humaines.

Engagements et positionnements politiques : Écologiste. Alerte sur les risques d''effondrement écologique et civilisationnel. Plaide pour une transformation radicale des modes de vie et de production. Critique la course à la croissance et prône la sobriété. Défend une approche systémique des enjeux contemporains.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Testot' AND prenom = 'Laurent');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Reghezza-Zitt', 'Magali', '{"Géographe"}', 'Géographe, maîtresse de conférences à l''École normale supérieure, membre du Haut Conseil pour le Climat, Magali Reghezza-Zitt est spécialiste des risques et de l''adaptation au changement climatique.', 'Domaines de recherche et expertise : Experte de la géographie des risques, de la résilience territoriale et de l''adaptation au changement climatique. Analyse les catastrophes naturelles, la vulnérabilité des territoires et les stratégies d''adaptation. Travaille sur l''aménagement du territoire face aux risques climatiques, les politiques publiques d''adaptation et la gestion des crises environnementales.

Engagements et positionnements politiques : Progressiste, écologiste. Défend des politiques ambitieuses d''adaptation au changement climatique. Plaide pour l''intégration des risques climatiques dans l''aménagement du territoire. Critique l''inaction climatique et appelle à une transformation profonde des modèles de développement.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Reghezza-Zitt' AND prenom = 'Magali');

INSERT INTO personnalites (nom, prenom, metiers, short_bio, bio, statut)
SELECT 'Pinçon-Charlot', 'Monique', '{"Sociologue"}', 'Sociologue, directrice de recherche émérite au CNRS, Monique Pinçon-Charlot a travaillé avec son mari Michel Pinçon sur la sociologie des élites et des classes dominantes.', 'Domaines de recherche et expertise : Spécialiste de la sociologie des classes sociales, des grandes fortunes et de la haute bourgeoisie. Analyse les mécanismes de reproduction sociale, les stratégies de distinction et de domination des élites. Critique l''entre-soi bourgeois et les inégalités patrimoniales. Travaille sur les quartiers chics, les beaux quartiers et la ségrégation spatiale.

Engagements et positionnements politiques : De gauche, anticapitaliste. Critique féroce des riches et de l''oligarchie. Dénonce la violence de classe exercée par les dominants. Défend la redistribution des richesses, la taxation du capital et la lutte contre les privilèges. Engagée contre les inégalités sociales.', 0
WHERE NOT EXISTS (SELECT 1 FROM personnalites WHERE nom = 'Pinçon-Charlot' AND prenom = 'Monique');

