// @vitest-environment happy-dom
import { mkdirSync, writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { decodeAmount, decodeDate, encodeAmount, parseStatement, toCsv, toOfx, toXlsx } from '../src/lib';
import { SAMPLE_MOVES, SAMPLE_OPENING, sampleCamt053, sampleCfonb } from '../src/lib/sample';
import { colName, excelDate } from '../src/lib/export';

const closing = Math.round((SAMPLE_OPENING + SAMPLE_MOVES.reduce((s, m) => s + m.amount, 0)) * 100) / 100;

describe('montants CFONB (signe superposé)', () => {
  it.each([
    ['0000000012345{', 2, 1234.5],
    ['0000000012345A', 2, 1234.51],
    ['0000000012345I', 2, 1234.59],
    ['0000000012345}', 2, -1234.5],
    ['0000000012345J', 2, -1234.51],
    ['0000000012345R', 2, -1234.59],
    ['0000000000000{', 2, 0],
    ['0000000000123E', 0, 1235],
  ])('%s (%i décimales) → %f', (raw, dec, expected) => {
    expect(decodeAmount(raw, dec)).toBe(expected);
  });
  it('encode puis décode à l’identique', () => {
    for (const v of [0, 0.01, -0.01, 186.42, -186.42, 999999.99, -12.5]) expect(decodeAmount(encodeAmount(v), 2)).toBe(v);
  });
  it('refuse une zone illisible', () => {
    expect(decodeAmount('00000ABC00000{', 2)).toBeUndefined();
  });
});

describe('dates', () => {
  it('JJMMAA → ISO', () => {
    expect(decodeDate('311026')).toBe('2026-10-31');
    expect(decodeDate('010199')).toBe('1999-01-01');
    expect(decodeDate('310226')).toBeUndefined();
  });
  it('numéro de série Excel', () => {
    expect(excelDate('1900-03-01')).toBe(61);
    expect(excelDate('2026-10-31')).toBe(46326);
    expect(colName(0)).toBe('A');
    expect(colName(26)).toBe('AA');
  });
});

describe('CFONB 120', () => {
  const text = sampleCfonb();
  it('produit des lignes de 120 caractères', () => {
    for (const l of text.split('\r\n').filter(Boolean)) expect(l.length).toBe(120);
  });
  const r = parseStatement(text);
  it('lit soldes et mouvements', () => {
    expect(r.format).toBe('CFONB 120');
    expect(r.statements).toHaveLength(1);
    const s = r.statements[0];
    expect(s.account).toBe('00012345678');
    expect(s.opening).toEqual({ date: '2026-09-30', amount: SAMPLE_OPENING });
    expect(s.closing?.amount).toBe(closing);
    expect(s.transactions).toHaveLength(SAMPLE_MOVES.length);
    const vir = s.transactions[0];
    expect(vir).toMatchObject({ bookingDate: '2026-10-01', amount: 2400, opCode: '05', opLabel: 'Virements reçus', counterparty: 'ATELIER BOIS ET CIE', endToEndId: 'F2026118' });
    expect(vir.details).toContain('FACTURE F-2026-118');
    const prlv = s.transactions[1];
    expect(prlv).toMatchObject({ amount: -186.42, opCode: 'B1', counterparty: 'FOURNISSEUR ENERGIE SA', mandateId: 'MDT-0045871', creditorId: 'FR12ZZZ123456' });
    expect(s.transactions[4].entryNumber).toBe('4521');
    expect(s.transactions[2].valueDate).toBe('2026-10-05');
  });
  it('vérifie l’équilibre des soldes', () => {
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(r.passed.some((p) => p.includes('nouveau solde'))).toBe(true);
  });
  it('détecte un relevé déséquilibré', () => {
    const lines = text.trim().split('\r\n');
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.slice(0, 90) + encodeAmount(closing + 1) + last.slice(104);
    const bad = parseStatement(lines.join('\r\n'));
    expect(bad.issues.some((i) => i.severity === 'error' && i.message.includes('écart'))).toBe(true);
  });
  it('accepte un fichier sans retours à la ligne et des lignes tronquées', () => {
    const oneLine = parseStatement(text.replace(/\r\n/g, ''));
    expect(oneLine.statements[0].transactions).toHaveLength(SAMPLE_MOVES.length);
    const trimmed = parseStatement(text.split('\r\n').map((l) => l.trimEnd()).join('\n'));
    expect(trimmed.statements[0].transactions).toHaveLength(SAMPLE_MOVES.length);
    expect(trimmed.issues.some((i) => i.message.includes('120 caractères'))).toBe(true);
  });
  it('lit un fichier encodé en Windows-1252', () => {
    const latin = text.replace('FRAIS TENUE DE COMPTE', 'FRAIS RELEVE TENUE COMPTE ÉTÉ');
    const bytes = Uint8Array.from([...latin].map((c) => c.charCodeAt(0) & 0xff));
    // É = 0xC9 en Windows-1252 : la longueur reste de 120 caractères
    const r2 = parseStatement(bytes);
    expect(r2.statements[0].transactions[6].label).toContain('ÉTÉ');
  });
});

describe('camt.053', () => {
  const r = parseStatement(sampleCamt053());
  it('lit le relevé ISO 20022', () => {
    expect(r.format).toBe('camt.053');
    const s = r.statements[0];
    expect(s.iban).toMatch(/^FR76/);
    expect(s.owner).toBe('STUDIO EXEMPLE SAS');
    expect(s.opening?.amount).toBe(SAMPLE_OPENING);
    expect(s.closing?.amount).toBe(closing);
    expect(s.transactions).toHaveLength(SAMPLE_MOVES.length);
    expect(s.transactions[0]).toMatchObject({ amount: 2400, counterparty: 'ATELIER BOIS ET CIE', opCode: '05', endToEndId: 'F2026118' });
    expect(s.transactions[1]).toMatchObject({ amount: -186.42, counterparty: 'FOURNISSEUR ENERGIE SA', mandateId: 'MDT-0045871' });
  });
  it('contrôles : nombre d’écritures, total net et soldes', () => {
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(r.passed.length).toBeGreaterThanOrEqual(3);
  });
  it('accepte l’ancienne syntaxe (camt.053.001.02, Nm direct)', () => {
    const v2 = sampleCamt053()
      .replace('camt.053.001.08', 'camt.053.001.02')
      .replace(/<Pty><Nm>([^<]*)<\/Nm><\/Pty>/g, '<Nm>$1</Nm>')
      .replace(/<Sts><Cd>BOOK<\/Cd><\/Sts>/g, '<Sts>BOOK</Sts>');
    const r2 = parseStatement(v2);
    expect(r2.statements[0].transactions[0].counterparty).toBe('ATELIER BOIS ET CIE');
    expect(r2.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('rejette un XML qui n’est pas un relevé', () => {
    expect(() => parseStatement('<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"><CstmrCdtTrfInitn/></Document>')).toThrow(/pain/);
  });
});

describe('exports', () => {
  const r = parseStatement(sampleCfonb());
  it('CSV point-virgule, virgule décimale, BOM', () => {
    const csv = toCsv(r.statements);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(SAMPLE_MOVES.length + 1);
    expect(lines[1]).toContain('01/10/2026');
    expect(lines[1]).toContain('2400,00');
    expect(lines[2]).toContain(';186,42;');
  });
  it('XLSX valide (zip + feuilles)', () => {
    const bytes = toXlsx(r.statements);
    const files = unzipSync(bytes);
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/styles.xml']));
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('ATELIER BOIS ET CIE');
    expect(sheet).toContain('<v>46296</v>'); // 2026-10-01
    expect(new DOMParser().parseFromString(sheet, 'application/xml').getElementsByTagName('parsererror')).toHaveLength(0);
    mkdirSync('tests/out', { recursive: true });
    writeFileSync('tests/out/exemple.xlsx', bytes);
    writeFileSync('tests/out/exemple.cfonb', sampleCfonb());
    writeFileSync('tests/out/exemple-camt053.xml', sampleCamt053());
  });
  it('OFX', () => {
    const ofx = toOfx(r.statements);
    expect(ofx).toContain('<TRNAMT>-186.42');
    expect(ofx.match(/<STMTTRN>/g)).toHaveLength(SAMPLE_MOVES.length);
  });
});
