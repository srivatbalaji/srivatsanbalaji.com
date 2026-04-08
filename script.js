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

const ICON_W        = 216;   // CSS width of .nav-icon  (must match styles.css)
const ICON_IMG_W    = 192;   // actual image size
const ICON_R        = ICON_IMG_W / 2 + 6;   // exclusion radius (image radius + tight margin)

const REPS          = 80;    // phrase repetitions — enough to fill the page
const PAD_H         = 48;    // horizontal padding (left & right)
const PAD_V         = 44;    // vertical padding (top)
const LINE_SCALE    = 1.58;  // line height = fontSize × LINE_SCALE
const SPACE_SCALE   = 0.55;  // space width ≈ fontSize × SPACE_SCALE (fallback if measure fails)

// ─── Runtime state ────────────────────────────────────────────────────────────

let fontSize   = 0;
let lineHeight = 0;
let spaceW     = 0;

const wordW    = {};   // word text → measured px width
const wordEls  = [];   // [{ el: <a> }] — all word DOM elements
const iconState = {};  // id → drag/float state

let containerW = 0;
let containerH = 0;

let animStart  = null;

// ─── Font-size computation ────────────────────────────────────────────────────
//
// Target ≈ 1/3 of the original 7.5vw = 2.5vw, clamped for readability.

function computeFontSize() {
    return Math.round(Math.min(23, Math.max(10, window.innerWidth * 0.016)));
}

// ─── Measure word widths using a hidden ruler span ────────────────────────────

function measureWidths() {
    fontSize   = computeFontSize();
    lineHeight = fontSize * LINE_SCALE;

    const ruler = document.createElement('span');
    Object.assign(ruler.style, {
        position:   'absolute',
        top:        '-9999px',
        left:       '-9999px',
        visibility: 'hidden',
        whiteSpace: 'nowrap',
        fontFamily: "'Chateau Normal', Georgia, 'Times New Roman', serif",
        fontSize:   `${fontSize}px`,
        lineHeight: '1',
    });
    document.body.appendChild(ruler);

    PHRASE.forEach(pw => {
        ruler.textContent = pw.text;
        wordW[pw.text] = ruler.getBoundingClientRect().width;
    });

    ruler.textContent = '\u2002'; // en-space — used as inter-word gap
    spaceW = ruler.getBoundingClientRect().width || fontSize * SPACE_SCALE;

    document.body.removeChild(ruler);
}

// ─── Build word DOM elements ──────────────────────────────────────────────────

function buildWordElements() {
    const bg = document.getElementById('pretext-bg');
    bg.innerHTML = '';
    wordEls.length = 0;

    // Apply font settings to the container so the ruler measurement is consistent
    bg.style.fontFamily = "'Chateau Normal', Georgia, 'Times New Roman', serif";
    bg.style.fontSize   = `${fontSize}px`;

    for (let r = 0; r < REPS; r++) {
        PHRASE.forEach(pw => {
            const a  = document.createElement('a');
            a.className   = 'word-link';
            a.textContent = pw.text;
            a.href        = pw.href;
            // Start all words off-screen; layout will position them
            a.style.transform = 'translate(-9999px,-9999px)';
            bg.appendChild(a);
            wordEls.push({ el: a });
        });
    }
}

// ─── Circular exclusion helper ────────────────────────────────────────────────
//
// For a circle at (cx, cy) with radius r, returns the horizontal blocked
// interval [left, right] for a text line whose top edge is at lineY.
// Returns null if the circle does not overlap this line at all.

function circleBlockOnLine(cx, cy, r, lineY) {
    const lineTop = lineY;
    const lineBot = lineY + lineHeight;

    // Nearest y on the line to the circle centre
    const nearY = Math.max(lineTop, Math.min(lineBot, cy));
    const dy    = cy - nearY;

    if (dy * dy >= r * r) return null; // circle misses this line

    const dx = Math.sqrt(r * r - dy * dy);
    return { lo: cx - dx, hi: cx + dx };
}

// ─── Per-frame layout pass ────────────────────────────────────────────────────
//
// Runs every animation frame. Reads icon positions from iconState (no DOM
// reads inside this function), then repositions every word-link element by
// writing CSS transforms in a batch.
//
// Algorithm:
//   cursor (x, y) advances left→right, top→bottom.
//   On each line, collect blocked intervals from all icon circles.
//   When the word would land inside a blocked interval, jump the cursor to
//   the right edge of that block. If the cursor would fall off the right
//   margin, advance to the next line from PAD_H.

let prevLayout = null; // cheap dirty-check: skip if nothing moved

function runLayout() {
    // --- collect icon exclusion zones (pure state reads, no DOM) ---
    const zones = ICONS.map(cfg => {
        const s = iconState[cfg.id];
        if (!s) return null;
        return {
            cx: s.curX + ICON_W / 2,
            cy: s.curY + ICON_W / 2,   // square container, so same for Y
            r:  ICON_R,
        };
    }).filter(Boolean);

    // Dirty-check: build a compact signature of all zone positions.
    // Layout is identical if icons haven't moved.
    const sig = zones.map(z => `${z.cx.toFixed(1)},${z.cy.toFixed(1)}`).join('|');
    if (sig === prevLayout) return;
    prevLayout = sig;

    // --- layout pass ---
    let x    = PAD_H;
    let y    = PAD_V;
    const W  = containerW;
    const H  = containerH;
    const rh = PAD_H; // right-hand padding

    for (let i = 0; i < wordEls.length; i++) {
        const { el } = wordEls[i];
        const ww   = wordW[el.textContent] ?? 40;
        const gap  = spaceW;

        // Stop generating layout once we're past the visible area
        if (y > H + lineHeight) {
            el.style.transform = 'translate(-9999px,-9999px)';
            continue;
        }

        let placed  = false;
        let safety  = 0;

        while (!placed && safety++ < 40) {
            // --- wrap at right margin ---
            if (x + ww > W - rh) {
                x = PAD_H;
                y += lineHeight;
                if (y > H + lineHeight) break;
                continue;
            }

            // --- check blocked intervals on current line ---
            let blocker = null;
            for (const z of zones) {
                const blk = circleBlockOnLine(z.cx, z.cy, z.r, y);
                if (!blk) continue;
                // Does the word [x, x+ww] overlap the block [blk.lo, blk.hi]?
                if (x < blk.hi && x + ww > blk.lo) {
                    // Pick the furthest blocker right edge to jump past
                    if (!blocker || blk.hi > blocker.hi) blocker = blk;
                }
            }

            if (!blocker) {
                // Word fits here — write transform and advance cursor
                el.style.transform = `translate(${x | 0}px,${y | 0}px)`;
                x += ww + gap;
                placed = true;
            } else {
                // Jump cursor to right edge of the blocking circle on this line
                x = blocker.hi + 2;
            }
        }

        if (!placed) {
            el.style.transform = 'translate(-9999px,-9999px)';
        }
    }
}

// ─── Icon initialisation ──────────────────────────────────────────────────────

function initIcons() {
    const layer = document.getElementById('icons-layer');
    containerW  = layer.offsetWidth;
    containerH  = layer.offsetHeight;

    const PAD   = 64;
    const placed = [];

    ICONS.forEach((cfg, i) => {
        const link = document.createElement('a');
        link.id        = cfg.id;
        link.className = 'nav-icon';
        link.href      = cfg.href;
        if (cfg.external) link.setAttribute('target', '_blank');

        const img      = document.createElement('img');
        img.src        = cfg.img;
        img.alt        = cfg.label;
        img.draggable  = false;

        const lbl      = document.createElement('span');
        lbl.className  = 'icon-label';
        lbl.textContent = cfg.label;

        link.appendChild(img);
        link.appendChild(lbl);
        layer.appendChild(link);

        // Random non-overlapping start position
        let x, y, tries = 0;
        const minD = ICON_W * 1.7;
        do {
            x = PAD + Math.random() * (containerW - ICON_W - PAD * 2);
            y = PAD + Math.random() * (containerH - ICON_W - PAD * 2);
            tries++;
        } while (placed.some(p => Math.hypot(p.x - x, p.y - y) < minD) && tries < 80);

        placed.push({ x, y });
        link.style.left = `${x}px`;
        link.style.top  = `${y}px`;

        iconState[cfg.id] = {
            baseX: x, baseY: y,
            curX:  x, curY:  y,
            fp:    FLOAT_PARAMS[i],
            dragging: false, hasMoved: false,
            dragStartX: 0, dragStartY: 0,
            elemStartX: x, elemStartY: y,
        };

        link.addEventListener('mousedown', e => onMouseDown(e, link, cfg.id));
        link.addEventListener('click', e => {
            if (iconState[cfg.id].hasMoved) e.preventDefault();
        });
    });
}

// ─── Drag ────────────────────────────────────────────────────────────────────

function onMouseDown(e, link, id) {
    if (e.button !== 0) return;
    e.preventDefault();
    const s = iconState[id];
    s.dragging   = true;
    s.hasMoved   = false;
    s.dragStartX = e.clientX;
    s.dragStartY = e.clientY;
    s.elemStartX = s.curX;
    s.elemStartY = s.curY;
    link.classList.add('is-dragging');

    function onMove(ev) {
        const dx = ev.clientX - s.dragStartX;
        const dy = ev.clientY - s.dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) s.hasMoved = true;
        if (!s.hasMoved) return;
        const nx = Math.max(0, Math.min(s.elemStartX + dx, containerW - ICON_W));
        const ny = Math.max(0, Math.min(s.elemStartY + dy, containerH - ICON_W));
        s.curX = nx; s.curY = ny;
        s.baseX = nx; s.baseY = ny;
        link.style.left = `${nx}px`;
        link.style.top  = `${ny}px`;
        prevLayout = null; // force layout recalculation
    }

    function onUp() {
        s.dragging = false;
        link.classList.remove('is-dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',  onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
}

// ─── Animation loop ───────────────────────────────────────────────────────────

function animate(ts) {
    if (!animStart) animStart = ts;
    const t0 = ts - animStart;

    // Float icons (unless being dragged)
    ICONS.forEach(cfg => {
        const s    = iconState[cfg.id];
        if (!s || s.dragging) return;
        const link = document.getElementById(cfg.id);
        if (!link) return;
        const { period, phaseX, phaseY, ampX, ampY } = s.fp;
        const t = (t0 / period) * Math.PI * 2;
        const nx = s.baseX + Math.sin(t + phaseX) * ampX;
        const ny = s.baseY + Math.cos(t * 0.73 + phaseY) * ampY;
        if (nx !== s.curX || ny !== s.curY) {
            s.curX = nx; s.curY = ny;
            link.style.left = `${nx}px`;
            link.style.top  = `${ny}px`;
            prevLayout = null; // icon moved → re-layout
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
        // Re-apply font size on container
        const bg = document.getElementById('pretext-bg');
        if (bg) bg.style.fontSize = `${fontSize}px`;
        prevLayout = null;
    }, 150);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('pretext-bg')) return; // not homepage

    // Build DOM before font measurement so the ruler is accurate
    measureWidths();
    buildWordElements();
    initIcons();

    // Wait for Chateau Normal to load, then re-measure and reveal
    document.fonts.ready.then(() => {
        measureWidths();
        const bg = document.getElementById('pretext-bg');
        if (bg) bg.style.fontSize = `${fontSize}px`;
        prevLayout = null;
        requestAnimationFrame(ts => {
            animate(ts);
            // Fade in after the first layout frame
            requestAnimationFrame(() => {
                document.getElementById('pretext-bg')?.classList.add('ready');
            });
        });
    });
});
