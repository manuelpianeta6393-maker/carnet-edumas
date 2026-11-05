window.FondoBlanco = (function () {
  let seg = null, cola = Promise.resolve();
  const BASE = "/assets/fondo/";
  function cargar() {
    if (window.SelfieSegmentation) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = BASE + "selfie_segmentation.js";
      s.onload = res;
      s.onerror = () => rej(new Error("No se pudo cargar el recorte de fondo"));
      document.head.appendChild(s);
    });
  }
  async function iniciar() {
    if (seg) return seg;
    await cargar();
    seg = new SelfieSegmentation({ locateFile: f => BASE + f });
    seg.setOptions({ modelSelection: 0, selfieMode: false });
    await seg.initialize();
    return seg;
  }
  function mascara(img) {
    return new Promise(async (res, rej) => {
      const s = await iniciar();
      s.onResults(r => res(r.segmentationMask));
      try { await s.send({ image: img }); } catch (e) { rej(e); }
    });
  }
  function limpiar(a, w, h) {
    const n = w * h, lab = new Int32Array(n), q = new Int32Array(n);
    let best = -1, bestSize = 0, id = 0;
    for (let i = 0; i < n; i++) {
      if (lab[i] || a[i] < 128) continue;
      id++;
      let qh = 0, qt = 0, size = 0;
      q[qt++] = i; lab[i] = id;
      while (qh < qt) {
        const p = q[qh++]; size++;
        const x = p % w, y = (p / w) | 0;
        if (x > 0 && !lab[p - 1] && a[p - 1] >= 128) { lab[p - 1] = id; q[qt++] = p - 1; }
        if (x < w - 1 && !lab[p + 1] && a[p + 1] >= 128) { lab[p + 1] = id; q[qt++] = p + 1; }
        if (y > 0 && !lab[p - w] && a[p - w] >= 128) { lab[p - w] = id; q[qt++] = p - w; }
        if (y < h - 1 && !lab[p + w] && a[p + w] >= 128) { lab[p + w] = id; q[qt++] = p + w; }
      }
      if (size > bestSize) { bestSize = size; best = id; }
    }
    const keep = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (lab[i] === best) keep[i] = 1;
    const r = 2, d = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!keep[y * w + x]) continue;
      for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) d[yy * w + xx] = 1;
    }
    for (let i = 0; i < n; i++) if (!d[i]) a[i] = 0;
    return bestSize / n;
  }
  function px(c, w, h) {
    const k = document.createElement("canvas");
    k.width = w; k.height = h;
    const x = k.getContext("2d", { willReadFrequently: true });
    x.drawImage(c, 0, 0, w, h);
    return x.getImageData(0, 0, w, h).data;
  }
  function fondo(img, m, w, h) {
    let s = new Float32Array(w * h * 3), wt = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const q = m[i] < 0.08 ? 1 : 0;
      wt[i] = q;
      s[i * 3] = img[i * 4] * q; s[i * 3 + 1] = img[i * 4 + 1] * q; s[i * 3 + 2] = img[i * 4 + 2] * q;
    }
    for (let it = 0; it < 24; it++) {
      const s2 = new Float32Array(s.length), w2 = new Float32Array(wt.length);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let a = 0, b = 0, c = 0, d = 0;
        for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) {
          const j = yy * w + xx;
          a += s[j * 3]; b += s[j * 3 + 1]; c += s[j * 3 + 2]; d += wt[j];
        }
        const i = y * w + x;
        if (m[i] < 0.08) { s2[i * 3] = s[i * 3]; s2[i * 3 + 1] = s[i * 3 + 1]; s2[i * 3 + 2] = s[i * 3 + 2]; w2[i] = wt[i]; }
        else { s2[i * 3] = a / 9; s2[i * 3 + 1] = b / 9; s2[i * 3 + 2] = c / 9; w2[i] = d / 9; }
      }
      s = s2; wt = w2;
    }
    const out = new Float32Array(w * h * 3), has = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (wt[i] > 1e-4) { has[i] = 1; out[i * 3] = s[i * 3] / wt[i]; out[i * 3 + 1] = s[i * 3 + 1] / wt[i]; out[i * 3 + 2] = s[i * 3 + 2] / wt[i]; }
    return { c: out, has };
  }
  async function aplicar(canvas) {
    const w = canvas.width, h = canvas.height;
    const m = await mascara(canvas);
    const sw = 256, sh = Math.round(h * sw / w);
    const mp = px(m, sw, sh), a = new Uint8ClampedArray(sw * sh);
    for (let i = 0; i < a.length; i++) {
      const t = Math.min(1, Math.max(0, (mp[i * 4] / 255 - 0.2) / 0.6));
      a[i] = Math.round(t * t * (3 - 2 * t) * 255);
    }
    const area = limpiar(a, sw, sh);
    if (area < 0.08) throw new Error("No se encontró una persona en la foto");
    const lw = 96, lh = Math.round(h * lw / w);
    const ml = new Float32Array(lw * lh);
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      let mx = 0;
      const x0 = Math.floor(x * sw / lw), x1 = Math.ceil((x + 1) * sw / lw), y0 = Math.floor(y * sh / lh), y1 = Math.ceil((y + 1) * sh / lh);
      for (let yy = y0; yy < Math.min(sh, y1 + 1); yy++) for (let xx = x0; xx < Math.min(sw, x1 + 1); xx++) mx = Math.max(mx, a[yy * sw + xx] / 255);
      ml[y * lw + x] = mx;
    }
    const bg = fondo(px(canvas, lw, lh), ml, lw, lh);
    const mc = document.createElement("canvas");
    mc.width = sw; mc.height = sh;
    const mx = mc.getContext("2d");
    const id = mx.createImageData(sw, sh);
    for (let i = 0; i < a.length; i++) { id.data[i * 4 + 3] = a[i]; }
    mx.putImageData(id, 0, 0);
    const A = px(mc, w, h), I = px(canvas, w, h);
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const ox = out.getContext("2d");
    const od = ox.createImageData(w, h), o = od.data;
    for (let y = 0; y < h; y++) {
      const fy = Math.min(lh - 1, (y + 0.5) * lh / h - 0.5), y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(lh - 1, y0 + 1), ty = Math.max(0, fy - y0);
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let al = A[i * 4 + 3] / 255;
        if (al > 0.02 && al < 0.98) {
          const fx = Math.min(lw - 1, (x + 0.5) * lw / w - 0.5), x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(lw - 1, x0 + 1), tx = Math.max(0, fx - x0);
          let r = 0, g = 0, b = 0, ww = 0;
          const pts = [[x0, y0, (1 - tx) * (1 - ty)], [x1, y0, tx * (1 - ty)], [x0, y1, (1 - tx) * ty], [x1, y1, tx * ty]];
          for (const p of pts) { const j = p[1] * lw + p[0]; if (bg.has[j]) { r += bg.c[j * 3] * p[2]; g += bg.c[j * 3 + 1] * p[2]; b += bg.c[j * 3 + 2] * p[2]; ww += p[2]; } }
          if (ww > 0) {
            r /= ww; g /= ww; b /= ww;
            const d = Math.hypot(I[i * 4] - r, I[i * 4 + 1] - g, I[i * 4 + 2] - b);
            const ac = Math.min(1, Math.max(0, (d - 12) / 45));
            al = Math.min(al + 0.35, Math.max(al - 0.35, ac));
          }
        }
        const k = 1 - al;
        o[i * 4] = I[i * 4] * al + 255 * k;
        o[i * 4 + 1] = I[i * 4 + 1] * al + 255 * k;
        o[i * 4 + 2] = I[i * 4 + 2] * al + 255 * k;
        o[i * 4 + 3] = 255;
      }
    }
    ox.putImageData(od, 0, 0);
    return out;
  }
  function run(canvas) {
    const p = cola.then(() => aplicar(canvas));
    cola = p.catch(() => {});
    return p;
  }
  return { aplicar: run, precargar: () => iniciar().catch(() => {}) };
})();
