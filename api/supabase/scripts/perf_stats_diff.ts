/**
 * perf_stats_diff.ts — Compara dos fotos de perf_stats_snapshot.sql (T0 y T1).
 *
 * Muestra lo que pasó ENTRE las dos fotos (estado actual), no lo acumulado desde
 * el último reset de estadísticas.
 *
 *   npx tsx api/supabase/scripts/perf_stats_diff.ts stats-T0.csv stats-T1.csv
 *
 * Solo lee archivos locales; no se conecta a ninguna base.
 */
import { readFileSync } from 'node:fs';

type Row = { kind: string; role: string; object: string; v: number[]; label: string };

const HOT_TABLES = new Set(['bets', 'bets_archive', 'tickets', 'tickets_archive', 'polla_bets']);

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function load(path: string): Map<string, Row> {
  const raw = readFileSync(path, 'utf8');
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw; // BOM (Out-File de PowerShell)
  const [header, ...lines] = parseCsv(text);
  if (!header || header[0] !== 'kind') {
    throw new Error(
      `${path}: no parece una salida de perf_stats_snapshot.sql (falta el encabezado "kind")`
    );
  }
  const map = new Map<string, Row>();
  for (const cols of lines) {
    const [kind, role, object, ...rest] = cols;
    const v = rest.slice(0, 7).map((x) => (x === '' ? 0 : Number(x)));
    const label = rest[7] ?? '';
    map.set(`${kind}|${role}|${object}`, { kind, role, object, v, label });
  }
  return map;
}

function meta(map: Map<string, Row>, name: string): string {
  return map.get(`meta||${name}`)?.label ?? '';
}

function delta(t0: Map<string, Row>, t1: Map<string, Row>, kind: string): Row[] {
  const out: Row[] = [];
  for (const [key, r1] of t1) {
    if (r1.kind !== kind) continue;
    const r0 = t0.get(key);
    const v = r1.v.map((x, i) => x - (r0?.v[i] ?? 0));
    out.push({ ...r1, v });
  }
  return out;
}

const fmt = (n: number, d = 0) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: d, minimumFractionDigits: d });

function table(headers: string[], rows: (string | number)[][]): void {
  const cells = rows.map((r) => r.map((c) => String(c)));
  const widths = headers.map((h, i) => Math.max(h.length, ...cells.map((r) => r[i].length)));
  const line = (r: string[]) =>
    r.map((c, i) => (i === r.length - 1 ? c : c.padStart(widths[i]))).join(' | ');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('-+-'));
  for (const r of cells) console.log(line(r));
  console.log('');
}

function main(): void {
  const [p0, p1] = process.argv.slice(2);
  if (!p0 || !p1) {
    console.error('Uso: npx tsx api/supabase/scripts/perf_stats_diff.ts <T0.csv> <T1.csv>');
    process.exit(1);
  }
  const t0 = load(p0);
  const t1 = load(p1);

  const at0 = new Date(meta(t0, 'captured_at'));
  const at1 = new Date(meta(t1, 'captured_at'));
  const hours = (at1.getTime() - at0.getTime()) / 3_600_000;
  console.log(
    `Ventana: ${meta(t0, 'captured_at')} → ${meta(t1, 'captured_at')} (${fmt(hours, 1)} h)\n`
  );
  for (const name of ['stmt_reset', 'db_reset']) {
    if (meta(t0, name) !== meta(t1, name)) {
      console.log(
        `ATENCIÓN: ${name} cambió entre las fotos (${meta(t0, name)} → ${meta(t1, name)}): el delta no es válido.\n`
      );
    }
  }

  const stmts = delta(t0, t1, 'stmt').filter((r) => r.v[0] > 0);
  const totalMs = stmts.reduce((acc, r) => acc + r.v[1], 0);
  const stmtRow = (r: Row) => [
    fmt(r.v[0]),
    fmt(r.v[1] / 1000, 1),
    fmt((100 * r.v[1]) / (totalMs || 1), 1),
    fmt(r.v[1] / r.v[0], 1),
    fmt(r.v[3] / r.v[0]),
    fmt(r.v[4]),
    r.role,
    r.label.slice(0, 220),
  ];
  const stmtHeaders = ['calls', 'total_s', '%', 'mean_ms', 'buf/call', 'blks_read', 'rol', 'query'];

  console.log(
    `=== Top 25 statements por tiempo total en la ventana (total: ${fmt(totalMs / 1000, 0)} s)`
  );
  table(
    stmtHeaders,
    [...stmts]
      .sort((a, b) => b.v[1] - a.v[1])
      .slice(0, 25)
      .map(stmtRow)
  );

  console.log('=== Top 15 statements por tiempo medio (calls >= 20 en la ventana)');
  table(
    stmtHeaders,
    stmts
      .filter((r) => r.v[0] >= 20)
      .sort((a, b) => b.v[1] / b.v[0] - a.v[1] / a.v[0])
      .slice(0, 15)
      .map(stmtRow)
  );

  console.log('=== Tablas (actividad en la ventana)');
  table(
    ['seq_scan', 'seq_tup_read', 'tup/seq', 'idx_scan', 'ins', 'upd', 'hot%', 'del', 'tabla'],
    delta(t0, t1, 'tbl')
      .filter((r) => r.v.some((x) => x !== 0))
      .sort((a, b) => b.v[1] - a.v[1])
      .map((r) => [
        fmt(r.v[0]),
        fmt(r.v[1]),
        r.v[0] ? fmt(r.v[1] / r.v[0]) : '-',
        fmt(r.v[2]),
        fmt(r.v[3]),
        fmt(r.v[4]),
        r.v[4] ? fmt((100 * r.v[5]) / r.v[4], 1) : '-',
        fmt(r.v[6]),
        r.object,
      ])
  );

  console.log(
    '=== Índices de las tablas calientes (idx_scan en la ventana; 0 = candidato a revisar)'
  );
  table(
    ['idx_scan', 'tup_read', 'tup_fetch', 'blks_read', 'size', 'índice'],
    delta(t0, t1, 'idx')
      .filter((r) => HOT_TABLES.has(r.object.split('.')[0]))
      .sort(
        (a, b) => a.object.split('.')[0].localeCompare(b.object.split('.')[0]) || a.v[0] - b.v[0]
      )
      .map((r) => [fmt(r.v[0]), fmt(r.v[1]), fmt(r.v[2]), fmt(r.v[4]), r.label, r.object])
  );
}

main();
