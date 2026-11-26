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
  const base = ['home', 'directing', 'edit', 'about', 'spring', 'creeker'];
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
  initAbyss();
  initWithhold();
  initTicker();

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('hashchange', route);
  route();
}

// ---- ROUTING ----

let currentSection = null;
let fading = false;

function route() {
  const hash = window.location.hash.slice(1);
  const section = validSections().includes(hash) ? hash : 'home';

  if (hash !== section) history.replaceState(null, '', location.search + '#' + section);

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const first = currentSection === null;

  // Into Sinkhole: the page sinks away and the ground opens
  if (!first && !calm && !fading && section === 'sinkhole' && currentSection !== 'sinkhole') {
    sinkInto(() => showSection(section));
    return;
  }
  // Out of Sinkhole: rise back up through the dark
  if (!first && !calm && !fading && currentSection === 'sinkhole' && section !== 'sinkhole') {
    fadeThrough(900, 1100, () => showSection(section), 'dark');
    return;
  }
  // Into Creeker Day: threads stream across while the page fades
  if (!first && !calm && !fading && section === 'creeker' && currentSection !== 'creeker'
      && currentSection !== 'spring') {
    weaveInto(() => showSection(section));
    return;
  }
  // Entering or leaving One Afternoon in Spring: a long, slow fade through light
  const crossing = !first && (section === 'spring') !== (currentSection === 'spring');
  if (crossing && !calm && !fading) {
    const entering = section === 'spring';
    fadeThrough(entering ? 3200 : 1400, entering ? 2600 : 1200, () => showSection(section));
    return;
  }
  if (!fading) showSection(section);
}

// Fade a full-screen veil up, swap the page underneath, then let the veil dissolve
function fadeThrough(inMs, outMs, swap, tone) {
  const veil = document.getElementById('veil');
  veil.classList.toggle('dark', tone === 'dark');
  fading = true;
  hideCursorLabel();
  veil.style.transitionDuration = `${inMs}ms`;
  veil.classList.add('on');
  setTimeout(() => {
    swap();
    veil.style.transitionDuration = `${outMs}ms`;
    requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('on')));
    setTimeout(() => {
      fading = false;
      // If the address changed mid-fade, catch up
      const h = location.hash.slice(1);
      if (h && h !== currentSection) route();
    }, outMs);
  }, inMs + 150);
}

// Sinking in: the page quietly dims and settles a little deeper, the dark
// closes over it, then Sinkhole slowly surfaces out of the black.
function sinkInto(swap) {
  const veil = document.getElementById('veil');
  fading = true;
  hideCursorLabel();
  document.body.classList.add('sinking');
  veil.classList.add('dark');
  veil.style.transitionDuration = '1600ms';
  veil.classList.add('on');
  setTimeout(() => {
    swap();
    document.body.classList.remove('sinking');
    veil.style.transitionDuration = '2400ms';
    requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('on')));
    setTimeout(() => {
      fading = false;
      const h = location.hash.slice(1);
      if (h && h !== currentSection) route();
    }, 2400);
  }, 1750);
}

// Weaving: many threads stream across the screen — the year's stories gathering —
// while the current page fades out, then Creeker Day fades in as they thin out.
function weaveInto(swap) {
  fading = true;
  hideCursorLabel();
  creekSurge(2200);
  document.body.classList.add('weaving');
  setTimeout(() => {
    swap();
    document.body.classList.remove('weaving');
    setTimeout(() => {
      fading = false;
      const h = location.hash.slice(1);
      if (h && h !== currentSection) route();
    }, 1600);
  }, 1500);
}

function showSection(section) {
  currentSection = section;
  document.body.classList.toggle('sink-mode', section === 'sinkhole');

  const noTicker = section === 'about' || section === 'sinkhole' || section === 'spring';
  document.body.classList.toggle('spring-mode', section === 'spring');
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

  document.title = section === 'home'   ? 'G.G. COOPER'
                 : section === 'spring' ? 'One Afternoon in Spring'
                 : section === 'creeker' ? 'Creeker Day — G.G. Cooper'
                 : `${section.charAt(0).toUpperCase()}${section.slice(1)} — G.G. Cooper`;
}

function renderSection(section) {
  if (!siteData) return;
  ({
    home:      () => { renderVideoGrid('home-grid', siteData.featured || []); renderHolidayNote(); },
    directing: () => renderVideoGrid('directing-grid', siteData.directing || []),
    edit:      () => renderVideoGrid('edit-grid',      siteData.edit      || []),
    sinkhole:  () => renderSinkhole(siteData.sinkhole || {}),
    spring:    () => renderSpring(siteData.spring || {}),
    creeker:   () => renderCreeker(siteData.creeker || {}),
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

  // Letters settle at uneven depths, as if into soft ground
  const depths = [0, 0.05, 0.12, 0.03, 0.18, 0.07, 0.24, 0.1];
  const title = String(s.title || 'Sinkhole').toUpperCase().split('').map((ch, i) =>
    `<span style="--d:${depths[i % depths.length]};--i:${i}">${escHtml(ch)}</span>`).join('');

  // End-credits style: centered, role on the left of the gutter, names on the right.
  // "[Heading]" lines start a group; several names are separated by commas.
  const credits = String(s.credits || '').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => {
      const head = l.match(/^\[(.+)\]$/);
      if (head) return `<h3 class="sk-credit-head">${escHtml(head[1])}</h3>`;
      const [role, ...rest] = l.split(/\s+[—–]\s+/);
      const names = rest.join(' — ').split(/,\s+/).map(escHtml).join('<br>');
      return `<div class="sk-credit"><span>${escHtml(role)}</span><span>${names}</span></div>`;
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

  const heading = s.title_image
    ? `<h1 class="sk-title-wrap" style="--title-img:url('${esc(s.title_image)}')"><img class="sk-title-img" src="${escHtml(s.title_image)}" alt="${escHtml(s.title || 'Sinkhole')}"></h1>`
    : `<h1 class="sk-title" aria-label="${escHtml(s.title || 'Sinkhole')}">${title}</h1>`;

  container.innerHTML = `
    <div class="sk-stage">
      ${heading}
      ${s.status ? `<p class="sk-by">${escHtml(s.status)}</p>` : ''}
      ${s.tagline ? `<p class="sk-tag" id="sk-tag">${escHtml(s.tagline)}</p>` : ''}
    </div>
    ${s.still ? `<div class="sk-still"><img src="${escHtml(s.still)}" alt=""></div>` : ''}
    ${s.logline ? `<p class="sk-logline">${escHtml(s.logline)}</p>` : ''}
    ${credits ? `<div class="sk-credits">${credits}</div>` : ''}
    ${trailer}`;
}

// ---- CREEKER DAY ----
// Every July 4th since 2017. The holiday that replaced the Fourth of July.

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function creekerDay() {
  const since = parseInt((siteData && siteData.creeker && siteData.creeker.since), 10) || 2017;
  const now = new Date();
  const today = now.getMonth() === 6 && now.getDate() === 4;
  let year = now.getFullYear();
  if (!today && (now.getMonth() > 6 || (now.getMonth() === 6 && now.getDate() > 4))) year++;
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((new Date(year, 6, 4) - midnight) / 86400000);
  return { today, year, days, edition: year - since + 1 };
}

function renderHolidayNote() {
  const el = document.getElementById('holiday-note');
  if (!el) return;
  const c = creekerDay();
  const link = '<a href="#creeker">Creeker Day</a>';
  el.innerHTML = c.today
    ? `Today is ${link}.`
    : `The next ${link} is July 4, ${c.year}. ${c.days.toLocaleString()} ${c.days === 1 ? 'day' : 'days'} to go.`;
}

function renderCreeker(cd) {
  const container = document.getElementById('creeker-content');
  if (!container) return;
  const c = creekerDay();
  const since = parseInt(cd.since, 10) || 2017;
  const intro = String(cd.intro || '').replace(/\s*\n\s*/g, ' ');

  const count = c.today
    ? `Today is the ${ordinal(c.edition)} annual Creeker Day.`
    : `The ${ordinal(c.edition)} annual Creeker Day is in ${c.days.toLocaleString()} ${c.days === 1 ? 'day' : 'days'}.`;

  container.innerHTML = `
    <h1 class="section-title">${escHtml(cd.title || 'Creeker Day')}</h1>
    <p class="cr-observed">Observed every July 4th since ${since}.</p>
    <p class="cr-count">${count}</p>
    ${intro ? `<p class="cr-intro">${escHtml(intro)}</p>` : ''}
    <div class="video-grid" id="creeker-grid"></div>`;

  const videos = (cd.videos || []).slice().sort((a, b) => b.year - a.year).map((v) => ({
    title: `Creeker Day ${v.year}`,
    year: `July 4, ${v.year}`,
    youtube_id: v.youtube_id,
    thumbnail: v.thumbnail,
  }));
  if (videos.length) renderVideoGrid('creeker-grid', videos);
  else document.getElementById('creeker-grid').innerHTML = '<p class="empty-state">The films are on their way.</p>';
}

// ---- ONE AFTERNOON IN SPRING ----
// Hidden page (FILMMAKER in the ticker). A ledger of one trailer per year until 2047.

function renderSpring(sp) {
  const container = document.getElementById('spring-content');
  if (!container) return;

  const release = parseInt(sp.release, 10) || 2047;
  const first = 2022;
  const thisYear = new Date().getFullYear();
  const byYear = {};
  (sp.trailers || []).forEach((t) => { byYear[t.year] = t; });

  // Afternoons left until the first day of spring in the release year
  const spring = new Date(release, 2, 20, 15, 0, 0);
  const days = Math.max(0, Math.ceil((spring - new Date()) / 86400000));

  const rows = [];
  for (let y = first; y <= release; y++) {
    const t = byYear[y];
    if (y === release) {
      rows.push(`<div class="sp-row final"><div class="sp-year">${y}</div><div class="sp-note">The film.</div></div>`);
      continue;
    }
    if (t) {
      const v = { title: sp.title || 'One Afternoon in Spring', category: 'Trailer', year: String(y),
                  youtube_id: t.youtube_id, thumbnail: t.thumbnail };
      const key = cardRegistry.push(v) - 1;
      const thumb = getThumb(v);
      const ytId = (thumb.includes('img.youtube.com') && v.youtube_id) ? esc(v.youtube_id) : '';
      rows.push(`
        <div class="sp-row${y === thisYear ? ' now' : ''}">
          <div class="sp-year">${y}</div>
          <div class="sp-trailer">
            <div class="video-card" data-key="${key}" role="button" tabindex="0" aria-label="Play the ${y} trailer">
              <img class="video-thumb" src="${escHtml(thumb)}" alt="" loading="lazy"
                   ${ytId ? `onload="upgradeYoutubeThumb(this,'${ytId}')"` : ''}>
              <div class="video-play" aria-hidden="true"></div>
            </div>
          </div>
        </div>`);
    } else {
      const state = y > thisYear ? 'future' : (y === thisYear ? 'now' : '');
      const note = y === thisYear ? 'In progress.' : '';
      rows.push(`<div class="sp-row ${state}"><div class="sp-year">${y}</div><div class="sp-note">${note}</div></div>`);
    }
  }

  const intro = String(sp.intro || '').replace(/\s*\n\s*/g, ' ');

  container.innerHTML = `
    <p class="sp-kicker">${escHtml(sp.kicker || 'A documentary')}</p>
    <h1 class="sp-title">${escHtml(sp.title || 'One Afternoon in Spring')}</h1>
    <p class="sp-coming">Coming in ${release}.</p>
    <p class="sp-count">${days.toLocaleString()} afternoons from now.</p>
    ${intro ? `<p class="sp-intro">${escHtml(intro)}</p>` : ''}
    <div class="sp-ledger">${rows.join('')}</div>`;
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
  // On July 4th the ticker belongs to the holiday
  const unit = creekerDay().today
    ? '<span>HAPPY CREEKER DAY</span><span class="dot"> &middot; </span>'.repeat(3)
    : sets[0].innerHTML;

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
// A dozen faint wisps. Each drifts in, travels with a tail that fades to nothing,
// then dissolves completely before a new one appears. Nothing builds up.
// Now and then one warm "story thread" carries a tiny "July 4" — follow it to Creeker Day.

let creekSurge = () => {};

function initCreek() {
  const canvas = document.getElementById('creek');
  const tag = document.getElementById('story-thread');
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) { if (tag) tag.hidden = true; return; }
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, wisps = [], extras = [], story = null;
  let rgb = '168,196,208';
  const GOLD = '226,204,158';
  const readColor = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--wisp-rgb').trim();
    if (v) rgb = v.replace(/\s+/g, '');
  };

  const N = 12, BUCKETS = 8;
  const spawn = (fresh, opts = {}) => {
    const life = opts.life || 700 + Math.random() * 600;
    return { x: opts.x ?? Math.random() * w * 0.75, y: opts.y ?? Math.random() * h, pts: [],
             age: fresh ? Math.random() * life * 0.6 : 0, life,
             len: opts.len || 220 + Math.random() * 180, speed: opts.speed || 0.55 + Math.random() * 0.35 };
  };

  // Surge: many threads stream across at once (used for the way into Creeker Day)
  let surge = 0, surgeTarget = 0;
  creekSurge = (ms) => {
    surgeTarget = 1;
    extras = Array.from({ length: 46 }, () => spawn(false, {
      x: -Math.random() * w * 0.5, y: Math.random() * h, life: 400 + Math.random() * 200,
      len: 160 + Math.random() * 160, speed: 2.2 + Math.random() * 1.6 }));
    setTimeout(() => { surgeTarget = 0; }, ms);
  };

  // The story thread: appears every minute or so, carrying a "July 4" tag
  let nextStory = 12 + Math.random() * 10;   // seconds after load
  const spawnStory = () => {
    story = spawn(false, { x: Math.random() * w * 0.3, y: h * (0.25 + Math.random() * 0.5),
                           life: 1500, len: 420, speed: 0.6 });
    story.hover = false;
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wisps = Array.from({ length: N }, () => spawn(true));
    for (let i = 0; i < 300; i++) step(i / 60, false);    // start mid-flow
  }

  function advance(s, t, speedMul) {
    const a = Math.sin(s.y * 0.003 + s.x * 0.0016 + t * 0.012) * 0.5
            + Math.sin(s.x * 0.0022 - s.y * 0.001 - t * 0.01) * 0.3;
    s.x += (Math.cos(a) * s.speed + 0.25) * speedMul;
    s.y += Math.sin(a) * s.speed * 0.6 * speedMul;
    s.pts.push(s.x, s.y);
    if (s.pts.length > s.len * 2) s.pts.splice(0, 2);
    s.age += speedMul;
  }

  function paint(s, color, peak) {
    const env = Math.sin(Math.PI * Math.min(1, s.age / s.life)) ** 1.5;   // fade in, hold, fade out
    const n = s.pts.length / 2;
    if (n < 3) return env;
    for (let b = 0; b < BUCKETS; b++) {
      const i0 = Math.floor(b * (n - 1) / BUCKETS), i1 = Math.floor((b + 1) * (n - 1) / BUCKETS);
      const alpha = peak * env * ((b + 1) / BUCKETS) ** 1.6;            // tail fades into nothing
      if (alpha < 0.003) continue;
      ctx.strokeStyle = `rgba(${color},${alpha.toFixed(4)})`;
      ctx.beginPath();
      ctx.moveTo(s.pts[i0 * 2], s.pts[i0 * 2 + 1]);
      for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(s.pts[i * 2], s.pts[i * 2 + 1]);
      ctx.stroke();
    }
    return env;
  }

  function step(t, draw = true) {
    surge += (surgeTarget - surge) * 0.03;
    if (draw) ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    for (let k = 0; k < wisps.length; k++) {
      const s = wisps[k];
      advance(s, t, 1 + surge * 1.5);
      if (draw) paint(s, rgb, 0.13 + surge * 0.12);
      if (s.age >= s.life || s.x > w + 40) wisps[k] = spawn(false);
    }

    // Surge threads: many stories converging
    if (extras.length) {
      for (const s of extras) { advance(s, t, 1); if (draw) paint(s, rgb, 0.3 * surge + 0.02); }
      if (surge < 0.02 && surgeTarget === 0) extras = [];
    }

    // The story thread
    if (!draw) return;
    if (!story && t > nextStory && !document.body.classList.contains('sink-mode')) spawnStory();
    if (story) {
      advance(story, t, story.hover ? 0.25 : 1);
      ctx.lineWidth = story.hover ? 1.5 : 1.2;
      const env = paint(story, GOLD, story.hover ? 0.75 : 0.48);
      ctx.lineWidth = 1;
      if (tag) {
        tag.style.transform = `translate3d(${story.x + 10}px, ${story.y - 22}px, 0)`;
        tag.style.opacity = (env * (story.hover ? 1 : 0.8)).toFixed(3);
        tag.classList.toggle('live', env > 0.25);
      }
      if (story.age >= story.life || story.x > w + 40) {
        story = null;
        if (tag) { tag.style.opacity = 0; tag.classList.remove('live'); tag.textContent = 'July 4'; }
        nextStory = t + 45 + Math.random() * 30;
      }
    }
  }

  if (tag) {
    tag.addEventListener('mouseenter', () => { if (story) { story.hover = true; tag.textContent = 'Creeker Day'; } });
    tag.addEventListener('mouseleave', () => { if (story) story.hover = false; tag.textContent = 'July 4'; });
  }

  readColor();
  setInterval(readColor, 1000);
  window.addEventListener('resize', resize);
  resize();

  let t0 = null;
  function frame(now) {
    if (t0 === null) t0 = now;
    const b = document.body.classList;
    if (!b.contains('modal-open') && !b.contains('sink-mode') && !b.contains('spring-mode')) step((now - t0) * 0.001);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---- THE WORLD WITHHOLDS ----
// The tagline sits at the bottom of the hole and only surfaces if you stay
// still for a while. Any movement and it sinks back out of sight.

function initWithhold() {
  let timer = 0;
  const hide = () => {
    const tag = document.getElementById('sk-tag');
    if (tag) tag.classList.remove('surfaced');
    clearTimeout(timer);
    if (document.body.classList.contains('sink-mode')) {
      timer = setTimeout(() => {
        const t = document.getElementById('sk-tag');
        if (t && window.scrollY < 40) t.classList.add('surfaced');
      }, 6500);
    }
  };
  ['pointermove', 'pointerdown', 'scroll', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, hide, { passive: true }));
  window.addEventListener('hashchange', () => setTimeout(hide, 50));
  setTimeout(hide, 50);
}

// ---- ABYSS (Sinkhole page) ----
// Hand-drawn rings emerge from a dark point and swell toward you, like falling
// slowly down a well. Only runs on the Sinkhole page.

function initAbyss() {
  const canvas = document.getElementById('abyss');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1, maxR = 0, rings = [];
  const N = 16;
  const grow = (r) => 0.06 + r * 0.0032;                  // perspective: faster as they near you
  const fresh = () => ({ r: 2, seed: Math.random() * 100, rose: Math.random() < 0.33 });

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    maxR = Math.hypot(w, h) * 0.7;
    rings = [];
    // Spread rings along the tunnel by running time forward
    for (let i = 0; i < N; i++) {
      const g = fresh();
      for (let k = 0; k < i * 95; k++) g.r += grow(g.r);
      if (g.r < maxR) rings.push(g);
    }
  }

  let spawnClock = 0;
  function step(t) {
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * 0.66;
    if (!still) {
      if (++spawnClock > 95) { spawnClock = 0; rings.push(fresh()); }
      for (const g of rings) g.r += grow(g.r);
      rings = rings.filter((g) => g.r < maxR);
    }
    for (const g of rings) {
      const depth = g.r / maxR;                          // 0 deep in the hole, 1 at your eye
      const alpha = Math.min(1, depth * 9) * Math.min(1, (1 - depth) * 2.5) * 0.15;
      if (alpha < 0.004) continue;
      for (let pass = 0; pass < 2; pass++) {             // two offset strokes: a hand-drawn feel
        ctx.strokeStyle = `rgba(${g.rose ? '224,168,178' : '233,225,211'},${(alpha * (pass ? 0.5 : 1)).toFixed(4)})`;
        ctx.lineWidth = (pass ? 0.6 : 1) * (0.7 + depth * 0.9);
        ctx.beginPath();
        for (let k = 0; k <= 120; k++) {
          const th = (k / 120) * Math.PI * 2;
          const wob = 1 + 0.045 * Math.sin(3 * th + g.seed + t * 0.25)
                        + 0.02 * Math.sin(7 * th - g.seed - t * 0.4) + pass * 0.008;
          const x = cx + Math.cos(th) * g.r * wob * 1.15;
          const y = cy + Math.sin(th) * g.r * wob * 0.82;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  window.addEventListener('resize', resize);
  resize();

  function frame(now) {
    const b = document.body.classList;
    if (b.contains('sink-mode') && !b.contains('modal-open')) step(now * 0.001);
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
