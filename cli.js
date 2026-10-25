#!/usr/bin/env node
// App competitor scorecard on the PeekPanda API. Node 18+, no dependencies.
// One call to GET /v1/competitors/compare: your app and up to 9 rivals side by side.
import { readFile } from 'node:fs/promises';
import { toMarkdown, toCsv, toChat } from './scorecard.js';

const HELP = `Usage:
  PEEKPANDA_TOKEN=... node cli.js <yourStoreId> <rivalStoreId> [rivalStoreId ...] [options]
  node cli.js --file compare.json [options]

The first store id is "your" app; the rest are rivals (2 to 10 ids in total).

Options:
  --by installs|revenue  sort rivals by monthly downloads (default) or revenue
  --format md|csv|json   output format (default md)
  --webhook <url>        also POST a short summary to a Slack or Discord incoming webhook
  --tenancy <value>      x-genviral-tenancy header (default personal)
  --api <url>            API base (default https://api.peekpanda.com)
  --file <path>          read a saved GET /v1/competitors/compare response instead of calling the API`;

function parse(argv) {
  const o = { by: 'installs', format: 'md', tenancy: 'personal', api: 'https://api.peekpanda.com', ids: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') o.help = true;
    else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
    else o.ids.push(...a.split(',').filter(Boolean));
  }
  return o;
}

async function fetchCompare(o) {
  const token = process.env.PEEKPANDA_TOKEN;
  if (!token) throw new Error('Set PEEKPANDA_TOKEN to a PeekPanda API key (Account → API keys). Never commit it.');
  const ids = [...new Set(o.ids)];
  for (const id of ids) if (!/^\d+$/.test(id)) throw new Error(`storeId must be numeric, got "${id}"`);
  if (ids.length < 2 || ids.length > 10) throw new Error('Give 2 to 10 distinct store ids: yours first, then rivals.');
  const url = new URL('/v1/competitors/compare', o.api);
  url.search = new URLSearchParams({ storeIds: ids.join(',') });
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'x-genviral-tenancy': o.tenancy, Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const retry = res.headers.get('retry-after');
    throw new Error(`PeekPanda API ${res.status} ${body?.error?.code ?? ''}: ${body?.error?.message ?? res.statusText}${retry ? ` (retry after ${retry}s)` : ''}`);
  }
  return res.json();
}

async function main() {
  const o = parse(process.argv.slice(2));
  if (o.help || (!o.ids.length && !o.file)) { console.log(HELP); return; }
  if (!['installs', 'revenue'].includes(o.by)) throw new Error('--by must be installs or revenue');
  const resp = o.file ? JSON.parse(await readFile(o.file, 'utf8')) : await fetchCompare(o);

  if (o.format === 'json') console.log(JSON.stringify(resp, null, 2));
  else if (o.format === 'csv') console.log(toCsv(resp, o.by));
  else console.log(toMarkdown(resp, o.by) + '\n\nEstimates are PeekPanda worldwide monthly ranges, not store-reported numbers. "unknown" means no nightly score, not zero.');

  if (o.webhook) {
    const text = toChat(resp, o.by);
    const isDiscord = /discord(app)?\.com\/api\/webhooks/.test(o.webhook);
    const r = await fetch(o.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isDiscord ? { content: text.slice(0, 1900) } : { text }) });
    if (!r.ok) throw new Error(`Webhook returned ${r.status}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
