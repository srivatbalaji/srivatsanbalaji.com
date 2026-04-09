// ─── Phrase & links ──────────────────────────────────────────────────────────

const PHRASE = [
    { text: 'srivatsanbalaji.com', href: 'index.html'      },
    { text: 'about',               href: 'about.html'      },
    { text: 'projects',            href: 'projects.html'   },
    { text: 'experience',          href: 'experience.html' },
    { text: 'contact',             href: 'contact.html'    },
];

// ─── Icon config ─────────────────────────────────────────────────────────────

const ICONS = [
    { id: 'icon-spotify',  href: 'spotify.html',  img: 'images/cokebutton.png',  label: "What I'm listening to", external: false },
    { id: 'icon-mail',     href: 'contact.html',  img: 'images/mail.png',        label: 'Email me',              external: false },
    { id: 'icon-linkedin', href: 'https://www.linkedin.com/in/srivatsan-balaji3/', img: 'images/drillbutton.png', label: 'LinkedIn', external: true },
    { id: 'icon-github',   href: 'https://github.com/srivatbalaji',               img: 'images/tsbutton.png',    label: 'GitHub',   external: true },
];

const FLOAT_PARAMS = [
    { period: 7200,  phaseX: 0.00, phaseY: 1.10, ampX: 14, ampY: 11 },
    { period: 9100,  phaseX: 1.57, phaseY: 0.40, ampX: 10, ampY: 14 },
    { period: 8300,  phaseX: 3.14, phaseY: 2.00, ampX: 13, ampY:  9 },
    { period: 10500, phaseX: 0.80, phaseY: 3.30, ampX:  9, ampY: 12 },
];

// ─── Layout constants ─────────────────────────────────────────────────────────

// ┌── To adjust sizes, change these two numbers (and the matching CSS values): ─┐
const ICON_W     = 216;  // .nav-icon width in styles.css
const ICON_IMG_W = 192;  // .nav-icon img width/height in styles.css
// └─────────────────────────────────────────────────────────────────────────────┘

const REPS        = 80;    // phrase repetitions — enough to fill the page
const PAD_H       = 48;    // horizontal padding (left & right)
const PAD_V       = 44;    // vertical padding (top)
const LINE_SCALE  = 1.58;  // line height = fontSize × LINE_SCALE
const SPACE_SCALE = 0.55;  // fallback space width if measurement fails

// ─── Alpha-collision constants ────────────────────────────────────────────────

const ALPHA_THRESH = 20;                          // 0-255 — pixels below this are "transparent"
const EXCL_MARGIN  = 4;                           // px gap added around each opaque edge
const IMG_X_OFFSET = (ICON_W - ICON_IMG_W) / 2;  // image is centred horizontally inside container

// silhouettes[iconId] = Array(ICON_IMG_W) of {lo, hi} | null
// Each entry gives the leftmost/rightmost opaque pixel column (container-relative)
// at that display row.  Built once per image via buildSilhouette().
const silhouettes = {};

// ─── Runtime state ────────────────────────────────────────────────────────────

let fontSize   = 0;
let lineHeight = 0;
let spaceW     = 0;

const wordW     = {};  // word text → measured px width
const wordEls   = [];  // [{ el: <a>, lastTr: string }]
const iconState = {};  // id → drag/float state

let containerW = 0;
let containerH = 0;
let animStart  = null;
let prevLayout = null; // dirty-check signature

// ─── Font-size computation ────────────────────────────────────────────────────
// ┌── Change the three numbers below to adjust text size globally: ────────────┐
//   Math.min( MAX_PX, Math.max( MIN_PX, viewport_width × VW_FRACTION ) )
function computeFontSize() {
    return Math.round(Math.min(23, Math.max(10, window.innerWidth * 0.016)));
}
// └─────────────────────────────────────────────────────────────────────────────┘

// ─── Alpha silhouette builder ─────────────────────────────────────────────────
//
// Loads an image onto an offscreen canvas, reads its pixel data, and produces
// a display-scale silhouette: for each row 0..ICON_IMG_W-1 (the displayed
// image height), the leftmost and rightmost opaque pixel in container-relative
// x-coordinates.  Transparent rows are stored as null.
//
// Falls back silently if getImageData() is blocked (e.g. cross-origin).

function buildSilhouette(id, imgSrc) {
    const imgEl = new Image();

    imgEl.onload = () => {
        const natW = imgEl.naturalWidth;
        const natH = imgEl.naturalHeight;

        const canvas = document.createElement('canvas');
        canvas.width  = natW;
        canvas.height = natH;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(imgEl, 0, 0);

        let px;
        try {
            px = ctx.getImageData(0, 0, natW, natH).data;
        } catch (err) {
            // Security error (e.g. served from file:// with CORS issues).
            // The layout engine will fall back to the circle approximation.
            console.warn('[silhouette] getImageData blocked for', imgSrc, '—using circle fallback');
            return;
        }

        const rows = new Array(ICON_IMG_W);

        for (let dy = 0; dy < ICON_IMG_W; dy++) {
            // Map display row → nearest natural image row
            const ny  = Math.min(natH - 1, Math.round(dy * (natH - 1) / (ICON_IMG_W - 1)));
            const off = ny * natW;

            let lo = -1, hi = -1;
            for (let nx = 0; nx < natW; nx++) {
                if (px[(off + nx) * 4 + 3] > ALPHA_THRESH) {
                    if (lo < 0) lo = nx;
                    hi = nx;
                }
            }

            if (lo >= 0) {
                // Scale from natural pixels → display pixels, then add centering offset
                rows[dy] = {
                    lo: IMG_X_OFFSET + lo * ICON_IMG_W / natW,
                    hi: IMG_X_OFFSET + hi * ICON_IMG_W / natW,
                };
            } else {
                rows[dy] = null; // fully transparent row
            }
        }

        silhouettes[id] = rows;
        prevLayout = null; // re-layout now that we have real contour data
    };

    imgEl.src = imgSrc;
}

// ─── Silhouette block-on-line ─────────────────────────────────────────────────
//
// Returns the horizontal interval [lo, hi] (in layout coordinates) that
// the icon's opaque pixels occupy on the text line whose top is at lineY.
// Returns null if the icon doesn't overlap this line.

function silhouetteBlockOnLine(iconX, iconY, rows, lineY) {
    const imgTop = iconY;
    const imgBot = iconY + ICON_IMG_W;

    if (lineY + lineHeight <= imgTop || lineY >= imgBot) return null;

    const rowLo = Math.max(0,             Math.floor(lineY - imgTop));
    const rowHi = Math.min(ICON_IMG_W - 1, Math.ceil(lineY + lineHeight - imgTop));

    let lo = Infinity, hi = -Infinity;

    for (let r = rowLo; r <= rowHi; r++) {
        const row = rows[r];
        if (!row) continue;
        if (row.lo < lo) lo = row.lo;
        if (row.hi > hi) hi = row.hi;
    }

    if (lo === Infinity) return null;

    return {
        lo: iconX + lo - EXCL_MARGIN,
        hi: iconX + hi + EXCL_MARGIN,
    };
}

// ─── Circle fallback (used until silhouette is ready) ────────────────────────

function circleBlockOnLine(cx, cy, r, lineY) {
    const nearY = Math.max(lineY, Math.min(lineY + lineHeight, cy));
    const dy    = cy - nearY;
    if (dy * dy >= r * r) return null;
    const dx = Math.sqrt(r * r - dy * dy);
    return { lo: cx - dx, hi: cx + dx };
}

// ─── Word measurement ─────────────────────────────────────────────────────────

function measureWidths() {
    fontSize   = computeFontSize();
    lineHeight = fontSize * LINE_SCALE;

    const ruler = document.createElement('span');
    Object.assign(ruler.style, {
        position: 'absolute', top: '-9999px', left: '-9999px',
        visibility: 'hidden', whiteSpace: 'nowrap',
        fontFamily: "'Chateau Normal', Georgia, 'Times New Roman', serif",
        fontSize: `${fontSize}px`, lineHeight: '1',
    });
    document.body.appendChild(ruler);

    PHRASE.forEach(pw => {
        ruler.textContent = pw.text;
        wordW[pw.text] = ruler.getBoundingClientRect().width;
    });

    ruler.textContent = '\u2002';
    spaceW = ruler.getBoundingClientRect().width || fontSize * SPACE_SCALE;

    document.body.removeChild(ruler);
}

// ─── Build word DOM elements ──────────────────────────────────────────────────

function buildWordElements() {
    const bg = document.getElementById('pretext-bg');
    bg.innerHTML = '';
    wordEls.length = 0;

    bg.style.fontFamily = "'Chateau Normal', Georgia, 'Times New Roman', serif";
    bg.style.fontSize   = `${fontSize}px`;

    for (let r = 0; r < REPS; r++) {
        PHRASE.forEach(pw => {
            const a = document.createElement('a');
            a.className   = 'word-link';
            a.textContent = pw.text;
            a.href        = pw.href;
            a.style.transform = 'translate(-9999px,-9999px)';
            bg.appendChild(a);
            wordEls.push({ el: a, lastTr: '' });
        });
    }
}

// ─── Per-frame layout pass ────────────────────────────────────────────────────

function runLayout() {
    // Build zone list from current icon positions (pure state reads — no DOM)
    const zones = ICONS.map(cfg => {
        const s = iconState[cfg.id];
        if (!s) return null;
        return {
            id:   cfg.id,
            x:    s.curX,
            y:    s.curY,
            rows: silhouettes[cfg.id] ?? null,
            // circle fallback (used before silhouette loads)
            cx: s.curX + ICON_W / 2,
            cy: s.curY + ICON_IMG_W / 2,
            r:  ICON_IMG_W / 2 + EXCL_MARGIN,
        };
    }).filter(Boolean);

    // Dirty-check — skip if nothing moved by ≥1px
    const sig = zones.map(z => `${z.x | 0},${z.y | 0}`).join('|');
    if (sig === prevLayout) return;
    prevLayout = sig;

    let x = PAD_H;
    let y = PAD_V;

    for (let i = 0; i < wordEls.length; i++) {
        const entry = wordEls[i];
        const { el } = entry;
        const ww  = wordW[el.textContent] ?? 40;
        const gap = spaceW;

        if (y > containerH + lineHeight) {
            const offTr = 'translate(-9999px,-9999px)';
            if (entry.lastTr !== offTr) { entry.lastTr = offTr; el.style.transform = offTr; }
            continue;
        }

        let placed = false;
        let safety = 0;

        while (!placed && safety++ < 40) {
            // Wrap at right margin
            if (x + ww > containerW - PAD_H) {
                x = PAD_H;
                y += lineHeight;
                if (y > containerH + lineHeight) break;
                continue;
            }

            // Find the first zone that blocks [x, x+ww] on this line
            let blocker = null;
            for (const z of zones) {
                const blk = z.rows
                    ? silhouetteBlockOnLine(z.x, z.y, z.rows, y)
                    : circleBlockOnLine(z.cx, z.cy, z.r, y);
                if (!blk) continue;
                if (x < blk.hi && x + ww > blk.lo) {
                    if (!blocker || blk.hi > blocker.hi) blocker = blk;
                }
            }

            if (!blocker) {
                const tr = `translate(${x | 0}px,${y | 0}px)`;
                if (entry.lastTr !== tr) { entry.lastTr = tr; el.style.transform = tr; }
                x += ww + gap;
                placed = true;
            } else {
                x = blocker.hi + 2;
            }
        }

        if (!placed) {
            const offTr = 'translate(-9999px,-9999px)';
            if (entry.lastTr !== offTr) { entry.lastTr = offTr; el.style.transform = offTr; }
        }
    }
}

// ─── Icon initialisation ──────────────────────────────────────────────────────

function initIcons() {
    const layer = document.getElementById('icons-layer');
    containerW  = layer.offsetWidth;
    containerH  = layer.offsetHeight;

    const PAD    = 64;
    const placed = [];

    ICONS.forEach((cfg, i) => {
        const link = document.createElement('a');
        link.id        = cfg.id;
        link.className = 'nav-icon';
        link.href      = cfg.href;
        if (cfg.external) link.setAttribute('target', '_blank');

        const img     = document.createElement('img');
        img.src       = cfg.img;
        img.alt       = cfg.label;
        img.draggable = false;

        const lbl      = document.createElement('span');
        lbl.className  = 'icon-label';
        lbl.textContent = cfg.label;

        link.appendChild(img);
        link.appendChild(lbl);
        layer.appendChild(link);

        let x, y, tries = 0;
        do {
            x = PAD + Math.random() * (containerW - ICON_W - PAD * 2);
            y = PAD + Math.random() * (containerH - ICON_W - PAD * 2);
            tries++;
        } while (placed.some(p => Math.hypot(p.x - x, p.y - y) < ICON_W * 1.7) && tries < 80);

        placed.push({ x, y });
        link.style.left = `${x}px`;
        link.style.top  = `${y}px`;

        iconState[cfg.id] = {
            baseX: x, baseY: y, curX: x, curY: y,
            fp: FLOAT_PARAMS[i],
            dragging: false, hasMoved: false,
            dragStartX: 0, dragStartY: 0,
            elemStartX: x, elemStartY: y,
        };

        link.addEventListener('mousedown', e => onMouseDown(e, link, cfg.id));
        link.addEventListener('click', e => {
            if (iconState[cfg.id].hasMoved) e.preventDefault();
        });

        // Kick off alpha silhouette build for this icon
        buildSilhouette(cfg.id, cfg.img);
    });
}

// ─── Drag ────────────────────────────────────────────────────────────────────

function onMouseDown(e, link, id) {
    if (e.button !== 0) return;
    e.preventDefault();
    const s = iconState[id];
    s.dragging = true; s.hasMoved = false;
    s.dragStartX = e.clientX; s.dragStartY = e.clientY;
    s.elemStartX = s.curX;    s.elemStartY = s.curY;
    link.classList.add('is-dragging');

    function onMove(ev) {
        const dx = ev.clientX - s.dragStartX;
        const dy = ev.clientY - s.dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) s.hasMoved = true;
        if (!s.hasMoved) return;
        const nx = Math.max(0, Math.min(s.elemStartX + dx, containerW - ICON_W));
        const ny = Math.max(0, Math.min(s.elemStartY + dy, containerH - ICON_W));
        s.curX = nx; s.curY = ny; s.baseX = nx; s.baseY = ny;
        link.style.left = `${nx}px`; link.style.top = `${ny}px`;
        prevLayout = null;
    }
    function onUp() {
        s.dragging = false;
        link.classList.remove('is-dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

// ─── Animation loop ───────────────────────────────────────────────────────────

function animate(ts) {
    if (!animStart) animStart = ts;
    const t0 = ts - animStart;

    ICONS.forEach(cfg => {
        const s    = iconState[cfg.id];
        if (!s || s.dragging) return;
        const link = document.getElementById(cfg.id);
        if (!link) return;
        const { period, phaseX, phaseY, ampX, ampY } = s.fp;
        const t  = (t0 / period) * Math.PI * 2;
        const nx = s.baseX + Math.sin(t + phaseX) * ampX;
        const ny = s.baseY + Math.cos(t * 0.73 + phaseY) * ampY;
        if (nx !== s.curX || ny !== s.curY) {
            s.curX = nx; s.curY = ny;
            link.style.left = `${nx}px`; link.style.top = `${ny}px`;
            prevLayout = null;
        }
    });

    runLayout();
    requestAnimationFrame(animate);
}

// ─── Resize ───────────────────────────────────────────────────────────────────

let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const layer = document.getElementById('icons-layer');
        containerW = layer.offsetWidth;
        containerH = layer.offsetHeight;
        measureWidths();
        const bg = document.getElementById('pretext-bg');
        if (bg) bg.style.fontSize = `${fontSize}px`;
        prevLayout = null;
    }, 150);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('pretext-bg')) return;

    measureWidths();
    buildWordElements();
    initIcons(); // also triggers buildSilhouette() for each icon

    document.fonts.ready.then(() => {
        measureWidths();
        const bg = document.getElementById('pretext-bg');
        if (bg) bg.style.fontSize = `${fontSize}px`;
        prevLayout = null;
        requestAnimationFrame(ts => {
            animate(ts);
            requestAnimationFrame(() => {
                document.getElementById('pretext-bg')?.classList.add('ready');
            });
        });
    });
});
