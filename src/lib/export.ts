import { zipSync, strToU8 } from 'fflate';
import type { Statement, Transaction } from './types';

/*
 * Export tableur : CSV « à la française » (point-virgule, virgule décimale, BOM UTF-8
 * pour qu'Excel affiche correctement les accents) et XLSX natif, écrit à la main
 * (Office Open XML) pour éviter une dépendance lourde.
 */

export interface Column {
  key: string;
  label: string;
  type: 'text' | 'date' | 'amount';
  width: number;
  get: (t: Transaction, s: Statement) => string | number | undefined;
}

export const COLUMNS: Column[] = [
  { key: 'account', label: 'Compte', type: 'text', width: 26, get: (_t, s) => s.iban ?? s.account },
  { key: 'bookingDate', label: 'Date comptable', type: 'date', width: 13, get: (t) => t.bookingDate },
  { key: 'valueDate', label: 'Date de valeur', type: 'date', width: 13, get: (t) => t.valueDate },
  { key: 'label', label: 'Libellé', type: 'text', width: 38, get: (t) => t.label },
  { key: 'details', label: 'Informations complémentaires', type: 'text', width: 48, get: (t) => t.details.join(' | ') || undefined },
  { key: 'counterparty', label: 'Tiers', type: 'text', width: 26, get: (t) => t.counterparty },
  { key: 'debit', label: 'Débit', type: 'amount', width: 13, get: (t) => (t.amount < 0 ? -t.amount : undefined) },
  { key: 'credit', label: 'Crédit', type: 'amount', width: 13, get: (t) => (t.amount >= 0 ? t.amount : undefined) },
  { key: 'amount', label: 'Montant', type: 'amount', width: 13, get: (t) => t.amount },
  { key: 'currency', label: 'Devise', type: 'text', width: 8, get: (t) => t.currency },
  { key: 'opCode', label: 'Code opération', type: 'text', width: 14, get: (t) => t.opCode },
  { key: 'opLabel', label: 'Type d’opération', type: 'text', width: 30, get: (t) => t.opLabel },
  { key: 'reference', label: 'Référence', type: 'text', width: 20, get: (t) => t.reference },
  { key: 'endToEndId', label: 'Référence de bout en bout', type: 'text', width: 24, get: (t) => t.endToEndId },
  { key: 'entryNumber', label: 'N° d’écriture', type: 'text', width: 12, get: (t) => t.entryNumber },
];

export interface ExportOptions {
  /** Colonnes à inclure (par clé). Par défaut : toutes. */
  columns?: string[];
  separator?: ';' | ',' | '\t';
  decimal?: ',' | '.';
  dateFormat?: 'fr' | 'iso';
}

function pick(opts: ExportOptions): Column[] {
  return opts.columns ? COLUMNS.filter((c) => opts.columns!.includes(c.key)) : COLUMNS;
}

function rows(statements: Statement[]): [Transaction, Statement][] {
  return statements.flatMap((s) => s.transactions.map((t) => [t, s] as [Transaction, Statement]));
}

// --- CSV ---------------------------------------------------------------------------

export function toCsv(statements: Statement[], opts: ExportOptions = {}): string {
  const sep = opts.separator ?? ';';
  const dec = opts.decimal ?? (sep === ',' ? '.' : ',');
  const cols = pick(opts);
  const cell = (v: string | number | undefined, c: Column): string => {
    if (v === undefined || v === '') return '';
    let s: string;
    if (c.type === 'amount') s = (v as number).toFixed(2).replace('.', dec);
    else if (c.type === 'date' && opts.dateFormat !== 'iso') s = String(v).split('-').reverse().join('/');
    else s = String(v);
    const needsQuotes = s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(sep) || s !== s.trim();
    return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map((c) => cell(c.label, { ...c, type: 'text' })).join(sep)];
  for (const [t, s] of rows(statements)) lines.push(cols.map((c) => cell(c.get(t, s), c)).join(sep));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// --- XLSX --------------------------------------------------------------------------

const xmlEsc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // caractères de contrôle interdits en XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** Lettre de colonne Excel (0 → A, 26 → AA). */
export function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Numéro de série Excel d'une date AAAA-MM-JJ (système 1900). */
export function excelDate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

interface Sheet {
  name: string;
  header: string[];
  widths: number[];
  /** Valeurs déjà typées : string, number, ou { date } pour une date. */
  rows: (string | number | { date: string } | undefined)[][];
  /** Index des colonnes de montant (format 0,00). */
  amountCols: Set<number>;
  freeze?: boolean;
}

function sheetXml(sh: Sheet): string {
  const lastCol = colName(sh.header.length - 1);
  const lastRow = sh.rows.length + 1;
  const cell = (v: Sheet['rows'][number][number], r: number, c: number, header = false) => {
    const ref = `${colName(c)}${r}`;
    if (v === undefined || v === '') return '';
    if (header) return `<c r="${ref}" s="1" t="inlineStr"><is><t>${xmlEsc(String(v))}</t></is></c>`;
    if (typeof v === 'number') return `<c r="${ref}"${sh.amountCols.has(c) ? ' s="2"' : ''}><v>${v}</v></c>`;
    if (typeof v === 'object') return `<c r="${ref}" s="3"><v>${excelDate(v.date)}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  };
  const rowsXml = [
    `<row r="1">${sh.header.map((h, c) => cell(h, 1, c, true)).join('')}</row>`,
    ...sh.rows.map((row, i) => `<row r="${i + 2}">${row.map((v, c) => cell(v, i + 2, c)).join('')}</row>`),
  ].join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<dimension ref="A1:${lastCol}${lastRow}"/>` +
    (sh.freeze ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '') +
    `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${rowsXml}</sheetData>` +
    (sh.freeze && sh.rows.length ? `<autoFilter ref="A1:${lastCol}${lastRow}"/>` : '') +
    '</worksheet>'
  );
}

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE3F0F8"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

/** Nom d'onglet valide pour Excel (31 caractères, sans []:*?/\). */
function sheetName(s: string, used: Set<string>): string {
  let base = s.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || 'Feuille';
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 27)} (${i})`;
  used.add(name.toLowerCase());
  return name;
}

export function toXlsx(statements: Statement[], opts: ExportOptions = {}): Uint8Array {
  const cols = pick(opts);
  const value = (v: string | number | undefined, c: Column) =>
    v === undefined ? undefined : c.type === 'date' ? { date: String(v) } : v;

  const sheets: Sheet[] = [
    {
      name: 'Opérations',
      header: cols.map((c) => c.label),
      widths: cols.map((c) => c.width),
      rows: rows(statements).map(([t, s]) => cols.map((c) => value(c.get(t, s), c))),
      amountCols: new Set(cols.map((c, i) => (c.type === 'amount' ? i : -1)).filter((i) => i >= 0)),
      freeze: true,
    },
    {
      name: 'Soldes',
      header: ['Compte', 'Format', 'Devise', 'Date ancien solde', 'Ancien solde', 'Nb opérations', 'Total débits', 'Total crédits', 'Date nouveau solde', 'Nouveau solde'],
      widths: [28, 11, 8, 16, 15, 13, 15, 15, 17, 15],
      rows: statements.map((s) => [
        s.iban ?? s.account,
        s.format,
        s.currency,
        s.opening?.date ? { date: s.opening.date } : undefined,
        s.opening?.amount,
        s.transactions.length,
        -s.transactions.filter((t) => t.amount < 0).reduce((a, t) => a + Math.round(t.amount * 100), 0) / 100,
        s.transactions.filter((t) => t.amount >= 0).reduce((a, t) => a + Math.round(t.amount * 100), 0) / 100,
        s.closing?.date ? { date: s.closing.date } : undefined,
        s.closing?.amount,
      ]),
      amountCols: new Set([4, 6, 7, 9]),
      freeze: true,
    },
  ];

  const used = new Set<string>();
  const names = sheets.map((s) => sheetName(s.name, used));
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '</Relationships>',
    ),
    'docProps/core.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        '<dc:title>Relevé bancaire</dc:title><dc:creator>CFONB &amp; camt Tools</dc:creator>' +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</dcterms:created>` +
        '</cp:coreProperties>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets>${names.map((n, i) => `<sheet name="${xmlEsc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
        `<definedNames>${sheets
          .map((s, i) => (s.freeze && s.rows.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xmlEsc(names[i])}'!$A$1:$${colName(s.header.length - 1)}$${s.rows.length + 1}</definedName>` : ''))
          .join('')}</definedNames>` +
        '</workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(STYLES),
  };
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s))));
  return zipSync(files, { level: 6 });
}

/** Export OFX 1.0.2 (SGML), importable dans la plupart des logiciels de comptabilité et de budget. */
export function toOfx(statements: Statement[]): string {
  const d = (iso?: string) => (iso ?? '').replace(/-/g, '');
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const now = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  let out =
    'OFXHEADER:100\r\nDATA:OFXSGML\r\nVERSION:102\r\nSECURITY:NONE\r\nENCODING:USASCII\r\nCHARSET:1252\r\nCOMPRESSION:NONE\r\nOLDFILEUID:NONE\r\nNEWFILEUID:NONE\r\n\r\n' +
    `<OFX><SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>${now}<LANGUAGE>FRA</SONRS></SIGNONMSGSRSV1><BANKMSGSRSV1>`;
  statements.forEach((s, i) => {
    const dates = s.transactions.map((t) => t.bookingDate).filter(Boolean).sort() as string[];
    out +=
      `<STMTTRNRS><TRNUID>${i + 1}<STATUS><CODE>0<SEVERITY>INFO</STATUS><STMTRS><CURDEF>${s.currency}` +
      `<BANKACCTFROM><BANKID>${esc(s.bankCode ?? '')}<BRANCHID>${esc(s.branchCode ?? '')}<ACCTID>${esc(s.iban ?? s.account)}<ACCTTYPE>CHECKING</BANKACCTFROM>` +
      `<BANKTRANLIST><DTSTART>${d(s.opening?.date ?? dates[0])}<DTEND>${d(s.closing?.date ?? dates[dates.length - 1])}`;
    s.transactions.forEach((t, j) => {
      out +=
        `<STMTTRN><TRNTYPE>${t.amount < 0 ? 'DEBIT' : 'CREDIT'}<DTPOSTED>${d(t.bookingDate)}` +
        (t.valueDate ? `<DTAVAIL>${d(t.valueDate)}` : '') +
        `<TRNAMT>${t.amount.toFixed(2)}<FITID>${esc(t.reference ?? `${s.account}-${d(t.bookingDate)}-${j + 1}`)}` +
        `<NAME>${esc((t.counterparty ?? t.label).slice(0, 32))}<MEMO>${esc([t.label, ...t.details].join(' ').slice(0, 255))}</STMTTRN>`;
    });
    out += '</BANKTRANLIST>';
    if (s.closing) out += `<LEDGERBAL><BALAMT>${s.closing.amount.toFixed(2)}<DTASOF>${d(s.closing.date)}</LEDGERBAL>`;
    out += '</STMTRS></STMTTRNRS>';
  });
  return out + '</BANKMSGSRSV1></OFX>\r\n';
}
