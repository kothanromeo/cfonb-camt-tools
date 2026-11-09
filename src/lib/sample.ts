import { encodeAmount } from './cfonb';

/*
 * Relevés d'exemple fictifs (banque, compte et tiers inventés), générés à la volée.
 * Ils servent au bouton « Essayer avec un exemple » et aux tests.
 */

interface Move {
  op: string;
  date: string; // AAAA-MM-JJ
  value: string;
  label: string;
  amount: number;
  ref?: string;
  entry?: string;
  extra?: [string, string][];
}

const BANK = '12345';
const BRANCH = '00123';
const ACCOUNT = '00012345678';

const jjmmaa = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return d + m + y.slice(2);
};

function fixed(parts: [number, string][]): string {
  // parts : [longueur, valeur] dans l'ordre des positions
  return parts.map(([len, v]) => v.slice(0, len).padEnd(len, ' ')).join('');
}

function balanceLine(code: '01' | '07', date: string, amount: number): string {
  return fixed([
    [2, code], [5, BANK], [4, ''], [5, BRANCH], [3, 'EUR'], [1, '2'], [1, ''], [11, ACCOUNT],
    [2, ''], [6, jjmmaa(date)], [50, ''], [14, encodeAmount(amount)], [16, ''],
  ]);
}

function moveLine(m: Move): string {
  return fixed([
    [2, '04'], [5, BANK], [4, '0000'], [5, BRANCH], [3, 'EUR'], [1, '2'], [1, ''], [11, ACCOUNT],
    [2, m.op], [6, jjmmaa(m.date)], [2, ''], [6, jjmmaa(m.value)], [31, m.label], [2, ''],
    [7, (m.entry ?? '').padStart(7, '0')], [1, '0'], [1, '0'], [14, encodeAmount(m.amount)], [16, m.ref ?? ''],
  ]);
}

function complementLine(m: Move, q: string, info: string): string {
  return fixed([
    [2, '05'], [5, BANK], [4, '0000'], [5, BRANCH], [3, 'EUR'], [1, '2'], [1, ''], [11, ACCOUNT],
    [2, m.op], [6, jjmmaa(m.date)], [5, ''], [3, q], [70, info], [2, ''],
  ]);
}

export const SAMPLE_MOVES: Move[] = [
  { op: '05', date: '2026-10-01', value: '2026-10-01', label: 'VIR SEPA RECU /DE ATELIER BOIS', amount: 2400, ref: 'VIR0001', extra: [['NPY', 'ATELIER BOIS ET CIE'], ['LCC', 'FACTURE F-2026-118'], ['RCN', 'F2026118']] },
  { op: 'B1', date: '2026-10-03', value: '2026-10-03', label: 'PRLV SEPA FOURNISSEUR ENERGIE', amount: -186.42, extra: [['NBE', 'FOURNISSEUR ENERGIE SA'], ['RUM', 'MDT-0045871'], ['ICS', 'FR12ZZZ123456']] },
  { op: '11', date: '2026-10-06', value: '2026-10-05', label: 'CB LIBRAIRIE CENTRALE 04/10', amount: -32.9 },
  { op: '06', date: '2026-10-08', value: '2026-10-08', label: 'VIR SEPA EMIS /A LOYER BUREAU', amount: -950, extra: [['NBE', 'SCI DES TILLEULS'], ['LCC', 'LOYER OCTOBRE 2026']] },
  { op: '02', date: '2026-10-12', value: '2026-10-14', label: 'REMISE CHEQUES N 4521', amount: 615.5, entry: '4521' },
  { op: '01', date: '2026-10-15', value: '2026-10-15', label: 'CHEQUE 0001234', amount: -120, entry: '1234' },
  { op: '62', date: '2026-10-31', value: '2026-10-31', label: 'FRAIS TENUE DE COMPTE', amount: -12.5 },
];

export const SAMPLE_OPENING = 3250.75;

export function sampleCfonb(): string {
  const closing = Math.round((SAMPLE_OPENING + SAMPLE_MOVES.reduce((s, m) => s + m.amount, 0)) * 100) / 100;
  const lines = [balanceLine('01', '2026-09-30', SAMPLE_OPENING)];
  for (const m of SAMPLE_MOVES) {
    lines.push(moveLine(m));
    for (const [q, info] of m.extra ?? []) lines.push(complementLine(m, q, info));
  }
  lines.push(balanceLine('07', '2026-10-31', closing));
  return lines.join('\r\n') + '\r\n';
}

const xe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function sampleCamt053(): string {
  const iban = `FR76${BANK}${BRANCH}${ACCOUNT}${'86'}`;
  const closing = Math.round((SAMPLE_OPENING + SAMPLE_MOVES.reduce((s, m) => s + m.amount, 0)) * 100) / 100;
  const bal = (code: string, amount: number, date: string) =>
    `<Bal><Tp><CdOrPrtry><Cd>${code}</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">${Math.abs(amount).toFixed(2)}</Amt><CdtDbtInd>${amount < 0 ? 'DBIT' : 'CRDT'}</CdtDbtInd><Dt><Dt>${date}</Dt></Dt></Bal>`;
  const entries = SAMPLE_MOVES.map((m, i) => {
    const credit = m.amount >= 0;
    const extra = Object.fromEntries(m.extra ?? []);
    const party = credit ? extra.NPY : extra.NBE;
    const ustrd = extra.LCC ?? m.label;
    return (
      `<Ntry><NtryRef>${i + 1}</NtryRef><Amt Ccy="EUR">${Math.abs(m.amount).toFixed(2)}</Amt><CdtDbtInd>${credit ? 'CRDT' : 'DBIT'}</CdtDbtInd>` +
      `<Sts><Cd>BOOK</Cd></Sts><BookgDt><Dt>${m.date}</Dt></BookgDt><ValDt><Dt>${m.value}</Dt></ValDt>` +
      `<AcctSvcrRef>2026${String(i + 1).padStart(6, '0')}</AcctSvcrRef>` +
      `<BkTxCd><Prtry><Cd>${m.op}</Cd><Issr>CFONB</Issr></Prtry></BkTxCd>` +
      `<NtryDtls><TxDtls><Refs>${extra.RCN ? `<EndToEndId>${xe(extra.RCN)}</EndToEndId>` : '<EndToEndId>NOTPROVIDED</EndToEndId>'}${extra.RUM ? `<MndtId>${xe(extra.RUM)}</MndtId>` : ''}</Refs>` +
      (party ? `<RltdPties><${credit ? 'Dbtr' : 'Cdtr'}><Pty><Nm>${xe(party)}</Nm></Pty></${credit ? 'Dbtr' : 'Cdtr'}></RltdPties>` : '') +
      `<RmtInf><Ustrd>${xe(ustrd)}</Ustrd></RmtInf></TxDtls></NtryDtls>` +
      `<AddtlNtryInf>${xe(m.label)}</AddtlNtryInf></Ntry>`
    );
  }).join('\n      ');
  const net = Math.round(SAMPLE_MOVES.reduce((s, m) => s + m.amount, 0) * 100) / 100;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>EXEMPLE-20261031</MsgId><CreDtTm>2026-11-01T06:00:00</CreDtTm></GrpHdr>
    <Stmt>
      <Id>RELEVE-2026-10</Id>
      <CreDtTm>2026-11-01T06:00:00</CreDtTm>
      <Acct><Id><IBAN>${iban}</IBAN></Id><Ccy>EUR</Ccy><Ownr><Nm>STUDIO EXEMPLE SAS</Nm></Ownr><Svcr><FinInstnId><BICFI>EXMPFRPPXXX</BICFI></FinInstnId></Svcr></Acct>
      ${bal('OPBD', SAMPLE_OPENING, '2026-09-30')}
      ${bal('CLBD', closing, '2026-10-31')}
      <TxsSummry><TtlNtries><NbOfNtries>${SAMPLE_MOVES.length}</NbOfNtries><TtlNetNtry><Amt>${Math.abs(net).toFixed(2)}</Amt><CdtDbtInd>${net < 0 ? 'DBIT' : 'CRDT'}</CdtDbtInd></TtlNetNtry></TtlNtries></TxsSummry>
      ${entries}
    </Stmt>
  </BkToCstmrStmt>
</Document>
`;
}

/** Relevé MT940 d'exemple, avec un :86: structuré à la mode SEPA (/EREF/…/NAME/…/REMI/…). */
export function sampleMt940(): string {
  const yymmdd = (iso: string) => iso.slice(2).replace(/-/g, '');
  const mmdd = (iso: string) => iso.slice(5).replace('-', '');
  const swift = (n: number) => Math.abs(n).toFixed(2).replace('.', ',');
  const closing = Math.round((SAMPLE_OPENING + SAMPLE_MOVES.reduce((s, m) => s + m.amount, 0)) * 100) / 100;
  const types: Record<string, string> = { '05': 'NTRF', '06': 'NTRF', B1: 'NDDT', '11': 'NMSC', '02': 'NCLR', '01': 'NCHK', '62': 'NCHG' };
  const iban = `FR76${BANK}${BRANCH}${ACCOUNT}86`;
  const lines = [':20:RELEVE202610', `:25:${iban}`, ':28C:10/1', `:60F:${SAMPLE_OPENING < 0 ? 'D' : 'C'}260930EUR${swift(SAMPLE_OPENING)}`];
  SAMPLE_MOVES.forEach((m, i) => {
    const extra = Object.fromEntries(m.extra ?? []);
    lines.push(`:61:${yymmdd(m.value)}${mmdd(m.date)}${m.amount < 0 ? 'D' : 'C'}${swift(m.amount)}${types[m.op] ?? 'NMSC'}${m.ref ?? 'NONREF'}//2026${String(i + 1).padStart(6, '0')}`);
    const party = m.amount < 0 ? extra.NBE : extra.NPY;
    const parts = [extra.RCN ? `/EREF/${extra.RCN}` : '/EREF/NOTPROVIDED', extra.RUM ? `/MREF/${extra.RUM}` : '', party ? `/NAME/${party}` : '', `/REMI/${extra.LCC ?? m.label}`].join('');
    // Le champ :86: est découpé en lignes de 65 caractères au plus.
    lines.push(':86:' + parts.slice(0, 65), ...(parts.slice(65).match(/.{1,65}/g) ?? []));
  });
  lines.push(`:62F:${closing < 0 ? 'D' : 'C'}261031EUR${swift(closing)}`, '-');
  return lines.join('\r\n') + '\r\n';
}
