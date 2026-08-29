# Prochain codage ClimaZEN (Issam)

**Ne pas coder tant que les unités Cursor n’ont pas été réinitialisées, et tant qu’Issam n’a pas dit de lancer.**

Sauvegardé le 29/08/2026 pour ne pas oublier. C’est la feuille de route **après** renouvellement des unités — pas un chantier à ouvrir tout de suite.

---

## 1. QR Code Site & Équipement

### QR équipement — existe déjà

Raccourci tech **au pied de la machine** :

- Accueil → Scanner QR
- Scan de l’étiquette collée sur l’équipement
- Reprend un OT ouvert sur cette machine, sinon ouvre un OT « Client appelle » prérempli (client, site, équipement)
- Enchaîne CERFA / rapport / historique

Fichiers : `src/pages/ScanEquipementPage.tsx`, `src/lib/equipementQr.ts`, impression depuis Sites & Parc.

### À ajouter — QR Code Site

Collé au **local technique / accueil** du bâtiment.

- **Client / syndic** : voir tout le parc du site + ouvrir un ticket de panne rapidement
- **Tech** : voir tout le parc du site d’un scan (pas une seule machine)

Pas encore dans le code (aujourd’hui le QR ne pointe que vers un `eq=`).

---

## 2. Pointage temps réel, GPS & trajets

De la **prise du véhicule** au **retour chez soi**.

- Validation début de journée / démarrage véhicule
- Temps de trajet, temps sur site / intervention, pauses, trajet retour domicile
- Export propre des heures pour la **pré-paie**

**Rappel produit / légal :** pas de tracking GPS 24/7. Pointage volontaire + GPS **au moment du pointage** (CNIL / France). Issam devait encore préciser les règles métier — les demander avant de coder.

---

## 3. Sécurité PTI / DATI (travailleur isolé)

- Détection perte de verticalité ou immobilité prolongée (chute, malaise en local technique ou toiture-terrasse)
- Alarme sonore locale
- Relais d’alerte SMS / serveur vers l’astreinte ou le responsable
- Doit rester utilisable **hors réseau / mode déconnecté**

Pas encore dans le code.

---

## 4. Contrats de maintenance P1–P4 & 3ᵉ PDF *(ne pas oublier)*

C’est le chantier annoncé avec le tableau « tous types de contrats / grands établissements ».

### Saisie guidée avec le client

- Niveaux **P1 / P2 / P3 / P4** (énergie, main-d’œuvre, pièces, gros travaux)
- Fréquences mensuelle / trimestrielle / **custom** (mensuel et trimestriel existent déjà sur le contrat ; custom non)
- Machines couvertes **explicitement** (aujourd’hui : client + sites seulement, pas d’IDs équipements)

### Signature écran → PDF contrat immédiat

Aujourd’hui :

1. Texte de contrat signable **dans l’app**, **sans export PDF contrat**
2. PDF de **fiche visite** (clim/PAC, chaufferie P2/P3 registre, CTA/VMC)

**3ᵉ PDF à faire :** quand tous les points du contrat sont cochés avec le client → PDF contrat complet pré-rempli (opérateur, client, sites, périodicité, P1–P4, machines, prestations, signatures).

### OT préventifs auto

- Générer les OT de visite **J-30** dans l’agenda des techs
- Aujourd’hui : rappel agenda « prendre RDV » ~14 jours, **pas d’OT auto**

Fichiers actuels : `src/lib/contratMaintenance.ts`, `src/pages/ContratsMaintenancePage.tsx`, `src/lib/agenda.ts`.

---

## Hors scope de cette liste (ne pas mélanger)

- Ne pas merger une PR sans **« lance maj »**
- Loula / Vapi : autre sujet, seulement si Issam le demande
- GPS / PTI : attendre les règles métier + unités renouvelées
