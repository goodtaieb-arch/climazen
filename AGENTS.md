# Climazen — notes agents

Voir `README.md` pour le produit, le stack (Vite + React + Supabase) et les commandes (`npm install`, `npm run dev`, `npm run lint`, `npm run build`).

## Cursor Cloud specific instructions

- **Backend = Supabase Cloud uniquement.** Ne pas lancer Docker, `supabase start`, ni une stack locale. L’app lit `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans `.env.local` (modèle : `.env.example`). Copier ces variables depuis le projet hébergé (celui de climazen.fr) ; la clé publishable/anon est déjà dans le bundle prod.
- **Démarrage dev :** `npm ci` puis `npm run dev -- --host 0.0.0.0 --port 5173`. Vite sert l’app sur le port 5173. Pas de script `test` npm.
- **Lint :** `npm run lint` (oxlint) tourne, mais le dépôt a déjà des erreurs `react-hooks/rules-of-hooks` dans `src/lib/store.tsx` (exit 1). Ne pas les « corriger » dans un setup d’environnement.
- **Build :** `npm run build` (`tsc -b && vite build`) passe.
- **Hello-world métier :** landing → `/register` (compte société) → `/app` → `/app/clients` → Ajouter une fiche client. L’inscription cloud peut renvoyer un JWT même sans e-mail confirmé ; le login mot de passe fonctionne ensuite.
- Relancer Vite après toute modification de `.env.local` (les `VITE_*` sont injectées au boot).
- **Ne pas bloquer.** Si une étape bloque ou prend trop de temps (Docker, variables d’environnement, dépendances, services distants), arrêter la commande et enchaîner en local : écrire / modifier le code dans les fichiers, sans attendre l’infra. Pas de retry infini sur Docker ou les secrets.
