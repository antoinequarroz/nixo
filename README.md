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
| Rappels | notification du soir à l'heure choisie + seconde 2 h plus tard si pas validé |
| Binôme et témoins | simulés sur le téléphone ; le serveur (Supabase) vient à l'étape suivante |
| Plusieurs compagnons | chacun nommé par l'utilisateur, 4 espèces (1 gratuite, 3 à débloquer, achat simulé) |
| Pliables | au-delà de 600 px de large, l'accueil passe en deux panneaux |

## Organisation du code

```
src/
  app/            écrans (Expo Router) : onboarding, accueil, lignée, économies, binôme, compagnons, respiration, réglages
  domain/         règles du jeu, pures et testées (engine.ts, rules.ts)
  components/     compagnon (SVG), fond granuleux, boutons, feuilles
  i18n/           textes FR / EN et messages du compagnon
  services/       rappels, achats (simulés), dialogues
  state/          stockage local et état de l'app
```

Les chiffres du jeu sont tous dans `src/domain/rules.ts`.

```bash
npm test           # tests du moteur de jeu
npm run typecheck
```

## Choix techniques

**Expo (React Native) plutôt que Flutter**, pour quatre raisons :

1. RevenueCat (achats) et Supabase (binôme, comptes) ont des SDK React Native de premier plan.
2. EAS construit et publie sur l'App Store et Google Play depuis le cloud, sans Mac obligatoire.
3. Les mises à jour « over the air » permettent de corriger des textes ou des règles sans repasser par la revue des stores.
4. La même base tourne dans le navigateur, ce qui rend le prototype partageable et facile à tester.

## Étapes suivantes

- Serveur Supabase : comptes, vrai binôme par code, témoins qui signalent depuis leur téléphone
- RevenueCat : vrais achats (résurrection, gels, espèces, Premium)
- Les ~150 messages du compagnon prévus pour la V1 (le prototype en a une quarantaine par langue)
- Icône, écran de démarrage et fiches des stores
