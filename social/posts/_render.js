// Renders a slide/post object into a target .post element.
// Used by both template.html (single posts) and carousel.html (slide sequences).
function renderSlideInto(root, post) {
  root.classList.add('theme-' + post.theme);
  root.classList.add('tpl-' + post.tpl);
  if (post.center) root.classList.add('centered');
  if (post.size)   root.classList.add('size-' + post.size);
  if (post.format) root.classList.add('format-' + post.format);
  if (post.tpl === 'C' && post.pos) root.classList.add('pos-' + post.pos);

  // Eyebrow vocabulary (locked 2026-05-08).
  // - `mixed` is the brand default — most pieces use it.
  // - 5 persona keys for targeted bunches (3 posts each in the cadence).
  // - Old `ent` / `fcb` keys map to `mixed` for backward compat so
  //   any in-flight rendering doesn't break before data files are swept.
  const eyebrowText =
    post.eyebrow === 'mixed'      ? 'For anyone with mixed or unpredictable income.' :
    post.eyebrow === 'freelance'  ? 'For freelancers and consultants.' :
    post.eyebrow === 'creator'    ? 'For creators.' :
    post.eyebrow === 'gig'        ? 'For gig and rideshare drivers.' :
    post.eyebrow === 'commission' ? 'For commission earners.' :
    post.eyebrow === 'business'   ? 'For small business owners.' :
    // Legacy keys → fall through to the main brand line.
    post.eyebrow === 'ent'        ? 'For anyone with mixed or unpredictable income.' :
    post.eyebrow === 'fcb'        ? 'For anyone with mixed or unpredictable income.' :
    (post.eyebrow || '');

  const meta = post.meta || 'becomeable.app/get-able';

  // Split multi-line {...} chunks into one underline span per line so the
  // squiggle tracks each line's actual width. Without this, a {a\nb} where
  // a is wider than b draws a single underline at the bottom that extends
  // way past the end of "b" (as wide as "a") — see posts 62/64/B20.
  // Also absorb trailing punctuation into the LAST segment's span so the
  // period/comma can't orphan to its own line when the span+punct is
  // wider than the row (e.g. C23 "Etsy income.", C40 "doesn't pretend.").
  const renderText = (str) => str
    .replace(/\{([^}]+)\}([.,;:!?]*)/g, (_, inner, punct) => {
      const segs = inner.split('\n');
      return segs.map((seg, i) => {
        const text = (i === segs.length - 1) ? seg + punct : seg;
        return `<span class="underline">${text}</span>`;
      }).join('\n');
    })
    .replace(/\n/g, '<br>');

  const mutedHtml = post.muted ? '<div class="muted">' + renderText(post.muted) + '</div>' : '';
  const punchHtml = '<div class="punch">' + renderText(post.punch) + '</div>';

  // tpl-C wraps the muted+punch in a product-text col next to a phone shot.
  // The shot is a CSS background pulled from /marketing-footage/product-shots/<shot>/9x16.png.
  let stackHtml;
  if (post.tpl === 'C') {
    // Relative path so it works both via file:// (when reviewing locally)
    // and via http:// (when served from any /social/posts/ URL).
    const shotUrl = `../../marketing-footage/product-shots/${post.shot}/9x16-bare.png`;
    stackHtml = `
      <div class="product-row">
        <div class="product-text">${mutedHtml}${punchHtml}</div>
        <div class="product-shot" style="background-image:url('${shotUrl}');"></div>
      </div>
    `;
  } else {
    stackHtml = `<div class="stack">${mutedHtml}${punchHtml}</div>`;
  }

  // Optional: suppress the "Able" wordmark when the copy itself already
  // surfaces the word (avoids double-stamping). The footer keeps the URL,
  // pushed to the right via justify-content override in CSS.
  const footerClass = post.noWordmark ? 'footer no-wordmark' : 'footer';
  const wordmarkHtml = post.noWordmark ? '' : '<div class="wordmark">Able</div>';
  // Optional: Apple "Download on the App Store" badge below the footer.
  // Set { appStoreBadge: true } on a slide/post to opt in. The pill is the
  // same stack used on the landing page (apple glyph + "Download on the
  // App Store" two-line label, black background, white text).
  const appBadgeHtml = post.appStoreBadge ? `
    <a class="app-store-badge" href="https://apps.apple.com/app/able-inconsistent-income/id6769551407" aria-label="Download on the App Store">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
      <span><small>Download on the</small><strong>App Store</strong></span>
    </a>` : '';
  const inner = `
    <div class="eyebrow">${eyebrowText}</div>
    ${stackHtml}
    <div class="${footerClass}">
      ${wordmarkHtml}
      <div class="url">${meta}</div>
    </div>
    ${appBadgeHtml}
  `;

  if (post.theme === 'glass' || post.theme === 'glass-dark') {
    root.innerHTML = `
      <div class="blob blob-a"></div>
      <div class="blob blob-b"></div>
      <div class="blob blob-c"></div>
      <div class="glass-card">${inner}</div>
    `;
  } else {
    root.innerHTML = inner;
  }
}
