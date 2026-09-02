# Compte test sandbox ClimaZEN

Jeu de données complet pour tester GMAO, portail client, OT, pièces, contrats, etc.

## Identifiants gérant

| Champ | Valeur |
|--------|--------|
| **URL** | https://climazen.fr/login |
| **E-mail** | `sandbox@climazen.fr` |
| **Mot de passe** | `SbxDemo-Gmao#2026xK9mR` |
| **Édition** | Pro (owner / gérant) |

## 10 opérateurs connectables

Après `npm run provision:sandbox`, chaque profil a un **vrai compte Auth** (visible dans **Équipe**, connexion possible).

**Mot de passe commun opérateurs :** `SbxOp-Gmao#2026xK9m`

| Rôle | E-mail |
|------|--------|
| Tech frigoriste | `op.tech1@sbx-demo.fr` |
| Tech CVC | `op.tech2@sbx-demo.fr` |
| Électricien | `op.tech3@sbx-demo.fr` |
| **Responsable** | `op.responsable@sbx-demo.fr` |
| Tech frigoriste | `op.tech4@sbx-demo.fr` |
| Plombier | `op.tech5@sbx-demo.fr` |
| **Magasinier** | `op.magasinier@sbx-demo.fr` |
| **Secrétaire** | `op.secretaire@sbx-demo.fr` |
| **Pilote** | `op.pilote@sbx-demo.fr` |
| Tech CVC | `op.tech6@sbx-demo.fr` |

Sur la page **Connexion**, la section « Comptes démo sandbox » permet de préremplir un profil (gérant, responsable, pilote, secrétaire, tech, magasinier).

> Sans provision script, seul le gérant existe : les 10 noms apparaissent en dossiers RH mais **ne sont pas connectables**.

## Contenu préchargé

- **3 clients** · **10 sites** · **17 équipements**
- **11 membres** (1 gérant + 10 opérateurs après provision)
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

Le script crée le gérant, **10 opérateurs Auth**, remplit `org_data`, lie les dossiers RH aux vrais `userId`, et enregistre les portails SQL.

## Recharger les données (déjà connecté)

En dev : appeler `resetSandbox()` depuis le store, ou relancer `npm run provision:sandbox`.

À la première connexion avec `sandbox@climazen.fr`, si le cloud est vide, l’app pousse automatiquement le jeu sandbox (sans créer les comptes opérateurs — il faut le script).
