// Extract LC_COURSES + LC_LESSONS from app.html and emit markdown files
// into able-content/learn/<course>/<slug>.md for the existing
// build-resources.py converter to pick up.
//
// Usage: node scripts/extract-lc.js /Users/pauljohnson/Desktop/able-content

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CONTENT_ROOT = process.argv[2];
if (!CONTENT_ROOT) {
  console.error('Usage: node scripts/extract-lc.js <path-to-able-content>');
  process.exit(1);
}

const appHtml = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');

// Pull the two declarations out of app.html and eval them in a sandbox.
// Uses brace counting so nested `};` don't terminate early.
function extractBlock(name) {
  const startMarker = `const ${name} = `;
  const startIdx = appHtml.indexOf(startMarker);
  if (startIdx < 0) throw new Error(`Could not find ${name}`);
  // Find the first { or [ after the marker; this is the start of the value.
  const valueStart = startIdx + startMarker.length;
  const openChar = appHtml[valueStart];
  if (openChar !== '{' && openChar !== '[') {
    throw new Error(`Expected { or [ after ${startMarker}, got ${openChar}`);
  }
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let strQuote = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = valueStart; i < appHtml.length; i++) {
    const ch = appHtml[i];
    const prev = appHtml[i - 1];
    if (inLineComment) { if (ch === '\n') inLineComment = false; continue; }
    if (inBlockComment) { if (ch === '/' && prev === '*') inBlockComment = false; continue; }
    if (inStr) {
      if (ch === '\\') { i++; continue; } // skip escaped char
      if (ch === strQuote) { inStr = false; strQuote = null; }
      continue;
    }
    if (ch === '/' && appHtml[i + 1] === '/') { inLineComment = true; i++; continue; }
    if (ch === '/' && appHtml[i + 1] === '*') { inBlockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strQuote = ch; continue; }
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return appHtml.slice(valueStart, i + 1);
      }
    }
  }
  throw new Error(`Never found matching close for ${name}`);
}

const source = 'var LC_COURSES = ' + extractBlock('LC_COURSES') +
               '\nvar LC_LESSONS = ' + extractBlock('LC_LESSONS') +
               '\nresult = { courses: LC_COURSES, lessons: LC_LESSONS };';
const ctx = { result: null };
vm.createContext(ctx);
vm.runInContext(source, ctx);

const { courses, lessons } = ctx.result;

function slugify(s) {
  return s.toLowerCase()
    .replace(/[''"]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Escape double quotes in YAML string values.
function yamlStr(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

const COURSE_URL_SLUG = {
  payself: 'pay-yourself-first',
  debt: 'get-out-of-debt',
  credit: 'improve-your-credit-score',
  funding: 'get-business-funding',
  money: 'how-money-works',
};

function courseSlug(id) {
  return COURSE_URL_SLUG[id] || id;
}

const generated = [];

for (const course of courses) {
  const courseLessons = lessons[course.id] || [];
  const courseUrlSlug = courseSlug(course.id);
  const courseDir = path.join(CONTENT_ROOT, 'learn', courseUrlSlug);
  fs.mkdirSync(courseDir, { recursive: true });

  courseLessons.forEach((lesson, i) => {
    const slug = slugify(lesson.title);
    const urlPath = `/learn/${courseUrlSlug}/${slug}/`;
    const siblings = courseLessons.filter(l => l.id !== lesson.id)
      .map(l => ({ title: l.title, url: `/learn/${courseUrlSlug}/${slugify(l.title)}/` }));

    const metaDesc = (lesson.hint ? lesson.hint + '. ' : '') +
      stripHtml(lesson.overview?.[0] || '').slice(0, 140);

    const fm = {
      title: lesson.title,
      slug,
      url: urlPath,
      meta_title: `${lesson.title} | Able Learn`,
      meta_description: metaDesc.slice(0, 158),
      target_keyword: slugify(lesson.title).replace(/-/g, ' ').slice(0, 60),
      secondary_keywords: [],
      cluster: 'learn-' + course.id,
      page_type: 'supporting',
      parent: `/learn/${courseUrlSlug}/`,
      internal_links: [
        `/learn/${courseUrlSlug}/`,
        '/learn/',
        ...siblings.slice(0, 3).map(s => s.url),
      ],
      cta: 'Start free trial',
    };

    let md = '---\n';
    md += `title: ${yamlStr(fm.title)}\n`;
    md += `slug: ${fm.slug}\n`;
    md += `url: ${fm.url}\n`;
    md += `meta_title: ${yamlStr(fm.meta_title)}\n`;
    md += `meta_description: ${yamlStr(fm.meta_description)}\n`;
    md += `target_keyword: ${yamlStr(fm.target_keyword)}\n`;
    md += 'secondary_keywords: []\n';
    md += `cluster: ${fm.cluster}\n`;
    md += `page_type: ${fm.page_type}\n`;
    md += `parent: ${fm.parent}\n`;
    md += 'internal_links:\n';
    for (const link of fm.internal_links) md += `  - ${link}\n`;
    md += `cta: ${fm.cta}\n`;
    md += '---\n\n';
    md += `# ${lesson.title}\n\n`;
    if (lesson.hint) md += `${lesson.hint}\n\n`;

    // Overview paragraphs
    if (Array.isArray(lesson.overview)) {
      for (const p of lesson.overview) md += p + '\n\n';
    }

    // First pull quote as a blockquote, if present
    if (Array.isArray(lesson.pullQuotes) && lesson.pullQuotes.length) {
      md += `> ${lesson.pullQuotes[0]}\n\n`;
    }

    // Key points
    if (Array.isArray(lesson.keyPoints) && lesson.keyPoints.length) {
      md += '## Key points\n\n';
      for (const kp of lesson.keyPoints) {
        md += '- ' + kp.text + '\n';
      }
      md += '\n';
    }

    // Second pull quote, if present
    if (Array.isArray(lesson.pullQuotes) && lesson.pullQuotes.length > 1) {
      md += `> ${lesson.pullQuotes[1]}\n\n`;
    }

    // Callout
    if (lesson.callout && lesson.callout.text) {
      if (lesson.callout.title) md += `## ${lesson.callout.title}\n\n`;
      md += `${lesson.callout.text}\n\n`;
    }

    // Steps
    if (Array.isArray(lesson.steps) && lesson.steps.length) {
      md += '## Steps\n\n';
      lesson.steps.forEach((s, idx) => {
        md += `**${idx + 1}. ${s.title}.** ${s.desc}\n\n`;
      });
    }

    // CTA
    md += '---\n\n## Start setting up today\n\nAble routes every deposit automatically. Taxes, bills, smoothing reserve, debt, and your own pay. Seven days free. Cancel anytime.\n\n**[Start Free Trial](https://becomeable.app/signup)**\n\n';

    // Keep reading
    md += '---\n\n## Keep Reading\n\n';
    const readMore = [
      { title: course.title + ': course overview', url: `/learn/${courseUrlSlug}/` },
      ...siblings.slice(0, 4),
      { title: 'Able learn hub', url: '/learn/' },
    ];
    for (const r of readMore) md += `- [${r.title}](${r.url})\n`;
    md += '\n';

    const outPath = path.join(courseDir, `${slug}.md`);
    fs.writeFileSync(outPath, md);
    generated.push({ course: course.id, slug, path: outPath });
  });

  // Course overview (pillar-ish) page
  const overviewPath = path.join(courseDir, 'index.md');
  let ov = '---\n';
  ov += `title: ${yamlStr(course.title)}\n`;
  ov += `slug: ${courseUrlSlug}\n`;
  ov += `url: /learn/${courseUrlSlug}/\n`;
  ov += `meta_title: ${yamlStr(course.title + ' | Able Learn')}\n`;
  ov += `meta_description: ${yamlStr(course.desc)}\n`;
  ov += `target_keyword: ${yamlStr(course.title.toLowerCase())}\n`;
  ov += 'secondary_keywords: []\n';
  ov += `cluster: learn-${course.id}\n`;
  ov += `page_type: pillar\n`;
  ov += 'internal_links:\n';
  ov += '  - /learn/\n';
  for (const l of courseLessons) {
    ov += `  - /learn/${courseUrlSlug}/${slugify(l.title)}/\n`;
  }
  ov += 'cta: Start free trial\n---\n\n';
  ov += `# ${course.title}\n\n`;
  ov += `${course.desc}\n\n`;
  ov += '---\n\n## Lessons in this course\n\n';
  for (const l of courseLessons) {
    const hint = l.hint ? ` ${l.hint}.` : '';
    ov += `**${l.num}. [${l.title}](/learn/${courseUrlSlug}/${slugify(l.title)}/)**${hint}\n\n`;
  }
  ov += '\n---\n\n## Start practicing today\n\nAble is the app where the lessons in this course turn into a running system. Every deposit routed. Tax off the top. Smoothing reserve absorbing the swings. Seven days free. Cancel anytime.\n\n**[Start Free Trial](https://becomeable.app/signup)**\n';
  fs.writeFileSync(overviewPath, ov);
  generated.push({ course: course.id, slug: 'index', path: overviewPath });
}

console.log(`Generated ${generated.length} markdown files.`);
for (const g of generated) {
  console.log(`  ${g.course}/${g.slug}`);
}
