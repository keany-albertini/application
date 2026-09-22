# Application — V0.4 Recherche universelle

Application mobile/PWA de calendrier événementiel global.

## Objectif de la V0.4

Une seule recherche doit pouvoir combiner :
- sujet : Nike, Adidas, Red Bull, ping-pong, concert, gaming, salon, etc. ;
- lieu : Marseille, Lyon, Bordeaux, Paris ou une ville ailleurs dans le monde ;
- date : aujourd'hui, demain ou un jour sélectionné dans le calendrier.

Exemples :
- `Nike Marseille demain`
- `ping-pong Lyon`
- `Adidas Paris`
- `concert Bordeaux`
- `Marseille`, puis sélection d'un jour dans le calendrier.

Le calendrier relance désormais la recherche côté serveur pour la date choisie au lieu de simplement filtrer une petite liste déjà chargée.

## Fiabilité des résultats

Chaque événement est normalisé avec sa source et un niveau de vérification :
1. officiel ;
2. institutionnel / open data ;
3. professionnel vérifié ;
4. web structuré vérifié ;
5. communautaire.

L'application n'invente pas de date à partir d'un simple article. La découverte web ne crée un événement que lorsqu'une date structurée est trouvée sur la page (Schema.org Event ou métadonnée événementielle).

## Sources intégrées

### Publiques / sans clé
- Red Bull Events
- Formula 1
- Formula E
- PSG
- FC Barcelona
- Manchester City
- Liverpool FC
- UEFA
- Ligue 1
- NBA
- NHL
- UFC
- Ville de Paris Open Data
- TheSportsDB (clé publique `123` comme secours sportif)

### API gratuites à connecter
- OpenAgenda — API gratuite avec authentification
- DATAtourisme — clé gratuite sur demande
- Tavily — moteur de recherche web, 1 000 crédits gratuits/mois
- Brave Search — secours optionnel

### Source interne
- Supabase — événements publiés par les professionnels après validation

## Variables Vercel

```bash
TAVILY_API_KEY=
BRAVE_SEARCH_API_KEY=
OPENAGENDA_API_KEY=
DATATOURISME_API_KEY=
THESPORTSDB_API_KEY=123

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Les clés restent exclusivement côté serveur.

## Architecture

- `app/page.tsx` — interface mobile + calendrier qui déclenche les recherches datées
- `app/api/events/route.ts` — agrégation, déduplication et classement de confiance
- `lib/universal-search.ts` — compréhension aujourd'hui/demain + découverte web structurée
- `lib/sources.ts` — sources officielles, OpenAgenda et DATAtourisme
- `app/api/pro-events/route.ts` — publication professionnelle
- `lib/types.ts` — modèle unifié

## Développement

```bash
npm install
npm run dev
npm run build
```
