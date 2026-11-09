---
title: "Codes opérations interbancaires CFONB : la liste complète expliquée"
seoTitle: "Codes opérations interbancaires CFONB (01, 05, 06, B1, A1…) : liste complète"
description: "Liste complète des codes opérations interbancaires CFONB (01 chèques, 05 virements reçus, B1 prélèvements SEPA…) et comment les utiliser."
keywords: ["codes opérations interbancaires cfonb", "code opération cfonb", "code opération 05 virement reçu", "code b1 prélèvement sepa", "code a1 cfonb", "liste codes cfonb", "code opération bancaire relevé", "cfonb 120 code opération", "code interbancaire relevé de compte", "rapprochement bancaire code opération"]
published: 2026-11-09
faq:
  - q: "Où se trouve le code opération dans un fichier CFONB 120 ?"
    a: "<p>En positions 33 et 34 des enregistrements 04 (mouvement) et 05 (complément). Ne le confondez pas avec le code opération interne de la banque, en positions 8 à 11, qui n’est pas normalisé.</p>"
  - q: "Pourquoi certains codes contiennent-ils une lettre ?"
    a: "<p>Les codes historiques sont numériques. Les codes créés à partir de 2010 pour les opérations SEPA sont alphanumériques : A1 à A6 pour les prélèvements SEPA émis et leurs retours, B1 à B6 pour les prélèvements SEPA reçus.</p>"
  - q: "Le code opération est-il présent dans un relevé camt.053 ?"
    a: "<p>Souvent, oui : de nombreuses banques françaises reprennent le code CFONB dans la zone propriétaire du code de transaction (BkTxCd/Prtry), en plus du code ISO 20022. Le convertisseur l’utilise quand il est disponible.</p>"
---

Dans un relevé bancaire CFONB, chaque opération porte un **code opération interbancaire** sur deux caractères. Ce code est commun à toutes les banques françaises : `05` veut dire « virement reçu » à la Société Générale comme au Crédit Agricole. C’est ce qui en fait l’outil idéal pour classer automatiquement les opérations, bien plus fiable que le libellé.

Cette page donne la liste complète des codes, regroupés par famille, telle qu’elle figure dans les tables publiées par les banques à partir de la brochure CFONB *Codes opérations pour les restitutions clientèles*.

## Où trouver le code dans le fichier

- **CFONB 120** : positions 33 et 34 des enregistrements `04` (mouvement) et `05` (complément). Le détail du format est dans [le guide du CFONB 120](/guides/format-cfonb-120/).
- **camt.053** : quand la banque le fournit, dans `BkTxCd/Prtry/Cd`, souvent avec `Issr` à `CFONB`.

Il existe aussi un **code opération interne** (positions 8 à 11 du CFONB 120). Celui-là est propre à chaque banque : utile pour affiner, mais à ne jamais utiliser seul si vous travaillez avec plusieurs banques.

## Codes génériques et codes détaillés

Certains codes regroupent une famille entière, d’autres la détaillent. Par exemple :

- `05` (virements reçus) est **générique** ; `13` (virements de trésorerie reçus), `18` (autres virements reçus) et `39` (virements d’origine extérieure) le précisent ;
- `08` (prélèvements, TIP et télérèglements domiciliés) est générique ; `22`, `23`, `96`, `B1` et `B2` le précisent.

Selon sa banque et son offre, vous recevrez le code générique ou le code détaillé. Une règle de rapprochement robuste doit donc accepter les deux.

## La liste complète

### Opérations de caisse

| Code | Libellé |
|---|---|
| `01` | Chèques payés |
| `02` | Remises de chèques |
| `03` | Chèques impayés |
| `04` | Versements espèces |
| `05` | Virements reçus |
| `06` | Virements émis |
| `07` | LCR / BOR domiciliés |
| `08` | Prélèvements, TIP et télérèglements domiciliés |
| `09` | Prélèvements, TIP et télérèglements émis |
| `10` | Prélèvements, TIP et télérèglements rejetés / impayés |
| `11` | Factures cartes de paiement / DAB-GAB |
| `12` | Rejets / retours de virement |
| `13` | Virements de trésorerie reçus |
| `14` | Virements de trésorerie émis |
| `15` | Remises de chèques sur caisse |
| `18` | Autres virements reçus |
| `21` | Autres virements émis |
| `22` | TIP domiciliés |
| `23` | Prélèvements domiciliés |
| `24` | TIP émis |
| `25` | Prélèvements émis |
| `26` | TIP rejetés / impayés |
| `27` | Prélèvements rejetés / impayés |
| `28` | Factures cartes payées |
| `29` | Retraits DAB-GAB |
| `30` | Factures cartes remises |
| `36` | Remises de factures CB crédit |
| `38` | Factures CB impayées / rejetées |
| `39` | Virements d’origine extérieure (VOE) reçus |
| `90` | VCOM émis |
| `92` | Centralisation de recettes |
| `93` | Centralisation de dépenses |
| `94` | Centralisation de trésorerie (crédit) |
| `95` | Centralisation de trésorerie (débit) |
| `96` | Télérèglements domiciliés |
| `97` | Télérèglements émis |
| `98` | Télérèglements rejetés / impayés |
| `A1` | Prélèvements SEPA émis |
| `A2` | Prélèvements SEPA interentreprises émis |
| `A3` | Prélèvements SEPA rejetés / impayés émis (R-transaction) |
| `A4` | Prélèvements SEPA interentreprises rejetés / impayés émis (R-transaction) |
| `A5` | Prélèvements SEPA : reversements émis (R-transaction) |
| `A6` | Prélèvements SEPA interentreprises : reversements émis (R-transaction) |
| `B1` | Prélèvements SEPA domiciliés |
| `B2` | Prélèvements SEPA interentreprises domiciliés |
| `B3` | Prélèvements SEPA rejetés / impayés reçus (R-transaction) |
| `B4` | Prélèvements SEPA interentreprises rejetés / impayés reçus (R-transaction) |
| `B5` | Prélèvements SEPA : reversements reçus (R-transaction) |
| `B6` | Prélèvements SEPA interentreprises : reversements reçus (R-transaction) |

### Portefeuille France

| Code | Libellé |
|---|---|
| `31` | Remises d’effets à l’encaissement |
| `32` | Remises à l’escompte (papier commercial / chèque) |
| `33` | Effets impayés |
| `34` | Incidents sur effets |
| `35` | Remises de LCR / BOR à l’encaissement |
| `37` | Remises de LCR / BOR à l’escompte |

### Opérations avec l’étranger

| Code | Libellé |
|---|---|
| `41` | Transferts vers / en provenance de l’étranger |
| `42` | Achats / ventes de devises |
| `43` | Autres opérations avec l’étranger |
| `44` | Transferts émis |
| `45` | Transferts reçus |
| `46` | Achats de devises au comptant |
| `47` | Ventes de devises au comptant |
| `48` | Levées sur achat à terme |
| `49` | Livraisons sur vente à terme |
| `68` | Autres opérations avec l’étranger (débit) |
| `69` | Autres opérations avec l’étranger (crédit) |

### Titres et bourse

| Code | Libellé |
|---|---|
| `51` | Achats et ventes de titres |
| `52` | Diverses opérations sur titres |
| `53` | Achats / souscriptions de valeurs mobilières (Bourses françaises) |
| `54` | Ventes de valeurs mobilières (Bourses françaises) |
| `55` | Solde de liquidation (Bourses françaises) |
| `56` | Achats OPCVM |
| `57` | Ventes OPCVM |
| `58` | Achats TCN |
| `59` | Ventes TCN |
| `80` | Achats autres titres de créance |
| `81` | Ventes autres titres de créance |
| `82` | Contrats |
| `83` | Options |
| `84` | Achats Bourses étrangères |
| `85` | Ventes Bourses étrangères |
| `86` | Opérations sur titres |
| `87` | Revenus sur titres |
| `88` | Commissions et droits de garde |
| `89` | Remboursement d’impôts étrangers |

### Agios et frais

| Code | Libellé |
|---|---|
| `61` | Agios |
| `62` | Commissions et frais divers |
| `63` | Produits financiers |
| `64` | Commissions y compris taxes |
| `65` | Commissions hors taxes |
| `66` | Commissions non taxables |
| `67` | Taxes |
| `70` | Charges financières |

### Financement et blocage

| Code | Libellé |
|---|---|
| `71` | Tirage de crédits |
| `72` | Échéance de crédits |
| `73` | Émission de valeurs mobilières |
| `74` | Émission de titres de créances |
| `75` | Remboursement |
| `76` | Dépôt à terme |
| `77` | Échéance de dépôt à terme |

### Divers

| Code | Libellé |
|---|---|
| `91` | Opérations diverses |
| `99` | Annulations et régularisations |


## Les codes SEPA en détail

Les codes alphanumériques ont été créés pour les prélèvements SEPA, qui ont remplacé les anciens avis de prélèvement :

- `A1` et `A2` : vous êtes **créancier** et vous encaissez des prélèvements (SEPA Core et SEPA interentreprises, dit B2B) ;
- `B1` et `B2` : vous êtes **débiteur** et un fournisseur vous prélève ;
- `A3` à `A6` et `B3` à `B6` : les **R-transactions**, c’est-à-dire les rejets, retours, refus et remboursements qui suivent un prélèvement.

Un `B3` sur le relevé d’un créancier signale donc un prélèvement revenu impayé : c’est le code à surveiller pour relancer un client.

## Utiliser les codes pour automatiser

Quelques usages concrets :

1. **Pré-affecter les comptes comptables** : `61` (agios) vers le compte de charges financières, `62` à `67` vers les frais bancaires, `05` vers le compte d’attente clients.
2. **Isoler les incidents** : `03` (chèques impayés), `10`, `27`, `B3`/`B4` (prélèvements rejetés), `12` (virements retournés), `33` (effets impayés).
3. **Suivre la trésorerie** par nature : encaissements clients, décaissements fournisseurs, opérations financières.

Le [convertisseur](/convertir-cfonb-120-excel/) ajoute à chaque ligne exportée le code et son libellé. Dans Excel, un simple filtre ou un tableau croisé dynamique sur la colonne « Type d’opération » suffit pour ventiler un mois d’opérations.
