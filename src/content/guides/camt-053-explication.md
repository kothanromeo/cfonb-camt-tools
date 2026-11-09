---
title: "Comprendre un relevé camt.053 (ISO 20022) : soldes, écritures et codes"
seoTitle: "camt.053 expliqué : lire un relevé bancaire XML ISO 20022"
description: "Lire un relevé camt.053 : structure du XML, soldes OPBD et CLBD, écritures Ntry, sens CRDT/DBIT, codes de transaction, différences avec camt.052 et camt.054."
keywords: ["camt.053", "camt.053 explication", "lire camt.053", "camt.053 structure", "iso 20022 relevé bancaire", "bank to customer statement", "camt.053 opbd clbd", "camt.053 ntry", "camt.052 camt.053 camt.054 différence", "bktxcd camt.053", "relevé xml banque"]
published: 2026-11-09
faq:
  - q: "Quelle différence entre camt.052, camt.053 et camt.054 ?"
    a: "<p>Le camt.053 est le relevé de fin de journée, avec des soldes définitifs. Le camt.052 est un relevé intrajournalier : il montre les opérations au fil de la journée et ses soldes sont provisoires. Le camt.054 est un avis de débit ou de crédit qui détaille des opérations, par exemple le contenu d’une remise de prélèvements.</p>"
  - q: "Que signifie le statut PDNG ?"
    a: "<p>Pending : l’écriture est en attente et pas encore comptabilisée définitivement. Elle ne doit pas entrer dans le calcul du solde. Le statut BOOK signifie comptabilisée, INFO une information sans impact sur le solde.</p>"
  - q: "Où trouver le nom du client qui m’a payé ?"
    a: "<p>Dans le détail de la transaction : NtryDtls/TxDtls/RltdPties/Dbtr pour un crédit (le débiteur, c’est celui qui paie), et RltdPties/Cdtr pour un débit (le créancier, celui que vous payez). Selon la version du schéma, le nom est directement dans Nm ou dans Pty/Nm.</p>"
---

Le **camt.053** est le relevé de compte au format **ISO 20022**, la norme internationale des messages financiers. Son nom officiel est *BankToCustomerStatement* : c’est la banque qui raconte au client ce qui s’est passé sur son compte. Il remplace progressivement les formats nationaux comme le CFONB 120 en France et le MT940 de SWIFT à l’international.

Là où le CFONB tient une opération en une ligne de 120 caractères, le camt.053 la décrit en XML, avec bien plus de détail : tiers, références, motif complet. C’est plus riche, mais difficile à lire sans outil.

## La structure générale

Un fichier camt.053 suit cette arborescence :

```text
Document
└── BkToCstmrStmt
    ├── GrpHdr            en-tête du message (identifiant, date de création)
    └── Stmt              un relevé (un compte, une période) — il peut y en avoir plusieurs
        ├── Id            identifiant du relevé
        ├── Acct          le compte : IBAN, devise, titulaire, banque
        ├── Bal           les soldes (plusieurs)
        ├── TxsSummry     le récapitulatif : nombre d’écritures, totaux
        └── Ntry          une écriture (autant que d’opérations)
            └── NtryDtls
                └── TxDtls   le détail d’une transaction (tiers, références, motif)
```

L’élément racine porte la version du schéma dans son espace de noms, par exemple `urn:iso:std:iso:20022:tech:xsd:camt.053.001.08`. Les versions diffèrent sur des détails (la façon de nommer les tiers, la forme du statut), pas sur l’esprit.

## Les soldes (Bal)

Chaque solde a un type, un montant, un sens et une date :

```xml
<Bal>
  <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
  <Amt Ccy="EUR">3250.75</Amt>
  <CdtDbtInd>CRDT</CdtDbtInd>
  <Dt><Dt>2026-09-30</Dt></Dt>
</Bal>
```

Les types les plus fréquents :

| Code | Signification |
|---|---|
| `OPBD` | Solde d’ouverture comptable (*opening booked*) |
| `PRCD` | Solde de clôture précédent, utilisé par certaines banques à la place d’OPBD |
| `CLBD` | Solde de clôture comptable (*closing booked*) |
| `CLAV` | Solde de clôture disponible |
| `ITBD` | Solde intermédiaire en cours de journée (camt.052) |
| `FWAV` | Solde disponible prévisionnel |

Le montant n’est **jamais négatif** dans un camt.053 : c’est `CdtDbtInd` qui donne le sens. `CRDT` pour un solde créditeur, `DBIT` pour un découvert.

## Les écritures (Ntry)

Une écriture correspond à une ligne de votre relevé :

| Élément | Contenu |
|---|---|
| `Amt` | Montant, toujours positif, avec la devise en attribut |
| `CdtDbtInd` | `CRDT` (entrée d’argent) ou `DBIT` (sortie) |
| `Sts` | Statut : `BOOK` comptabilisée, `PDNG` en attente, `INFO` information |
| `BookgDt` | Date de comptabilisation |
| `ValDt` | Date de valeur |
| `AcctSvcrRef` | Référence de l’écriture chez la banque |
| `BkTxCd` | Code de transaction bancaire |
| `NtryDtls` | Détail des transactions |
| `AddtlNtryInf` | Libellé de l’écriture, souvent celui du relevé papier |

### Le code de transaction (BkTxCd)

Il peut prendre deux formes, souvent présentes ensemble :

- **le code ISO structuré** : un domaine, une famille et une sous-famille. `PMNT / RCDT / ESCT` se lit « paiement, virement reçu, virement SEPA » ; `PMNT / IDDT / ESDD` « paiement, prélèvement émis, prélèvement SEPA » ;
- **le code propriétaire** (`Prtry`) : en France, de nombreuses banques y placent le code opération CFONB, par exemple `05` pour un virement reçu. C’est pratique pour garder les mêmes règles de rapprochement qu’avec le [CFONB 120](/guides/codes-operations-interbancaires-cfonb/).

### Le détail des transactions (TxDtls)

C’est là que se trouve l’information la plus utile pour la comptabilité :

- `Refs/EndToEndId` : la référence de bout en bout, saisie par le payeur. Pour un virement client, c’est souvent votre numéro de facture. `NOTPROVIDED` signifie qu’elle n’a pas été renseignée ;
- `Refs/MndtId` : la référence du mandat, pour un prélèvement SEPA ;
- `RltdPties/Dbtr` et `RltdPties/Cdtr` : le débiteur (qui paie) et le créancier (qui reçoit) ;
- `RmtInf/Ustrd` : le motif libre, jusqu’à 140 caractères ;
- `RmtInf/Strd` : le motif structuré, par exemple une référence créancier normalisée.

Une écriture peut contenir **plusieurs TxDtls** : c’est le cas d’une remise groupée (*batch booking*), où la banque passe une seule écriture pour cent prélèvements encaissés, et détaille chacun d’eux.

## Le récapitulatif (TxsSummry)

Il annonce le nombre total d’écritures et leur total net. C’est un excellent moyen de vérifier qu’un fichier est complet : si le nombre d’écritures lues ne correspond pas au nombre annoncé, le fichier a été tronqué.

## Vérifier un camt.053

Trois contrôles suffisent à détecter la plupart des problèmes :

1. **Soldes** : OPBD + écritures comptabilisées = CLBD ;
2. **Nombre d’écritures** : identique à `TxsSummry/TtlNtries/NbOfNtries` ;
3. **Total net** : identique à `TxsSummry/TtlNtries/TtlNetNtry`.

Le [convertisseur camt.053](/convertir-camt-053-excel/) fait ces trois vérifications avant de produire le fichier Excel, et exclut du calcul les écritures en attente.

## camt.052 et camt.054

Les deux autres messages de la famille partagent la même structure d’écritures :

- le **camt.052** (*BankToCustomerAccountReport*) est un relevé en cours de journée. Ses soldes sont intermédiaires (`ITBD`), il est utile pour la trésorerie au fil de l’eau ;
- le **camt.054** (*BankToCustomerDebitCreditNotification*) est un avis d’opération. On le reçoit typiquement pour le détail d’une remise de prélèvements ou de virements.

Le convertisseur lit les trois. La comparaison avec le format CFONB est détaillée dans [CFONB 120 ou camt.053](/guides/cfonb-ou-camt-053/).
