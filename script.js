/* ============================================================
   G.G. COOPER — PORTFOLIO SCRIPT
   ============================================================ */

let siteData = null;
const cardRegistry = [];   // project data, indexed by data-key on each card
const PREVIEW = new URLSearchParams(location.search).has('preview');

function sinkholeVisible() {
  const s = siteData && siteData.sinkhole;
  return !!(s && s.title && (String(s.published).toLowerCase() === 'yes' || PREVIEW));
}

function validSections() {
  const base = ['home', 'directing', 'edit', 'about'];
  return sinkholeVisible() ? base.concat('sinkhole') : base;
}

// ---- INIT ----

async function init() {
  try {
    const res = await fetch('data.json?v=' + Date.now());
    siteData = await res.json();
  } catch (err) {
    console.warn('Could not load data.json:', err);
    siteData = { featured: [], edit: [], directing: [], about: {}, sinkhole: {} };
  }

  document.querySelector('.nav-link-feature').hidden = !sinkholeVisible();

  document.getElementById('modal-backdrop').addEventListener('click', closeModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  const main = document.getElementById('main');
  main.addEventListener('click', (e) => {
    const card = e.target.closest('[data-key]');
    if (card) openVideo(cardRegistry[+card.dataset.key]);
  });
  main.addEventListener('keydown', (e) => {
    const card = e.target.closest('[data-key]');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openVideo(cardRegistry[+card.dataset.key]);
    }
  });

  initCursorLabel();
  initCreek();
  initTicker();

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('hashchange', route);
  route();
}

// ---- ROUTING ----

function route() {
  const hash = window.location.hash.slice(1);
  const section = validSections().includes(hash) ? hash : 'home';

  if (hash !== section) history.replaceState(null, '', location.search + '#' + section);

  const noTicker = section === 'about' || section === 'sinkhole';
  document.getElementById('ticker').classList.toggle('hidden', noTicker);
  document.getElementById('main').classList.toggle('no-ticker', noTicker);

  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active', 'visible'));

  const activeEl = document.getElementById('sec-' + section);
  if (activeEl) {
    activeEl.classList.add('active');
    renderSection(section);
    requestAnimationFrame(() => requestAnimationFrame(() => activeEl.classList.add('visible')));
  }

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === section);
  });

  hideCursorLabel();
  window.scrollTo(0, 0);

  document.title = section === 'home'
    ? 'G.G. COOPER'
    : `${section.charAt(0).toUpperCase()}${section.slice(1)} — G.G. Cooper`;
}

function renderSection(section) {
  if (!siteData) return;
  ({
    home:      () => renderVideoGrid('home-grid',      siteData.featured  || []),
    directing: () => renderVideoGrid('directing-grid', siteData.directing || []),
    edit:      () => renderVideoGrid('edit-grid',      siteData.edit      || []),
    sinkhole:  () => renderSinkhole(siteData.sinkhole || {}),
    about:     () => renderAbout(siteData.about || {}),
  })[section]?.();
}

// ---- VIDEO GRID ----

// "Documentary Trailer" + "MediaLiberated" + "2025" → "Documentary trailer for MediaLiberated, 2025"
function metaLine(v) {
  const cat = v.category ? v.category.charAt(0) + v.category.slice(1).toLowerCase() : '';
  let s = cat;
  if (v.client) s = s ? `${s} for ${v.client}` : v.client;
  if (v.year)   s = s ? `${s}, ${v.year}` : v.year;
  return s;
}

function renderVideoGrid(containerId, videos) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!videos.length) {
    container.innerHTML = '<p class="empty-state">Nothing here yet.</p>';
    return;
  }

  container.innerHTML = videos.map((v) => {
    const key = cardRegistry.push(v) - 1;
    const thumb = getThumb(v);
    const ytId = (thumb.includes('img.youtube.com') && v.youtube_id) ? esc(v.youtube_id) : '';
    const meta = metaLine(v);

    const thumbHtml = thumb
      ? `<img class="video-thumb" src="${escHtml(thumb)}" alt="${escHtml(v.title)}" loading="lazy"
             onerror="this.src='${esc(getFallbackThumb(v))}';"
             ${ytId ? `onload="upgradeYoutubeThumb(this,'${ytId}')"` : ''}>`
      : '';

    return `
      <div class="video-item">
        <div class="video-card" data-key="${key}" role="button" tabindex="0"
             aria-label="Play ${escHtml(v.title)}">
          ${thumbHtml}
          <div class="video-play" aria-hidden="true"></div>
        </div>
        <div class="card-caption">
          <div class="cc-title">${escHtml(v.title)}</div>
          ${meta ? `<div class="cc-meta">${escHtml(meta)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ---- THUMBNAIL HELPERS ----

function getThumb(v) {
  // A custom thumbnail always wins over the auto-generated YouTube one
  if (v.thumbnail && !v.thumbnail.includes('img.youtube.com') && !v.thumbnail.includes('vumbnail.com')) {
    return v.thumbnail;
  }
  if (v.youtube_id) return `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`;
  if (v.thumbnail)  return v.thumbnail;
  if (v.vimeo_id)   return `https://vumbnail.com/${v.vimeo_id}.jpg`;
  return '';
}

function getFallbackThumb(v) {
  if (v.youtube_id) return `https://img.youtube.com/vi/${v.youtube_id}/0.jpg`;
  return '';
}

// Upgrade hqdefault (480x360) to maxresdefault (1280x720) when one exists.
// YouTube sometimes returns a 120x90 placeholder instead of a 404, so check width.
function upgradeYoutubeThumb(imgEl, youtubeId) {
  if (!youtubeId || imgEl.dataset.upgraded) return;
  imgEl.dataset.upgraded = '1';
  const hiRes = new Image();
  hiRes.onload = () => { if (hiRes.naturalWidth > 120) imgEl.src = hiRes.src; };
  hiRes.src = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
}

// ---- CURSOR LABEL ----
// The project title as plain type, trailing the cursor with a slight drift.

const label = { el: null, x: 0, y: 0, tx: 0, ty: 0, on: false, raf: 0 };

function initCursorLabel() {
  if (!matchMedia('(hover: hover)').matches) return;
  label.el = document.getElementById('cursor-label');
  const main = document.getElementById('main');

  main.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.video-card[data-key]');
    if (!card) return;
    const v = cardRegistry[+card.dataset.key];
    document.getElementById('cl-title').textContent = v.title || '';
    document.getElementById('cl-meta').textContent  = metaLine(v);
    document.getElementById('cl-desc').textContent  = v.description || '';
    if (!label.on) { label.x = label.tx; label.y = label.ty; }
    label.on = true;
    label.el.classList.add('visible');
    if (!label.raf) label.raf = requestAnimationFrame(stepLabel);
  });

  main.addEventListener('mouseout', (e) => {
    const from = e.target.closest('.video-card[data-key]');
    const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.video-card[data-key]');
    if (from && !to) hideCursorLabel();
  });

  window.addEventListener('mousemove', (e) => { label.tx = e.clientX; label.ty = e.clientY; });
}

function stepLabel() {
  if (!label.el) return;
  label.x += (label.tx - label.x) * 0.16;
  label.y += (label.ty - label.y) * 0.16;

  const w = label.el.offsetWidth, h = label.el.offsetHeight;
  let px = label.x + 24, py = label.y + 20;
  if (px + w > innerWidth - 16)  px = label.x - w - 24;
  if (py + h > innerHeight - 16) py = label.y - h - 20;
  label.el.style.transform = `translate3d(${px}px, ${py}px, 0)`;

  label.raf = label.on ? requestAnimationFrame(stepLabel) : 0;
}

function hideCursorLabel() {
  label.on = false;
  if (label.el) label.el.classList.remove('visible');
}

// ---- SINKHOLE ----

function renderSinkhole(s) {
  const container = document.getElementById('sinkhole-content');
  if (!container) return;

  const credits = String(s.credits || '').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => {
      const [role, ...rest] = l.split(/\s+[—–-]\s+/);
      return `<div class="sk-credit"><span>${escHtml(role)}</span><span>${escHtml(rest.join(' — '))}</span></div>`;
    }).join('');

  let trailer = '';
  if (s.trailer_youtube_id) {
    const v = { title: `${s.title}, trailer`, youtube_id: s.trailer_youtube_id };
    const key = cardRegistry.push(v) - 1;
    trailer = `
      <div class="sk-trailer">
        <div class="video-card" data-key="${key}" role="button" tabindex="0" aria-label="Play trailer">
          <img class="video-thumb" src="https://img.youtube.com/vi/${esc(s.trailer_youtube_id)}/hqdefault.jpg" alt=""
               onload="upgradeYoutubeThumb(this,'${esc(s.trailer_youtube_id)}')">
          <div class="video-play" aria-hidden="true"></div>
        </div>
      </div>`;
  }

  container.innerHTML = `
    ${s.still ? `<div class="sk-hero"><img src="${escHtml(s.still)}" alt="${escHtml(s.title)}"></div>` : ''}
    <div class="sk-head">
      <h1 class="sk-title">${escHtml(s.title)}</h1>
      ${s.status ? `<p class="sk-status">${escHtml(s.kicker || 'Feature film')}, ${escHtml(s.status.toLowerCase())}</p>` : ''}
    </div>
    <div class="sk-body">
      <p class="sk-logline">${escHtml(s.logline || '')}</p>
      ${credits ? `<div class="sk-credits">${credits}</div>` : ''}
    </div>
    ${trailer}`;
}

// ---- ABOUT ----

function renderAbout(about) {
  const container = document.getElementById('about-content');
  if (!container) return;

  const contact = about.email
    ? `<a href="mailto:${escHtml(about.email)}">${escHtml(about.email)}</a>` : '';

  const social = [
    about.instagram ? `<a href="${escHtml(about.instagram)}" target="_blank" rel="noopener">Instagram</a>` : '',
    about.vimeo     ? `<a href="${escHtml(about.vimeo)}"     target="_blank" rel="noopener">Vimeo</a>`     : '',
    about.youtube   ? `<a href="${escHtml(about.youtube)}"   target="_blank" rel="noopener">YouTube</a>`   : '',
  ].filter(Boolean).join('');

  const clients = String(about.clients || '').split(',').map((c) => c.trim()).filter(Boolean)
    .map((c) => `<span>${escHtml(c)}</span>`).join('');

  const s = siteData.sinkhole || {};
  const feature = sinkholeVisible()
    ? `<p class="about-feature">His first feature, <a href="#sinkhole">${escHtml(s.title)}</a>, is ${escHtml((s.status || 'in progress').toLowerCase())}.</p>`
    : '';

  container.innerHTML = `
    ${about.quote ? `<div class="about-quote">${escHtml(about.quote)}</div>` : ''}
    ${about.bio   ? `<p class="about-bio">${escHtml(about.bio)}</p>` : ''}
    ${feature}
    <div class="about-footer">
      ${contact ? `<div class="about-col"><h3>Contact</h3>${contact}</div>` : ''}
      ${clients ? `<div class="about-col"><h3>Selected clients</h3>${clients}</div>` : ''}
      ${social  ? `<div class="about-col"><h3>Elsewhere</h3>${social}</div>` : ''}
    </div>`;
}

// ---- VIDEO MODAL ----

function openVideo(v) {
  if (!v) return;
  let embedUrl = '';
  if (v.youtube_id) {
    embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.youtube_id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  } else if (v.vimeo_id) {
    embedUrl = `https://player.vimeo.com/video/${encodeURIComponent(v.vimeo_id)}?autoplay=1&title=0&byline=0&portrait=0`;
  }
  if (!embedUrl) return;

  document.getElementById('modal-video').innerHTML = `
    <iframe src="${embedUrl}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen
            title="${escHtml(v.title)}"></iframe>`;

  hideCursorLabel();
  document.getElementById('video-modal').classList.add('open');
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('video-modal').classList.remove('open');
  document.getElementById('modal-video').innerHTML = '';
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
}

// ---- TICKER ----
// Repeat the words until each loop is wider than the screen, so there's never a gap
// before the loop restarts. Speed stays constant regardless of screen width.

function initTicker() {
  const sets = document.querySelectorAll('.ticker-set');
  const inner = document.querySelector('.ticker-inner');
  if (sets.length < 2 || !inner) return;
  const unit = sets[0].innerHTML;

  function fill() {
    sets[0].innerHTML = unit;
    let guard = 0;
    while (sets[0].scrollWidth < innerWidth + 200 && guard++ < 20) sets[0].innerHTML += unit;
    sets[1].innerHTML = sets[0].innerHTML;
    inner.style.animationDuration = `${sets[0].scrollWidth / 40}s`;   // ~40px per second
  }
  fill();
  window.addEventListener('resize', fill);
}

// ---- CREEK ----
// "Long exposure": fine threads drifting left to right, like a creek shot
// with a slow shutter. Not interactive — it just flows.

function initCreek() {
  const canvas = document.getElementById('creek');
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');

  let w = 0, h = 0, dpr = 1, threads = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const n = Math.round(Math.min(420, (w * h) / 3800));
    threads = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h }));
  }
  window.addEventListener('resize', resize);
  resize();

  function step(t) {
      // Slowly fade what's already drawn, so strokes build into silky trails
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.018)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';

      ctx.strokeStyle = 'rgba(236,228,214,0.075)';   // warm off-white, not green
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const p of threads) {
        // A very slowly changing current, so strands run side by side instead of crossing
        const a = Math.sin(p.y * 0.003 + p.x * 0.0016 + t * 0.012) * 0.5
                + Math.sin(p.x * 0.0022 - p.y * 0.001 - t * 0.01) * 0.3;
        const nx = p.x + Math.cos(a) * 1.0 + 0.4;
        const ny = p.y + Math.sin(a) * 0.6;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        p.x = nx; p.y = ny;
        if (p.x > w + 5 || p.y < -5 || p.y > h + 5) { p.x = -5; p.y = Math.random() * h; }
      }
      ctx.stroke();
  }

  // Pre-run a few seconds so the page opens with trails already formed
  function prewarm() { for (let i = 0; i < 600; i++) step(i * 0.0167); }
  prewarm();
  window.addEventListener('resize', prewarm);

  function frame(now) {
    if (!document.body.classList.contains('modal-open')) step(now * 0.001 + 10);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---- HELPERS ----

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '');
}

function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
