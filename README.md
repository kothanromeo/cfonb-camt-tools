<div align="center">

# CFONB & camt Tools

**Convertir un relevé bancaire CFONB 120, MT940 ou camt.053 en Excel, CSV ou OFX, sans envoyer le fichier à un serveur.**

[**→ Ouvrir le convertisseur**](https://cfonb-camt-tools.kothanromeo.dev/) · [Guides](https://cfonb-camt-tools.kothanromeo.dev/guides/) · [Signaler un problème](https://github.com/kothanromeo/cfonb-camt-tools/issues)

![Tests](https://github.com/kothanromeo/cfonb-camt-tools/actions/workflows/ci.yml/badge.svg)
![Licence MIT](https://img.shields.io/badge/licence-MIT-blue)

</div>

---

Les banques françaises transmettent les relevés de compte aux entreprises dans deux formats faits pour les machines : le **CFONB 120** (lignes de 120 caractères, montants dont le signe est caché dans la dernière lettre) et le **camt.053** (XML ISO 20022). Les ouvrir sans logiciel de comptabilité est pénible, et les convertisseurs en ligne demandent souvent d'envoyer ses relevés sur un serveur.

Ici, tout se passe dans le navigateur.

## Fonctionnalités

- **Détection automatique** du format : CFONB 120, MT940 (SWIFT), camt.053, camt.052, camt.054 (toutes versions du schéma ISO 20022).
- **MT940** : enveloppe SWIFT et relevés multiples, champ `:61:` (dates de valeur et de comptabilisation, annulations RC/RD, codes TRF/DDT/CHK…), champ `:86:` structuré façon SEPA (`/EREF/…/NAME/…/REMI/…`) ou allemand (`?20…?32…`).
- **CFONB 120** : décodage des montants signés (`{`, `A`–`I`, `}`, `J`–`R`), dates JJMMAA, compléments `05` rattachés à leur mouvement (payeur, bénéficiaire, référence de bout en bout, mandat SEPA), fichiers avec ou sans retours à la ligne, encodage UTF-8 ou Windows-1252.
- **camt.053** : soldes `OPBD`/`PRCD`/`CLBD`, écritures et détail des transactions, tiers (`Nm` ou `Pty/Nm`), codes ISO et codes CFONB propriétaires, écritures groupées.
- **Codes opérations interbancaires CFONB** traduits en clair (01, 05, 06, B1, A1…).
- **Contrôles** : ancien solde + mouvements = nouveau solde, nombre et total des écritures (camt), lignes de longueur incorrecte, compléments orphelins.
- **Exports** : Excel `.xlsx` (feuilles « Opérations » et « Soldes », vraies dates, montants numériques, filtres), CSV français (`;` et virgule décimale), CSV international, OFX.

## Structure

```
src/lib/
├── cfonb.ts    Lecture du CFONB 120 (zones, signe superposé, contrôles de soldes)
├── camt.ts     Lecture des camt.052 / camt.053 / camt.054
├── mt940.ts    Lecture des relevés SWIFT MT940
├── codes.ts    Codes opérations interbancaires et qualifiants des compléments
├── export.ts   CSV, XLSX (Office Open XML écrit à la main + fflate) et OFX
├── sample.ts   Relevés d'exemple fictifs
└── index.ts    Détection du format
```

Site statique [Astro](https://astro.build/), sans framework côté client. Seule dépendance d'exécution : [fflate](https://github.com/101arrowz/fflate) pour le zip du fichier Excel.

## Développement

```bash
npm install
npm run dev     # http://localhost:4321/
npm test        # tests Vitest
npm run build   # site statique dans dist/
```

## Contribuer

Les issues et pull requests sont les bienvenues : relevés mal lus (**anonymisez-les** : numéros de compte, noms, montants), qualifiants `05` propres à une banque, nouveaux formats (CFONB 240, MT942).

## Licence

[MIT](LICENSE) © Roméo Kothan
