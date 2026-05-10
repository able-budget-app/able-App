/**
 * Run the Claude drafter for every article in able-content/ that doesn't
 * yet have a videos/<slug>/script.json.
 *
 * Run: ANTHROPIC_API_KEY=... npm run draft-all
 *      [--cluster=budgeting]      (only this cluster)
 *      [--pillars-only]           (skip supporting articles)
 *      [--limit=5]                (cap how many to do this pass)
 *      [--force]                  (re-draft even if script.json exists)
 *
 * Cost: ~$0.05-0.10 per article on claude-sonnet-4-7. The full library
 * (~74 articles) costs ~$5-7 total.
 */
import {execSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const pillarsOnly = argv.includes('--pillars-only');
const clusterArg = argv.find((a) => a.startsWith('--cluster='));
const cluster = clusterArg ? clusterArg.slice('--cluster='.length) : null;
const limitArg = argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : Infinity;

const CONTENT_DIR = resolve('../able-content');

type Article = {
  path: string;        // absolute path to .md
  slug: string;        // derived for videos/<slug>
  cluster: string;
  pageType: string;
};

function deriveSlug(absPath: string): string {
  const rel = relative(CONTENT_DIR, absPath);
  const parts = rel.split('/');
  if (parts[parts.length - 1] === 'index.md') parts.pop();
  else parts[parts.length - 1] = parts[parts.length - 1].replace(/\.md$/, '');
  return parts.join('-');
}

function parseFrontmatter(text: string): Record<string, any> {
  if (!text.startsWith('---\n')) return {};
  const end = text.indexOf('\n---\n', 4);
  if (end < 0) return {};
  const block = text.slice(4, end);
  // Tiny YAML extractor — only need top-level scalars (cluster, page_type)
  const out: Record<string, any> = {};
  for (const line of block.split('\n')) {
    const m = /^([a-z_]+):\s*"?([^"]*)"?\s*$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function walk(dir: string, out: Article[] = []): Article[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (entry.endsWith('.md') && entry !== 'README.md') {
      const meta = parseFrontmatter(readFileSync(p, 'utf8'));
      out.push({
        path: p,
        slug: deriveSlug(p),
        cluster: meta.cluster || '',
        pageType: meta.page_type || 'supporting',
      });
    }
  }
  return out;
}

const all = walk(CONTENT_DIR);
let queue = all
  .filter((a) => (cluster ? a.cluster === cluster : true))
  .filter((a) => (pillarsOnly ? a.pageType === 'pillar' : true))
  .filter((a) => force || !existsSync(`videos/${a.slug}/script.json`));

// Pillars first within whatever filter applied
queue.sort((a, b) =>
  a.pageType !== b.pageType ? (a.pageType === 'pillar' ? -1 : 1)
  : a.cluster.localeCompare(b.cluster) || a.slug.localeCompare(b.slug),
);

queue = queue.slice(0, limit);

console.log(`[draft-all] ${queue.length} article(s) queued`);
if (queue.length === 0) process.exit(0);

let ok = 0, fail = 0;
for (let i = 0; i < queue.length; i++) {
  const a = queue[i];
  console.log(`\n[${i + 1}/${queue.length}] ${a.slug} (${a.pageType}, ${a.cluster})`);
  try {
    const articleArg = relative(resolve('..'), a.path); // ⇒ able-content/...
    execSync(`npx tsx scripts/draft-script.ts --article=${articleArg} --slug=${a.slug}`, {
      stdio: 'inherit',
    });
    ok++;
  } catch (e: any) {
    console.error(`  [error] ${a.slug}: ${e.message}`);
    fail++;
  }
}

console.log(`\n[draft-all] done — ok:${ok} fail:${fail}`);
