// Sprite maps: pixel art defined as arrays of strings. Each character is a pixel; '.' (or ' ') is transparent.
// {
//   pal: { 'o': 'ink', 's': 'skin', 'h': '#6b3a24' },   // char -> palette key (see palette.js) or css color
//   rows: [ '..ooo..', '.ossso.', ... ],
//   ox: 0, oy: 0   // optional anchor offset (drawn at x-ox, y-oy)
// }
// All rows must have the same length. Sprites are rasterized once and cached (also the horizontally flipped version).
(function (PSA) {
  const G = PSA.gfx;
  const S = {};
  const cache = new WeakMap();

  S.validate = function (def, name) {
    if (!def || !Array.isArray(def.rows) || !def.rows.length) throw new Error('sprite ' + (name || '') + ': rows missing');
    const w = def.rows[0].length;
    def.rows.forEach((r, i) => {
      if (r.length !== w) throw new Error('sprite ' + (name || '') + ': row ' + i + ' has length ' + r.length + ', expected ' + w + ' -> ' + JSON.stringify(r));
      for (const ch of r) {
        if (ch === '.' || ch === ' ') continue;
        if (!def.pal || !(ch in def.pal)) throw new Error('sprite ' + (name || '') + ': row ' + i + ' uses unknown palette char ' + JSON.stringify(ch));
      }
    });
    return true;
  };

  function rasterize(def) {
    const h = def.rows.length, w = def.rows[0].length;
    const c = G.makeCanvas(w, h);
    const ctx = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = def.rows[y];
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = def.pal[ch];
        if (col == null) throw new Error('sprite: unknown palette char ' + JSON.stringify(ch) + ' at row ' + y);
        ctx.fillStyle = G.col(col);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }
  function flipCanvas(src) {
    const c = G.makeCanvas(src.width, src.height);
    const ctx = c.getContext('2d');
    ctx.translate(src.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    return c;
  }

  S.get = function (def) {
    let e = cache.get(def);
    if (!e) { e = { canvas: rasterize(def), flipped: null }; cache.set(def, e); }
    return e;
  };
  S.width = (def) => def.rows[0].length;
  S.height = (def) => def.rows.length;

  // Draw a sprite with its top-left at (x,y) (minus optional anchor ox/oy). opts: {flip, alpha}
  S.draw = function (ctx, def, x, y, opts) {
    opts = opts || {};
    const e = S.get(def);
    let img = e.canvas;
    if (opts.flip) { if (!e.flipped) e.flipped = flipCanvas(e.canvas); img = e.flipped; }
    const ox = def.ox || 0, oy = def.oy || 0;
    x = (x - ox) | 0; y = (y - oy) | 0;
    if (opts.alpha != null && opts.alpha < 1) {
      const a = ctx.globalAlpha; ctx.globalAlpha = a * opts.alpha;
      ctx.drawImage(img, x, y); ctx.globalAlpha = a;
    } else ctx.drawImage(img, x, y);
  };

  // Draw with bottom-center anchor (handy for characters standing on a floor line)
  S.drawFeet = function (ctx, def, cx, feetY, opts) {
    const w = S.width(def), h = S.height(def);
    S.draw(ctx, def, cx - (w >> 1), feetY - h, opts);
  };

  // Helper to build a sprite def from rows + pal quickly
  S.make = function (rows, pal, extra) {
    const def = Object.assign({ rows: rows, pal: pal }, extra || {});
    S.validate(def);
    return def;
  };

  // Recolor: new def with some palette chars remapped (e.g. a darker variant)
  S.recolor = function (def, mapping) {
    const pal = Object.assign({}, def.pal);
    for (const k in mapping) pal[k] = mapping[k];
    return Object.assign({}, def, { pal: pal });
  };

  PSA.sprite = S;
})(window.PSA);
