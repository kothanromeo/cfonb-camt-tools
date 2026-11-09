---
title: "Le format MT940 expliqué : les champs :20:, :25:, :60F:, :61:, :86: et :62F:"
seoTitle: "Format MT940 : structure du relevé SWIFT champ par champ"
description: "Le relevé SWIFT MT940 champ par champ : :20:, :25:, :28C:, :60F:, :61:, :86:, :62F:, le décodage de la ligne :61:, les annulations RC/RD et les formats du :86:."
keywords: ["format mt940", "mt940 structure", "mt940 champ 61", "mt940 champ 86", "mt940 :60f: :62f:", "swift mt940", "mt940 explication", "mt940 rc rd", "mt940 ntrf", "relevé swift", "mt940 vs camt.053", "mt940 eref name remi"]
published: 2026-11-10
faq:
  - q: "MT940 ou MT942 : quelle différence ?"
    a: "<p>Le MT940 est le relevé de fin de journée, avec des soldes définitifs. Le MT942 est un relevé intrajournalier, qui donne les opérations au fil de la journée. C’est l’équivalent du couple camt.053 / camt.052 en ISO 20022.</p>"
  - q: "Le MT940 va-t-il disparaître ?"
    a: "<p>Les messages SWIFT MT migrent progressivement vers l’ISO 20022, et le camt.053 est le successeur naturel du MT940. Le calendrier dépend des banques et des flux : renseignez-vous auprès de la vôtre avant de lancer un nouveau développement, et privilégiez le camt.053 s’il est proposé.</p>"
---

Le **MT940** (*Customer Statement Message*) est le relevé de compte du réseau SWIFT. Créé pour les échanges entre banques et grandes entreprises, il est devenu un standard de fait bien au-delà : la plupart des banques européennes le proposent, et beaucoup de logiciels de trésorerie le lisent nativement. En France, il coexiste avec le [CFONB 120](/guides/format-cfonb-120/) et le [camt.053](/guides/camt-053-explication/).

## La structure générale

Un MT940 est une suite de **champs étiquetés**, une étiquette par début de ligne, entre deux-points :

| Champ | Nom | Contenu |
|---|---|---|
| `:20:` | Référence | Identifiant du message, choisi par la banque |
| `:21:` | Référence liée | Facultatif |
| `:25:` | Compte | IBAN, ou code banque et numéro de compte |
| `:28C:` | Numéro de relevé | Numéro / séquence, par exemple `10/1` |
| `:60F:` ou `:60M:` | Solde initial | F = premier relevé de la période, M = relevé intermédiaire |
| `:61:` | Ligne d’opération | Une par opération |
| `:86:` | Information | Détail de l’opération qui précède |
| `:62F:` ou `:62M:` | Solde final | Comptable |
| `:64:` | Solde disponible | Facultatif |
| `:65:` | Solde disponible à terme | Facultatif, répétable |

Un fichier peut enchaîner plusieurs relevés, chacun commençant par `:20:`. Quand il vient directement du réseau SWIFT, chaque message est entouré d’une **enveloppe** : `{1:…}{2:…}{4:` puis le texte, puis `-}`.

## Les soldes : :60F: et :62F:

```text
:60F:C260930EUR3250,75
```

| Partie | Valeur | Sens |
|---|---|---|
| `C` | C ou D | Solde créditeur ou débiteur |
| `260930` | AAMMJJ | 30 septembre 2026 |
| `EUR` | Devise | |
| `3250,75` | Montant | Virgule décimale, sans signe |

Le contrôle de base est le même que pour tout relevé : **solde :60F: + opérations = solde :62F:**.

## La ligne d’opération : :61:

C’est le champ le plus dense, et le plus mal compris. Il est entièrement positionnel :

```text
:61:2610011001C2400,00NTRFVIR0001//2026000001
```

| Partie | Exemple | Contenu |
|---|---|---|
| Date de valeur | `261001` | AAMMJJ, obligatoire |
| Date de comptabilisation | `1001` | MMJJ, facultative (l’année se déduit de la date de valeur) |
| Sens | `C` | `C` crédit, `D` débit, `RC` annulation de crédit, `RD` annulation de débit |
| Code fonds | | Une lettre facultative (3<sup>e</sup> lettre du code devise) |
| Montant | `2400,00` | Virgule décimale |
| Type d’opération | `NTRF` | Une lettre (`N`, `F` ou `S`) suivie d’un code de 3 caractères |
| Référence client | `VIR0001` | `NONREF` si absente |
| Référence banque | `//2026000001` | Facultative, après deux barres obliques |
| Détails | | Facultatifs, sur la ligne suivante |

Deux pièges classiques :

- **Le passage d’année.** Une opération de valeur 31/12 comptabilisée le 02/01 donne `251231` puis `0102` : la date de comptabilisation est dans l’année suivante.
- **Les annulations.** `RC` annule un crédit : l’argent **sort** du compte. `RD` annule un débit : l’argent **revient**. Les traiter comme `C` et `D` fausse le solde.

### Les codes d’opération

Les trois caractères après `N` décrivent la nature de l’opération :

| Code | Signification |
|---|---|
| `TRF` | Virement |
| `DDT` | Prélèvement |
| `CHK` | Chèque |
| `CLR` | Remise de chèques |
| `STO` | Ordre permanent |
| `CHG` | Frais |
| `COM` | Commission |
| `INT` | Intérêts |
| `MSC` | Opération diverse |
| `RTI` | Opération rejetée ou retournée |

Ils sont moins précis que les [codes opérations interbancaires CFONB](/guides/codes-operations-interbancaires-cfonb/) : `TRF` ne dit pas si le virement est reçu ou émis, c’est le sens qui le dit.

## Le détail de l’opération : :86:

Le `:86:` suit le `:61:` qu’il complète. Il tient sur 6 lignes de 65 caractères au plus. Son contenu n’est pas normalisé par SWIFT, et on en rencontre trois formes.

**La forme structurée « SEPA »**, de plus en plus répandue, avec des codes entre barres obliques :

```text
:86:/EREF/F2026118/NAME/ATELIER BOIS ET CIE/REMI/FACTURE F-2026-118
```

`EREF` est la référence de bout en bout, `NAME` le nom du tiers, `REMI` le motif. On trouve aussi `IBAN`, `BIC`, `MREF` (mandat de prélèvement), `CRED` (identifiant créancier) ou `PURP` (objet du paiement).

**La forme à sous-champs**, très utilisée par les banques allemandes, avec un code numérique de transaction suivi de sous-champs `?nn` :

```text
:86:166?00SEPA-UEBERWEISUNG?20EREF+ABC123 SVWZ+Rechnung 42?32MUSTERMANN GMBH
```

`?00` est le libellé de l’opération, `?20` à `?29` le motif, `?31` l’IBAN du tiers et `?32`-`?33` son nom.

**Le texte libre**, enfin, que chaque banque rédige à sa façon.

Le [convertisseur MT940](/convertir-mt940-excel/) reconnaît les trois et répartit les informations dans les colonnes « Tiers », « Référence de bout en bout » et « Informations complémentaires » du fichier Excel.

## MT940, CFONB 120 ou camt.053 ?

Les trois décrivent la même chose. Le MT940 est plus riche que le CFONB 120 sur les données SEPA, grâce au `:86:` structuré, mais moins que le camt.053, qui consacre un champ dédié à chaque information. Pour un nouveau projet, le camt.053 est le choix le plus durable ; pour lire ce que vous recevez aujourd’hui, le convertisseur accepte les trois et produit le même tableau.
