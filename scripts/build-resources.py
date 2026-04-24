#!/usr/bin/env python3
"""
Convert markdown content files (with YAML frontmatter) under able-content/ into
Able's public resource HTML pages. Writes to /budgeting/, /taxes/, /business/
at the repo root.

Usage:
  python3 scripts/build-resources.py /path/to/able-content

Each article is rendered with the same template (nav, article styling, CTA,
related list, footer). The frontmatter `url` field determines the output path:
  url: /budgeting/            ->  budgeting/index.html
  url: /taxes/how-much/       ->  taxes/how-much/index.html
"""

import sys
import os
import re
from pathlib import Path
import yaml
import markdown

REPO_ROOT = Path(__file__).resolve().parent.parent
SITE_ORIGIN = "https://becomeable.app"

NICE_TITLES = {
    "budgeting": "Budgeting with irregular income",
    "taxes": "Taxes for the self-employed",
    "business": "Running a business with variable income",
}

CSS = """
:root {
  --ds-page: #f0f7f2;
  --ds-card: #ffffff;
  --ds-t1: #111c16;
  --ds-t2: #4a5c52;
  --ds-t3: #8ca898;
  --ds-t4: #c4d8cc;
  --ds-green: #2a7a4a;
  --ds-green2: #1f6038;
  --ds-green-l: #eaf5ee;
  --ds-f: 'Bricolage Grotesque', -apple-system, sans-serif;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--ds-f);
  background: var(--ds-page);
  color: var(--ds-t1);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--ds-green); text-decoration: underline; text-underline-offset: 2px; }
a:hover { color: var(--ds-green2); }
.site-nav {
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 960px;
  margin: 0 auto;
}
.site-logo {
  font-size: 1.35rem;
  font-weight: 900;
  color: var(--ds-t1);
  letter-spacing: -.03em;
  position: relative;
  display: inline-block;
  line-height: 1;
  padding-bottom: 3px;
  text-decoration: none;
}
.site-logo::after {
  content: '';
  position: absolute;
  left: 0;
  right: -4%;
  bottom: 0;
  height: 5px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 4.2' preserveAspectRatio='none'><path d='M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z' fill='%232a7a4a'/></svg>") no-repeat center / 100% 100%;
}
.site-nav .cta {
  background: var(--ds-green);
  color: white;
  padding: 10px 18px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -.01em;
  transition: background .15s;
  text-decoration: none;
}
.site-nav .cta:hover { background: var(--ds-green2); }
.article-inner { max-width: 720px; margin: 0 auto; padding: 2.5rem 2rem 4rem; }
.breadcrumb { font-size: 12px; font-weight: 700; color: var(--ds-t3); margin-bottom: 1.25rem; letter-spacing: .02em; }
.breadcrumb a { color: var(--ds-t3); text-decoration: none; }
.breadcrumb a:hover { color: var(--ds-green); }
.article-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--ds-green); margin-bottom: .75rem; }
.article-dek { font-size: 18px; color: var(--ds-t2); font-weight: 500; line-height: 1.55; margin-bottom: 2.5rem; }
.article-body h1 { font-size: clamp(1.9rem, 4vw, 2.6rem); font-weight: 900; letter-spacing: -.03em; line-height: 1.1; margin-bottom: 1rem; color: var(--ds-t1); }
.article-body h2 { font-size: 1.5rem; font-weight: 800; letter-spacing: -.02em; line-height: 1.25; margin-top: 2.75rem; margin-bottom: 1rem; color: var(--ds-t1); }
.article-body h3 { font-size: 1.1rem; font-weight: 800; letter-spacing: -.01em; margin-top: 1.75rem; margin-bottom: .75rem; color: var(--ds-t1); }
.article-body p { font-size: 16.5px; color: var(--ds-t2); font-weight: 500; margin-bottom: 1rem; line-height: 1.7; }
.article-body ol, .article-body ul { margin: 1rem 0 1.25rem 1.5rem; color: var(--ds-t2); font-weight: 500; font-size: 16.5px; line-height: 1.7; }
.article-body li { margin-bottom: .4rem; }
.article-body strong { color: var(--ds-t1); font-weight: 800; }
.article-body hr { border: none; border-top: 1px solid var(--ds-t4); margin: 2.25rem 0; }
.article-body blockquote {
  background: var(--ds-green-l);
  border-left: 4px solid var(--ds-green);
  border-radius: 18px;
  padding: 1.25rem 1.5rem;
  margin: 2rem 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--ds-t1);
  line-height: 1.5;
  letter-spacing: -.01em;
}
.article-body blockquote p { font-size: inherit; color: inherit; font-weight: inherit; margin: 0; }
.cta-card {
  background: linear-gradient(135deg, #eaf5ee 0%, #d9ecde 100%);
  border-radius: 26px;
  padding: 2rem 1.75rem;
  margin-top: 3rem;
  text-align: center;
}
.cta-card-title { font-size: 1.35rem; font-weight: 900; letter-spacing: -.02em; margin-bottom: .5rem; color: var(--ds-t1); }
.cta-card-sub { font-size: 14px; color: var(--ds-t2); font-weight: 600; margin-bottom: 1.25rem; line-height: 1.55; }
.cta-card-btn {
  display: inline-block;
  background: var(--ds-green);
  color: white;
  padding: 14px 28px;
  border-radius: 100px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -.01em;
  text-decoration: none;
  transition: background .15s, transform .15s;
}
.cta-card-btn:hover { background: var(--ds-green2); transform: translateY(-1px); }
.cta-card-fine { font-size: 11px; color: var(--ds-t3); font-weight: 600; margin-top: .85rem; letter-spacing: .02em; }
.related { margin-top: 3.5rem; padding-top: 2rem; border-top: 1px solid var(--ds-t4); }
.related-label { font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--ds-t3); margin-bottom: 1rem; }
.related-list { list-style: none; padding: 0; margin: 0; }
.related-list li { margin-bottom: .6rem; }
.related-list a { font-size: 15px; font-weight: 700; color: var(--ds-t1); text-decoration: none; }
.related-list a:hover { color: var(--ds-green); }
.site-footer {
  border-top: 1px solid var(--ds-t4);
  padding: 2rem;
  text-align: center;
  color: var(--ds-t3);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
}
.site-footer a { color: var(--ds-t3); text-decoration: none; }
.site-footer a:hover { color: var(--ds-green); }
""".strip()


def parse_file(path: Path):
    text = path.read_text()
    if not text.startswith("---"):
        raise ValueError(f"{path}: missing frontmatter")
    _, fm_raw, body = text.split("---", 2)
    fm = yaml.safe_load(fm_raw)
    return fm, body.strip()


def rewrite_links(html: str) -> str:
    # Replace the placeholder signup link with the real app URL.
    html = html.replace("https://becomeable.app/signup", "/app.html")
    html = html.replace('href="/signup"', 'href="/app.html"')
    return html


def strip_h1(body_md: str, title: str):
    """Strip the leading H1 from markdown body if it matches the title."""
    lines = body_md.split("\n")
    out = []
    skipped = False
    for i, line in enumerate(lines):
        if not skipped and line.strip().startswith("# "):
            skipped = True
            continue
        out.append(line)
    return "\n".join(out).strip()


def extract_dek(body_md: str):
    """Take the first non-empty paragraph as the article dek."""
    # Remove leading blank lines
    stripped = body_md.strip()
    # First paragraph is everything up to the first blank line or horizontal rule
    parts = re.split(r"\n\s*\n|\n---\n", stripped, maxsplit=1)
    first = parts[0].strip()
    rest = parts[1].strip() if len(parts) > 1 else ""
    return first, rest


def render_html(fm, body_md, related_titles):
    title = fm.get("title", "")
    meta_title = fm.get("meta_title", title)
    meta_desc = fm.get("meta_description", "")
    url = fm.get("url", "/")
    canonical = SITE_ORIGIN + url
    cluster = fm.get("cluster", "")
    cluster_label = NICE_TITLES.get(cluster, cluster.title())

    body_md = strip_h1(body_md, title)
    dek, rest_md = extract_dek(body_md)

    # Find and strip the last "Keep Reading" section so we can render it as
    # the styled .related block instead of a plain list.
    keep_re = re.compile(r"\n---\s*\n\s*##+\s*Keep Reading\s*\n(.+?)$", re.DOTALL)
    match = keep_re.search(rest_md)
    related_md_items = []
    if match:
        related_block = match.group(1).strip()
        rest_md = rest_md[: match.start()].rstrip()
        for line in related_block.splitlines():
            line = line.strip()
            if line.startswith("- "):
                m = re.match(r"-\s*\[([^\]]+)\]\(([^)]+)\)", line)
                if m:
                    related_md_items.append((m.group(1), m.group(2)))

    # Also strip any final CTA block that is a markdown button: **[Start Free Trial](...)**
    # because we render a prettier cta-card instead.
    rest_md = re.sub(
        r"\n\*\*\[Start Free Trial\]\([^)]*\)\*\*\s*$", "", rest_md.rstrip()
    )
    # Drop the "Start Your First Budget Today" / "Start Setting Aside Taxes Today"
    # style promo paragraph that always sits right before the CTA link. It's
    # easier to rebuild in the cta-card than keep inline. We detect it heuristically
    # as the last ## section that has the words "Start" and mentions Able + "Seven days".
    rest_md = re.sub(
        r"\n---\s*\n\s*##+\s*Start[^\n]*\n.*?Seven days free\. Cancel anytime\.\s*$",
        "",
        rest_md,
        flags=re.DOTALL,
    )

    body_html = markdown.markdown(
        rest_md, extensions=["extra", "sanitize_lists"] if False else ["extra"]
    )
    dek_html = markdown.markdown(dek)
    # Dek should be a single paragraph's text, so unwrap <p>
    dek_text = re.sub(r"^<p>|</p>$", "", dek_html.strip())

    body_html = rewrite_links(body_html)

    # Related block
    related_html = ""
    if related_md_items:
        lis = "".join(
            f'<li><a href="{url}">{title}</a></li>' for title, url in related_md_items
        )
        related_html = (
            '<div class="related"><div class="related-label">Keep reading</div>'
            f'<ul class="related-list">{lis}</ul></div>'
        )

    cta_card = (
        '<div class="cta-card">'
        '<div class="cta-card-title">Run your deposits, not the other way around.</div>'
        '<div class="cta-card-sub">Seven days free. Card required so the trial starts cleanly. Cancel anytime in Settings.</div>'
        '<a href="/app.html" class="cta-card-btn">Start your free 7-day trial</a>'
        '<div class="cta-card-fine">You will not be charged until day 8.</div>'
        '</div>'
    )

    # JSON-LD
    schema = (
        '<script type="application/ld+json">{'
        f'"@context":"https://schema.org","@type":"Article",'
        f'"headline":{escape_json(title)},'
        f'"description":{escape_json(meta_desc)},'
        f'"url":{escape_json(canonical)},'
        '"author":{"@type":"Organization","name":"Able"},'
        '"publisher":{"@type":"Organization","name":"Able","url":"https://becomeable.app/"},'
        f'"mainEntityOfPage":{escape_json(canonical)},'
        '"inLanguage":"en"'
        '}</script>'
    )

    breadcrumb_parts = ['<a href="/">Home</a>']
    if cluster:
        if url == f"/{cluster}/":
            breadcrumb_parts.append(cluster_label)
        else:
            breadcrumb_parts.append(f'<a href="/{cluster}/">{cluster_label}</a>')
            breadcrumb_parts.append(title)

    breadcrumb_html = ' / '.join(breadcrumb_parts)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escape_html(meta_title)}</title>
<meta name="description" content="{escape_html(meta_desc)}">
<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{escape_html(title)}">
<meta property="og:description" content="{escape_html(meta_desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Able">
<meta name="twitter:card" content="summary">
{schema}
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800;12..96,900&display=swap" rel="stylesheet">
<style>
{CSS}
</style>
</head>
<body>
<nav class="site-nav">
  <a href="/" class="site-logo">Able</a>
  <a href="/app.html" class="cta">Start free trial</a>
</nav>
<article class="article-inner">
  <div class="breadcrumb">{breadcrumb_html}</div>
  <div class="article-eyebrow">{escape_html(cluster_label)}</div>
  <div class="article-body">
    <h1>{escape_html(title)}</h1>
    <p class="article-dek">{dek_text}</p>
{body_html}
  </div>
  {cta_card}
  {related_html}
</article>
<footer class="site-footer">
  <div><a href="/">Home</a> &middot; <a href="/resources/">Resources</a> &middot; <a href="/app.html">Sign in</a> &middot; <a href="/privacy.html">Privacy</a> &middot; <a href="/terms.html">Terms</a></div>
  <div style="margin-top:.5rem;">Able. Built for inconsistent income.</div>
</footer>
</body>
</html>
"""
    return html


def escape_html(s: str) -> str:
    if s is None:
        return ""
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def escape_json(s: str) -> str:
    # naive but fine for our strings: escape quotes and wrap in double quotes
    if s is None:
        return '""'
    s = s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").strip()
    return f'"{s}"'


def write_output(fm, html):
    url = fm.get("url", "/")
    # /budgeting/           -> budgeting/index.html
    # /budgeting/freelancer-budget/ -> budgeting/freelancer-budget/index.html
    rel = url.strip("/")
    if rel:
        out_path = REPO_ROOT / rel / "index.html"
    else:
        out_path = REPO_ROOT / "index.html"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html)
    return out_path


def main(content_root: Path):
    md_files = sorted(content_root.rglob("*.md"))
    generated = []
    for p in md_files:
        if p.name == "README.md":
            continue
        fm, body = parse_file(p)
        html = render_html(fm, body, [])
        out = write_output(fm, html)
        rel_out = out.relative_to(REPO_ROOT)
        print(f"  {p.name}  ->  {rel_out}")
        generated.append((fm, out))
    return generated


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: build-resources.py /path/to/able-content", file=sys.stderr)
        sys.exit(1)
    content_root = Path(sys.argv[1]).resolve()
    if not content_root.exists():
        print(f"Not found: {content_root}", file=sys.stderr)
        sys.exit(1)
    print(f"Building from {content_root}")
    main(content_root)
    print("Done.")
