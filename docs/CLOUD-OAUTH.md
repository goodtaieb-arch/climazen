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
7. **OAuth consent screen → Publish app** : indispensable, voir ci-dessous.

Le scope `drive.file` est volontairement le plus étroit possible : ClimaZEN ne
voit **que** les fichiers qu’il a créés ou que l’utilisateur lui a explicitement
confiés. Un dossier créé à la main dans Drive lui reste donc invisible : laissez
ClimaZEN créer lui-même son arborescence.

### Publier l’écran de consentement (sinon « Accès bloqué »)

Un projet Google neuf reste en statut **Testing**. Dans cet état, seuls les
comptes inscrits dans *Test users* peuvent autoriser l’application : tous les
autres reçoivent `Erreur 403 : access_denied` avec le message « n’a pas terminé
la procédure de validation de Google ».

Ajouter des testeurs dépanne, mais ne suffit pas : en mode Testing, Google
**expire les autorisations au bout de 7 jours**, refresh_token compris. La
connexion d’un gérant se casserait donc toutes les semaines.

La bonne configuration est donc **OAuth consent screen → Publish app**
(statut *In production*). Comme `drive.file` est un scope *non sensible*, cette
publication ne déclenche ni évaluation de sécurité ni vérification des scopes.
Tant que la marque (nom + logo) n’est pas vérifiée, Google peut afficher un
écran d’avertissement contournable via *Paramètres avancés → Continuer* ; la
*brand verification* le supprime, mais elle n’est pas nécessaire au
fonctionnement.

Microsoft Entra ID n’a pas d’équivalent : aucune publication n’est requise.

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

### L’écran Microsoft annonce « un accès total à tous les fichiers »

C’est le libellé imposé par Microsoft pour `Files.ReadWrite.All` en permission
**déléguée**. « Total » ne veut pas dire « toute l’organisation » : l’application
hérite uniquement des droits du compte qui autorise, et jamais plus. Ce scope
est nécessaire pour écrire ailleurs que dans le OneDrive personnel du compte —
bibliothèques SharePoint et dossiers partagés. `Files.ReadWrite`, plus étroit,
suffirait pour le seul OneDrive personnel mais ferait échouer SharePoint.

Deux mentions de cet écran se règlent dans Entra, sans toucher au code :

| Mention | Réglage |
| --- | --- |
| « L’éditeur n’a pas fourni de liens vers ses conditions d’utilisation » | *Branding & properties* → *Terms of service URL* `https://climazen.fr/cgu` et *Privacy statement URL* `https://climazen.fr/confidentialite` |
| « non vérifié » | *Publisher verification* — nécessite un compte Microsoft Partner Network |

## 4. Tester les droits d’écriture

Le bouton **Tester la connexion et les droits** écrit un vrai fichier
`test-climazen.txt` avec le compte connecté en OAuth, puis le supprime. C’est le
seul moyen de savoir si ClimaZEN pourra déposer les documents : un lien collé,
même valide, ne dit rien des droits.

Le test s’appuie toujours sur la connexion OAuth — il n’existe pas de compte de
service : sans clic préalable sur « Connecter … », le test répond simplement
qu’il faut connecter le service.

Côté Google, l’autorisation `drive.file` ne donne accès qu’aux fichiers créés
par ClimaZEN. Tester un dossier existant créé à la main dans Drive échoue donc
avec un message explicite : laissez le champ de lien vide pour tester à la
racine du Drive connecté, et laissez ClimaZEN créer lui-même son arborescence.

## 5. Variables d’environnement Vercel

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Drive | client OAuth Google (alias acceptés : `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) |
| `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET` | OneDrive | application Entra ID (alias : `MICROSOFT_CLIENT_*`, `AZURE_CLIENT_*`) |
| `MICROSOFT_TENANT_ID` | non | `common` par défaut ; l’ID du tenant pour un mono-locataire (alias `AZURE_TENANT_ID`) |
| `CLOUD_OAUTH_REDIRECT_BASE` | recommandé | ex. `https://climazen.fr` — doit correspondre à l’URI déclarée |
| `CLOUD_TOKEN_SECRET` | recommandé | clé de chiffrement des jetons (à défaut : dérivée du service role) |

`SUPABASE_SERVICE_ROLE_KEY` reste requis (lecture / écriture des deux tables).

> **Attention à `CLOUD_TOKEN_SECRET`** : si elle est absente, la clé de
> chiffrement est dérivée de `SUPABASE_SERVICE_ROLE_KEY`. Faire tourner le
> service role rendrait alors les jetons illisibles — l’app le détecte, affiche
> « Jeton illisible » et demande une reconnexion.

## 6. Routes

| Route | Méthode | Rôle |
| --- | --- | --- |
| `/api/cloud-oauth` | `GET` | état des connexions et URI de redirection à déclarer |
| `/api/cloud-oauth` | `POST { action: 'start' }` | crée l’état + PKCE, renvoie l’URL de consentement |
| `/api/cloud-oauth` | `POST { action: 'disconnect' }` | oublie le jeton de la société |
| `/api/cloud-oauth` | `POST { action: 'test-write' }` | crée puis supprime `test-climazen.txt` |
| `/api/auth/google/callback` | `GET` | échange du code Google → `refresh_token` |
| `/api/auth/microsoft/callback` | `GET` | échange du code Microsoft → `refresh_token` |

Les actions d’écriture sont réservées au **gérant** (`role = owner`), vérifié
côté serveur par `authorizeOrgRequest`.

Les deux callbacks sont des **rewrites** (`vercel.json`) vers `/api/cloud-oauth`
avec `?callback=google|microsoft` : le plan Vercel plafonne un déploiement à 12
fonctions serverless, donc une seule fonction porte tout le flux cloud. Les URLs
publiques — celles déclarées chez Google et Microsoft — ne changent pas.

> **Une variable ajoutée ne s’applique pas aux déploiements déjà en ligne.**
> Sur Vercel, les variables sont attachées au déploiement : après un ajout ou
> une modification, il faut cocher l’environnement **Production** puis relancer
> un déploiement (Deployments → … → Redeploy).

## 7. Diagnostic rapide

Sans être connecté, deux appels suffisent à situer un problème :

```bash
curl -s https://climazen.fr/api/cloud-oauth
# 401 "Session requise."            → SUPABASE_SERVICE_ROLE_KEY est bien lu
# 503 "service role non configuré"  → SUPABASE_SERVICE_ROLE_KEY manque

curl -si https://climazen.fr/api/auth/google/callback | grep -i location
# …reason=no_code                 → tout est configuré (il manquait juste le code)
# …reason=provider_not_configured → identifiants OAuth absents en Production
# …reason=supabase_missing        → SUPABASE_SERVICE_ROLE_KEY absent
```

Connecté en gérant, la page **Mon entreprise** affiche directement
« Identifiants OAuth absents sur le serveur » sous le service concerné.

### `redirect_uri_mismatch` (Google) / `invalid_request … redirect_uri` (Microsoft)

Le clic ouvre bien la page du fournisseur, mais celle-ci refuse avant même le
consentement. L’URI envoyée par ClimaZEN n’est alors pas déclarée **au caractère
près** côté console. Les valeurs attendues sont :

```
https://climazen.fr/api/auth/google/callback
https://climazen.fr/api/auth/microsoft/callback
```

Pièges les plus fréquents : barre oblique finale, `www.`, `http` au lieu de
`https`, l’URL `*.vercel.app` au lieu du domaine, ou — côté Entra — une URI
enregistrée sous la plateforme *Single-page application* au lieu de *Web*.

La page **Mon entreprise** affiche la valeur exacte, avec un bouton **Copier**,
sous « Google ou Microsoft refuse la connexion ? » : elle est calculée par le
serveur, donc toujours celle réellement envoyée. Comptez quelques minutes de
propagation après l’avoir ajoutée.

### `Erreur 403 : access_denied` (Google)

L’URI de redirection est bonne — Google l’affiche d’ailleurs dans les détails de
la requête — mais l’écran de consentement est resté en mode **Testing**. Publiez
l’application (§2) ; ajouter le compte aux *Test users* ne tient que 7 jours.

## 8. Vérifier après déploiement

1. Mon entreprise → **Connecter Google Drive** → écran de consentement Google →
   retour sur `/app/operateur` avec « Google Drive connecté ».
2. Idem **Connecter OneDrive**.
3. **Tester la connexion et les droits** → `test-climazen.txt` apparaît puis
   disparaît du Drive / OneDrive connecté.
