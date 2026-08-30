# Prochain codage ClimaZEN (Issam)

**Ne pas tout coder d’un coup.** Points 1–4 : attendre qu’Issam dise de lancer. **Demain 31/08/2026 : points 5 et 6.**

Sauvegardé le 29/08/2026, complété le 30/08/2026. Feuille de route — **ne pas tout coder d’un coup**.

**Demain (31/08/2026) :**
- **5** — tâches sous-traitant / réglementaires + registre de sécurité
- **6** — Accueil : courbes et indicateurs (préventif / curatif + vue société)

Les points 1–4 restent en attente d’un « lance » explicite (sauf si Issam dit autrement).

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

## 5. Contrats — tâches sous-traitant & réglementaires + registre de sécurité *(demain 31/08)*

Demandé le 30/08/2026 : à coder **prochainement (demain)**.

### Ce qu’Issam veut

Sur les **contrats de maintenance**, une **configuration propre** des tâches souvent faites par un **sous-traitant** (pas le tech ClimaZEN) :

- Contrôle **disconnecteur** (eau potable)
- **Ramonage** (corps de chauffe, carneaux — ramoneur)
- Et le reste du même type : attestations réglementaires (gaz, électriques, analyses d’eau / légionelle, extincteurs, etc. — catalogue configurable, pas une liste figée dans le contrat texte)

Ces tâches **réglementaires** doivent s’afficher **proprement sur le dossier maintenance** (site / contrat) : qui les fait (nous / sous-traitant), périodicité, dernière date, prochaine échéance, pièce jointe (attestation).

Pour **ces tâches-là**, **avertir le tech** qu’il doit **remplir le registre de sécurité** (ERP / copro) — pas seulement cocher la fiche visite.

### État actuel (ne pas confondre)

- Fiche chaufferie : points **disconnecteur** (inspection visuelle semestrielle) et **ramonage** (annuel) = checklist **faite par le tech** sur la visite P2/P3. Ce n’est **pas** une config contrat « sous-traitant + attestation + registre ».
- Contrats : liste de **prestations en texte libre**, pas de type de tâche, pas de sous-traitant, pas de registre.
- OT : origine « sous-traitance » = **donneur d’ordre / client payeur**, pas un ramoneur / contrôleur disconnecteur.
- **Aucun** écran « registre de sécurité » ni alerte dédiée au tech.

### À construire (demain)

1. **Catalogue de tâches réglementaires** (config gérant) : disconnecteur, ramonage, + autres (extensible). Pour chaque : périodicité, **exécutant = nous | sous-traitant**, obligatoire registre de sécurité oui/non.
2. **Lier au contrat / dossier maintenance du site** : affichage clair (pas noyé dans le texte du contrat).
3. **Alerte tech** quand une de ces tâches est due ou vient d’être faite : « Pensez à remplir le **registre de sécurité** du site » (bandeau + sur l’OT / fiche).
4. Pouvoir noter le sous-traitant (nom, date, n° attestation) sans inventer un module facture.

Ne pas mélanger avec P1–P4 / PDF contrat (point 4) : ici c’est le **suivi d’obligations** et le **registre**, pas le niveau de prestation.

---

## 6. Accueil — courbes, graphiques et indicateurs société *(demain 31/08)*

Demandé le 30/08/2026 : améliorer la **page Accueil** pour une **vue globale** qui facilite le pilotage de la société — **pas seulement des raccourcis**.

### Ce qu’Issam veut

- **Courbes et graphiques** lisibles (mobile + bureau)
- Avancement du travail **préventif** vs **curatif** (dépannage)
- Tous les **indicateurs utiles** pour le gérant : charge, retards, contrats, stock, équipe — une photo de l’activité, pas une liste d’OT à reprendre

### État actuel (v140)

L’accueil (`src/pages/Dashboard.tsx`) est opérationnel terrain :
- icônes / raccourcis
- bandeaux alertes (RH, étalonnage, matériel à réceptionner, agenda)
- OT / CERFA à reprendre

**Aucun graphique.** Pas de split préventif / curatif. L’avancement existe **par OT** (`avancementPct`), pas en courbe société. Les OT ont une origine commerciale (`depannage_urgence`, contrat, etc. dans `chaineCommerciale.ts`) — on pourra s’en servir pour classer curatif vs préventif, mais ce n’est pas agrégé aujourd’hui.

Pas de librairie de charts dans le projet (pas de Recharts / Chart.js).

### À construire (demain)

Tableau de bord gérant sur l’Accueil (ou bloc dédié au-dessus des icônes) :

1. **Préventif vs curatif** — part des OT / visites (camembert ou barres), et **avancement** des maintenances sous contrat (fait / dû / en retard).
2. **Courbe dans le temps** — volume d’interventions sur 4–12 semaines (préventif / curatif empilé).
3. **Indicateurs utiles** (cartes chiffrées, cliquables) :
   - OT ouverts / en retard / clôturés (semaine / mois)
   - visites contrat à venir (J-30) vs déjà faites
   - CERFA brouillons
   - stock fluide (kg, consignes, alertes)
   - étalonnage outillage bientôt / expiré
   - docs RH bientôt / expirés
   - charge par tech (si simple à dériver des OT)
4. Vue **gérant = toute la société** ; tech = **ses** chiffres seulement.
5. Reste lisible au téléphone (pas un écran Excel).

Ne pas attendre le point 4 (OT auto J-30) pour afficher le préventif : s’appuyer sur les contrats signés + OT existants.

---

## Hors scope de cette liste (ne pas mélanger)

- Ne pas merger une PR sans **« lance maj »**
- Loula / Vapi : autre sujet, seulement si Issam le demande
- GPS / PTI : attendre les règles métier + unités renouvelées
