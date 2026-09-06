# Connexion cloud OAuth2 — Google Drive et Microsoft OneDrive / SharePoint

Avant, les boutons « cloud » de **Mon entreprise** n’étaient que des liens externes.
Ils déclenchent désormais un vrai consentement OAuth2 : ClimaZEN obtient un
`refresh_token` par société, chiffré côté serveur, et peut écrire dans le dossier.

Rien n’est stocké dans le navigateur : le jeton ne quitte jamais Vercel + Supabase.

## 1. Base de données

Supabase → **SQL Editor** → exécuter [`supabase/cloud-oauth.sql`](../supabase/cloud-oauth.sql).

Deux tables sont créées, toutes les deux en RLS **sans aucune policy** : seul le
service role (API Vercel) peut les lire.

| Table | Rôle |
| --- | --- |
| `organization_cloud_connections` | `refresh_token` / `access_token` chiffrés AES-256-GCM, par société et par fournisseur |
| `cloud_oauth_states` | états anti-CSRF + PKCE, à usage unique, valables 10 minutes |

## 2. Google Drive

1. [console.cloud.google.com](https://console.cloud.google.com) → créer (ou choisir) un projet.
2. **APIs & Services → Library** → activer **Google Drive API**.
3. **OAuth consent screen** → type *External* (ou *Internal* si Workspace) →
   ajouter le scope `https://www.googleapis.com/auth/drive.file`.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
5. *Authorized redirect URIs* — exactement :
   - `https://climazen.fr/api/auth/google/callback`
   - `http://localhost:5173/api/auth/google/callback` (dev, optionnel)
6. Copier le *Client ID* et le *Client secret* dans Vercel.

Le scope `drive.file` est volontairement le plus étroit possible : ClimaZEN ne
voit **que** les fichiers qu’il a créés ou que l’utilisateur lui a explicitement
confiés. Pour écrire dans un dossier déjà existant qui n’a pas été créé par
ClimaZEN, il faut passer par le **compte de service** (§4).

## 3. Microsoft OneDrive / SharePoint

1. [entra.microsoft.com](https://entra.microsoft.com) → **App registrations → New registration**.
2. *Supported account types* : « Accounts in any organizational directory and
   personal Microsoft accounts » (sinon renseigner `MICROSOFT_TENANT_ID`).
3. *Redirect URI* → **Web** :
   - `https://climazen.fr/api/auth/microsoft/callback`
4. **Certificates & secrets → New client secret** → copier la *Value*.
5. **API permissions → Microsoft Graph → Delegated** :
   `Files.ReadWrite.All` et `offline_access` → *Grant admin consent*.

`offline_access` est obligatoire : sans lui, Microsoft ne renvoie pas de
`refresh_token` et la connexion serait perdue au bout d’une heure.

## 4. Compte de service (option secours)

Quand le gérant colle un lien de dossier au lieu de connecter son cloud, l’app
affiche :

> Si vous utilisez un lien direct, vous devez partager votre dossier en mode
> Éditeur avec notre compte de service `…`.

Pour Google, créez un *service account* (IAM → Service accounts → clé JSON) et
donnez son JSON à Vercel : le bouton **Tester la connexion et les droits**
écrira alors avec ce compte.

Microsoft n’a pas d’équivalent utilisable sur un simple lien : côté OneDrive /
SharePoint, le test exige la connexion OAuth (le message le dit clairement).

## 5. Variables d’environnement Vercel

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Drive | client OAuth Google |
| `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET` | OneDrive | application Entra ID |
| `MICROSOFT_TENANT_ID` | non | `common` par défaut ; l’ID du tenant pour un mono-locataire |
| `CLOUD_OAUTH_REDIRECT_BASE` | recommandé | ex. `https://climazen.fr` — doit correspondre à l’URI déclarée |
| `CLOUD_TOKEN_SECRET` | recommandé | clé de chiffrement des jetons (à défaut : dérivée du service role) |
| `CLIMAZEN_SERVICE_ACCOUNT_EMAIL` | secours | e-mail affiché au client pour le partage Éditeur |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | secours | JSON complet du compte de service Google |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | secours | alternative au JSON |

`SUPABASE_SERVICE_ROLE_KEY` reste requis (lecture / écriture des deux tables).

> **Attention à `CLOUD_TOKEN_SECRET`** : si elle est absente, la clé de
> chiffrement est dérivée de `SUPABASE_SERVICE_ROLE_KEY`. Faire tourner le
> service role rendrait alors les jetons illisibles — l’app le détecte, affiche
> « Jeton illisible » et demande une reconnexion.

## 6. Routes

| Route | Méthode | Rôle |
| --- | --- | --- |
| `/api/cloud-oauth` | `GET` | état des connexions, e-mail du compte de service |
| `/api/cloud-oauth` | `POST { action: 'start' }` | crée l’état + PKCE, renvoie l’URL de consentement |
| `/api/cloud-oauth` | `POST { action: 'disconnect' }` | oublie le jeton de la société |
| `/api/cloud-oauth` | `POST { action: 'test-write' }` | crée puis supprime `test-climazen.txt` |
| `/api/auth/google/callback` | `GET` | échange du code Google → `refresh_token` |
| `/api/auth/microsoft/callback` | `GET` | échange du code Microsoft → `refresh_token` |

Les actions d’écriture sont réservées au **gérant** (`role = owner`), vérifié
côté serveur par `authorizeOrgRequest`.

## 7. Vérifier après déploiement

1. Mon entreprise → **Connecter Google Drive** → écran de consentement Google →
   retour sur `/app/operateur` avec « Google Drive connecté ».
2. Idem **Connecter OneDrive**.
3. Coller un lien de dossier partagé en Éditeur → **Tester la connexion et les
   droits** → `test-climazen.txt` apparaît puis disparaît du dossier.
