# Téléphonie Lola — 2 comptes seulement

Rien d’autre à créer (pas Vapi, pas un 3ᵉ outil).

## Étape 1 — OpenAI (le cerveau)

| Action | Lien (ouvre la page exacte) |
|--------|-----------------------------|
| Créer le compte | https://platform.openai.com/signup |
| Activer le paiement | https://platform.openai.com/settings/organization/billing |
| Créer la clé `sk-…` | https://platform.openai.com/api-keys |

Puis coller la clé dans ClimaZEN → **Mon entreprise**.

## Étape 2 — Twilio (le numéro)

| Action | Lien (ouvre la page exacte) |
|--------|-----------------------------|
| Créer le compte | https://www.twilio.com/try-twilio |
| Acheter un numéro France (voix) | https://www.twilio.com/console/phone-numbers/search |
| Mes numéros (coller le webhook) | https://www.twilio.com/console/phone-numbers/incoming |

Webhook à coller sur le numéro (*A call comes in* → Webhook POST) :

`https://climazen.fr/api/telephony-inbound`

Puis coller le `+33…` dans ClimaZEN et activer Lola.

## Principe sécurité

- **Un numéro = une société.** Routage **avant** l’IA (`organization_telephony`).
- Lola et l’assistant site = **la même clé OpenAI** de la société.

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

## Intelligence A→Z + validation humaine

Lola (téléphone) et l’assistant site = **une seule intelligence**.
Elle peut **proposer** tout le parcours métier (OT, CERFA brouillon, clients, agenda, devis, commandes, pièces…).
**Aucune écriture** sans validation humaine (« oui » / Valider) dans l’app.
Interdit : signature, clôture OT, PDF CERFA final, suppressions.

## Évolution prévue

| Phase | Contenu |
|-------|---------|
| **Actuel** | Routage numéro → société + clé OpenAI société + propositions A→Z (validation humaine) |
| **Suivant** | Reconnaissance appelant (annuaire techs/clients) |
| **Puis** | Conversation vocale continue + propositions OT/devis à valider dans l’app |

## FAQ

**Un numéro pour toutes les sociétés ClimaZEN ?**  
Non recommandé. **Un numéro par société** = zéro confusion.

**ClimaZEN peut-il revendre un numéro ?**  
Possible plus tard (addon Pro). Aujourd’hui : **vous procurez** le numéro.

**Les données passent-elles chez OpenAI / Google ?**  
OpenAI uniquement (plus Gemini). Uniquement le **strict nécessaire** pour la phrase en cours, avec **la clé de votre société**. Jamais la base complète d’une autre société.
