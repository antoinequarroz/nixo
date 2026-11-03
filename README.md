# Nixo

Application pour arrêter de fumer : un compagnon grandit chaque soir sans cigarette et s'affaiblit à chaque rechute. iPhone (standard et pliable), Android (téléphones, pliables, Surface Duo), une seule base de code.

## Lancer le prototype

```bash
npm install
npm start          # puis scanner le QR code avec l'app Expo Go (iOS / Android)
npm run web        # version navigateur, pratique pour tester vite
```

Pour tester sans attendre des jours : **Réglages → Labo du prototype** avance l'horloge de l'app (+6 h, +1 jour, +7 jours). On voit ainsi le compagnon évoluer, la série grandir, les jours oubliés compter comme rechute, la mort et la résurrection.

Installer sur un vrai téléphone sans Expo Go (build interne via EAS) :

```bash
npx eas-cli@latest build --profile preview --platform android   # APK installable
npx eas-cli@latest build --profile preview --platform ios       # nécessite le compte Apple Developer
```

## Ce que fait le prototype

| Boucle | Détail |
|---|---|
| Validation du jour | « Journée sans fumer » ou « J'ai craqué », jusqu'à midi le lendemain |
| Santé | +10 % par jour validé, −30 % par rechute avouée, −20 % par jour oublié, −15 % par signalement d'un témoin |
| Évolution | 6 formes calées sur les paliers du sevrage : jour 0, 3, 14, 30, 90, 365 |
| Mort | à 0 %. Résurrection gratuite en tenant 3 jours d'affilée, ou payante (simulée) après un délai de 12 h. Passé 72 h (au moins), le compagnon est enterré au mémorial |
| Gels de série | protègent un jour oublié (pack de 3, achat simulé) |
| Économies | argent, cigarettes non fumées, vie regagnée, objectif avec date estimée, projections |
| Messages | écrits du point de vue du compagnon, FR et EN, selon sa santé et ta journée |
| Rappels | message du matin du compagnon (désactivable), rappel du soir à l'heure choisie + second 2 h plus tard si pas validé ; texte spécial si santé basse ou compagnon éteint |
| Notifications push | dès qu'un témoin signale ou que le binôme encourage, envoyées par le serveur via Expo |
| Binôme et témoins | vrais via Supabase (code d'invitation, témoins acceptés, 1 signalement par jour, encouragements), simulés si le serveur n'est pas configuré |
| Plusieurs compagnons | chacun nommé par l'utilisateur, 4 espèces (1 gratuite, 3 à débloquer, achat simulé) |
| Compte | aucune inscription ; « Supprimer mon compte » efface tout, sur le téléphone et le serveur |
| Pliables | au-delà de 600 px de large, l'accueil passe en deux panneaux |

## Tester le binôme sans Supabase (serveur SQLite)

Pour essayer le binôme et les témoins à plusieurs téléphones avant de créer le projet Supabase, un petit serveur de test tourne sur ton ordinateur, avec une base SQLite (`server/nixo.db`). Il applique les mêmes règles que Supabase.

1. Copier `.env.example` en `.env` (il contient déjà `EXPO_PUBLIC_LOCAL_SERVER=auto`).
2. Dans un terminal : `npm run server` (Node 22.13 ou plus récent).
3. Dans un autre : `npm start`, puis ouvrir l'app avec Expo Go sur deux téléphones **connectés au même Wi-Fi** que l'ordinateur.

Chaque téléphone reçoit un compte de test. Pour tout remettre à zéro : arrêter le serveur et supprimer `server/nixo.db`. Si les téléphones n'arrivent pas à joindre le serveur, mettre l'adresse affichée par `npm run server` à la place de `auto` (ex. `http://192.168.1.20:8787`) et vérifier que le pare-feu laisse passer le port 8787.

Dès que les clés Supabase sont dans `.env`, l'app utilise Supabase et ignore ce serveur. Rien d'autre à changer.

## Brancher le serveur et les achats

Sans configuration (ni Supabase, ni serveur de test), l'app tourne en **mode simulé** (binôme, témoins et achats restent sur le téléphone). Pour passer en vrai :

1. Copier `.env.example` en `.env` et le remplir.
2. **Supabase** (binôme, témoins, encouragements)
   - Créer un projet (région Europe), puis dans *Authentication → Sign In / Providers*, activer **Allow anonymous sign-ins** : chaque téléphone a un compte sans inscription.
   - Appliquer le schéma : `npx supabase link --project-ref <ref>` puis `npx supabase db push` (ou coller `supabase/migrations/*.sql` dans l'éditeur SQL).
   - Mettre l'URL et la clé publique `anon` dans `.env`. Jamais la clé `service_role`.
3. **RevenueCat** (achats)
   - Créer les produits dans App Store Connect et Google Play, avec ces identifiants : `nixo_revive` (consommable), `nixo_freeze_pack_3` (consommable), `nixo_species_moss`, `nixo_species_mist`, `nixo_species_ochre` (non consommables).
   - Les ajouter dans RevenueCat, puis mettre les clés publiques iOS et Android dans `.env`.
   - Les vrais achats ne marchent pas dans Expo Go : il faut un build de développement (`npx eas-cli@latest build --profile development`).
4. **Notifications push** (signalements, encouragements)
   - Lier le projet à EAS une fois : `npx eas-cli@latest init` (ajoute l'identifiant du projet dans la config).
   - iOS : `npx eas-cli@latest credentials` crée la clé de notifications Apple. Android : ajouter le fichier `google-services.json` de Firebase (Expo l'explique pas à pas).
   - Côté serveur, rien à faire : la base envoie les push elle-même (extension `pg_net` de Supabase).

Le jeu (santé, série, évolution) reste calculé sur le téléphone. Le serveur ne garde que ce que les autres doivent voir (prénom, nom et état du compagnon, série) et les actions des autres sur toi (signalements, encouragements). Toutes les écritures passent par des fonctions SQL contrôlées, et chaque personne ne voit que son binôme et ses témoins.

## Publier sur l'App Store et Google Play

Tout ce qu'il faut pour les fiches est dans `docs/` :

- `docs/legal/` : politique de confidentialité et conditions, en français et en anglais. À mettre en ligne sur une page publique, puis renseigner son adresse dans `EXPO_PUBLIC_LEGAL_URL` (lien dans Réglages).
- `docs/store/` : textes des fiches FR et EN, réponses aux questionnaires (âge, confidentialité Apple, sécurité des données Google), produits à créer, étapes de build et d'envoi (`publication.md`).
- `docs/store/screenshots/` : captures aux formats iPhone 6,9", iPad 13" et Android, en FR et EN. On les régénère avec `node scripts/store-screenshots.mjs` (mode d'emploi en tête du fichier).

Dans une build de production, le labo d'horloge est caché, et Réglages propose **Supprimer mon compte**, qui efface le compte et toutes ses données sur le serveur (exigé par Apple et Google).

## Organisation du code

```
server/           serveur de test SQLite (mêmes règles que Supabase)
supabase/
  migrations/     schéma, règles d'accès et fonctions du serveur
  sql-tests/      tests du schéma (npm run test:db)
src/
  app/            écrans (Expo Router) : onboarding, accueil, lignée, économies, binôme, compagnons, respiration, réglages
  domain/         règles du jeu, pures et testées (engine.ts, rules.ts)
  components/     compagnon (SVG), fond granuleux, boutons, feuilles
  i18n/           textes FR / EN et messages du compagnon
  services/       rappels, achats (RevenueCat ou simulés), serveur (Supabase), dialogues
  state/          stockage local et état de l'app
```

Les chiffres du jeu sont tous dans `src/domain/rules.ts`.

```bash
npm test           # tests du moteur de jeu
npm run test:server  # règles du serveur de test SQLite
npm run test:db    # schéma Supabase et règles d'accès, sur un Postgres local jetable
npm run typecheck
# Test de bout en bout avec un Supabase local (Docker) :
npx supabase start && SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<anon key affichée> node scripts/smoke-supabase.mjs
```

## Choix techniques

**Expo (React Native) plutôt que Flutter**, pour quatre raisons :

1. RevenueCat (achats) et Supabase (binôme, comptes) ont des SDK React Native de premier plan.
2. EAS construit et publie sur l'App Store et Google Play depuis le cloud, sans Mac obligatoire.
3. Les mises à jour « over the air » permettent de corriger des textes ou des règles sans repasser par la revue des stores.
4. La même base tourne dans le navigateur, ce qui rend le prototype partageable et facile à tester.

## Étapes suivantes

- Abonnement Premium dans RevenueCat
- Lier le compte anonyme à Apple / Google pour retrouver ses données sur un nouveau téléphone
- Les ~150 messages du compagnon prévus pour la V1 (le prototype en a une quarantaine par langue)
- Mettre en ligne la politique de confidentialité (nixo.ch ?)
