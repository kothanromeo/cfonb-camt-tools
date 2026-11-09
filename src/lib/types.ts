export type SourceFormat = 'CFONB 120' | 'camt.053' | 'camt.052' | 'camt.054';

export interface Balance {
  /** AAAA-MM-JJ */
  date?: string;
  /** Montant signé : positif = créditeur, négatif = débiteur. */
  amount: number;
}

export interface Transaction {
  bookingDate?: string;
  valueDate?: string;
  /** Montant signé : positif = crédit (entrée d'argent), négatif = débit. */
  amount: number;
  currency: string;
  label: string;
  /** Informations complémentaires (enregistrements 05, RmtInf, AddtlNtryInf…). */
  details: string[];
  /** Code opération interbancaire CFONB, ou code de transaction bancaire ISO 20022. */
  opCode?: string;
  opLabel?: string;
  /** Code opération interne à la banque (CFONB, positions 8-11). */
  bankCode?: string;
  counterparty?: string;
  counterpartyIban?: string;
  reference?: string;
  endToEndId?: string;
  mandateId?: string;
  creditorId?: string;
  entryNumber?: string;
  rejectCode?: string;
  status?: string;
}

export interface Statement {
  format: SourceFormat;
  id?: string;
  account: string;
  iban?: string;
  bankCode?: string;
  branchCode?: string;
  currency: string;
  owner?: string;
  bankName?: string;
  opening?: Balance;
  closing?: Balance;
  transactions: Transaction[];
}

export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  severity: Severity;
  message: string;
  /** Numéro de ligne (CFONB) quand c'est pertinent. */
  line?: number;
}

export interface ParseResult {
  format: SourceFormat;
  statements: Statement[];
  issues: Issue[];
  /** Contrôles réussis, affichés en vert. */
  passed: string[];
}
