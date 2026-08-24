# Climazen

Application terrain pour frigoristes / installateurs d’équipements contenant des fluides frigorigènes.

## Fonctionnalités MVP

- **Clients / détenteurs** (cadre CERFA [2])
- **Chantiers / équipements** (cadre [3], fluide, charge, détection fuites)
- **Stock fluides** (contenants vierges / régénérés / récupération — cadres [11][12])
- **Interventions** : préremplissage du **CERFA officiel 15497*04** (PDF administration — mise en page non modifiée)
- **Compte cloud Supabase** — même compte et données sur ordi et téléphone

## CERFA officiel

Le fichier `public/cerfa/cerfa_15497_04.pdf` est le formulaire dynamique officiel.
ClimaZEN **ne redessine pas** ce document : il remplit uniquement ses champs.

Source : https://www.formulaires.service-public.gouv.fr/gf/cerfa_15497.do

## Configurer Supabase (obligatoire)

1. Créez un projet gratuit sur [supabase.com](https://supabase.com)
2. **SQL Editor** → collez et exécutez [`supabase/schema.sql`](supabase/schema.sql)
3. **Authentication → URL Configuration** : ajoutez vos redirect URLs  
   - `http://localhost:5173/reset-password`  
   - `https://VOTRE-APP.vercel.app/reset-password`
4. (Test) **Authentication → Providers → Email** : vous pouvez désactiver « Confirm email » pour tester plus vite
5. **Settings → API** : copiez Project URL + `anon` `public` key
6. Créez `.env.local` (voir [`.env.example`](.env.example)) :

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

7. Sur **Vercel** : mêmes variables d’environnement → Redeploy

## Sentry (crashs en production)

Sans DSN, l’app fonctionne comme avant (aucun appel réseau Sentry).

1. Créez un projet **React** sur [sentry.io](https://sentry.io)
2. Copiez le **DSN** → Vercel / `.env.local` : `VITE_SENTRY_DSN=...`
3. (Optionnel) source maps lisibles : `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` **uniquement** en CI (jamais `VITE_`)
4. Pas de Session Replay : les écrans contiennent signatures et données client

Au premier login sur l’ordi, si d’anciennes données locales existent, un bandeau propose de les **importer vers le cloud**.

## Démarrer

```bash
cd climazen
npm install
npm run dev
```

Ouvrir l’URL affichée (souvent `http://localhost:5173`).

## Stack

Vite · React · TypeScript · Tailwind · pdf-lib · Supabase (Auth + Postgres + Storage)
