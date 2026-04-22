/* ════════════════════════════════════════════════════════
   UIO0987 · 3D GALLERY — app.js
   ════════════════════════════════════════════════════════ */

'use strict';

// ── State ────────────────────────────────────────────────
const state = {
  images:       [],
  pendingFiles: [],
  paused:       false,
  rgbOn:        false,
  ambientOn:    false,
  starsOn:      true,
  orbit:        380,
  cardW:        220,
  cardH:        280,
  speed:        25,
  wpOpacity:    0.18,
  currentTheme: 'dark',
  dragging:     false,
  dragStartX:   0,
  dragStartY:   0,
  manualRotX:   10,
  manualRotY:   0,
};

// ── DOM refs ─────────────────────────────────────────────
const scene         = document.getElementById('scene');
const sceneWrapper  = document.getElementById('sceneWrapper');
const emptyState    = document.getElementById('emptyState');
const hamBtn        = document.getElementById('hamBtn');
const hamPanel      = document.getElementById('hamPanel');
const panelClose    = document.getElementById('panelClose');
const fabBtn        = document.getElementById('fabBtn');
const pauseBtn      = document.getElementById('pauseBtn');
const modalOverlay  = document.getElementById('modalOverlay');
const modalClose    = document.getElementById('modalClose');
const modalAddBtn   = document.getElementById('modalAddBtn');
const modalCancelBtn= document.getElementById('modalCancelBtn');
const tabLocal      = document.getElementById('tabLocal');
const tabUrl        = document.getElementById('tabUrl');
const paneLocal     = document.getElementById('paneLocal');
const paneUrl       = document.getElementById('paneUrl');
const dropZone      = document.getElementById('dropZone');
const fileInput     = document.getElementById('fileInput');
const previewStrip  = document.getElementById('previewStrip');
const addUrlBtn     = document.getElementById('addUrlBtn');
const imgUrlInput   = document.getElementById('imgUrlInput');
const imgLabelInput = document.getElementById('imgLabelInput');
const toastEl       = document.getElementById('toast');
const rgbCanvas     = document.getElementById('rgbCanvas');
const starsEl       = document.getElementById('stars');
const wallpaperBg   = document.getElementById('wallpaperBg');
const ambientOverlay= document.getElementById('ambientOverlay');
const bgAudio       = document.getElementById('bgAudio');
const musicPlayBtn  = document.getElementById('musicPlayBtn');
const musicInfo     = document.getElementById('musicInfo');

// ── RGB Canvas Animation ─────────────────────────────────
let rgbHue = 0;
let rgbRaf = null;

function startRGB() {
  const ctx = rgbCanvas.getContext('2d');
  function resize() {
    rgbCanvas.width  = window.innerWidth;
    rgbCanvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    const w = rgbCanvas.width, h = rgbCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const thickness = 4;
    const total = 2 * (w + h);   // perimeter
    const segLen = 220;           // length of glowing segment

    // Calculate hue-shifted gradient along perimeter
    // We draw the 4 edges: top → right → bottom → left
    function hslStr(hue) {
      return `hsl(${hue % 360}, 100%, 55%)`;
    }

    const offset = (rgbHue * 3) % total; // position of segment head

    // Build gradient path
    function drawEdge(x1, y1, x2, y2) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      // Full rainbow along edge
      for (let i = 0; i <= 10; i++) {
        grad.addColorStop(i / 10, hslStr(rgbHue + (i / 10) * 60));
      }
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = grad;
      ctx.lineWidth = thickness;
      ctx.shadowBlur = 18;
      ctx.shadowColor = hslStr(rgbHue);
      ctx.stroke();
    }

    ctx.lineCap = 'round';
    drawEdge(0,     0,     w,     0    ); // top
    drawEdge(w,     0,     w,     h    ); // right
    drawEdge(w,     h,     0,     h    ); // bottom
    drawEdge(0,     h,     0,     0    ); // left

    rgbHue = (rgbHue + 1.2) % 360;
    rgbRaf = requestAnimationFrame(draw);
  }
  draw();
}

function stopRGB() {
  if (rgbRaf) { cancelAnimationFrame(rgbRaf); rgbRaf = null; }
  const ctx = rgbCanvas.getContext('2d');
  ctx.clearRect(0, 0, rgbCanvas.width, rgbCanvas.height);
}

// ── Starfield ────────────────────────────────────────────
(function buildStars() {
  for (let i = 0; i < 180; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const sz = Math.random() * 2.4 + 0.4;
    s.style.cssText = `
      width:${sz}px; height:${sz}px;
      left:${(Math.random() * 100).toFixed(2)}%;
      top:${(Math.random() * 100).toFixed(2)}%;
      --d:${(Math.random() * 4 + 1.5).toFixed(1)}s;
      --delay:-${(Math.random() * 6).toFixed(1)}s;
    `;
    starsEl.appendChild(s);
  }
})();

// ── Gallery Build ────────────────────────────────────────
function buildGallery() {
  scene.innerHTML = '';
  const n = state.images.length;
  emptyState.classList.toggle('hidden', n > 0);
  if (!n) return;

  const angleStep = 360 / n;
  state.images.forEach((img, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = `
      width: ${state.cardW}px;
      height: ${state.cardH}px;
      top: ${-state.cardH / 2}px;
      left: ${-state.cardW / 2}px;
      transform: rotateY(${angleStep * i}deg) translateZ(${state.orbit}px);
    `;

    const imgEl = document.createElement('img');
    imgEl.src = img.src;
    imgEl.alt = img.label || '';
    imgEl.loading = 'lazy';
    imgEl.draggable = false;

    const label = document.createElement('div');
    label.className = 'card-label';
    label.textContent = img.label || `Image ${i + 1}`;

    const rmBtn = document.createElement('button');
    rmBtn.className = 'card-remove';
    rmBtn.innerHTML = '✕';
    rmBtn.title = 'Remove image';
    rmBtn.addEventListener('click', e => { e.stopPropagation(); removeImage(i); });

    card.append(imgEl, label, rmBtn);
    scene.appendChild(card);
  });
}

function refreshCardPositions() {
  const cards = scene.querySelectorAll('.card');
  const n = cards.length;
  if (!n) return;
  const angleStep = 360 / n;
  cards.forEach((card, i) => {
    card.style.width  = `${state.cardW}px`;
    card.style.height = `${state.cardH}px`;
    card.style.top    = `${-state.cardH / 2}px`;
    card.style.left   = `${-state.cardW / 2}px`;
    card.style.transform = `rotateY(${angleStep * i}deg) translateZ(${state.orbit}px)`;
  });
}

function removeImage(idx) {
  state.images.splice(idx, 1);
  buildGallery();
  toast('🗑 Image removed');
}

// ── Drag to rotate manually ──────────────────────────────
function applyManualRotation() {
  scene.style.animation = 'none';
  scene.style.transform = `rotateX(${state.manualRotX}deg) rotateY(${state.manualRotY}deg)`;
}
function restoreAutoRotation() {
  scene.style.animation = '';
  scene.style.transform = '';
}

scene.addEventListener('mousedown', e => {
  state.dragging = true;
  state.dragStartX = e.clientX;
  state.dragStartY = e.clientY;
  scene.style.animationPlayState = 'paused';
});
window.addEventListener('mousemove', e => {
  if (!state.dragging) return;
  const dx = e.clientX - state.dragStartX;
  const dy = e.clientY - state.dragStartY;
  state.dragStartX = e.clientX;
  state.dragStartY = e.clientY;
  state.manualRotY += dx * 0.4;
  state.manualRotX  = Math.max(-35, Math.min(35, state.manualRotX - dy * 0.25));
  applyManualRotation();
});
window.addEventListener('mouseup', () => {
  if (!state.dragging) return;
  state.dragging = false;
  if (!state.paused) restoreAutoRotation();
});

scene.addEventListener('touchstart', e => {
  const t = e.touches[0];
  state.dragging = true;
  state.dragStartX = t.clientX;
  state.dragStartY = t.clientY;
  scene.style.animationPlayState = 'paused';
}, { passive: true });
window.addEventListener('touchmove', e => {
  if (!state.dragging) return;
  const t = e.touches[0];
  const dx = t.clientX - state.dragStartX;
  const dy = t.clientY - state.dragStartY;
  state.dragStartX = t.clientX;
  state.dragStartY = t.clientY;
  state.manualRotY += dx * 0.4;
  state.manualRotX  = Math.max(-35, Math.min(35, state.manualRotX - dy * 0.25));
  applyManualRotation();
}, { passive: true });
window.addEventListener('touchend', () => {
  state.dragging = false;
  if (!state.paused) restoreAutoRotation();
});

// ── Pause / Resume ───────────────────────────────────────
pauseBtn.addEventListener('click', () => {
  state.paused = !state.paused;
  scene.classList.toggle('paused', state.paused);
  pauseBtn.textContent = state.paused ? '▶' : '⏸';
});

// ── Hamburger Panel ──────────────────────────────────────
function openPanel()  { hamPanel.classList.add('open');  hamBtn.classList.add('open');  hamPanel.setAttribute('aria-hidden','false'); }
function closePanel() { hamPanel.classList.remove('open'); hamBtn.classList.remove('open'); hamPanel.setAttribute('aria-hidden','true'); }
hamBtn.addEventListener('click', () => hamPanel.classList.contains('open') ? closePanel() : openPanel());
panelClose.addEventListener('click', closePanel);

// ── Theme ────────────────────────────────────────────────
document.querySelectorAll('.theme-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const t = chip.dataset.theme;
    document.documentElement.setAttribute('data-theme', t);
    state.currentTheme = t;
    document.querySelectorAll('.theme-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

// ── Effects toggles ──────────────────────────────────────
document.getElementById('rgbToggle').addEventListener('change', e => {
  state.rgbOn = e.target.checked;
  if (state.rgbOn) {
    rgbCanvas.classList.add('active');
    startRGB();
  } else {
    rgbCanvas.classList.remove('active');
    stopRGB();
  }
});

document.getElementById('ambientToggle').addEventListener('change', e => {
  state.ambientOn = e.target.checked;
  ambientOverlay.classList.toggle('active', state.ambientOn);
});

document.getElementById('starsToggle').addEventListener('change', e => {
  state.starsOn = e.target.checked;
  starsEl.style.opacity = state.starsOn ? '1' : '0';
});

document.getElementById('tiltToggle').addEventListener('change', e => {
  const angle = e.target.checked ? '10deg' : '0deg';
  document.querySelector('#scene').style.setProperty('--tilt', angle);
  // Update keyframe via CSS var approach — easiest: update the animation directly
  const newAnim = e.target.checked
    ? 'spinY var(--speed) linear infinite'
    : 'spinYFlat var(--speed) linear infinite';
  // Inject a flat variant if needed
  scene.style.animationName = e.target.checked ? 'spinY' : 'spinYFlat';
});

// Inject flat spin keyframe once
(function injectFlatSpin() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spinYFlat {
      from { transform: rotateX(0deg) rotateY(0deg); }
      to   { transform: rotateX(0deg) rotateY(360deg); }
    }
  `;
  document.head.appendChild(style);
})();

// ── Gallery Sliders ──────────────────────────────────────
document.getElementById('speedSlider').addEventListener('input', e => {
  state.speed = +e.target.value;
  document.documentElement.style.setProperty('--speed', `${state.speed}s`);
  document.getElementById('speedVal').textContent = `${state.speed}s`;
});

document.getElementById('radiusSlider').addEventListener('input', e => {
  state.orbit = +e.target.value;
  document.getElementById('radiusVal').textContent = `${state.orbit}px`;
  refreshCardPositions();
});

document.getElementById('sizeSlider').addEventListener('input', e => {
  state.cardW = +e.target.value;
  state.cardH = Math.round(state.cardW * 1.27);
  document.getElementById('sizeVal').textContent = `${state.cardW}px`;
  refreshCardPositions();
});

// ── Wallpaper ────────────────────────────────────────────
function setWallpaper(url) {
  wallpaperBg.style.backgroundImage = url ? `url('${url}')` : '';
  document.querySelectorAll('.wp-thumb').forEach(t => {
    t.classList.toggle('active', t.dataset.wp === url);
  });
}

document.querySelectorAll('.wp-thumb').forEach(thumb => {
  thumb.addEventListener('click', () => setWallpaper(thumb.dataset.wp || ''));
});

document.getElementById('wpFile').addEventListener('change', function () {
  const f = this.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = ev => setWallpaper(ev.target.result);
  reader.readAsDataURL(f);
});

document.getElementById('wpUrlBtn').addEventListener('click', () => {
  const url = document.getElementById('wpUrl').value.trim();
  if (url) { setWallpaper(url); toast('Wallpaper applied!'); }
});

document.getElementById('wpOpacity').addEventListener('input', e => {
  state.wpOpacity = +e.target.value / 100;
  wallpaperBg.style.opacity = state.wpOpacity;
  document.getElementById('wpOpVal').textContent = `${e.target.value}%`;
});

// ── Music ────────────────────────────────────────────────
function loadAudio(url, name) {
  bgAudio.src = url;
  musicInfo.textContent = name;
  bgAudio.volume = document.getElementById('volSlider').value / 100;
  bgAudio.play().catch(() => {});
  musicPlayBtn.textContent = '⏸';
  toast(`🎵 Playing: ${name}`);
}

document.getElementById('musicFile').addEventListener('change', function () {
  const f = this.files[0];
  if (!f) return;
  loadAudio(URL.createObjectURL(f), f.name);
});

document.getElementById('musicUrlBtn').addEventListener('click', () => {
  const url = document.getElementById('musicUrl').value.trim();
  if (url) loadAudio(url, url.split('/').pop().substring(0, 40));
});

window.toggleMusic = function () {
  if (bgAudio.paused) {
    bgAudio.play().catch(() => {});
    musicPlayBtn.textContent = '⏸';
  } else {
    bgAudio.pause();
    musicPlayBtn.textContent = '▶';
  }
};

window.stopMusic = function () {
  bgAudio.pause();
  bgAudio.currentTime = 0;
  musicPlayBtn.textContent = '▶';
};

document.getElementById('volSlider').addEventListener('input', e => {
  bgAudio.volume = +e.target.value / 100;
});

// ── Feedback / Email ─────────────────────────────────────
document.getElementById('fbSendBtn').addEventListener('click', async () => {
  const name  = document.getElementById('fbName').value.trim();
  const email = document.getElementById('fbEmail').value.trim();
  const msg   = document.getElementById('fbMsg').value.trim();
  const status = document.getElementById('fbStatus');
  const btn    = document.getElementById('fbSendBtn');

  if (!name || !msg) {
    status.style.color = '#ff4466';
    status.textContent = '⚠ Name and message are required.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'SENDING…';
  status.textContent = '';

  try {
    const fd = new FormData();
    fd.append('name',     name);
    fd.append('email',    email || 'noreply@3dgallery.app');
    fd.append('message',  msg);
    fd.append('_subject', `[3D Gallery Feedback] from ${name}`);
    fd.append('_replyto', email || '');
    fd.append('_template','table');
    fd.append('_captcha', 'false');

    const res = await fetch('https://formsubmit.co/cocfan09876@gmail.com', {
      method: 'POST',
      body: fd,
      headers: { 'Accept': 'application/json' }
    });

    if (res.ok) {
      status.style.color = '#34d399';
      status.textContent = '✅ Feedback sent! Thank you.';
      document.getElementById('fbName').value  = '';
      document.getElementById('fbEmail').value = '';
      document.getElementById('fbMsg').value   = '';
      toast('📬 Feedback sent to uio0987!');
    } else {
      throw new Error('Server error');
    }
  } catch {
    status.style.color = '#ff4466';
    status.textContent = '❌ Send failed. Try again later.';
  }

  btn.disabled = false;
  btn.textContent = '✉️ SEND FEEDBACK';
});

// ── Modal ────────────────────────────────────────────────
function openModal()  { modalOverlay.classList.add('open');  }
function closeModal() {
  modalOverlay.classList.remove('open');
  state.pendingFiles = [];
  previewStrip.innerHTML = '';
  imgUrlInput.value   = '';
  imgLabelInput.value = '';
}

fabBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

// Tabs
tabLocal.addEventListener('click', () => {
  paneLocal.style.display = 'block';
  paneUrl.style.display   = 'none';
  tabLocal.classList.add('active');
  tabUrl.classList.remove('active');
});
tabUrl.addEventListener('click', () => {
  paneUrl.style.display   = 'block';
  paneLocal.style.display = 'none';
  tabUrl.classList.add('active');
  tabLocal.classList.remove('active');
});

// Drop zone
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

function handleFiles(files) {
  Array.from(files).forEach(f => {
    if (!f.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      state.pendingFiles.push({ src: ev.target.result, label: f.name.replace(/\.[^.]+$/, '') });
      const img = document.createElement('img');
      img.className = 'preview-thumb';
      img.src = ev.target.result;
      previewStrip.appendChild(img);
    };
    reader.readAsDataURL(f);
  });
}

// Add from URL
addUrlBtn.addEventListener('click', () => {
  const url   = imgUrlInput.value.trim();
  const label = imgLabelInput.value.trim() || url.split('/').pop().split('?')[0] || 'Image';
  if (!url) { toast('⚠ Enter an image URL'); return; }
  state.images.push({ src: url, label });
  buildGallery();
  closeModal();
  toast('🖼 Image added from URL!');
});

// Add pending files
modalAddBtn.addEventListener('click', () => {
  if (!state.pendingFiles.length) { toast('⚠ Select at least one image'); return; }
  state.pendingFiles.forEach(f => state.images.push(f));
  const count = state.pendingFiles.length;
  buildGallery();
  closeModal();
  toast(`✅ ${count} image${count > 1 ? 's' : ''} added!`);
});

// ── Toast ────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, ms = 2800) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// ── Keyboard shortcuts ───────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closePanel(); }
  if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    pauseBtn.click();
  }
});

// ── Resize: rebuild on window resize ────────────────────
window.addEventListener('resize', () => {
  if (state.rgbOn) {
    rgbCanvas.width  = window.innerWidth;
    rgbCanvas.height = window.innerHeight;
  }
});

// ── Sample images to start with ─────────────────────────
const SAMPLES = [
  { src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500', label: 'Mountains' },
  { src: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=500', label: 'Galaxy' },
  { src: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=500', label: 'Night Sky' },
  { src: 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=500', label: 'Deep Space' },
  { src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500', label: 'Alpine Peak' },
  { src: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=500', label: 'Landscape' },
  { src: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=500', label: 'City Lights' },
  { src: 'https://images.unsplash.com/photo-1540390769625-2fc3f8b1d50c?w=500', label: 'Aurora' },
];

state.images.push(...SAMPLES);
buildGallery();
