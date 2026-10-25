// Pure helpers for the competitor scorecard. Works in Node and in the browser (index.html imports it).
// Input: one GET /v1/competitors/compare response. Output: rows, Markdown, CSV, a chat summary.

export function compact(n) {
  if (n == null || !Number.isFinite(n)) return '';
  const a = Math.abs(n);
  if (a >= 1e9) return trim(n / 1e9) + 'B';
  if (a >= 1e6) return trim(n / 1e6) + 'M';
  if (a >= 1e3) return trim(n / 1e3) + 'k';
  return String(Math.round(n));
}
function trim(x) { return (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toString(); }

// An estimate is { kind: 'range', range: {low, mid, high} }, { kind: 'below_floor', ceiling }, or null (unknown, not zero).
export function midOf(est) {
  if (!est) return null;
  if (est.kind === 'range' && est.range) return est.range.mid;
  if (est.kind === 'below_floor') return 0; // under the floor; treated as the bottom for sorting only
  return null;
}

export function describe(est, money = false) {
  const p = money ? '$' : '';
  if (!est) return 'unknown';
  if (est.kind === 'below_floor') return `under ${p}${compact(est.ceiling)}`;
  if (est.kind === 'range' && est.range) {
    const { low, mid, high } = est.range;
    return `${p}${compact(low)}–${p}${compact(high)} (mid ${p}${compact(mid)})`;
  }
  return 'unknown';
}

// Month-over-month change of the mid estimate, only when both months are ranges.
export function change(est) {
  if (!est || est.kind !== 'range' || !est.previous || est.previous.kind !== 'range') return null;
  const now = est.range?.mid, before = est.previous.range?.mid;
  if (!Number.isFinite(now) || !Number.isFinite(before) || before === 0) return null;
  return (now - before) / before;
}

export function pct(x) {
  if (x == null) return '';
  const v = Math.round(x * 100);
  return (v > 0 ? '+' : '') + v + '%';
}

export function toRows(resp) {
  const subject = resp?.subjectStoreId ?? null;
  return (resp?.data ?? []).map((d) => ({
    storeId: d.app?.storeId ?? '',
    name: d.app?.name ?? '',
    developer: d.app?.developerName ?? '',
    genre: d.app?.genre ?? '',
    rating: d.app?.rating ?? null,
    totalRatings: d.app?.totalRatings ?? null,
    installs: d.monthlyInstalls ?? null,
    revenue: d.monthlyRevenue ?? null,
    installsMid: midOf(d.monthlyInstalls),
    revenueMid: midOf(d.monthlyRevenue),
    installsChange: change(d.monthlyInstalls),
    revenueChange: change(d.monthlyRevenue),
    scoredAt: (d.monthlyInstalls?.observedAt ?? d.monthlyRevenue?.observedAt ?? '').slice(0, 10),
    currency: d.currency ?? 'USD',
    isSubject: d.app?.storeId === subject,
  }));
}

// Subject first, then the rest by the chosen key (installs or revenue), unknowns last.
export function sortRows(rows, by = 'installs') {
  const key = by === 'revenue' ? 'revenueMid' : 'installsMid';
  const subject = rows.filter((r) => r.isSubject);
  const rest = rows.filter((r) => !r.isSubject).sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1));
  return [...subject, ...rest];
}

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function toMarkdown(resp, by = 'installs') {
  const rows = sortRows(toRows(resp), by);
  const out = [];
  out.push('| App | Developer | Rating | Ratings | Monthly downloads | MoM | Monthly revenue | MoM | Scored |');
  out.push('| --- | --- | ---: | ---: | --- | ---: | --- | ---: | --- |');
  for (const r of rows) {
    out.push(`| ${r.isSubject ? '**' + esc(r.name) + '** (you)' : esc(r.name)} | ${esc(r.developer)} | ${r.rating ?? ''} | ${compact(r.totalRatings)} | ${describe(r.installs)} | ${pct(r.installsChange)} | ${describe(r.revenue, true)} | ${pct(r.revenueChange)} | ${r.scoredAt} |`);
  }
  const missing = resp?.missingStoreIds ?? [];
  if (missing.length) out.push('', `Not in the catalogue: ${missing.join(', ')}`);
  return out.join('\n');
}

export function toCsv(resp, by = 'installs') {
  const rows = sortRows(toRows(resp), by);
  const q = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lo = (e) => (e?.kind === 'range' ? e.range.low : null);
  const hi = (e) => (e?.kind === 'range' ? e.range.high : e?.kind === 'below_floor' ? e.ceiling : null);
  const head = ['store_id', 'name', 'developer', 'is_subject', 'rating', 'total_ratings', 'installs_kind', 'installs_low', 'installs_mid', 'installs_high', 'installs_mom', 'revenue_kind', 'revenue_low', 'revenue_mid', 'revenue_high', 'revenue_mom', 'currency', 'scored_at'];
  const lines = [head.join(',')];
  for (const r of rows) {
    lines.push([r.storeId, r.name, r.developer, r.isSubject, r.rating, r.totalRatings,
      r.installs?.kind ?? 'unknown', lo(r.installs), r.installs?.kind === 'range' ? r.installs.range.mid : null, hi(r.installs), r.installsChange == null ? null : r.installsChange.toFixed(4),
      r.revenue?.kind ?? 'unknown', lo(r.revenue), r.revenue?.kind === 'range' ? r.revenue.range.mid : null, hi(r.revenue), r.revenueChange == null ? null : r.revenueChange.toFixed(4),
      r.currency, r.scoredAt].map(q).join(','));
  }
  return lines.join('\n');
}

// Short plain-text summary for Slack/Discord.
export function toChat(resp, by = 'installs') {
  const rows = sortRows(toRows(resp), by);
  const lines = [`App scorecard (${by === 'revenue' ? 'monthly revenue' : 'monthly downloads'}, PeekPanda estimates)`];
  for (const r of rows) {
    const est = by === 'revenue' ? r.revenue : r.installs;
    const ch = by === 'revenue' ? r.revenueChange : r.installsChange;
    lines.push(`${r.isSubject ? '• you: ' : '• '}${r.name}: ${describe(est, by === 'revenue')}${ch == null ? '' : ` (${pct(ch)} MoM)`}`);
  }
  return lines.join('\n');
}
