/* ============================================================
   G.G. COOPER — PORTFOLIO SCRIPT
   ============================================================ */

let siteData = null;
const VALID_SECTIONS = ['edit', 'directing', 'photos', 'about'];

// ---- INIT ----

async function init() {
  try {
    const res = await fetch('data.json?v=' + Date.now());
    siteData = await res.json();
  } catch (err) {
    console.warn('Could not load data.json:', err);
    siteData = { edit: [], directing: [], photos: [], about: {} };
  }

  // Set up event listeners
  document.getElementById('modal-backdrop').addEventListener('click', closeModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('lightbox-backdrop').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeLightbox();
    }
  });

  window.addEventListener('hashchange', route);
  route(); // Initial render
}

// ---- ROUTING ----

function route() {
  const hash = window.location.hash.slice(1);
  const section = VALID_SECTIONS.includes(hash) ? hash : 'edit';

  // If hash was missing or invalid, update URL silently
  if (!hash || !VALID_SECTIONS.includes(hash)) {
    history.replaceState(null, '', '#' + section);
  }

  const isAbout = section === 'about';

  // Toggle body class for light/dark mode
  document.body.classList.toggle('about-mode', isAbout);

  // Show/hide ticker
  const ticker = document.getElementById('ticker');
  ticker.classList.toggle('hidden', isAbout);

  // Adjust main top padding
  const main = document.getElementById('main');
  main.classList.toggle('no-ticker', isAbout);

  // Swap sections
  document.querySelectorAll('.section').forEach((s) => {
    s.classList.remove('active', 'visible');
  });

  const activeEl = document.getElementById(section);
  if (activeEl) {
    activeEl.classList.add('active');
    // Small delay to allow display:block before starting opacity transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        activeEl.classList.add('visible');
      });
    });
    renderSection(section);
  }

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === section);
  });
}

// ---- RENDER DISPATCH ----

function renderSection(section) {
  if (!siteData) return;
  const renderers = {
    edit:       () => renderVideoGrid('edit-grid', siteData.edit || []),
    directing:  () => renderVideoGrid('directing-grid', siteData.directing || []),
    photos:     () => renderPhotoGrid('photos-grid', siteData.photos || []),
    about:      () => renderAbout(siteData.about || {}),
  };
  if (renderers[section]) renderers[section]();
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
    const thumb = v.thumbnail
      || (v.vimeo_id ? `https://vumbnail.com/${v.vimeo_id}.jpg` : '');

    const metaParts = [v.client, v.year].filter(Boolean);
    const meta = metaParts.join(' \u2014 ');

    const thumbHtml = thumb
      ? `<img class="video-thumb" src="${esc(thumb)}" alt="${esc(v.title)}" loading="lazy">`
      : `<div class="video-thumb" style="background:#181818;width:100%;height:100%;position:absolute;inset:0;"></div>`;

    return `
      <div class="video-card"
           onclick="openVideo('${esc(v.vimeo_id)}', '${esc(v.title)}')"
           role="button"
           tabindex="0"
           aria-label="Play ${esc(v.title)}"
           onkeydown="if(event.key==='Enter')openVideo('${esc(v.vimeo_id)}','${esc(v.title)}')">
        ${thumbHtml}
        <div class="video-overlay">
          <div class="video-play" aria-hidden="true"></div>
          <div class="video-info">
            <div class="video-title">${escHtml(v.title)}</div>
            ${meta ? `<div class="video-meta">${escHtml(meta)}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
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
         onclick="openPhoto('${esc(p.src)}', '${esc(p.title)}')"
         role="button"
         tabindex="0"
         aria-label="${esc(p.title)}"
         onkeydown="if(event.key==='Enter')openPhoto('${esc(p.src)}','${esc(p.title)}')">
      <img src="${esc(p.src)}" alt="${esc(p.title)}" loading="lazy">
      <div class="photo-overlay">
        <span class="photo-overlay-title">${escHtml(p.title)}</span>
      </div>
    </div>
  `).join('');
}

// ---- ABOUT ----

function renderAbout(about) {
  const container = document.getElementById('about-content');
  if (!container) return;

  const links = [
    about.email    ? `<a href="mailto:${esc(about.email)}">${escHtml(about.email)}</a>` : '',
  ].filter(Boolean);

  const socials = [
    about.vimeo     ? `<a href="${esc(about.vimeo)}"     target="_blank" rel="noopener noreferrer">Vimeo</a>`     : '',
    about.youtube   ? `<a href="${esc(about.youtube)}"   target="_blank" rel="noopener noreferrer">YouTube</a>`   : '',
    about.instagram ? `<a href="${esc(about.instagram)}" target="_blank" rel="noopener noreferrer">Instagram</a>` : '',
  ].filter(Boolean);

  container.innerHTML = `
    ${about.quote ? `<div class="about-quote">${escHtml(about.quote)}</div>` : ''}
    ${about.bio   ? `<p class="about-bio">${escHtml(about.bio)}</p>` : ''}
    <div class="about-footer">
      ${links.length ? `
        <div class="about-col">
          <h3>Contact</h3>
          ${links.join('')}
        </div>` : ''}
      ${socials.length ? `
        <div class="about-col">
          <h3>Follow</h3>
          ${socials.join('')}
        </div>` : ''}
    </div>
  `;
}

// ---- VIDEO MODAL ----

function openVideo(vimeoId, title) {
  if (!vimeoId) return;
  const modal = document.getElementById('video-modal');
  const box   = document.getElementById('modal-video');

  box.innerHTML = `
    <iframe
      src="https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}?autoplay=1&color=c9b89a&title=0&byline=0&portrait=0"
      allow="autoplay; fullscreen; picture-in-picture"
      allowfullscreen
      title="${esc(title)}">
    </iframe>`;

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('video-modal');
  const box   = document.getElementById('modal-video');
  modal.classList.remove('open');
  box.innerHTML = ''; // Stop video playback
  document.body.style.overflow = '';
}

// ---- PHOTO LIGHTBOX ----

function openPhoto(src, title) {
  const lb   = document.getElementById('lightbox');
  const img  = document.getElementById('lightbox-img');
  const cap  = document.getElementById('lightbox-caption');

  img.src       = src;
  img.alt       = title;
  cap.textContent = title;

  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb  = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  lb.classList.remove('open');
  img.src = '';
  document.body.style.overflow = '';
}

// ---- HELPERS ----

// Escape for use inside HTML attribute values (single-quoted)
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '');
}

// Escape for use as visible HTML text
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- START ----
init();
