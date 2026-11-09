import { ISO_FAMILIES, OP_CODES } from './codes';
import { checkBalances } from './cfonb';
import type { Balance, Issue, ParseResult, SourceFormat, Statement } from './types';
import { fr, round2, sum } from './util';

/*
 * Relevés ISO 20022 : camt.053 (relevé de fin de journée), camt.052 (relevé intrajournalier)
 * et camt.054 (avis de débit/crédit). Les trois partagent la même structure d'écriture
 * (Ntry). On lit par nom local d'élément pour accepter toutes les versions du schéma
 * (de camt.053.001.02 aux versions les plus récentes) quel que soit le préfixe d'espace de noms.
 */

export class CamtError extends Error {}

function kids(el: Element | null | undefined, name?: string): Element[] {
  if (!el) return [];
  const out: Element[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (!name || (n as Element).localName === name)) out.push(n as Element);
  }
  return out;
}

function at(el: Element | null | undefined, ...path: string[]): Element | null {
  let cur: Element | null | undefined = el;
  for (const p of path) {
    if (!cur) return null;
    cur = kids(cur, p)[0] ?? null;
  }
  return cur ?? null;
}

function txt(el: Element | null | undefined, ...path: string[]): string | undefined {
  const v = at(el, ...path)?.textContent?.replace(/\s+/g, ' ').trim();
  return v || undefined;
}

/** Date ISO (Dt) ou date-heure (DtTm) → AAAA-MM-JJ. */
function date(el: Element | null | undefined): string | undefined {
  const v = txt(el, 'Dt') ?? txt(el, 'DtTm');
  return v ? v.slice(0, 10) : undefined;
}

function signed(el: Element | null): number {
  const amt = Number(txt(el, 'Amt') ?? 'NaN');
  const ind = txt(el, 'CdtDbtInd');
  return round2(ind === 'DBIT' ? -amt : amt);
}

/** Nom d'une partie : <Nm> direct (versions 02 à 07) ou <Pty><Nm> (versions 08 et suivantes). */
function partyName(el: Element | null): string | undefined {
  return txt(el, 'Nm') ?? txt(el, 'Pty', 'Nm');
}

function accountId(el: Element | null): string | undefined {
  return txt(el, 'Id', 'IBAN') ?? txt(el, 'Id', 'Othr', 'Id');
}

export function looksLikeCamt(text: string): boolean {
  return /<([\w-]+:)?Document[\s>]/.test(text.slice(0, 3000)) && /camt\.05[234]/.test(text.slice(0, 3000));
}

export function parseCamt(xml: string): ParseResult {
  const doc = new DOMParser().parseFromString(xml.replace(/^﻿/, ''), 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) throw new CamtError('Le fichier XML est mal formé : ' + (err.textContent?.trim().split('\n')[0] ?? ''));
  const root = doc.documentElement;
  const msg = kids(root)[0];
  if (!msg) throw new CamtError('Document ISO 20022 vide.');

  const kinds: Record<string, [SourceFormat, string]> = {
    BkToCstmrStmt: ['camt.053', 'Stmt'],
    BkToCstmrAcctRpt: ['camt.052', 'Rpt'],
    BkToCstmrDbtCdtNtfctn: ['camt.054', 'Ntfctn'],
  };
  const kind = kinds[msg.localName];
  if (!kind) {
    throw new CamtError(
      `Message ISO 20022 non pris en charge : <${msg.localName}>. Seuls les relevés camt.053, camt.052 et camt.054 sont lus.`,
    );
  }
  const [format, tag] = kind;
  const issues: Issue[] = [];
  const passed: string[] = [];
  const statements: Statement[] = [];

  for (const st of kids(msg, tag)) {
    const acct = at(st, 'Acct');
    const currency = txt(acct, 'Ccy') ?? 'EUR';
    const balances = kids(st, 'Bal').map((b) => ({
      code: txt(b, 'Tp', 'CdOrPrtry', 'Cd') ?? txt(b, 'Tp', 'CdOrPrtry', 'Prtry'),
      balance: { date: date(at(b, 'Dt')), amount: signed(b) } as Balance,
    }));
    const find = (...codes: string[]) => codes.map((c) => balances.find((b) => b.code === c)?.balance).find(Boolean);

    const s: Statement = {
      format,
      id: txt(st, 'Id'),
      account: accountId(acct) ?? 'inconnu',
      iban: txt(acct, 'Id', 'IBAN'),
      currency,
      owner: partyName(at(acct, 'Ownr')),
      bankName: txt(acct, 'Svcr', 'FinInstnId', 'Nm') ?? txt(acct, 'Svcr', 'FinInstnId', 'BICFI') ?? txt(acct, 'Svcr', 'FinInstnId', 'BIC'),
      opening: find('OPBD', 'PRCD'),
      closing: find('CLBD'),
      transactions: [],
    };

    for (const n of kids(st, 'Ntry')) {
      const amount = signed(n);
      const credit = amount >= 0;
      const status = txt(n, 'Sts', 'Cd') ?? txt(n, 'Sts');
      const txs = kids(at(n, 'NtryDtls'), 'TxDtls').concat(...kids(n, 'NtryDtls').slice(1).map((d) => kids(d, 'TxDtls')));
      const first = txs[0];
      const related = at(first, 'RltdPties');
      const counterparty = credit
        ? partyName(at(related, 'Dbtr')) ?? partyName(at(related, 'UltmtDbtr'))
        : partyName(at(related, 'Cdtr')) ?? partyName(at(related, 'UltmtCdtr'));
      const counterpartyIban = credit ? accountId(at(related, 'DbtrAcct')) : accountId(at(related, 'CdtrAcct'));

      const details: string[] = [];
      for (const t of txs) {
        for (const u of kids(at(t, 'RmtInf'), 'Ustrd')) if (u.textContent?.trim()) details.push(u.textContent.trim());
        const strd = txt(t, 'RmtInf', 'Strd', 'CdtrRefInf', 'Ref');
        if (strd) details.push(`Réf. structurée : ${strd}`);
        const add = txt(t, 'AddtlTxInf');
        if (add) details.push(add);
      }
      if (txs.length > 1) details.unshift(`Lot de ${txs.length} opérations`);

      // Code opération : code propriétaire CFONB s'il est fourni (banques françaises), sinon code ISO.
      const prtry = txt(n, 'BkTxCd', 'Prtry', 'Cd');
      const domain = txt(n, 'BkTxCd', 'Domn', 'Cd');
      const family = txt(n, 'BkTxCd', 'Domn', 'Fmly', 'Cd');
      const sub = txt(n, 'BkTxCd', 'Domn', 'Fmly', 'SubFmlyCd');
      const cfonb = prtry && OP_CODES[prtry] ? prtry : undefined;
      const iso = [domain, family, sub].filter(Boolean).join('-') || undefined;

      const addtl = txt(n, 'AddtlNtryInf');
      const label = addtl ?? details[0] ?? counterparty ?? (cfonb ? OP_CODES[cfonb].label : family ? ISO_FAMILIES[family] : undefined) ?? '';

      s.transactions.push({
        bookingDate: date(at(n, 'BookgDt')),
        valueDate: date(at(n, 'ValDt')),
        amount,
        currency: at(n, 'Amt')?.getAttribute('Ccy') ?? currency,
        label,
        details: details.filter((d) => d !== label),
        opCode: cfonb ?? iso ?? prtry,
        opLabel: cfonb ? OP_CODES[cfonb].label : family ? ISO_FAMILIES[family] : undefined,
        counterparty,
        counterpartyIban,
        reference: txt(n, 'AcctSvcrRef') ?? txt(first, 'Refs', 'AcctSvcrRef'),
        endToEndId: txt(first, 'Refs', 'EndToEndId'),
        mandateId: txt(first, 'Refs', 'MndtId'),
        status,
      });
    }

    // Contrôle du nombre et du total des écritures déclarés dans TxsSummry
    const declared = Number(txt(st, 'TxsSummry', 'TtlNtries', 'NbOfNtries') ?? NaN);
    if (!isNaN(declared)) {
      if (declared === s.transactions.length) passed.push(`Compte ${s.account} : ${declared} écritures, conforme au récapitulatif du relevé.`);
      else issues.push({ severity: 'error', message: `Compte ${s.account} : le relevé annonce ${declared} écritures mais en contient ${s.transactions.length}.` });
    }
    const declaredNet = txt(st, 'TxsSummry', 'TtlNtries', 'TtlNetNtry', 'Amt');
    if (declaredNet) {
      const ind = txt(st, 'TxsSummry', 'TtlNtries', 'TtlNetNtry', 'CdtDbtInd');
      const net = round2(Number(declaredNet) * (ind === 'DBIT' ? -1 : 1));
      const actual = sum(s.transactions.map((t) => t.amount));
      if (Math.abs(net - actual) < 0.005) passed.push(`Compte ${s.account} : total net des écritures ${fr(actual)}, conforme au récapitulatif.`);
      else issues.push({ severity: 'error', message: `Compte ${s.account} : total net annoncé ${fr(net)}, total calculé ${fr(actual)}.` });
    }
    const pending = s.transactions.filter((t) => t.status === 'PDNG').length;
    if (pending) issues.push({ severity: 'info', message: `${pending} écriture(s) en attente (PDNG), exclues du contrôle des soldes.` });
    if (!s.opening && format === 'camt.053') issues.push({ severity: 'warning', message: `Compte ${s.account} : pas de solde d’ouverture (OPBD) dans le relevé.` });
    if (!s.closing && format === 'camt.053') issues.push({ severity: 'warning', message: `Compte ${s.account} : pas de solde de clôture (CLBD) dans le relevé.` });
    statements.push(s);
  }

  if (!statements.length) issues.push({ severity: 'error', message: 'Aucun relevé trouvé dans le fichier.' });
  checkBalances(statements, { issues, passed });
  return { format, statements, issues, passed };
}
