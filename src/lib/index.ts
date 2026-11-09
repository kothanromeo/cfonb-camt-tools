import { looksLikeCamt, parseCamt } from './camt';
import { looksLikeCfonb, parseCfonb } from './cfonb';
import type { ParseResult } from './types';
import { decodeText } from './util';

export * from './types';
export { parseCfonb, decodeAmount, encodeAmount, decodeDate } from './cfonb';
export { parseCamt, CamtError } from './camt';
export { toCsv, toXlsx, toOfx, COLUMNS } from './export';
export { OP_CODES, QUALIFIERS } from './codes';

export class FormatError extends Error {}

/** Détecte le format (CFONB 120 ou ISO 20022 camt) et lit le relevé. */
export function parseStatement(input: Uint8Array | string): ParseResult {
  const text = typeof input === 'string' ? input : decodeText(input);
  const head = text.trimStart();
  if (head.startsWith('<')) {
    if (looksLikeCamt(head) || /BkToCstmr/.test(head.slice(0, 5000))) return parseCamt(head);
    throw new FormatError(
      'Ce fichier XML n’est pas un relevé ISO 20022 camt.053, camt.052 ou camt.054. S’il s’agit d’un ordre de virement (pain.001) ou de prélèvement (pain.008), ce n’est pas un relevé de compte.',
    );
  }
  if (looksLikeCfonb(text)) return parseCfonb(text);
  if (/^:20:|:60F:|:61:/m.test(text.slice(0, 3000))) {
    throw new FormatError('Ce fichier ressemble à un relevé SWIFT MT940, un format qui n’est pas encore pris en charge.');
  }
  if (/^OFXHEADER|<OFX>/i.test(head)) throw new FormatError('Ce fichier est déjà au format OFX.');
  throw new FormatError(
    'Format non reconnu. Un relevé CFONB 120 commence par « 01 » suivi du code banque ; un relevé camt.053 est un fichier XML ISO 20022.',
  );
}
