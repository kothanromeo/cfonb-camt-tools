/** Arrondi au centime, robuste aux erreurs binaires. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100 || 0;
}

export function sum(values: number[]): number {
  // Calcul en centimes entiers pour éviter les dérives sur de longs relevés.
  return values.reduce((s, v) => s + Math.round(v * 100), 0) / 100;
}

/** Formate un montant à la française : 1 234,56 */
export function fr(n: number | undefined, cur = ''): string {
  if (n === undefined) return '—';
  const s = n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cur ? `${s} ${cur}` : s;
}

/** Décode un fichier texte : UTF-8 si valide, sinon Windows-1252 (cas fréquent des relevés bancaires). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
