---
title: "Le format CFONB 120 expliqué ligne par ligne (01, 04, 05, 07)"
seoTitle: "Format CFONB 120 : structure du relevé de compte position par position"
description: "Structure du relevé CFONB 120 : enregistrements 01, 04, 05 et 07, position de chaque zone, montants signés et dates JJMMAA, avec un exemple décodé."
keywords: ["format cfonb 120", "cfonb 120 structure", "cfonb 120 positions", "relevé de compte cfonb", "enregistrement 04 cfonb", "enregistrement 05 cfonb", "cfonb 120 montant signé", "cfonb 120 caractères", "norme cfonb relevé", "lire fichier cfonb", "spécification cfonb 120"]
published: 2026-11-09
faq:
  - q: "Que veut dire CFONB ?"
    a: "<p>Comité Français d’Organisation et de Normalisation Bancaires. C’est l’organisme de la place bancaire française qui définit les formats d’échange entre les banques et leurs clients, dont le relevé de compte « 120 caractères ».</p>"
  - q: "Quelle est l’extension d’un fichier CFONB ?"
    a: "<p>Il n’y en a pas d’officielle. Selon la banque ou le logiciel, on rencontre .txt, .dat, .cfonb, .120, .rel ou aucune extension. C’est le contenu qui compte : des lignes de 120 caractères commençant par 01, 04, 05 ou 07.</p>"
  - q: "Un fichier peut-il contenir plusieurs comptes ?"
    a: "<p>Oui. Un fichier peut enchaîner plusieurs relevés, chacun délimité par un enregistrement 01 et un enregistrement 07. C’est courant pour une entreprise qui a plusieurs comptes dans la même banque, ou pour un fichier qui couvre plusieurs jours.</p>"
---

Le relevé de compte CFONB « 120 caractères » est le format historique que les banques françaises utilisent pour transmettre les opérations aux logiciels de comptabilité et de trésorerie. Il date d’une époque où chaque octet comptait, et ça se voit : pas de séparateur, pas d’en-tête, uniquement des zones de longueur fixe.

Ce guide décrit sa structure telle que la définit la norme CFONB *Relevé de compte sur support informatique* (édition de juillet 2004), avec un exemple décodé à la fin.

## Le principe : quatre types de lignes

Chaque ligne fait exactement 120 caractères. Les deux premiers indiquent son type :

| Code | Nom | Rôle |
|---|---|---|
| `01` | Ancien solde | Ouvre le relevé : solde du compte à la fin de la période précédente |
| `04` | Mouvement | Une opération. Il y en a une par écriture |
| `05` | Complément | Information supplémentaire sur le mouvement qui le précède. Facultatif, sans limite de nombre |
| `07` | Nouveau solde | Ferme le relevé : solde à la fin de la période |

Un compte sans opération sur la période donne un relevé de deux lignes seulement, `01` puis `07`. Un même fichier peut contenir plusieurs relevés à la suite : plusieurs comptes, ou plusieurs jours.

## Les zones communes

Les 40 premiers caractères suivent presque le même découpage dans tous les enregistrements :

| Positions | Longueur | Zone |
|---|---|---|
| 1-2 | 2 | Code enregistrement (01, 04, 05, 07) |
| 3-7 | 5 | Code banque |
| 8-11 | 4 | Code opération interne à la banque (04 et 05), zone réservée sinon |
| 12-16 | 5 | Code guichet |
| 17-19 | 3 | Code devise (EUR) |
| 20 | 1 | Nombre de décimales du montant |
| 21 | 1 | Zone réservée |
| 22-32 | 11 | Numéro de compte |
| 33-34 | 2 | Code opération interbancaire (04 et 05), zone réservée sinon |
| 35-40 | 6 | Date (JJMMAA) : date du solde ou date de comptabilisation |

Le code banque, le code guichet et le numéro de compte sont les trois premiers morceaux du RIB. La clé RIB n’apparaît pas.

## L’enregistrement 04 : le mouvement

C’est la ligne la plus riche. Après les 40 premiers caractères :

| Positions | Longueur | Zone |
|---|---|---|
| 41-42 | 2 | Code motif de rejet (seulement pour les impayés et rejets) |
| 43-48 | 6 | Date de valeur (JJMMAA) |
| 49-79 | 31 | Libellé |
| 80-81 | 2 | Zone réservée |
| 82-88 | 7 | Numéro d’écriture (numéro de chèque, de remise ou de pièce, sinon des zéros) |
| 89 | 1 | Indice d’exonération de commission de mouvement (0 ou 1) |
| 90 | 1 | Indice d’indisponibilité (0 = disponible, 1 = indisponible) |
| 91-104 | 14 | Montant signé |
| 105-120 | 16 | Zone référence |

Deux zones méritent qu’on s’y arrête.

**Le code opération interbancaire** (positions 33-34) est normalisé : `05` signifie « virement reçu » dans toutes les banques, `B1` « prélèvement SEPA domicilié », etc. C’est lui qu’il faut utiliser pour classer les opérations automatiquement, pas le libellé, que chaque banque rédige à sa façon et peut changer du jour au lendemain. La liste complète est dans [le guide des codes opérations interbancaires](/guides/codes-operations-interbancaires-cfonb/).

**Le code opération interne** (positions 8-11) est propre à chaque banque. Il apporte une précision supplémentaire, mais il n’a pas de sens d’une banque à l’autre.

## L’enregistrement 05 : le complément

Les positions 3 à 40 d’un complément reprennent celles du mouvement auquel il se rattache. Ensuite :

| Positions | Longueur | Zone |
|---|---|---|
| 41-45 | 5 | Zone réservée |
| 46-48 | 3 | Qualifiant : la nature de l’information |
| 49-118 | 70 | Information complémentaire |
| 119-120 | 2 | Zone réservée |

La norme définit deux qualifiants, `LIB` (libellé complémentaire libre) et `MMO` (montant et monnaie d’origine, pour une opération en devise). Avec l’arrivée du SEPA, les banques ont ajouté des qualifiants pour transporter les données des virements et prélèvements. Les plus courants :

| Qualifiant | Contenu habituel |
|---|---|
| `NPY` | Nom du payeur |
| `NBE` | Nom du bénéficiaire |
| `LCC` | Motif saisi par le client (« Facture 2026-118 ») |
| `RCN` | Référence de bout en bout (End-to-End) |
| `RUM` | Référence unique du mandat de prélèvement |
| `ICS` | Identifiant créancier SEPA |
| `REF` | Référence de l’opération |

L’usage exact varie selon les banques : il vaut mieux traiter un qualifiant inconnu comme un simple texte que d’en deviner le sens.

## Les enregistrements 01 et 07 : les soldes

Après les 40 premiers caractères, les soldes n’ont qu’une zone utile : le montant, en positions 91 à 104. Tout le reste est réservé. La date (35-40) est celle du solde.

Le solde du `07` d’un relevé est repris comme `01` du relevé suivant. Et surtout, chaque relevé doit vérifier :

> ancien solde (01) + somme des mouvements (04) = nouveau solde (07)

Si l’égalité n’est pas respectée, il manque des lignes ou le fichier a été altéré. C’est le premier contrôle que fait [le convertisseur CFONB 120](/convertir-cfonb-120-excel/).

## Les montants : le signe caché dans la dernière lettre

Le montant occupe 14 caractères, cadré à droite et complété par des zéros. Il n’y a ni virgule ni signe moins : le nombre de décimales est donné en position 20 (presque toujours 2), et le signe est **superposé au dernier chiffre**. En ASCII, ce dernier caractère devient :

| Dernier chiffre | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Montant positif (crédit) | `{` | `A` | `B` | `C` | `D` | `E` | `F` | `G` | `H` | `I` |
| Montant négatif (débit) | `}` | `J` | `K` | `L` | `M` | `N` | `O` | `P` | `Q` | `R` |

Exemples avec 2 décimales :

- `0000000024000{` → les chiffres sont `00000000240000`, le signe est positif : **+2 400,00**
- `0000000018642K` → `K` vaut −2, les chiffres sont `00000000186422` : **−1 864,22**

C’est un héritage des cartes perforées et du codage EBCDIC des gros systèmes. C’est aussi la raison pour laquelle un fichier CFONB ouvert dans Excel affiche des montants incompréhensibles.

## Les dates

Toutes les dates sont au format `JJMMAA` sur 6 caractères : `311026` pour le 31 octobre 2026. Il y a en général deux dates par mouvement : la **date de comptabilisation** (le jour où la banque a passé l’écriture) et la **date de valeur** (celle qui sert au calcul des intérêts). Pour un rapprochement bancaire, c’est la date de comptabilisation qui correspond à ce que vous voyez sur le relevé papier.

## Un exemple décodé

Voici un mouvement complet, découpé zone par zone :

```text
0412345000000123EUR2 0001234567805011026  011026VIR SEPA RECU /DE ATELIER BOIS   0000000000000000024000{VIR0001
```

| Zone | Valeur | Signification |
|---|---|---|
| 1-2 | `04` | Mouvement |
| 3-7 | `12345` | Code banque |
| 8-11 | `0000` | Code opération interne |
| 12-16 | `00123` | Code guichet |
| 17-19 | `EUR` | Euros |
| 20 | `2` | 2 décimales |
| 22-32 | `00012345678` | Numéro de compte |
| 33-34 | `05` | Virement reçu |
| 35-40 | `011026` | Comptabilisé le 01/10/2026 |
| 43-48 | `011026` | Valeur au 01/10/2026 |
| 49-79 | `VIR SEPA RECU /DE ATELIER BOIS` | Libellé |
| 82-88 | `0000000` | Pas de numéro d’écriture |
| 91-104 | `0000000024000{` | +2 400,00 € |
| 105-120 | `VIR0001` | Référence |

Suivi de trois compléments `NPY ATELIER BOIS ET CIE`, `LCC FACTURE F-2026-118` et `RCN F2026118`, le convertisseur en fait une ligne Excel : 01/10/2026, virement reçu de l’Atelier Bois et Cie, +2 400,00 €, motif « Facture F-2026-118 ».

## Les pièges classiques

- **Les espaces de fin supprimés.** Un éditeur de texte ou un transfert FTP en mode texte peut raccourcir les lignes. Les positions restent justes tant qu’on complète la ligne avec des espaces.
- **Le fichier sans retour à la ligne.** Certains systèmes livrent un bloc continu ; il suffit de le découper tous les 120 caractères.
- **L’encodage.** Les relevés sont en général en ASCII ou en Windows-1252 ; les accents sont rares mais possibles dans les libellés.
- **Le libellé utilisé comme clé.** Il change selon les banques et dans le temps. Pour automatiser, utilisez le code opération interbancaire.
