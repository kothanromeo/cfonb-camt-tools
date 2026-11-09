import { checkBalances } from './cfonb';
import type { Balance, Issue, ParseResult, Statement, Transaction } from './types';
import { round2 } from './util';

/*
 * Relevé SWIFT MT940 (« Customer Statement Message »), le format international
 * qui précède le camt.053. Le message est une suite de champs étiquetés :
 *   :20:  référence      :25:  compte          :28C: numéro de relevé
 *   :60F: solde initial  :61:  une opération   :86:  informations sur l'opération
 *   :62F: solde final    :64:  solde disponible :65: solde disponible à terme
 * Le fichier peut contenir plusieurs relevés, éventuellement dans une enveloppe SWIFT ({1:…}{4:…-}).
 */

/** Codes de type d'opération SWIFT (les 3 lettres après N, F ou S dans le champ :61:). */
export const SWIFT_CODES: Record<string, string> = {
  TRF: 'Virement',
  CHK: 'Chèque',
  CLR: 'Remise de chèques',
  DDT: 'Prélèvement',
  STO: 'Ordre permanent',
  CHG: 'Frais',
  COM: 'Commission',
  INT: 'Intérêts',
  MSC: 'Opération diverse',
  RTI: 'Opération rejetée / retournée',
  FEX: 'Change',
  SEC: 'Titres',
  DIV: 'Dividendes',
  BOE: 'Effet de commerce',
  LDP: 'Prêt / dépôt',
  CMI: 'Gestion de trésorerie',
  TCK: 'Chèque de voyage',
  ECK: 'Eurochèque',
  VDA: 'Ajustement de date de valeur',
  DCR: 'Crédit documentaire',
};

export function looksLikeMt940(text: string): boolean {
  const head = text.slice(0, 4000);
  return /(^|\n|\{4:\s*\n?):20:/.test(head) && /:(60[FM]|61|25):/.test(head);
}

/** Montant SWIFT : virgule décimale, sans signe. */
const amount = (s: string) => Number(s.replace(',', '.'));

/** AAMMJJ → AAAA-MM-JJ */
function yymmdd(s: string): string | undefined {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (!m) return undefined;
  const y = 2000 + Number(m[1]);
  const iso = `${y}-${m[2]}-${m[3]}`;
  const d = new Date(iso + 'T00:00:00Z');
  return !isNaN(+d) && d.getUTCMonth() + 1 === Number(m[2]) && d.getUTCDate() === Number(m[3]) ? iso : undefined;
}

function balance(raw: string): Balance | undefined {
  const m = /^([CD])(\d{6})([A-Z]{3})([\d,]+)/.exec(raw.replace(/\s/g, ''));
  if (!m) return undefined;
  const a = amount(m[4]);
  return { date: yymmdd(m[2]), amount: round2(m[1] === 'D' ? -a : a) };
}

interface Field {
  tag: string;
  value: string;
}

/** Découpe le texte en champs :XX: (les lignes de continuation sont rattachées au champ précédent). */
function fields(text: string): Field[] {
  let body = text.replace(/\r\n?/g, '\n');
  // Enveloppe SWIFT : on ne garde que les blocs 4.
  if (/\{4:/.test(body)) {
    const blocks = [...body.matchAll(/\{4:\s*\n?([\s\S]*?)\n?-\}/g)].map((m) => m[1]);
    if (blocks.length) body = blocks.join('\n');
  }
  const out: Field[] = [];
  for (const line of body.split('\n')) {
    const m = /^:(\d{2}[A-Z]?):(.*)$/.exec(line);
    if (m) out.push({ tag: m[1], value: m[2] });
    else if (line.trim() === '-' || line.trim() === '') continue;
    else if (out.length) out[out.length - 1].value += '\n' + line;
  }
  return out;
}

interface Info86 {
  label?: string;
  details: string[];
  counterparty?: string;
  counterpartyIban?: string;
  endToEndId?: string;
  mandateId?: string;
  creditorId?: string;
}

/** Interprète le champ :86:, structuré (/CODE/… ou ?20…) ou libre. */
export function parse86(raw: string): Info86 {
  const joined = raw.split('\n').join('');
  const info: Info86 = { details: [] };

  // Forme « /EREF/…/NAME/…/REMI/… » (recommandations SEPA et nombreuses banques européennes)
  if (/^\s*\/[A-Z]{3,4}\//.test(joined) || /\/(EREF|NAME|REMI|MREF|IBAN|ORDP|BENM)\//.test(joined)) {
    const parts = [...joined.matchAll(/\/([A-Z]{3,4})\/((?:(?!\/[A-Z]{3,4}\/).)*)/g)];
    const map: Record<string, string> = {};
    for (const [, code, value] of parts) {
      const v = value.replace(/^\//, '').trim();
      if (v) map[code] = map[code] ? `${map[code]} ${v}` : v;
    }
    const remi = map.REMI?.replace(/^USTD\/\/?/, '').replace(/^STRD\/\/?/, '');
    info.label = remi ?? map.NAME;
    info.counterparty = map.NAME ?? map.BENM ?? map.ORDP;
    info.counterpartyIban = map.IBAN;
    info.endToEndId = map.EREF && map.EREF !== 'NOTPROVIDED' ? map.EREF : undefined;
    info.mandateId = map.MREF;
    info.creditorId = map.CRED ?? map.CSID;
    for (const [k, v] of Object.entries(map)) if (!['REMI', 'NAME', 'IBAN', 'EREF', 'MREF', 'CRED', 'CSID', 'BENM', 'ORDP'].includes(k)) info.details.push(`${k} : ${v}`);
    return info;
  }

  // Forme allemande « 166?00Texte?20…?32Nom » (utilisée par de nombreuses banques en Europe)
  if (/^\d{3}\?\d{2}/.test(joined) || /\?2\d/.test(joined)) {
    const map: Record<string, string> = {};
    for (const [, k, v] of joined.matchAll(/\?(\d{2})([^?]*)/g)) map[k] = (map[k] ?? '') + v;
    const remittance = ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '60', '61', '62', '63']
      .map((k) => map[k])
      .filter(Boolean)
      .join('');
    info.label = remittance.trim() || map['00'];
    if (map['00'] && info.label !== map['00']) info.details.push(map['00'].trim());
    info.counterparty = [map['32'], map['33']].filter(Boolean).join('').trim() || undefined;
    info.counterpartyIban = map['31']?.trim();
    const e2e = /EREF\+([^\s]+)/.exec(remittance);
    if (e2e) info.endToEndId = e2e[1];
    const mref = /MREF\+([^\s]+)/.exec(remittance);
    if (mref) info.mandateId = mref[1];
    return info;
  }

  // Texte libre : les lignes de 65 caractères sont recollées avec un espace.
  info.label = raw.split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
  return info;
}

/** Champ :61: — ligne d'opération. */
const RE61 = /^(\d{6})(\d{4})?(RC|RD|EC|ED|C|D)([A-Z])?(\d+,\d*)([NFS])([A-Z0-9]{3})([^\n]*?)(?:\/\/([^\n]*))?(?:\n([\s\S]*))?$/;

export function parseMt940(text: string): ParseResult {
  const issues: Issue[] = [];
  const passed: string[] = [];
  const statements: Statement[] = [];
  let st: Statement | undefined;
  let last: Transaction | undefined;
  let bad61 = 0;

  const start = () => {
    st = { format: 'MT940', account: 'inconnu', currency: 'EUR', transactions: [] };
    statements.push(st);
    last = undefined;
  };

  for (const f of fields(text)) {
    switch (f.tag) {
      case '20':
        start();
        st!.id = f.value.trim();
        break;
      case '25': {
        if (!st) start();
        const acc = f.value.trim();
        const iban = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}/.exec(acc.replace(/\s/g, ''));
        st!.account = acc;
        if (iban) st!.iban = iban[0];
        break;
      }
      case '28C':
      case '28':
        if (st && !st.id) st.id = f.value.trim();
        break;
      case '60F':
      case '60M': {
        if (!st) start();
        const b = balance(f.value);
        if (b) {
          st!.opening = b;
          st!.currency = /^[CD]\d{6}([A-Z]{3})/.exec(f.value)?.[1] ?? st!.currency;
        } else issues.push({ severity: 'error', message: `Solde initial illisible : « ${f.value} ».` });
        break;
      }
      case '61': {
        if (!st) start();
        const m = RE61.exec(f.value);
        if (!m) {
          bad61++;
          if (bad61 <= 5) issues.push({ severity: 'error', message: `Ligne d’opération (:61:) illisible : « ${f.value.split('\n')[0]} ».` });
          break;
        }
        const [, valueD, entryMMDD, mark, , amt, , code, ownerRef, bankRef, extra] = m;
        const valueDate = yymmdd(valueD);
        let bookingDate = valueDate;
        if (entryMMDD && valueDate) {
          let year = Number(valueDate.slice(0, 4));
          const vm = Number(valueDate.slice(5, 7));
          const em = Number(entryMMDD.slice(0, 2));
          if (vm === 12 && em === 1) year++;
          if (vm === 1 && em === 12) year--;
          bookingDate = yymmdd(String(year).slice(2) + entryMMDD) ?? valueDate;
        }
        const credit = mark === 'C' || mark === 'RD' || mark === 'EC';
        const value = amount(amt);
        last = {
          bookingDate,
          valueDate,
          amount: round2(credit ? value : -value),
          currency: st!.currency,
          label: '',
          details: extra?.trim() ? [extra.trim()] : [],
          opCode: code,
          opLabel: SWIFT_CODES[code] ? SWIFT_CODES[code] + (mark.startsWith('R') ? ' (annulation)' : '') : mark.startsWith('R') ? 'Annulation' : undefined,
          reference: bankRef?.trim() || (ownerRef.trim() && ownerRef.trim() !== 'NONREF' ? ownerRef.trim() : undefined),
          status: mark.startsWith('E') ? 'PDNG' : undefined,
        };
        st!.transactions.push(last);
        break;
      }
      case '86': {
        // Un :86: sans opération qui le précède porte sur le relevé entier : on l'ignore.
        if (!last) break;
        const info = parse86(f.value);
        last.label = info.label?.slice(0, 200) ?? '';
        last.details.push(...info.details);
        last.counterparty = info.counterparty;
        last.counterpartyIban = info.counterpartyIban;
        last.endToEndId = info.endToEndId;
        last.mandateId = info.mandateId;
        last.creditorId = info.creditorId;
        last = undefined; // un seul :86: par opération
        break;
      }
      case '62F':
      case '62M': {
        if (!st) break;
        const b = balance(f.value);
        if (b) st.closing = b;
        else issues.push({ severity: 'error', message: `Solde final illisible : « ${f.value} ».` });
        last = undefined;
        break;
      }
      default:
        break;
    }
  }

  for (const s of statements) {
    for (const t of s.transactions) if (!t.label) t.label = t.opLabel ?? t.reference ?? '';
    if (!s.opening) issues.push({ severity: 'warning', message: `Relevé ${s.id ?? ''} : pas de solde initial (:60F:).` });
    if (!s.closing) issues.push({ severity: 'warning', message: `Relevé ${s.id ?? ''} : pas de solde final (:62F:).` });
  }
  if (bad61 > 5) issues.push({ severity: 'error', message: `${bad61} lignes :61: illisibles au total.` });
  if (!statements.length) issues.push({ severity: 'error', message: 'Aucun relevé MT940 trouvé (pas de champ :20:).' });
  else passed.push(`${statements.length} relevé(s) MT940 lus.`);
  checkBalances(statements, { issues, passed });
  return { format: 'MT940', statements, issues, passed };
}
