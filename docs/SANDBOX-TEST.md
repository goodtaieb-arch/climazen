# Compte test sandbox ClimaZEN

Jeu de données complet pour tester GMAO, portail client, OT, pièces, contrats, etc.

## Identifiants

| Champ | Valeur |
|--------|--------|
| **URL** | https://climazen.fr/login |
| **E-mail** | `sandbox@climazen.fr` |
| **Mot de passe** | `SbxDemo-Gmao#2026xK9mR` |
| **Édition** | Pro (gérant) |

## Contenu préchargé

- **3 clients** · **10 sites** · **17 équipements**
- **10 techniciens** (dossiers RH / affectation OT)
- **5 OT** (dont 1 ticket client Bureau 117, maintenance clôturée, attente pièce…)
- **2 contrats signés** · **devis** · **commandes** · **magasin pièces**
- **2 portails client** actifs (Tour Part-Dieu, Data center Bron)

### Liens portail test

- Tour Part-Dieu : `https://climazen.fr/portail/sandboxportail001horizon117`
- Data center : `https://climazen.fr/portail/sandboxportail002datacenter`

## Création / réinitialisation (admin)

Sur une machine avec les clés Supabase :

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
npm run provision:sandbox
```

Le script crée l’utilisateur Auth, remplit `org_data` et enregistre les portails SQL.

## Recharger les données (déjà connecté)

En dev : appeler `resetSandbox()` depuis le store, ou relancer `npm run provision:sandbox`.

À la première connexion avec `sandbox@climazen.fr`, si le cloud est vide, l’app pousse automatiquement le jeu sandbox.
