import { describe, expect, it } from 'vitest';
import { parse86, parseStatement, toXlsx } from '../src/lib';
import { SAMPLE_MOVES, SAMPLE_OPENING, sampleMt940 } from '../src/lib/sample';

const closing = Math.round((SAMPLE_OPENING + SAMPLE_MOVES.reduce((s, m) => s + m.amount, 0)) * 100) / 100;

describe('MT940', () => {
  const text = sampleMt940();
  const r = parseStatement(text);
  it('détecte et lit le relevé', () => {
    expect(r.format).toBe('MT940');
    const s = r.statements[0];
    expect(s.iban).toMatch(/^FR76/);
    expect(s.opening).toEqual({ date: '2026-09-30', amount: SAMPLE_OPENING });
    expect(s.closing?.amount).toBe(closing);
    expect(s.transactions).toHaveLength(SAMPLE_MOVES.length);
    expect(s.transactions[0]).toMatchObject({ bookingDate: '2026-10-01', amount: 2400, opCode: 'TRF', counterparty: 'ATELIER BOIS ET CIE', endToEndId: 'F2026118', label: 'FACTURE F-2026-118' });
    expect(s.transactions[1]).toMatchObject({ amount: -186.42, opCode: 'DDT', mandateId: 'MDT-0045871', counterparty: 'FOURNISSEUR ENERGIE SA' });
    // date de valeur 05/10, comptabilisation 06/10
    expect(s.transactions[2]).toMatchObject({ valueDate: '2026-10-05', bookingDate: '2026-10-06' });
  });
  it('contrôle les soldes', () => {
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(r.passed.some((p) => p.includes('nouveau solde'))).toBe(true);
  });
  it('lit l’enveloppe SWIFT et plusieurs relevés', () => {
    const two = `{1:F01BANKFRPPAXXX0000000000}{2:I940BANKFRPPXXXXN}{4:\r\n${text.replace(/-\r\n$/, '')}-}{1:F01BANKFRPPAXXX0000000000}{4:\r\n${text.replace(':20:RELEVE202610', ':20:RELEVE202611').replace(/-\r\n$/, '')}-}`;
    const r2 = parseStatement(two);
    expect(r2.statements).toHaveLength(2);
    expect(r2.statements[1].id).toBe('RELEVE202611');
  });
  it('annulations, passage d’année et montants', () => {
    const t = ':20:X\n:25:12345/678\n:60F:C251231EUR100,00\n:61:2512310102RC10,00NTRFNONREF\n:86:Annulation\n:61:2601020102D5,5NCHG\n:62F:C260102EUR84,50\n-';
    const s = parseStatement(t).statements[0];
    expect(s.transactions[0]).toMatchObject({ amount: -10, bookingDate: '2026-01-02', valueDate: '2025-12-31', opLabel: 'Virement (annulation)' });
    expect(s.transactions[1].amount).toBe(-5.5);
    expect(parseStatement(t).issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
  it(':86: au format allemand ?20/?32', () => {
    const i = parse86('166?00SEPA-UEBERWEISUNG?20EREF+ABC123 SVWZ+Rechnung?2142?32MUSTERMANN GMBH?31DE89370400440532013000');
    expect(i.counterparty).toBe('MUSTERMANN GMBH');
    expect(i.counterpartyIban).toBe('DE89370400440532013000');
    expect(i.endToEndId).toBe('ABC123');
  });
  it('s’exporte en Excel', () => {
    expect(toXlsx(r.statements).length).toBeGreaterThan(1000);
  });
});
