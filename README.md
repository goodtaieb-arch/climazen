# Climazen

Application terrain pour frigoristes / installateurs d’équipements contenant des fluides frigorigènes.

## Fonctionnalités MVP

- **Clients / détenteurs** (cadre CERFA [2])
- **Chantiers / équipements** (cadre [3], fluide, charge, détection fuites)
- **Stock fluides** (contenants vierges / régénérés / récupération — cadres [11][12])
- **Interventions** : préremplissage du **CERFA officiel 15497*04** (PDF administration — mise en page non modifiée)
- Données locales (navigateur) — démo sans serveur

## CERFA officiel

Le fichier `public/cerfa/cerfa_15497_04.pdf` est le formulaire dynamique officiel.
ClimaZEN **ne redessine pas** ce document : il remplit uniquement ses champs.

Source : https://www.formulaires.service-public.gouv.fr/gf/cerfa_15497.do

## Démarrer

```bash
cd climazen
npm install
npm run dev
```

Ouvrir l’URL affichée (souvent `http://localhost:5173`).

## Stack

Vite · React · TypeScript · Tailwind · pdf-lib · localStorage
