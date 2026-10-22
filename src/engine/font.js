// Bitmap font renderer. Glyph data is provided by src/assets/font.js as PSA.FONT:
//   PSA.FONT = { h: 8, baseline: 7, space: 3, spacing: 1, glyphs: { 'A': ['.###.', '#...#', ...], ... } }
// Each glyph is an array of rows (strings of '#' and '.'), all rows same length, height == FONT.h.
(function (PSA) {
  const G = PSA.gfx;
  const F = {};
  const cache = new Map(); // key: glyphChar + color + scale -> canvas

  function font() {
    if (!PSA.FONT) throw new Error('PSA.FONT is not loaded (src/assets/font.js)');
    return PSA.FONT;
  }
  function glyphRows(ch) {
    const f = font();
    let g = f.glyphs[ch];
    if (!g && f.glyphs[ch.toUpperCase()]) g = f.glyphs[ch.toUpperCase()];
    if (!g) g = f.glyphs['?'] || ['#'];
    return g;
  }
  function glyphCanvas(ch, color, scale) {
    const key = ch + '|' + color + '|' + scale;
    let c = cache.get(key);
    if (c) return c;
    const rows = glyphRows(ch);
    const w = rows[0].length, h = rows.length;
    c = G.makeCanvas(Math.max(1, w * scale), Math.max(1, h * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = G.col(color);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rows[y][x] === '#') ctx.fillRect(x * scale, y * scale, scale, scale);
    cache.set(key, c);
    return c;
  }

  F.glyphWidth = function (ch, scale) {
    scale = scale || 1;
    if (ch === ' ') return font().space * scale;
    return glyphRows(ch)[0].length * scale;
  };
  F.lineHeight = function (scale) { return (font().h + (font().leading || 2)) * (scale || 1); };
  F.measure = function (text, scale) {
    scale = scale || 1;
    let w = 0;
    for (let i = 0; i < text.length; i++) {
      w += F.glyphWidth(text[i], scale);
      if (i < text.length - 1) w += font().spacing * scale;
    }
    return w;
  };

  // Draw a single line. opts: {color, scale, align:'left'|'center'|'right', shadow:'#color', alpha}
  // Returns the x after the last glyph.
  F.text = function (ctx, text, x, y, opts) {
    opts = opts || {};
    const scale = opts.scale || 1, color = opts.color || 'uiText';
    const f = font();
    if (opts.align === 'center') x = Math.round(x - F.measure(text, scale) / 2);
    else if (opts.align === 'right') x = Math.round(x - F.measure(text, scale));
    x |= 0; y |= 0;
    const prevAlpha = ctx.globalAlpha;
    if (opts.alpha != null) ctx.globalAlpha = prevAlpha * opts.alpha;
    let cx = x;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch !== ' ') {
        if (opts.shadow) ctx.drawImage(glyphCanvas(ch, opts.shadow, scale), cx + scale, y + scale);
        ctx.drawImage(glyphCanvas(ch, color, scale), cx, y);
      }
      cx += F.glyphWidth(ch, scale) + f.spacing * scale;
    }
    ctx.globalAlpha = prevAlpha;
    return cx;
  };

  // Word-wrap text to maxWidth (in native px). Returns array of lines. Honors explicit '\n'.
  F.wrap = function (text, maxWidth, scale) {
    scale = scale || 1;
    const out = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const cand = line ? line + ' ' + w : w;
        if (F.measure(cand, scale) <= maxWidth || !line) line = cand;
        else { out.push(line); line = w; }
      }
      out.push(line);
    }
    return out;
  };

  // Draw wrapped text; opts as F.text plus {maxWidth, lineHeight, chars (typewriter limit)}.
  // Returns {lines, drawn}.
  F.block = function (ctx, text, x, y, opts) {
    opts = opts || {};
    const scale = opts.scale || 1;
    const lines = opts.maxWidth ? F.wrap(text, opts.maxWidth, scale) : String(text).split('\n');
    const lh = opts.lineHeight || F.lineHeight(scale);
    let remaining = opts.chars == null ? Infinity : opts.chars;
    let drawn = 0;
    for (let i = 0; i < lines.length; i++) {
      if (remaining <= 0) break;
      const ln = lines[i];
      const part = remaining >= ln.length ? ln : ln.slice(0, remaining);
      F.text(ctx, part, x, y + i * lh, opts);
      drawn += part.length;
      remaining -= ln.length + 1; // +1 for the line break
    }
    return { lines: lines, drawn: drawn };
  };

  PSA.font = F;
})(window.PSA);
