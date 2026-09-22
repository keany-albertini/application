# Application — V0.3

Calendrier mobile global qui agrège des événements provenant en priorité de sources officielles et open data, avec une source sportive gratuite de secours.

## Sources intégrées

### Sans clé API
- Red Bull Events — page officielle
- Formula 1 — calendrier officiel
- Paris Saint-Germain — calendrier officiel
- FC Barcelona — calendrier officiel
- Manchester City — calendrier officiel
- Liverpool FC — calendrier officiel
- UEFA — calendrier/fixtures officiels
- Ligue 1 — site officiel
- Formula E — calendrier officiel
- NBA — calendrier officiel
- NHL — calendrier officiel
- UFC — événements officiels
- Ville de Paris Open Data — agenda public
- TheSportsDB — secours sportif gratuit avec la clé publique `123`

### Gratuites mais avec clé à demander
- OpenAgenda — événements culturels et territoriaux
- DATAtourisme — base nationale française des événements touristiques, clé API gratuite sur demande

### Notre propre source
- Supabase — événements publiés par les professionnels et validés par notre plateforme

## Variables d'environnement optionnelles

```bash
THESPORTSDB_API_KEY=123
OPENAGENDA_API_KEY=
DATATOURISME_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Aucune clé n'est nécessaire pour lancer l'interface et utiliser les sources publiques sans authentification. Les clés privées doivent rester dans les variables Vercel et ne jamais être commitées dans le dépôt.

## Fonctionnement

`/api/events` interroge les sources pertinentes en parallèle, normalise les événements dans un format unique, élimine les doublons, retire les événements passés et privilégie les données officielles dans le flux.

L'interface affiche la provenance et un badge **Officiel** lorsque l'événement vient directement d'une source officielle ou open data institutionnelle.

## Publication professionnelle

La route `/api/pro-events` est prête pour Supabase. Avant ouverture publique :
- authentification des organisateurs ;
- validation/modération ;
- règles RLS ;
- historique des modifications ;
- vérification de domaine ou d'identité pour les comptes professionnels.

## Développement

```bash
npm install
npm run dev
npm run build
```

## Architecture

- `app/page.tsx` — interface mobile/PWA
- `app/api/events/route.ts` — agrégateur
- `app/api/pro-events/route.ts` — publication professionnelle
- `lib/sources.ts` — adaptateurs officiels/open data/API
- `lib/types.ts` — modèle unifié
- `lib/demo-events.ts` — secours lorsque les sources ne répondent pas
