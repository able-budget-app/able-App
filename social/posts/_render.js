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
  const inner = `
    <div class="eyebrow">${eyebrowText}</div>
    ${stackHtml}
    <div class="${footerClass}">
      ${wordmarkHtml}
      <div class="url">${meta}</div>
    </div>
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
