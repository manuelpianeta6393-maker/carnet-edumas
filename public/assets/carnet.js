(function () {
  const C = window.Carnet, api = window.Api;
  const $ = s => document.querySelector(s);
  const m = /^\/c\/([A-Za-z0-9]{16,64})(\/|$)/.exec(location.pathname);
  const token = m ? m[1] : "";
  const LS = "carnet." + token;
  let installEvt = null, current = null, front = null, paintId = 0;

  function view(v) { ["load", "gate", "card", "bad"].forEach(n => { $("#v-" + n).hidden = n !== v; }); }

  function bad(title, text) {
    $("#bad-t").textContent = title;
    $("#bad-p").textContent = text;
    view("bad");
  }

  function readCache() {
    try {
      const c = JSON.parse(localStorage.getItem(LS) || "null");
      return c && c.id && c.data ? c : null;
    } catch (e) { return null; }
  }

  function writeCache(c) { try { localStorage.setItem(LS, JSON.stringify(c)); } catch (e) {} }
  function clearCache() { try { localStorage.removeItem(LS); } catch (e) {} }

  function standalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }

  function fmtWhen(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, "0");
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  async function paint(c, offline) {
    const id = ++paintId;
    current = c;
    const d = c.data, cfg = Object.assign({}, C.CFG0, c.cfg || {});
    const e = C.estado(d);
    const o = { qr: location.origin + "/v/" + d.vtoken, stamp: e.stamp };
    const r = await Promise.all([C.front(d, cfg, o), C.back(d, cfg, o)]);
    if (id !== paintId) return;
    front = r[0];
    $("#img-front").src = r[0].toDataURL("image/jpeg", 0.92);
    $("#img-back").src = r[1].toDataURL("image/jpeg", 0.92);
    const st = $("#status");
    st.dataset.k = e.k;
    st.textContent = e.k === "off" ? "Carnet inactivo" : e.k === "bad" ? "Carnet vencido el " + C.fmtDate(d.fechaFin)
      : d.fechaFin ? "Vigente hasta el " + C.fmtDate(d.fechaFin) : "Vigente";
    $("#meta").textContent = (offline ? "Sin conexión · " : "") + "Verificado el " + fmtWhen(c.at);
    document.title = "Carnet · " + C.cardName(d);
    view("card");
    installUi();
  }

  async function refresh(c) {
    try {
      const r = await Promise.all([api.get("carnets/" + c.id), api.get("ajustes/entidad").catch(() => null)]);
      if (!r[0]) {
        clearCache();
        bad("Este carnet ya no es válido", "Pide un enlace nuevo en la oficina de EDUMAS.");
        return;
      }
      const cfg = r[1] || c.cfg || null;
      if (cfg) delete cfg.id;
      delete r[0].id;
      const n = { id: c.id, data: r[0], cfg, at: Date.now() };
      writeCache(n);
      await paint(n, false);
    } catch (e) {
      if (current) $("#meta").textContent = "Sin conexión · Verificado el " + fmtWhen(current.at);
    }
  }

  async function submitGate(ev) {
    ev.preventDefault();
    const er = $("#gate-err"), b = $("#gate-btn");
    const doc = api.normDoc($("#doc").value);
    er.hidden = true;
    if (doc.length < 4) {
      er.textContent = "Escribe tu número de documento completo.";
      er.hidden = false;
      return;
    }
    b.disabled = true;
    try {
      const id = await api.carnetId(token, doc);
      const d = await api.get("carnets/" + id);
      if (!d) {
        er.textContent = "El número no coincide con este carnet. Revísalo e intenta de nuevo.";
        er.hidden = false;
      } else {
        const cfg = await api.get("ajustes/entidad").catch(() => null);
        if (cfg) delete cfg.id;
        delete d.id;
        const c = { id, data: d, cfg, at: Date.now() };
        writeCache(c);
        view("load");
        await paint(c, false);
      }
    } catch (e) {
      er.textContent = e && e.offline ? "Sin conexión. Conéctate a internet para activar tu carnet." : "No se pudo activar. Intenta de nuevo en un momento.";
      er.hidden = false;
    }
    b.disabled = false;
  }

  function installUi() {
    const btn = $("#btn-install"), tip = $("#ios-tip");
    if (standalone()) { btn.hidden = true; tip.hidden = true; return; }
    if (installEvt) { btn.hidden = false; tip.hidden = true; return; }
    btn.hidden = true;
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const otro = /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(ua);
    if (ios) {
      tip.innerHTML = "<b>Para instalarlo en iPhone</b><ol>" +
        (otro
          ? "<li>Este navegador no permite instalarlo. Toca <b>Copiar enlace</b> y pégalo en <b>Safari</b>.</li>"
          : "<li>Si lo abriste desde WhatsApp, toca primero el ícono de <b>Safari</b> (la brújula, abajo a la derecha) o <b>Abrir en Safari</b>. Si no aparece, toca <b>Copiar enlace</b> y pégalo en Safari.</li>") +
        "<li>En Safari toca <b>Compartir</b>: el cuadrado con la flecha hacia arriba.</li>" +
        "<li>Desliza hacia abajo y elige <b>Agregar a pantalla de inicio</b> → <b>Agregar</b>.</li>" +
        "<li>Abre el ícono nuevo con internet y escribe tu documento una vez más.</li></ol>";
      $("#btn-copy").hidden = false;
    } else {
      tip.innerHTML = "Para instalarlo: abre el menú del navegador y elige <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>.";
      $("#btn-copy").hidden = true;
    }
    tip.hidden = false;
  }

  async function copyLink() {
    const url = location.origin + "/c/" + token + "/";
    try {
      await navigator.clipboard.writeText(url);
      $("#btn-copy").textContent = "Enlace copiado";
    } catch (e) {
      window.prompt("Copia este enlace y pégalo en Safari:", url);
    }
  }

  function start() {
    if (!token) { bad("Enlace no válido", "Abre el enlace personal que te envió EDUMAS."); return; }
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/c/" + token + "/manifest.webmanifest";
    document.head.appendChild(link);
    if (!/\/$/.test(location.pathname)) {
      try { history.replaceState(null, "", "/c/" + token + "/"); } catch (e) {}
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    window.addEventListener("beforeinstallprompt", ev => {
      ev.preventDefault();
      installEvt = ev;
      if (current) installUi();
    });
    window.addEventListener("appinstalled", () => { installEvt = null; installUi(); });
    $("#btn-install").addEventListener("click", async () => {
      if (!installEvt) return;
      installEvt.prompt();
      try { await installEvt.userChoice; } catch (e) {}
      installEvt = null;
      installUi();
    });
    $("#flip").addEventListener("click", () => { $("#flip").classList.toggle("on"); });
    $("#btn-copy").addEventListener("click", copyLink);
    $("#v-gate").addEventListener("submit", submitGate);
    window.addEventListener("online", () => { if (current) refresh(current); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && current) refresh(current); });
    if (!api.configured) { bad("App sin configurar", "Falta conectar la base de datos. Avisa al administrador."); return; }
    const c = readCache();
    if (c) paint(c, !navigator.onLine).then(() => refresh(c));
    else view("gate");
  }

  start();
})();
