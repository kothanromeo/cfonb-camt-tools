import { parseStatement } from '../lib';
import type { ParseResult, Statement, Transaction } from '../lib/types';
import { fr } from '../lib/util';
import { bindThanks, thanksCard, waitCard } from './creator';

/* Interface du convertisseur. Toute donnée issue du fichier passe par esc(). */

const MAX_PREVIEW = 300;

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const d = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '—');

function download(data: Uint8Array | string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function summary(s: Statement): string {
  const debits = s.transactions.filter((t) => t.amount < 0).reduce((a, t) => a + Math.round(t.amount * 100), 0) / 100;
  const credits = s.transactions.filter((t) => t.amount >= 0).reduce((a, t) => a + Math.round(t.amount * 100), 0) / 100;
  return `<div class="acct card">
    <div class="acct-head"><strong>${esc(s.iban ?? s.account)}</strong>
      <span class="hint">${esc(s.format)}${s.owner ? ` · ${esc(s.owner)}` : ''}${s.bankName ? ` · ${esc(s.bankName)}` : ''}${s.bankCode ? ` · banque ${esc(s.bankCode)} guichet ${esc(s.branchCode)}` : ''}</span></div>
    <dl class="acct-kv">
      <div><dt>Ancien solde${s.opening?.date ? ` au ${d(s.opening.date)}` : ''}</dt><dd>${fr(s.opening?.amount, s.currency)}</dd></div>
      <div><dt>${s.transactions.length} opération(s)</dt><dd><span class="neg">${fr(debits)}</span> / <span class="pos">+${fr(credits)}</span></dd></div>
      <div><dt>Nouveau solde${s.closing?.date ? ` au ${d(s.closing.date)}` : ''}</dt><dd><strong>${fr(s.closing?.amount, s.currency)}</strong></dd></div>
    </dl></div>`;
}

function row(t: Transaction, s: Statement, multi: boolean): string {
  const info = [t.counterparty, ...t.details].filter(Boolean).join(' · ');
  return `<tr>
    ${multi ? `<td class="mono">${esc((s.iban ?? s.account).slice(-8))}</td>` : ''}
    <td class="nowrap">${d(t.bookingDate)}</td>
    <td class="nowrap">${d(t.valueDate)}</td>
    <td>${esc(t.label)}${info ? `<br><small>${esc(info)}</small>` : ''}</td>
    <td class="nowrap" title="${esc(t.opLabel ?? '')}">${t.opCode ? `<span class="code">${esc(t.opCode)}</span>` : ''}${t.opLabel ? `<br><small>${esc(t.opLabel)}</small>` : ''}</td>
    <td class="num ${t.amount < 0 ? 'neg' : 'pos'}">${t.amount < 0 ? '' : '+'}${fr(t.amount)}</td>
  </tr>`;
}

function checks(r: ParseResult): string {
  const errors = r.issues.filter((i) => i.severity === 'error');
  const warnings = r.issues.filter((i) => i.severity === 'warning');
  const infos = r.issues.filter((i) => i.severity === 'info');
  const li = (cls: string, icon: string, msg: string, line?: number) =>
    `<li class="${cls}"><span class="ic">${icon}</span><span>${esc(msg)}</span><span class="rule">${line ? `ligne ${line}` : ''}</span></li>`;
  return `<ul class="checks">${[
    ...errors.map((i) => li('error', '✕', i.message, i.line)),
    ...warnings.map((i) => li('warning', '!', i.message, i.line)),
    ...infos.map((i) => li('warning', 'i', i.message, i.line)),
    ...r.passed.map((p) => li('pass', '✓', p)),
  ].join('')}</ul>`;
}

export function render(out: HTMLElement, r: ParseResult, fileName: string) {
  const all = r.statements.flatMap((s) => s.transactions.map((t) => [t, s] as const));
  const multi = r.statements.length > 1 && new Set(r.statements.map((s) => s.account)).size > 1;
  const errors = r.issues.filter((i) => i.severity === 'error').length;
  const base = fileName.replace(/\.[^.]+$/, '') || 'releve';

  const banner = errors
    ? `<div class="banner err"><div><strong>Relevé lu, mais ${errors} anomalie(s) à vérifier</strong><p>${all.length} opérations converties depuis un fichier ${esc(r.format)}. Le détail est dans l’onglet « Contrôles ».</p></div></div>`
    : `<div class="banner ok"><div><strong>${all.length} opérations converties</strong><p>Format ${esc(r.format)} · ${r.statements.length} relevé(s) · soldes contrôlés.</p></div></div>`;

  out.innerHTML = `${banner}
    <div class="export-bar card">
      <span class="export-title">Télécharger :</span>
      <div class="btn-row">
        <button type="button" class="btn" data-export="xlsx">Excel (.xlsx)</button>
        <button type="button" class="btn secondary" data-export="csv">CSV (Excel FR)</button>
        <button type="button" class="btn ghost" data-export="csv-intl">CSV international</button>
        <button type="button" class="btn ghost" data-export="ofx">OFX</button>
      </div>
    </div>
    ${thanksCard('conversion')}
    <div class="tabs" role="tablist">
      <button type="button" role="tab" aria-selected="true" data-tab="ops">Opérations (${all.length})</button>
      <button type="button" role="tab" aria-selected="false" data-tab="soldes">Soldes</button>
      <button type="button" role="tab" aria-selected="false" data-tab="controles">Contrôles${errors ? ` (${errors})` : ''}</button>
    </div>
    <div class="panel card" data-panel="ops">
      <input type="search" class="filter" placeholder="Filtrer : libellé, tiers, montant, code…" aria-label="Filtrer les opérations" data-filter />
      <div class="table-wrap"><table class="ops"><thead><tr>${multi ? '<th>Compte</th>' : ''}<th>Date</th><th>Valeur</th><th>Libellé et détails</th><th>Code</th><th class="num">Montant</th></tr></thead>
      <tbody data-rows></tbody></table></div>
      <p class="hint" data-more></p>
    </div>
    <div class="panel" data-panel="soldes" hidden>${r.statements.map(summary).join('')}</div>
    <div class="panel card" data-panel="controles" hidden>
      <p class="hint">Contrôle principal : ancien solde + somme des opérations = nouveau solde. Un écart signale un fichier incomplet ou altéré.</p>
      ${checks(r)}
    </div>
    <div class="btn-row" style="margin-top:1rem"><button type="button" class="btn ghost" data-reset>Convertir un autre fichier</button></div>`;
  out.hidden = false;
  bindThanks(out);

  const tbody = out.querySelector<HTMLElement>('[data-rows]')!;
  const more = out.querySelector<HTMLElement>('[data-more]')!;
  const draw = (q: string) => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? all.filter(([t]) => [t.label, t.counterparty, ...t.details, t.opCode, t.opLabel, fr(t.amount), String(t.amount), d(t.bookingDate)].join(' ').toLowerCase().includes(needle))
      : all;
    tbody.innerHTML = list.slice(0, MAX_PREVIEW).map(([t, s]) => row(t, s, multi)).join('') || `<tr><td colspan="6">Aucune opération ne correspond.</td></tr>`;
    more.textContent = list.length > MAX_PREVIEW ? `Aperçu limité aux ${MAX_PREVIEW} premières lignes sur ${list.length}. Le fichier exporté contient tout.` : '';
  };
  draw('');
  out.querySelector<HTMLInputElement>('[data-filter]')!.addEventListener('input', (e) => draw((e.target as HTMLInputElement).value));

  out.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      out.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      out.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
    }),
  );

  out.querySelectorAll<HTMLButtonElement>('[data-export]').forEach((b) =>
    b.addEventListener('click', async () => {
      const { toCsv, toXlsx, toOfx } = await import('../lib/export');
      const kind = b.dataset.export;
      if (kind === 'xlsx') download(toXlsx(r.statements), `${base}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      else if (kind === 'csv') download(toCsv(r.statements), `${base}.csv`, 'text/csv;charset=utf-8');
      else if (kind === 'csv-intl') download(toCsv(r.statements, { separator: ',', decimal: '.', dateFormat: 'iso' }), `${base}-intl.csv`, 'text/csv;charset=utf-8');
      else if (kind === 'ofx') download(toOfx(r.statements), `${base}.ofx`, 'application/x-ofx');
    }),
  );

  out.querySelector('[data-reset]')!.addEventListener('click', () => {
    out.hidden = true;
    out.innerHTML = '';
    out.parentElement?.querySelector('[data-drop]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function mountConverter(root: HTMLElement) {
  const drop = root.querySelector<HTMLElement>('[data-drop]')!;
  const input = root.querySelector<HTMLInputElement>('[data-file]')!;
  const out = root.querySelector<HTMLElement>('[data-result]')!;
  const sampleBtn = root.querySelector<HTMLButtonElement>('[data-sample]')!;

  const run = async (get: () => Promise<Uint8Array | string>, name: string, label = 'Lecture du relevé…') => {
    const timer = setTimeout(() => {
      out.innerHTML = waitCard(label);
      out.hidden = false;
    }, 150);
    try {
      const data = await get();
      const r = parseStatement(data);
      clearTimeout(timer);
      render(out, r, name);
    } catch (e) {
      clearTimeout(timer);
      out.innerHTML = `<div class="banner err"><div><strong>Conversion impossible</strong><p>${esc(e instanceof Error ? e.message : e)}</p></div></div>`;
      out.hidden = false;
    }
  };

  const handle = (file?: File) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      out.innerHTML = '<div class="banner err"><div><strong>Fichier trop volumineux</strong><p>100 Mo maximum.</p></div></div>';
      out.hidden = false;
      return;
    }
    run(async () => new Uint8Array(await file.arrayBuffer()), file.name);
  };

  input.addEventListener('change', () => {
    handle(input.files?.[0]);
    input.value = '';
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    handle(e.dataTransfer?.files[0]);
  });
  sampleBtn.addEventListener('click', () => {
    const kind = root.dataset.sampleKind;
    run(
      async () => {
        const m = await import('../lib/sample');
        return kind === 'camt' ? m.sampleCamt053() : kind === 'mt940' ? m.sampleMt940() : m.sampleCfonb();
      },
      kind === 'camt' ? 'exemple-camt053.xml' : kind === 'mt940' ? 'exemple-mt940.sta' : 'exemple-cfonb120.txt',
      'Création d’un relevé d’exemple…',
    );
  });
}
