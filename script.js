/* ============================================================
   G.G. COOPER — PORTFOLIO SCRIPT
   ============================================================ */

let siteData = null;
const VALID_SECTIONS = ['home', 'edit', 'directing', 'about'];

// ---- INIT ----

async function init() {
  try {
    const res = await fetch('data.json?v=' + Date.now());
    siteData = await res.json();
  } catch (err) {
    console.warn('Could not load data.json:', err);
    siteData = { featured: [], edit: [], directing: [], photos: [], about: {} };
  }

  document.getElementById('modal-backdrop').addEventListener('click', closeModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('lightbox-backdrop').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeLightbox(); }
  });

  window.addEventListener('hashchange', route);
  route();
}

// ---- ROUTING ----

function route() {
  const hash = window.location.hash.slice(1);
  const section = VALID_SECTIONS.includes(hash) ? hash : 'home';

  if (!hash || !VALID_SECTIONS.includes(hash)) {
    history.replaceState(null, '', '#' + section);
  }

  const isAbout = section === 'about';

  document.body.classList.toggle('about-mode', isAbout);
  document.getElementById('ticker').classList.toggle('hidden', isAbout);
  document.getElementById('main').classList.toggle('no-ticker', isAbout);

  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active', 'visible'));

  const activeEl = document.getElementById(section);
  if (activeEl) {
    activeEl.classList.add('active');
    requestAnimationFrame(() => requestAnimationFrame(() => activeEl.classList.add('visible')));
    renderSection(section);
  }

  // Nav: highlight edit/directing/photos/about but not home (logo = home)
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === section);
  });
}

// ---- RENDER DISPATCH ----

function renderSection(section) {
  if (!siteData) return;
  ({
    home:      () => renderVideoGrid('home-grid',      siteData.featured  || []),
    edit:      () => renderVideoGrid('edit-grid',      siteData.edit      || []),
    directing: () => renderVideoGrid('directing-grid', siteData.directing || []),
    about:     () => renderAbout(siteData.about || {}),
  })[section]?.();
}

// ---- VIDEO GRID ----

function renderVideoGrid(containerId, videos) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!videos.length) {
    container.innerHTML = '<p class="empty-state">No projects yet.</p>';
    return;
  }

  container.innerHTML = videos.map((v) => {
    const thumb = getThumb(v);
    const metaParts = [v.client, v.year].filter(Boolean);
    const meta = metaParts.join(' \u2014 ');

    // Only auto-upgrade to maxresdefault when we're using the generated
    // YouTube thumbnail — never touch a manually-set custom thumbnail.
    const isAutoYoutubeThumb = thumb.includes('img.youtube.com');
    const ytId = (isAutoYoutubeThumb && v.youtube_id) ? esc(v.youtube_id) : '';
    const thumbHtml = thumb
      ? `<img class="video-thumb" src="${esc(thumb)}" alt="${esc(v.title)}" loading="lazy"
             onerror="this.src='${esc(getFallbackThumb(v))}';"
             ${ytId ? `onload="upgradeYoutubeThumb(this,'${ytId}')"` : ''}>`
      : `<div class="video-thumb" style="background:#181818;position:absolute;inset:0;"></div>`;

    return `
      <div class="video-card"
           onclick="openVideo(${attrJson(v)})"
           role="button" tabindex="0"
           aria-label="Play ${esc(v.title)}"
           onkeydown="if(event.key==='Enter')openVideo(${attrJson(v)})">
        ${thumbHtml}
        <div class="video-overlay">
          <div class="video-play" aria-hidden="true"></div>
          <div class="video-info">
            <div class="video-title">${escHtml(v.title)}</div>
            ${meta ? `<div class="video-meta">${escHtml(meta)}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ---- THUMBNAIL HELPERS ----

function getThumb(v) {
  // A manually-set thumbnail (custom override) always wins over the
  // auto-generated YouTube/Vimeo one, even when youtube_id is present
  // (youtube_id is still needed separately for video playback).
  if (v.thumbnail && !v.thumbnail.includes('img.youtube.com') && !v.thumbnail.includes('vumbnail.com')) {
    return v.thumbnail;
  }
  if (v.youtube_id) return `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`;
  if (v.thumbnail)  return v.thumbnail;
  if (v.vimeo_id)   return `https://vumbnail.com/${v.vimeo_id}.jpg`;
  return '';
}

function getFallbackThumb(v) {
  // Last-resort fallback if hqdefault somehow fails too
  if (v.youtube_id) return `https://img.youtube.com/vi/${v.youtube_id}/0.jpg`;
  return '';
}

// Try upgrading a displayed hqdefault (480x360) thumbnail to the sharper
// maxresdefault (1280x720) if one exists. YouTube doesn't always return a
// real 404 for videos without a maxres image — sometimes it's a 200 with a
// tiny 120x90 gray placeholder — so we check the actual decoded width
// instead of relying on the error event.
function upgradeYoutubeThumb(imgEl, youtubeId) {
  if (!youtubeId || imgEl.dataset.upgraded) return;
  imgEl.dataset.upgraded = '1';
  const hiRes = new Image();
  hiRes.onload = () => {
    if (hiRes.naturalWidth > 120) {
      imgEl.src = hiRes.src;
    }
  };
  hiRes.src = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
}

// ---- PHOTO GRID ----

function renderPhotoGrid(containerId, photos) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!photos.length) {
    container.innerHTML = '<p class="empty-state">No photos yet.</p>';
    return;
  }

  container.innerHTML = photos.map((p) => `
    <div class="photo-card"
         onclick="openPhoto('${esc(p.src)}','${esc(p.title)}')"
         role="button" tabindex="0"
         aria-label="${esc(p.title)}"
         onkeydown="if(event.key==='Enter')openPhoto('${esc(p.src)}','${esc(p.title)}')">
      <img src="${esc(p.src)}" alt="${esc(p.title)}" loading="lazy">
      <div class="photo-overlay">
        <span class="photo-overlay-title">${escHtml(p.title)}</span>
      </div>
    </div>`).join('');
}

// ---- ABOUT ----

function renderAbout(about) {
  const container = document.getElementById('about-content');
  if (!container) return;

  const contactLinks = [
    about.email ? `<a href="mailto:${esc(about.email)}">${escHtml(about.email)}</a>` : '',
  ].filter(Boolean);

  const socialLinks = [
    about.youtube   ? `<a href="${esc(about.youtube)}"   target="_blank" rel="noopener">YouTube</a>`   : '',
    about.vimeo     ? `<a href="${esc(about.vimeo)}"     target="_blank" rel="noopener">Vimeo</a>`     : '',
    about.instagram ? `<a href="${esc(about.instagram)}" target="_blank" rel="noopener">Instagram</a>` : '',
  ].filter(Boolean);

  container.innerHTML = `
    ${about.quote ? `<div class="about-quote">${escHtml(about.quote)}</div>` : ''}
    ${about.bio   ? `<p class="about-bio">${escHtml(about.bio)}</p>` : ''}
    <div class="about-footer">
      ${contactLinks.length ? `<div class="about-col"><h3>Contact</h3>${contactLinks.join('')}</div>` : ''}
      ${socialLinks.length  ? `<div class="about-col"><h3>Follow</h3>${socialLinks.join('')}</div>`   : ''}
    </div>`;
}

// ---- VIDEO MODAL ----

function openVideo(v) {
  const modal = document.getElementById('video-modal');
  const box   = document.getElementById('modal-video');
  let embedUrl = '';

  if (v.youtube_id) {
    embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(v.youtube_id)}?autoplay=1&rel=0&modestbranding=1`;
  } else if (v.vimeo_id) {
    embedUrl = `https://player.vimeo.com/video/${encodeURIComponent(v.vimeo_id)}?autoplay=1&color=c9b89a&title=0&byline=0&portrait=0`;
  }

  if (!embedUrl) return;

  box.innerHTML = `
    <iframe src="${embedUrl}"
      allow="autoplay; fullscreen; picture-in-picture"
      allowfullscreen
      title="${esc(v.title)}">
    </iframe>`;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('video-modal').classList.remove('open');
  document.getElementById('modal-video').innerHTML = '';
  document.body.style.overflow = '';
}

// ---- PHOTO LIGHTBOX ----

function openPhoto(src, title) {
  document.getElementById('lightbox-img').src       = src;
  document.getElementById('lightbox-img').alt       = title;
  document.getElementById('lightbox-caption').textContent = title;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightbox-img').src = '';
  document.body.style.overflow = '';
}

// ---- HELPERS ----

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '');
}

function attrJson(obj) {
  // Safe to embed inside a double-quoted HTML attribute: encode the JSON's
  // own double quotes as &quot; so the browser decodes them back to " before
  // the string is parsed as JS, instead of letting them close the attribute early.
  return JSON.stringify(obj).replace(/"/g, '&quot;');
}

function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
