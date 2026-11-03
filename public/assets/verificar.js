(function () {
  const C = window.Carnet, api = window.Api;
  const $ = s => document.querySelector(s);
  const m = /^\/v\/([A-Za-z0-9]{8,64})\/?$/.exec(location.pathname);
  const ICON = {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 7v6M12 16.5v.5"/></svg>',
    bad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/></svg>'
  };

  function state(k, title, text) {
    const s = $("#state");
    s.dataset.k = k;
    s.innerHTML = (ICON[k] || "") + "<div><b></b><span></span></div>";
    s.querySelector("b").textContent = title;
    s.querySelector("span").textContent = text;
  }

  function row(dl, k, v) {
    if (!v) return;
    const d = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = v;
    d.appendChild(dt);
    d.appendChild(dd);
    dl.appendChild(d);
  }

  function when() {
    const d = new Date(), p = n => String(n).padStart(2, "0");
    return "Consulta realizada el " + p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " a las " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  async function run() {
    if (!m || !api.configured) {
      state("bad", "Carnet no válido", "Este código no corresponde a ningún carnet.");
      return;
    }
    let d, cfg;
    try {
      const r = await Promise.all([api.get("verificacion/" + m[1]), api.get("ajustes/entidad").catch(() => null)]);
      d = r[0];
      cfg = Object.assign({}, C.CFG0, r[1] || {});
    } catch (e) {
      state("warn", "No se pudo verificar", e && e.offline ? "No hay conexión a internet. Intenta de nuevo." : "Intenta de nuevo en un momento.");
      return;
    }
    const ent = cfg.nombre || "EDUMAS";
    $("#foot-ent").textContent = [ent, cfg.telefono, [cfg.direccion, cfg.ciudad].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    $("#foot-when").textContent = when();
    if (!d) {
      state("bad", "Carnet no válido", "Este código no está en el registro de funcionarios de " + ent + ".");
      return;
    }
    const e = C.estado(d), tipo = C.tipoLabel(d.tipo);
    if (e.k === "off") state("bad", "Carnet inactivo", "Esta persona ya no figura como funcionario activo de " + ent + ".");
    else if (e.k === "bad") state("bad", "Carnet vencido", "La vigencia terminó el " + C.fmtDate(d.fechaFin) + ".");
    else state("ok", "Funcionario activo", tipo + " vinculado a " + ent + ".");
    const who = $("#who");
    if (/^data:image\//.test(d.foto || "")) {
      const im = new Image();
      im.alt = "Foto del funcionario";
      im.src = d.foto;
      who.insertBefore(im, who.firstChild);
    } else {
      const ph = document.createElement("div");
      ph.className = "ph";
      who.insertBefore(ph, who.firstChild);
    }
    $("#nombre").textContent = d.nombre || "";
    $("#tipo").textContent = tipo;
    who.hidden = false;
    const dl = $("#datos");
    row(dl, "Documento", d.doc);
    row(dl, "Cargo", d.cargo);
    row(dl, "Dependencia", d.dependencia);
    row(dl, "Válido hasta", C.fmtDate(d.fechaFin));
    row(dl, "Código", d.codigo);
    dl.hidden = !dl.children.length;
    document.title = "Verificación · " + (d.nombre || ent);
    registrar(d, e.k === "off" ? "inactivo" : e.k === "bad" ? "vencido" : "activo");
  }

  function posicion() {
    return new Promise(res => {
      if (!navigator.geolocation) { res({ estado: "no_disponible" }); return; }
      navigator.geolocation.getCurrentPosition(
        p => res({ estado: "si", lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy || 0) }),
        err => res({ estado: err && err.code === 1 ? "denegada" : "no_disponible" }),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }

  async function direccion(lat, lng) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=es&lat=" + lat + "&lon=" + lng, { signal: ctl.signal });
      clearTimeout(t);
      const j = await r.json();
      const a = j.address || {};
      const calle = [a.road, a.house_number].filter(Boolean).join(" ");
      const barrio = a.neighbourhood || a.suburb || a.quarter || a.residential || "";
      const ciudad = a.city || a.town || a.village || a.municipality || "";
      const txt = [calle, barrio, ciudad].filter(Boolean).join(", ") || j.display_name || "";
      return txt.slice(0, 200);
    } catch (e) { return ""; }
  }

  function dispositivo() {
    const u = navigator.userAgent;
    const so = /iphone|ipad/i.test(u) ? "iPhone" : /android/i.test(u) ? "Android" : /windows/i.test(u) ? "Windows" : /mac os/i.test(u) ? "Mac" : "Otro";
    return so;
  }

  async function registrar(d, resultado) {
    const key = "reg." + m[1];
    try {
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < 10 * 60 * 1000) { nota("Esta presentación ya quedó registrada."); return; }
    } catch (x) {}
    nota("Registrando la presentación…");
    const pos = await posicion();
    const data = { v: m[1], nombre: d.nombre || "", tipo: d.tipo || "", cargo: d.cargo || "", resultado, ubicacion: pos.estado, dispositivo: dispositivo() };
    if (pos.estado === "si") {
      data.lat = pos.lat;
      data.lng = pos.lng;
      data.precision = pos.precision;
      const dir = await direccion(pos.lat, pos.lng);
      if (dir) data.lugar = dir;
    }
    try {
      await api.addPublic("registros", data, "fecha");
      try { sessionStorage.setItem(key, String(Date.now())); } catch (x) {}
      nota(pos.estado === "si" ? "Presentación registrada con su ubicación." : "Presentación registrada sin ubicación: no se dio permiso de ubicación.");
    } catch (x) {
      nota("No se pudo registrar la presentación.");
    }
  }

  function nota(t) { const n = $("#reg"); n.textContent = t; n.hidden = !t; }

  run();
})();
