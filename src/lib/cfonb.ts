import { OP_CODES, QUALIFIERS } from './codes';
import type { Issue, ParseResult, Statement, Transaction } from './types';
import { fr, round2, sum } from './util';

/*
 * Relevé de compte CFONB « 120 caractères » (norme CFONB, édition 2004).
 *
 * Enregistrements de longueur fixe, positions numérotées à partir de 1 :
 *   01 ancien solde · 04 mouvement · 05 complément (facultatif, illimité) · 07 nouveau solde
 *
 * Zones communes : 1-2 code enregistrement, 3-7 code banque, 8-11 code opération interne
 * (04/05) ou zone réservée, 12-16 code guichet, 17-19 devise, 20 nombre de décimales,
 * 22-32 numéro de compte, 33-34 code opération interbancaire (04/05), 35-40 date (JJMMAA).
 *
 * 04 : 41-42 motif de rejet, 43-48 date de valeur, 49-79 libellé, 82-88 numéro d'écriture,
 *      89 exonération de commission, 90 indisponibilité, 91-104 montant, 105-120 référence.
 * 05 : 46-48 qualifiant, 49-118 information complémentaire.
 * 01/07 : 91-104 montant du solde.
 *
 * Le signe du montant est « superposé » au dernier caractère (codage ASCII) :
 *   « { » et « A » à « I » = +0 à +9 ; « } » et « J » à « R » = -0 à -9.
 */

export const RECORD_LENGTH = 120;

/** Extrait la zone [début, fin] (positions 1-indexées, bornes incluses). */
const zone = (line: string, start: number, end: number) => line.slice(start - 1, end);

const POSITIVE = '{ABCDEFGHI';
const NEGATIVE = '}JKLMNOPQR';

/** Décode un montant CFONB signé. Renvoie undefined si la zone est illisible. */
export function decodeAmount(raw: string, decimals: number): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const last = s[s.length - 1];
  let digit: number;
  let sign = 1;
  if (POSITIVE.includes(last)) digit = POSITIVE.indexOf(last);
  else if (NEGATIVE.includes(last)) {
    digit = NEGATIVE.indexOf(last);
    sign = -1;
  } else if (/\d/.test(last)) digit = Number(last); // certains logiciels omettent le signe
  else return undefined;
  const body = s.slice(0, -1);
  if (!/^\d*$/.test(body)) return undefined;
  const cents = Number(body + digit);
  return round2((sign * cents) / 10 ** decimals);
}

/** Encode un montant au format CFONB (14 caractères, signe superposé). */
export function encodeAmount(value: number, decimals = 2, width = 14): string {
  const n = Math.round(Math.abs(value) * 10 ** decimals);
  const digits = String(n).padStart(width, '0');
  const last = Number(digits[digits.length - 1]);
  return digits.slice(0, -1) + (value < 0 ? NEGATIVE : POSITIVE)[last];
}

/** JJMMAA → AAAA-MM-JJ (années 00-79 = 2000-2079). */
export function decodeDate(raw: string): string | undefined {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(raw.trim());
  if (!m) return undefined;
  const [, d, mo, y] = m;
  const year = Number(y) < 80 ? 2000 + Number(y) : 1900 + Number(y);
  const iso = `${year}-${mo}-${d}`;
  const t = new Date(iso + 'T00:00:00Z');
  return !isNaN(+t) && t.getUTCDate() === Number(d) && t.getUTCMonth() + 1 === Number(mo) ? iso : undefined;
}

/** Découpe le fichier en enregistrements, avec ou sans retours à la ligne. */
export function splitRecords(text: string): { line: string; no: number; length: number }[] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!clean.includes('\n') && clean.length > RECORD_LENGTH) {
    const out = [];
    for (let i = 0, no = 1; i < clean.length; i += RECORD_LENGTH, no++) {
      const line = clean.slice(i, i + RECORD_LENGTH);
      if (line.trim()) out.push({ line, no, length: line.length });
    }
    return out;
  }
  return clean
    .split('\n')
    .map((line, i) => ({ line, no: i + 1, length: line.length }))
    .filter((r) => r.line.trim() !== '');
}

export function looksLikeCfonb(text: string): boolean {
  const first = splitRecords(text.slice(0, 2000))[0];
  return !!first && /^(01|04|05|07)\d{5}/.test(first.line) && first.line.trimEnd().length >= 100;
}

interface Ctx {
  issues: Issue[];
  passed: string[];
}

function finalizeTx(tx: Transaction, extra: Record<string, string>) {
  const credit = tx.amount >= 0;
  tx.counterparty ??= credit ? extra.NPY ?? extra.NBE : extra.NBE ?? extra.NPY;
}

export function parseCfonb(text: string): ParseResult {
  const ctx: Ctx = { issues: [], passed: [] };
  const statements: Statement[] = [];
  const records = splitRecords(text);
  let current: Statement | undefined;
  let lastTx: Transaction | undefined;
  let lastTxKey = '';
  let extra: Record<string, string> = {};
  let badLength = 0;
  let unknown = 0;

  const closeTx = () => {
    if (lastTx) finalizeTx(lastTx, extra);
    lastTx = undefined;
    extra = {};
  };

  const header = (line: string) => ({
    bankCode: zone(line, 3, 7).trim(),
    branchCode: zone(line, 12, 16).trim(),
    currency: zone(line, 17, 19).trim() || 'EUR',
    decimals: Number(zone(line, 20, 20)) || 0,
    account: zone(line, 22, 32).trim(),
  });

  for (const { line: raw, no, length } of records) {
    let line = raw;
    if (length !== RECORD_LENGTH) {
      badLength++;
      line = raw.padEnd(RECORD_LENGTH, ' ').slice(0, RECORD_LENGTH);
    }
    const code = zone(line, 1, 2);
    const h = header(line);

    if (code === '01') {
      closeTx();
      if (current && !current.closing) {
        ctx.issues.push({ severity: 'warning', line: no, message: `Le relevé du compte ${current.account} n’a pas de nouveau solde (07) avant le relevé suivant.` });
      }
      const amount = decodeAmount(zone(line, 91, 104), h.decimals);
      if (amount === undefined) ctx.issues.push({ severity: 'error', line: no, message: 'Montant de l’ancien solde illisible.' });
      current = {
        format: 'CFONB 120',
        account: h.account,
        bankCode: h.bankCode,
        branchCode: h.branchCode,
        currency: h.currency,
        opening: { date: decodeDate(zone(line, 35, 40)), amount: amount ?? 0 },
        transactions: [],
      };
      statements.push(current);
    } else if (code === '04') {
      closeTx();
      if (!current) {
        ctx.issues.push({ severity: 'warning', line: no, message: 'Mouvement (04) sans ancien solde (01) préalable.' });
        current = { format: 'CFONB 120', account: h.account, bankCode: h.bankCode, branchCode: h.branchCode, currency: h.currency, transactions: [] };
        statements.push(current);
      }
      const amount = decodeAmount(zone(line, 91, 104), h.decimals);
      if (amount === undefined) ctx.issues.push({ severity: 'error', line: no, message: `Montant illisible : « ${zone(line, 91, 104)} ».` });
      const op = zone(line, 33, 34).trim();
      const entry = zone(line, 82, 88).trim();
      const bookingDate = decodeDate(zone(line, 35, 40));
      if (!bookingDate) ctx.issues.push({ severity: 'warning', line: no, message: `Date de comptabilisation invalide : « ${zone(line, 35, 40)} ».` });
      lastTx = {
        bookingDate,
        valueDate: decodeDate(zone(line, 43, 48)),
        amount: amount ?? 0,
        currency: h.currency,
        label: zone(line, 49, 79).trim(),
        details: [],
        opCode: op || undefined,
        opLabel: OP_CODES[op]?.label,
        bankCode: zone(line, 8, 11).trim() || undefined,
        entryNumber: entry && !/^0+$/.test(entry) ? entry.replace(/^0+/, '') : undefined,
        rejectCode: zone(line, 41, 42).trim() || undefined,
        reference: zone(line, 105, 120).trim() || undefined,
      };
      lastTxKey = zone(line, 3, 40);
      current.transactions.push(lastTx);
    } else if (code === '05') {
      if (!lastTx) {
        ctx.issues.push({ severity: 'warning', line: no, message: 'Complément (05) sans mouvement (04) auquel le rattacher : ignoré.' });
        continue;
      }
      if (zone(line, 3, 40) !== lastTxKey) {
        ctx.issues.push({ severity: 'info', line: no, message: 'Les positions 3 à 40 de ce complément (05) diffèrent de celles du mouvement qui le précède.' });
      }
      const q = zone(line, 46, 48).trim();
      const info = zone(line, 49, 118).trim();
      if (!info) continue;
      switch (q) {
        case 'RCN':
          lastTx.endToEndId = info;
          break;
        case 'REF':
          lastTx.reference ??= info;
          lastTx.details.push(`Réf. : ${info}`);
          break;
        case 'RUM':
          lastTx.mandateId = info;
          break;
        case 'ICS':
          lastTx.creditorId = info;
          break;
        case 'NPY':
        case 'NBE':
          extra[q] = info;
          break;
        case 'LIB':
        case 'LCC':
        case 'LC2':
          lastTx.details.push(info);
          break;
        default:
          lastTx.details.push(`${QUALIFIERS[q] ?? q} : ${info}`);
      }
    } else if (code === '07') {
      closeTx();
      const amount = decodeAmount(zone(line, 91, 104), h.decimals);
      if (!current || current.closing) {
        ctx.issues.push({ severity: 'warning', line: no, message: 'Nouveau solde (07) sans ancien solde (01) correspondant.' });
        current = { format: 'CFONB 120', account: h.account, bankCode: h.bankCode, branchCode: h.branchCode, currency: h.currency, transactions: [] };
        statements.push(current);
      }
      if (h.account !== current.account) {
        ctx.issues.push({ severity: 'error', line: no, message: `Le nouveau solde porte sur le compte ${h.account}, alors que le relevé concerne le compte ${current.account}.` });
      }
      current.closing = { date: decodeDate(zone(line, 35, 40)), amount: amount ?? 0 };
      current = undefined;
    } else {
      unknown++;
      if (unknown <= 5) ctx.issues.push({ severity: 'warning', line: no, message: `Code d’enregistrement inconnu « ${code} » : ligne ignorée.` });
    }
  }
  closeTx();

  if (badLength) {
    ctx.issues.push({
      severity: 'warning',
      message: `${badLength} ligne(s) ne font pas exactement 120 caractères. Elles ont été complétées ou tronquées ; vérifiez qu’un logiciel n’a pas supprimé les espaces de fin.`,
    });
  } else if (records.length) {
    ctx.passed.push(`Les ${records.length} enregistrements font bien 120 caractères.`);
  }
  if (unknown > 5) ctx.issues.push({ severity: 'warning', message: `${unknown} enregistrements au total ont un code inconnu.` });

  checkBalances(statements, ctx);
  return { format: 'CFONB 120', statements, issues: ctx.issues, passed: ctx.passed };
}

/** Contrôle : ancien solde + somme des mouvements = nouveau solde. */
export function checkBalances(statements: Statement[], ctx: Ctx) {
  for (const s of statements) {
    const label = `Compte ${s.account}${s.closing?.date ? ` au ${s.closing.date.split('-').reverse().join('/')}` : ''}`;
    if (!s.opening || !s.closing) continue;
    const moves = sum(s.transactions.filter((t) => t.status !== 'PDNG').map((t) => t.amount));
    const expected = round2(s.opening.amount + moves);
    if (Math.abs(expected - s.closing.amount) < 0.005) {
      ctx.passed.push(`${label} : ancien solde ${fr(s.opening.amount)} + mouvements ${fr(moves)} = nouveau solde ${fr(s.closing.amount)}.`);
    } else {
      ctx.issues.push({
        severity: 'error',
        message: `${label} : ancien solde ${fr(s.opening.amount)} + mouvements ${fr(moves)} = ${fr(expected)}, mais le nouveau solde indiqué est ${fr(s.closing.amount)} (écart ${fr(round2(s.closing.amount - expected))}).`,
      });
    }
  }
}
