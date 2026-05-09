// Renders a slide/post object into a target .post element.
// Used by both template.html (single posts) and carousel.html (slide sequences).
function renderSlideInto(root, post) {
  root.classList.add('theme-' + post.theme);
  root.classList.add('tpl-' + post.tpl);
  if (post.center) root.classList.add('centered');
  if (post.size)   root.classList.add('size-' + post.size);

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

  const meta = post.meta || 'becomeable.app';

  const renderText = (str) => str
    .replace(/\n/g, '<br>')
    .replace(/\{([^}]+)\}/g, '<span class="underline">$1</span>');

  const mutedHtml = post.muted ? '<div class="muted">' + renderText(post.muted) + '</div>' : '';
  const punchHtml = '<div class="punch">' + renderText(post.punch) + '</div>';

  const inner = `
    <div class="eyebrow">${eyebrowText}</div>
    <div class="stack">${mutedHtml}${punchHtml}</div>
    <div class="footer">
      <div class="wordmark">Able</div>
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
