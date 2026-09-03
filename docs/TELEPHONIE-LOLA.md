# Téléphonie Lola — guide gérant ClimaZEN

## Principe sécurité

- **Intelligence partagée** : Lola et l’agent ClimaZEN utilisent le même catalogue d’actions (créer OT, agenda…).
- **Données isolées** : chaque société a son **propre numéro entrant** → une seule `organization_id` par appel.
- **Aucun mélange** : le serveur ClimaZEN route **avant** l’IA (table `organization_telephony`).

## Qui doit acheter le numéro ?

**Vous (le gérant / la société Pro)**, pas ClimaZEN aujourd’hui.

ClimaZEN fournit :
- le webhook : `https://climazen.fr/api/telephony-inbound`
- l’enregistrement du numéro dans **Mon entreprise**
- le routage sécurisé vers votre société

Vous devez :
1. Créer un compte chez un opérateur **voice + webhook HTTP**
2. Acheter **un numéro français** dédié à votre société
3. Pointer le webhook « appel entrant » vers ClimaZEN
4. Saisir le numéro dans l’app (format +33…)

## Fournisseurs compatibles

| Fournisseur | Site | Notes |
|-------------|------|--------|
| **Twilio** (recommandé) | twilio.com | Le plus documenté, ~1 €/mois + usage |
| Vonage | vonage.com | Même principe webhook |
| Plivo | plivo.com | Idem |
| Autre | — | Tout service qui envoie un POST HTTP à notre URL (comme Twilio) |

**Orange / Free pro** : souvent pas de webhook simple → préférez Twilio pour Lola.

## Configuration Twilio (exemple)

1. Console Twilio → **Phone Numbers** → Buy a number (France, Voice).
2. Numéro → **Voice Configuration** :
   - *A call comes in* → **Webhook**
   - URL : `https://climazen.fr/api/telephony-inbound`
   - Method : **POST**
3. ClimaZEN → **Mon entreprise** → section **Accueil téléphonique Lola** :
   - Fournisseur : Twilio
   - Numéro : `+33…` (exactement celui acheté)
   - Cocher **Activer Lola**
   - E-mail gérant (accord OT futurs)
4. Test : appelez le numéro → message d’accueil ClimaZEN pour **votre** société.

## Variables Vercel (ClimaZEN — pas le client)

```
SUPABASE_SERVICE_ROLE_KEY=…
TWILIO_AUTH_TOKEN=…       # optionnel — validation signature Twilio
OPENAI_MODEL=gpt-4o-mini  # optionnel — nom du modèle uniquement
```

**Plus de clé OpenAI / Gemini globale pour les sociétés.**  
Chaque gérant colle **sa** clé OpenAI dans **Mon entreprise** (`organization_ai_secrets`).  
Cette clé paie **l’assistant du site et Lola**. SQL : `supabase/ai-org-openai.sql`.

## SQL Supabase (admin ClimaZEN)

Exécuter dans l’ordre :
1. `supabase/ai-vocabulary.sql`
2. `supabase/ai-telephony-security.sql`
3. `supabase/ai-org-openai.sql` (clé OpenAI par société)

## Évolution prévue

| Phase | Contenu |
|-------|---------|
| **Actuel** | Routage numéro → société + accueil vocal test |
| **Suivant** | Reconnaissance appelant (annuaire techs/clients) |
| **Puis** | Lola conversation + OT brouillon + mail gérant |

## FAQ

**Un numéro pour toutes les sociétés ClimaZEN ?**  
Non recommandé. **Un numéro par société** = zéro confusion.

**ClimaZEN peut-il revendre un numéro ?**  
Possible plus tard (addon Pro). Aujourd’hui : **vous procurez** le numéro.

**Les données passent-elles chez OpenAI / Google ?**  
OpenAI uniquement (plus Gemini). Uniquement le **strict nécessaire** pour la phrase en cours, avec **la clé de votre société**. Jamais la base complète d’une autre société.
