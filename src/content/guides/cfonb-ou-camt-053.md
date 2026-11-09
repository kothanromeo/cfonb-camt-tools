---
title: "CFONB 120 ou camt.053 : quelles différences, et lequel demander à sa banque ?"
seoTitle: "CFONB 120 ou camt.053 : différences et passage à l’ISO 20022"
description: "CFONB 120 et camt.053 comparés : contenu, données SEPA, compatibilité des logiciels. Lequel demander à sa banque, et ce que change l’ISO 20022."
keywords: ["cfonb ou camt.053", "cfonb 120 vs camt.053", "différence cfonb camt", "passage iso 20022 relevé", "migration cfonb iso 20022", "relevé bancaire format", "camt.053 france", "remplacer cfonb 120", "mt940 camt.053", "format relevé ebics"]
published: 2026-11-09
faq:
  - q: "Le CFONB 120 va-t-il disparaître ?"
    a: "<p>Le mouvement vers l’ISO 20022 est engagé, mais je n’ai pas trouvé de date officielle de fin pour le relevé CFONB 120 de la banque domestique. Le CFONB a publié un guide d’utilisation du camt.053 pour la place française. Pour un nouveau projet, demandez le camt.053 ; pour un existant, vérifiez auprès de votre banque son calendrier.</p>"
  - q: "Comment récupérer mes relevés au format camt.053 ?"
    a: "<p>Généralement via votre contrat de banque à distance (EBICS ou espace web entreprise). Il suffit souvent de demander à votre conseiller d’activer le format camt.053 en plus, ou à la place, du CFONB 120.</p>"
  - q: "Mon logiciel de comptabilité accepte-t-il le camt.053 ?"
    a: "<p>La plupart des logiciels récents l’acceptent. Pour un logiciel plus ancien qui ne lit que le CFONB, l’OFX ou l’Excel, le convertisseur du site permet de transformer un camt.053 en Excel, CSV ou OFX.</p>"
---

Si vous récupérez vos relevés bancaires sous forme de fichiers, vous avez sûrement croisé ces deux formats. Le **CFONB 120** est le standard historique des banques françaises ; le **camt.053** est son équivalent dans la norme internationale ISO 20022. Les deux décrivent la même chose, un relevé de compte, mais pas avec la même richesse.

## La comparaison en un tableau

| | CFONB 120 | camt.053 |
|---|---|---|
| Norme | Française (CFONB) | Internationale (ISO 20022) |
| Forme | Texte, lignes de 120 caractères | XML |
| Libellé | 31 caractères, plus des compléments de 70 | Motif jusqu’à 140 caractères, plusieurs zones |
| Tiers (payeur, bénéficiaire) | Dans des compléments optionnels | Champs dédiés, nom et IBAN |
| Références SEPA | Compléments optionnels selon les banques | Champs dédiés (EndToEndId, MndtId…) |
| Code opération | Code interbancaire CFONB sur 2 caractères | Code ISO (domaine, famille, sous-famille), souvent avec le code CFONB |
| Contrôle d’intégrité | Soldes 01 et 07 | Soldes + récapitulatif (nombre et total des écritures) |
| Lisible sans outil | Non | Non |
| Taille du fichier | Compacte | 10 à 20 fois plus volumineuse |

## Ce que le camt.053 apporte vraiment

La différence se voit surtout sur les opérations SEPA. Avec un CFONB 120, le nom du client qui vous a payé et la référence de sa facture tiennent dans des enregistrements complémentaires que toutes les banques ne fournissent pas de la même façon. Avec un camt.053, ces informations ont leur place prévue : le débiteur, son IBAN, la référence de bout en bout, le motif complet.

Pour le **rapprochement bancaire automatique**, c’est décisif. Un virement de 2 400 € accompagné de la référence « F-2026-118 » se lettre tout seul avec la facture correspondante. Sans référence, il faut chercher.

Le camt.053 gère aussi nativement :

- les **écritures groupées**, avec le détail de chaque transaction d’une remise ;
- les **montants en devise** et les taux de change ;
- les **écritures en attente** grâce au statut, distinctes des écritures comptabilisées.

## Ce que le CFONB 120 garde pour lui

- **La simplicité** : un fichier texte que n’importe quel langage de programmation découpe en dix lignes de code.
- **La compatibilité** : tous les logiciels de comptabilité français le lisent depuis des décennies.
- **La compacité** : quelques kilo-octets pour un mois d’opérations.

## Le passage à l’ISO 20022

Le paiement européen s’est construit sur l’ISO 20022 : les virements et prélèvements SEPA sont des messages ISO 20022 depuis leur création. Les relevés suivent le même chemin. Le CFONB a publié un *guide d’utilisation du BankToCustomerStatement* qui précise comment les banques françaises remplissent le camt.053, et notamment comment y retrouver les codes opérations CFONB. Pour les échanges internationaux, la migration du MT940 de SWIFT vers le camt.053 fait l’objet d’un calendrier de place.

Pour le relevé CFONB 120 domestique, je n’ai pas trouvé de date de fin officielle. En pratique :

- **pour un nouveau projet** (nouveau logiciel, nouvelle intégration bancaire), demandez le camt.053 : c’est le format d’avenir et le plus riche ;
- **pour une chaîne existante** qui fonctionne en CFONB 120, rien ne presse, mais renseignez-vous auprès de votre banque sur son calendrier.

## Lire l’un comme l’autre

Les deux formats sont illisibles sans outil. Le [convertisseur](/) détecte automatiquement le format et produit le même fichier Excel dans les deux cas : mêmes colonnes, mêmes contrôles de soldes, mêmes codes opérations quand la banque les fournit. C’est aussi un bon moyen de comparer les deux fichiers d’une même journée si votre banque vous les propose tous les deux, et de voir concrètement ce que le camt.053 ajoute.

Pour approfondir chaque format : [le CFONB 120 ligne par ligne](/guides/format-cfonb-120/) et [comprendre un camt.053](/guides/camt-053-explication/).
