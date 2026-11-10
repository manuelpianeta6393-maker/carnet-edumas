(function () {
  const W = 1080, H = 1500;
  const FM = 'Montserrat,"Arial Black",Arial,sans-serif';
  const FA = 'Unbounded,Montserrat,Arial,sans-serif';
  const K = { navy: "#04214D", royal: "#0C3472", green: "#2E9B44", blue: "#004AAD", name: "#09022E", ink: "#0B0B0F", soft: "#E6EFF7", note: "#3A4763" };
  const CFG0 = {
    nombre: "EDUMAS",
    subtitulo: "#ReconciliémonosConElAmbiente",
    nit: "900128208-0",
    telefono: "(+57) 3186072719",
    direccion: "Cra. 23A # 80-05",
    ciudad: "Los Almendros - Soledad, Atlántico",
    legal: ""
  };
  const AREAS = [
    "Gerencia",
    "Secretaría Ejecutiva",
    "Oficina Jurídica",
    "Oficina Administrativa y Financiera",
    "Oficina de Control Interno",
    "Comunicaciones",
    "Subgerencia Ambiental",
    "Subgerencia de Desarrollo Urbano",
    "Control Urbano"
  ];
  const TPL = {};
  let ready = null;

  function loadImg(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
  }

  function ensure() {
    if (!ready) {
      const list = ["800 56px Montserrat", "600 54px Montserrat", "400 34px Montserrat", "400 40px Unbounded", "700 40px Unbounded"];
      const f = document.fonts && document.fonts.load
        ? Promise.all(list.map(s => document.fonts.load(s).catch(() => null)))
        : Promise.resolve();
      ready = Promise.all([
        Promise.race([f, new Promise(r => setTimeout(r, 4000))]),
        loadImg("/assets/tpl-front.jpg").then(i => { TPL.front = i; }).catch(() => {}),
        loadImg("/assets/tpl-back.jpg").then(i => { TPL.back = i; }).catch(() => {}),
        loadImg("/assets/tpl-planta-front.jpg").then(i => { TPL.plantaFront = i; }).catch(() => {}),
        loadImg("/assets/tpl-planta-back.jpg").then(i => { TPL.plantaBack = i; }).catch(() => {})
      ]);
    }
    return ready;
  }

  function todayISO(ms) {
    const d = new Date(ms || Date.now());
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function fmtDate(s) {
    if (!s) return "";
    const p = String(s).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : s;
  }

  function fmtDoc(n) {
    const t = String(n || "").trim();
    return /^\d{5,}$/.test(t) ? t.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : t;
  }

  function fullName(p) { return ((p.nombres || "") + " " + (p.apellidos || "")).trim(); }

  function shortName(n, a) {
    const fn = String(n || "").trim().split(/\s+/)[0] || "";
    const ws = String(a || "").trim().split(/\s+/).filter(Boolean);
    const out = [];
    for (const w of ws) {
      out.push(w);
      if (!/^(de|del|la|las|los|da|di|do|dos|san|santa|van|von)$/i.test(w)) break;
    }
    return (fn + " " + out.join(" ")).trim();
  }

  function cardName(p) {
    if (p.nombreCarnet && String(p.nombreCarnet).trim()) return String(p.nombreCarnet).trim();
    return shortName(p.nombres, p.apellidos);
  }

  function initials(p) {
    const ws = (cardName(p) || fullName(p)).split(/\s+/).filter(Boolean);
    return ((ws[0] || "").charAt(0) + (ws.length > 1 ? ws[ws.length - 1].charAt(0) : "")).toUpperCase() || "?";
  }

  function tipoLabel(t) { return t === "planta" ? "Funcionario de planta" : t === "contratista" ? "Contratista" : "Practicante"; }

  function estado(p, ms) {
    if (p.activo === false) return { k: "off", t: "Inactivo", stamp: "INACTIVO" };
    if (!p.fechaFin) return { k: "ok", t: "Vigente", stamp: "" };
    const t = todayISO(ms);
    if (p.fechaFin < t) return { k: "bad", t: "Vencido", stamp: "VENCIDO" };
    const d = Math.round((new Date(p.fechaFin + "T00:00:00") - new Date(t + "T00:00:00")) / 864e5);
    if (d <= 30) return { k: "warn", t: d === 0 ? "Vence hoy" : "Vence en " + d + " d", stamp: "" };
    return { k: "ok", t: "Vigente", stamp: "" };
  }

  function rr(x, a, b, w, h, r) {
    x.beginPath();
    x.moveTo(a + r, b);
    x.arcTo(a + w, b, a + w, b + h, r);
    x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r);
    x.arcTo(a, b, a + w, b, r);
    x.closePath();
  }

  function mk(tpl) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d");
    x.textBaseline = "alphabetic";
    x.fillStyle = "#FFFFFF";
    x.fillRect(0, 0, W, H);
    if (tpl) x.drawImage(tpl, 0, 0, W, H);
    else { x.fillStyle = K.navy; x.fillRect(0, 0, W, 238); }
    return [c, x];
  }

  function trackW(x, t, sp) {
    let w = 0;
    for (const ch of t) w += x.measureText(ch).width + sp;
    return w - sp;
  }

  function trackText(x, t, cx, y, sp) {
    let a = cx - trackW(x, t, sp) / 2;
    x.textAlign = "left";
    for (const ch of t) {
      x.fillText(ch, a, y);
      a += x.measureText(ch).width + sp;
    }
  }

  function trackFit(x, t, maxW, wt, size, min, fam, k) {
    let z = size;
    for (;;) {
      x.font = wt + " " + z + "px " + fam;
      if (trackW(x, t, z * k) <= maxW || z <= min) return z;
      z -= 1;
    }
  }

  function segs(s) {
    const out = [];
    String(s).split("*").forEach((t, i) => { if (t) out.push({ t, b: i % 2 === 1 }); });
    return out;
  }

  function richW(x, parts, size) {
    let w = 0;
    parts.forEach(p => {
      x.font = (p.b ? "700 " : "400 ") + size + "px " + FA;
      w += x.measureText(p.t).width;
    });
    return w;
  }

  function richLine(x, s, cx, y, size, maxW) {
    const parts = segs(s);
    let z = size;
    while (z > 18 && richW(x, parts, z) > maxW) z -= 1;
    let a = cx - richW(x, parts, z) / 2;
    x.textAlign = "left";
    parts.forEach(p => {
      x.font = (p.b ? "700 " : "400 ") + z + "px " + FA;
      x.fillText(p.t, a, y);
      a += x.measureText(p.t).width;
    });
  }

  function richWrap(x, s, size, maxW, maxLines) {
    const words = [];
    segs(s).forEach(p => p.t.split(/\s+/).filter(Boolean).forEach(w => words.push(p.b ? "*" + w + "*" : w)));
    const lines = [];
    let cur = "";
    words.forEach(w => {
      const t = cur ? cur + " " + w : w;
      if (!cur || richW(x, segs(t), size) <= maxW) cur = t;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines.slice(0, maxLines);
  }

  function stamp(x, text) {
    if (!text) return;
    x.save();
    x.translate(W / 2, H / 2);
    x.rotate(-Math.PI / 5);
    x.font = "800 190px " + FM;
    x.textAlign = "center";
    x.lineWidth = 10;
    x.strokeStyle = "rgba(255,255,255,0.75)";
    x.strokeText(text, 0, 64);
    x.fillStyle = "rgba(190,30,24,0.72)";
    x.fillText(text, 0, 64);
    x.restore();
  }

  function drawQR(x, text, a, b, size) {
    if (!text || typeof qrcode !== "function") return false;
    try {
      if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
      const q = qrcode(0, "M");
      q.addData(text);
      q.make();
      const n = q.getModuleCount(), cell = size / n;
      x.fillStyle = "#000000";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (q.isDark(r, c)) x.fillRect(a + c * cell, b + r * cell, cell + 0.5, cell + 0.5);
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  async function front(p, cfg, o) {
    o = o || {};
    await ensure();
    const planta = p.tipo === "planta";
    const [c, x] = mk(planta ? TPL.plantaFront || TPL.front : TPL.front);
    const bx = 198, by = planta ? 252 : 238, bw = 684, bh = 734;
    x.save();
    rr(x, bx, by, bw, bh, 50);
    x.clip();
    let drawn = false;
    if (p.foto) {
      try {
        const im = await loadImg(p.foto);
        const s = Math.max(bw / im.naturalWidth, bh / im.naturalHeight);
        const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
        x.fillStyle = "#FFFFFF";
        x.fillRect(bx, by, bw, bh);
        x.drawImage(im, bx + (bw - dw) / 2, by + (bh - dh) * 0.2, dw, dh);
        drawn = true;
      } catch (e) {}
    }
    if (!drawn) {
      x.fillStyle = K.soft;
      x.fillRect(bx, by, bw, bh);
      x.fillStyle = K.royal;
      x.font = "800 230px " + FM;
      x.textAlign = "center";
      x.fillText(initials(p), W / 2, by + bh / 2 + 82);
    }
    x.restore();

    x.fillStyle = K.name;
    const nm = cardName(p).toUpperCase(), k = 0.14;
    let z = trackFit(x, nm, 960, 800, 56, 36, FM, k);
    if (trackW(x, nm, z * k) <= 960 || nm.indexOf(" ") < 0) {
      trackText(x, nm, W / 2, 1115, z * k);
    } else {
      const ws = nm.split(" ");
      let best = 1, bestW = 1e9;
      x.font = "800 48px " + FM;
      for (let i = 1; i < ws.length; i++) {
        const m = Math.max(trackW(x, ws.slice(0, i).join(" "), 5), trackW(x, ws.slice(i).join(" "), 5));
        if (m < bestW) { bestW = m; best = i; }
      }
      const l1 = ws.slice(0, best).join(" "), l2 = ws.slice(best).join(" ");
      z = Math.min(trackFit(x, l1, 960, 800, 48, 24, FM, k), trackFit(x, l2, 960, 800, 48, 24, FM, k));
      x.font = "800 " + z + "px " + FM;
      trackText(x, l1, W / 2, 1084, z * k);
      trackText(x, l2, W / 2, 1084 + z + 10, z * k);
    }

    x.fillStyle = planta ? K.green : K.navy;
    x.beginPath();
    x.moveTo(452, 1174);
    x.lineTo(W, 1174);
    x.lineTo(W, 1296);
    x.lineTo(452, 1296);
    x.arc(452, 1235, 61, Math.PI / 2, Math.PI * 1.5);
    x.closePath();
    x.fill();
    x.fillStyle = "#FFFFFF";
    if (planta) {
      const cargo = String(p.cargo || "").trim().toUpperCase();
      let cz = trackFit(x, cargo, 610, 600, 46, 30, FM, 0.05);
      if (trackW(x, cargo, cz * 0.05) <= 610 || cargo.indexOf(" ") < 0) {
        x.font = "400 34px " + FM;
        trackText(x, "FUNCIONARIO DE PLANTA", 728, 1214, 2);
        x.font = "600 " + cz + "px " + FM;
        trackText(x, cargo, 728, 1270, cz * 0.05);
      } else {
        const ws = cargo.split(" ");
        let best = 1, bestW = 1e9;
        x.font = "600 30px " + FM;
        for (let i = 1; i < ws.length; i++) {
          const m = Math.max(trackW(x, ws.slice(0, i).join(" "), 1.5), trackW(x, ws.slice(i).join(" "), 1.5));
          if (m < bestW) { bestW = m; best = i; }
        }
        const l1 = ws.slice(0, best).join(" "), l2 = ws.slice(best).join(" ");
        cz = Math.min(trackFit(x, l1, 610, 600, 30, 18, FM, 0.05), trackFit(x, l2, 610, 600, 30, 18, FM, 0.05));
        x.font = "400 28px " + FM;
        trackText(x, "FUNCIONARIO DE PLANTA", 728, 1206, 2);
        x.font = "600 " + cz + "px " + FM;
        trackText(x, l1, 728, 1244, cz * 0.05);
        trackText(x, l2, 728, 1244 + cz + 6, cz * 0.05);
      }
    } else {
      const tp = tipoLabel(p.tipo).toUpperCase();
      const tz = trackFit(x, tp, 560, 600, 54, 30, FM, 0.09);
      trackText(x, tp, 738, 1252, tz * 0.09);
    }

    drawQR(x, o.qr, 69, 1181, 280);

    x.textAlign = "left";
    x.fillStyle = K.ink;
    x.font = "700 36px " + FA;
    x.fillText("Identificación", 434, 1359);
    const dt = (p.tipoDoc && p.tipoDoc !== "C.C." ? p.tipoDoc + " " : "") + fmtDoc(p.numDoc);
    let dz = 40;
    x.font = "400 " + dz + "px " + FA;
    while (dz > 22 && x.measureText(dt).width > 620) {
      dz -= 1;
      x.font = "400 " + dz + "px " + FA;
    }
    x.fillText(dt, 426, 1402);
    if (p.rh) {
      x.font = "700 40px " + FA;
      x.fillText("RH", 434, 1455);
      const rw = x.measureText("RH").width;
      x.font = "400 40px " + FA;
      x.fillText(": " + p.rh, 434 + rw, 1455);
    }
    stamp(x, o.stamp);
    return c;
  }

  async function back(p, cfg, o) {
    o = o || {};
    await ensure();
    const planta = p.tipo === "planta";
    const [c, x] = mk(planta ? TPL.plantaBack || TPL.back : TPL.back);
    const L = planta ? { dx: 15, d1: 30, d2: 27, dk: 22, dc: 20, pill: K.blue } : { dx: 0, d1: 0, d2: 0, dk: 0, dc: 0, pill: K.royal };
    const ent = String(cfg.nombre || "").trim(), tipo = tipoLabel(p.tipo).toUpperCase();
    x.fillStyle = K.ink;
    const p1 = planta
      ? ["El presente carnet virtual acredita", "al portador como *FUNCIONARIO*", "*DE PLANTA* del *" + ent.toUpperCase() + ".*"]
      : ["El presente carnet virtual acredita", "al portador como *" + tipo + "*", "del *" + ent.toUpperCase() + ".*"];
    p1.forEach((l, i) => richLine(x, l, W / 2 + L.dx, 371 + L.d1 + i * 49.5, 39, 900));
    const ver = cfg.legal && String(cfg.legal).trim()
      ? richWrap(x, String(cfg.legal).trim(), 39, 760, 4)
      : ["Escanee el *código QR* para", "verificar la originalidad de este", "carnet y si su portador es un",
        "funcionario activo del *" + ent.charAt(0).toUpperCase() + ent.slice(1).toLowerCase() + "*"];
    ver.forEach((l, i) => richLine(x, l, 527 + L.dx, 596 + L.d2 + i * 55, 39, 900));
    rr(x, 312 + L.dx, 805 + L.dk, 435, 100, 50);
    x.fillStyle = L.pill;
    x.fill();
    x.fillStyle = "#FFFFFF";
    x.font = "600 40px " + FM;
    trackText(x, "CONTACTO", 530 + L.dx, 869 + L.dk, 7);
    x.fillStyle = K.ink;
    if (cfg.telefono) richLine(x, "*Teléfono:* " + cfg.telefono, W / 2 + L.dx, 993 + L.dc, 40, 900);
    if (cfg.direccion) richLine(x, "*Dirección:*  " + cfg.direccion, W / 2 + L.dx, 1072 + L.dc, 40, 900);
    if (cfg.ciudad) richLine(x, cfg.ciudad, W / 2 + L.dx, 1148 + L.dc, 40, 940);
    const note = [cfg.nit ? "NIT " + cfg.nit : "", cfg.subtitulo].filter(Boolean).join("  ·  ");
    if (note) {
      x.fillStyle = K.note;
      richLine(x, note, W / 2 + L.dx, 1205 + L.dc, 21, 900);
    }
    stamp(x, o.stamp);
    return c;
  }

  window.Carnet = {
    W, H, CFG0, AREAS, ensure, front, back, loadImg, todayISO, fmtDate, fmtDoc, fullName, shortName, cardName, initials, tipoLabel, estado
  };
})();
