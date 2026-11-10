(function () {
  const C = window.Carnet, api = window.Api;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LIST = ["tipo", "nombres", "apellidos", "nombreCarnet", "tipoDoc", "numDoc", "cargo", "dependencia", "fechaInicio", "fechaFin", "codigo", "activo", "thumb", "token", "vtoken", "carnetId"];
  const GATES = ["load", "config", "login", "verify", "error"];
  const S = { people: [], cfg: Object.assign({}, C.CFG0), view: "lista", filter: "todos", q: "", sel: null, editId: null, foto: "", thumb: "", cards: null, token: 0, regs: null, regsAt: 0, fotoBase: null, fondoJob: 0 };
  let confirmFn = null, toastT = 0;

  function toast(m) {
    const t = $("#toast");
    t.textContent = m;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function errMsg(e) {
    if (e && e.offline) return "Sin conexión. Revisa el internet e intenta de nuevo.";
    if (e && e.http === 401) return "Tu sesión venció. Entra de nuevo.";
    if (e && (e.http === 403 || e.status === "PERMISSION_DENIED")) return "No tienes permiso para hacer este cambio.";
    if (e && (e.http === 429 || e.status === "RESOURCE_EXHAUSTED")) return "Se alcanzó el límite gratuito de hoy. Intenta mañana.";
    return "No se pudo completar. Intenta de nuevo.";
  }

  function gate(name) {
    GATES.forEach(n => { $("#g-" + n).hidden = n !== name; });
    $("#app").hidden = !!name;
    $("#tabs").hidden = !!name;
    const s = api.session();
    $("#who").hidden = !s;
    $("#who-mail").textContent = s ? s.email || "" : "";
  }

  function handle(e) {
    if (e && e.http === 401) {
      api.signOut();
      gate("login");
      toast(errMsg(e));
      return;
    }
    toast(errMsg(e));
  }

  function msg(id, text) {
    const el = $(id);
    el.textContent = text || "";
    el.hidden = !text;
  }

  function toLogin(text) {
    api.signOut();
    gate("login");
    msg("#l-info", "");
    msg("#l-err", text || "");
  }

  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "carnet"; }
  function linkOf(p) { return location.origin + "/c/" + p.token + "/"; }
  function verOf(p) { return location.origin + "/v/" + p.vtoken; }

  function tipoSel() {
    return $("#tipo-fp").checked ? "planta" : $("#tipo-ct").checked ? "contratista" : "practicante";
  }

  function tipoClass(t) { return t === "planta" ? "fp" : t === "contratista" ? "ct" : "pr"; }

  function fillAreas(current) {
    const list = C.AREAS.slice();
    if (current && list.indexOf(current) < 0) list.push(current);
    $("#f-dependencia").innerHTML = '<option value="">Selecciona el área</option>' + list.map(a => '<option value="' + esc(a) + '">' + esc(a) + "</option>").join("");
    $("#f-dependencia").value = current || "";
  }

  function nextCode(tipo) {
    const pre = tipo === "planta" ? "FP" : tipo === "contratista" ? "CT" : "PR";
    let max = 0;
    S.people.forEach(p => {
      const m = /^([A-Z]+)-(\d+)$/.exec(p.codigo || "");
      if (m && m[1] === pre) max = Math.max(max, parseInt(m[2], 10));
    });
    return pre + "-" + String(max + 1).padStart(3, "0");
  }

  function maskDoc(p) {
    const n = api.normDoc(p.numDoc);
    return (p.tipoDoc || "") + " ••••" + n.slice(-4);
  }

  function pubCarnet(f) {
    return {
      nombreCarnet: C.cardName(f), tipo: f.tipo, cargo: f.cargo || "", tipoDoc: f.tipoDoc || "", rh: f.rh || "", foto: f.foto || "",
      fechaInicio: f.fechaInicio || "", fechaFin: f.fechaFin || "", activo: f.activo !== false, vtoken: f.vtoken, codigo: f.codigo || "",
      actualizado: f.actualizado || ""
    };
  }

  function pubVerif(f) {
    return {
      nombre: C.fullName(f), tipo: f.tipo, cargo: f.tipo === "planta" ? f.cargo || "" : "", doc: maskDoc(f), foto: f.foto || "", dependencia: f.dependencia || "",
      fechaFin: f.fechaFin || "", activo: f.activo !== false, codigo: f.codigo || "", actualizado: f.actualizado || ""
    };
  }

  function strip(p) {
    const o = Object.assign({}, p);
    delete o.id;
    delete o.full;
    return o;
  }

  function putLocal(rec) {
    const i = S.people.findIndex(p => p.id === rec.id);
    if (i >= 0) S.people[i] = rec;
    else S.people.push(rec);
  }

  async function ensureFull(id) {
    const p = S.people.find(x => x.id === id);
    if (!p) return null;
    if (p.full) return p;
    const d = await api.get("funcionarios/" + id, true);
    if (!d) return null;
    d.full = true;
    putLocal(d);
    return d;
  }

  async function persist(id, d, prev) {
    const token = prev && prev.token ? prev.token : api.rnd(24);
    const vtoken = prev && prev.vtoken ? prev.vtoken : api.rnd(16);
    const cid = await api.carnetId(token, d.numDoc);
    const full = Object.assign({}, d, { token, vtoken, carnetId: cid, activo: prev ? prev.activo !== false : true });
    const ops = [
      { set: "funcionarios/" + id, data: full },
      { set: "carnets/" + cid, data: pubCarnet(full) },
      { set: "verificacion/" + vtoken, data: pubVerif(full) }
    ];
    if (prev && prev.carnetId && prev.carnetId !== cid) ops.push({ del: "carnets/" + prev.carnetId });
    await api.commit(ops, { accion: prev ? "editar" : "crear", funcionario: id, nombre: C.fullName(full) });
    const rec = Object.assign({ id, full: true }, full);
    putLocal(rec);
    return rec;
  }

  async function enter() {
    gate("load");
    try {
      const s = api.session();
      if (!api.isAdmin(s.email)) {
        toLogin("Esta cuenta no tiene permiso para administrar.");
        return;
      }
      if (!s.verificado) {
        $("#v-mail").textContent = s.email || "";
        msg("#v-err", "");
        msg("#v-info", "");
        gate("verify");
        return;
      }
      const r = await Promise.all([api.get("ajustes/entidad", true), api.list("funcionarios", LIST)]);
      S.cfg = Object.assign({}, C.CFG0, r[0] || {});
      delete S.cfg.id;
      S.people = r[1];
      gate(null);
      renderAll();
      show("lista");
    } catch (e) {
      if (e && e.http === 401) {
        toLogin("Tu sesión venció. Entra de nuevo.");
        return;
      }
      $("#g-error-t").textContent = e && e.offline
        ? "No hay conexión a internet."
        : e && (e.http === 403 || e.status === "PERMISSION_DENIED")
          ? "La base de datos rechazó la consulta. Revisa que las reglas de Firestore estén publicadas."
          : "Revisa que Firestore esté creado en tu proyecto y que config.js tenga los datos correctos.";
      gate("error");
    }
  }

  function loginError(e) {
    const r = (e && e.reason) || "";
    if (e && e.offline) return "Sin conexión a internet.";
    if (/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_EMAIL|MISSING_PASSWORD/.test(r)) return "Correo o contraseña incorrectos.";
    if (/USER_DISABLED/.test(r)) return "Esta cuenta está deshabilitada.";
    if (/TOO_MANY_ATTEMPTS/.test(r)) return "Demasiados intentos. Espera unos minutos.";
    if (/API key not valid/i.test(r)) return "La configuración de Firebase no es válida. Revisa config.js.";
    if (/CONFIGURATION_NOT_FOUND|OPERATION_NOT_ALLOWED|PASSWORD_LOGIN_DISABLED/.test(r)) return "Activa el acceso con correo y contraseña en Firebase Authentication.";
    return "No se pudo entrar. Intenta de nuevo.";
  }

  async function submitLogin(ev) {
    ev.preventDefault();
    const b = $("#l-btn"), er = $("#l-err");
    er.hidden = true;
    msg("#l-info", "");
    const mail = $("#l-mail").value.trim();
    if (!api.isAdmin(mail)) {
      er.textContent = "Este correo no tiene permiso para administrar los carnets.";
      er.hidden = false;
      return;
    }
    b.disabled = true;
    try {
      await api.signIn(mail, $("#l-pass").value);
      $("#l-pass").value = "";
      try { localStorage.setItem("carnets.ultimo", mail.toLowerCase()); } catch (x) {}
      await enter();
    } catch (e) {
      er.textContent = loginError(e);
      er.hidden = false;
    }
    b.disabled = false;
  }

  function renderBrand() { $("#brand-name").textContent = S.cfg.nombre || "Carnets"; }
  function renderAll() { renderBrand(); renderChips(); renderList(); }

  function counts() {
    const c = { todos: S.people.length, practicante: 0, contratista: 0, planta: 0, vence: 0 };
    S.people.forEach(p => {
      if (p.tipo === "contratista") c.contratista++;
      else if (p.tipo === "planta") c.planta++;
      else c.practicante++;
      if (C.estado(p).k !== "ok") c.vence++;
    });
    return c;
  }

  function renderChips() {
    const c = counts();
    const defs = [["todos", "Todos", c.todos], ["planta", "De planta", c.planta], ["practicante", "Practicantes", c.practicante], ["contratista", "Contratistas", c.contratista], ["vence", "Requieren atención", c.vence]];
    $("#chips").innerHTML = defs.map(d => '<button class="chip" type="button" data-filter="' + d[0] + '" aria-pressed="' + (S.filter === d[0]) + '">' + d[1] + " · " + d[2] + "</button>").join("");
  }

  function visible() {
    const q = norm(S.q);
    return S.people.filter(p => {
      if (S.filter === "practicante" && (p.tipo === "contratista" || p.tipo === "planta")) return false;
      if (S.filter === "contratista" && p.tipo !== "contratista") return false;
      if (S.filter === "planta" && p.tipo !== "planta") return false;
      if (S.filter === "vence" && C.estado(p).k === "ok") return false;
      if (!q) return true;
      return norm([p.nombres, p.apellidos, p.numDoc, p.dependencia, p.cargo, p.codigo].join(" ")).includes(q);
    }).sort((a, b) => (a.apellidos || "").localeCompare(b.apellidos || "", "es") || (a.nombres || "").localeCompare(b.nombres || "", "es"));
  }

  function pills(p) {
    const e = C.estado(p);
    return '<span class="pill ' + tipoClass(p.tipo) + '">' + (p.tipo === "planta" ? "De planta" : C.tipoLabel(p.tipo)) + '</span><span class="pill ' + e.k + '">' + esc(e.t) + "</span>";
  }

  function renderList() {
    const list = $("#list"), empty = $("#empty"), tools = $("#tools");
    if (!S.people.length) {
      list.hidden = true;
      tools.hidden = true;
      empty.hidden = false;
      $("#empty-t").textContent = "Aún no hay funcionarios";
      $("#empty-p").textContent = "Registra un practicante o un contratista y envíale el enlace para que instale su carnet.";
      $("#empty-btn").hidden = false;
      return;
    }
    tools.hidden = false;
    const rows = visible();
    if (!rows.length) {
      list.hidden = true;
      empty.hidden = false;
      $("#empty-btn").hidden = true;
      $("#empty-t").textContent = "Sin resultados";
      $("#empty-p").textContent = "Ningún funcionario coincide con la búsqueda o el filtro.";
      return;
    }
    empty.hidden = true;
    list.hidden = false;
    list.innerHTML = rows.map(p => {
      const img = p.thumb || "";
      const th = /^data:image\//.test(img) ? '<img class="thumb" alt="" src="' + esc(img) + '">' : '<span class="thumb">' + esc(C.initials(p)) + "</span>";
      return '<button class="row" type="button" data-id="' + esc(p.id) + '">' + th +
        '<span class="row-b"><span class="row-n">' + esc(C.fullName(p)) + '</span><span class="row-m">' + esc([p.cargo, p.dependencia].filter(Boolean).join(" · ")) + '</span><span class="row-m">' + esc((p.tipoDoc || "") + " " + C.fmtDoc(p.numDoc) + (p.fechaFin ? " · hasta " + C.fmtDate(p.fechaFin) : "")) + "</span>" +
        '<span class="row-s">' + pills(p) + '<span class="pill nt">' + esc(p.codigo || "") + "</span></span></span></button>";
    }).join("");
  }

  function show(v) {
    S.view = v;
    ["lista", "form", "detalle", "registros", "ajustes"].forEach(n => { $("#v-" + n).hidden = n !== v; });
    $$(".tab").forEach(t => {
      const on = t.dataset.go === v || (v === "detalle" && t.dataset.go === "lista");
      if (on) t.setAttribute("aria-current", "page");
      else t.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
  }

  function go(v) {
    if (v === "form") openForm(null);
    else if (v === "ajustes") { fillCfg(); show("ajustes"); }
    else if (v === "registros") { show("registros"); loadRegs(true); }
    else show("lista");
  }

  function setTipoFields() {
    const t = tipoSel();
    $$("[data-only]").forEach(el => { el.hidden = el.dataset.only !== t; });
    const pl = t === "planta";
    $("#f-cargo-l").textContent = pl ? "Cargo *" : "Cargo o rol";
    $("#f-cargo-h").hidden = !pl;
    $("#f-fin-l").textContent = pl ? "Válido hasta" : "Válido hasta *";
    $("#f-fin-h").textContent = pl ? "Opcional para funcionarios de planta. Si lo dejas vacío, el carnet no vence." : "Después de esta fecha el carnet aparece como vencido.";
    if (!S.editId) {
      const c = $("#f-codigo");
      if (!c.dataset.touched) c.value = nextCode(t);
    }
  }

  function setFoto(src, thumb) {
    if (!src) { S.fotoBase = null; S.fondoJob++; fondoNota(""); $("#fondo-row").hidden = true; }
    S.foto = src || "";
    S.thumb = src ? thumb || "" : "";
    const b = $("#photo-box");
    if (S.foto) {
      b.innerHTML = "";
      const i = new Image();
      i.alt = "Foto del funcionario";
      i.src = S.foto;
      b.appendChild(i);
    } else b.textContent = "Sin foto";
    $("#foto-quitar").hidden = !S.foto;
    if (S.foto) $("#fondo-row").hidden = false;
    $("#foto-lbl").textContent = S.foto ? "Cambiar foto" : "Tomar o elegir foto";
  }

  function clearErrors() {
    $$(".fld.bad").forEach(f => {
      f.classList.remove("bad");
      const m = f.querySelector(".msg");
      if (m) m.remove();
    });
  }

  function fieldErr(key, msg) {
    const f = document.querySelector('[data-f="' + key + '"]');
    if (!f) return;
    f.classList.add("bad");
    const m = document.createElement("span");
    m.className = "msg";
    m.textContent = msg;
    f.appendChild(m);
  }

  function openForm(id) {
    S.editId = id;
    clearErrors();
    const p = id ? S.people.find(x => x.id === id) : null;
    $("#form-t").textContent = p ? "Editar funcionario" : "Registrar funcionario";
    $("#form-save").textContent = p ? "Guardar cambios" : "Guardar y ver carnet";
    const v = p || { tipo: "practicante", tipoDoc: "C.C.", fechaInicio: C.todayISO() };
    $("#tipo-ct").checked = v.tipo === "contratista";
    $("#tipo-fp").checked = v.tipo === "planta";
    $("#tipo-pr").checked = v.tipo !== "contratista" && v.tipo !== "planta";
    $("#f-nombres").value = v.nombres || "";
    $("#f-apellidos").value = v.apellidos || "";
    const nc = $("#f-nombrecarnet");
    nc.value = v.nombreCarnet || "";
    if (p && v.nombreCarnet) nc.dataset.touched = "1";
    else delete nc.dataset.touched;
    $("#f-tipodoc").value = v.tipoDoc || "C.C.";
    $("#f-numdoc").value = v.numDoc || "";
    $("#f-rh").value = v.rh || "";
    $("#f-cargo").value = v.cargo || "";
    fillAreas(v.dependencia || "");
    $("#f-institucion").value = v.institucion || "";
    $("#f-programa").value = v.programa || "";
    $("#f-contrato").value = v.contrato || "";
    $("#f-objeto").value = v.objeto || "";
    $("#f-supervisor").value = v.supervisor || "";
    $("#f-inicio").value = v.fechaInicio || "";
    $("#f-fin").value = v.fechaFin || "";
    const c = $("#f-codigo");
    c.value = v.codigo || "";
    if (p) c.dataset.touched = "1";
    else delete c.dataset.touched;
    $("#f-foto").value = "";
    S.fotoBase = null;
    S.fondoJob++;
    fondoNota("");
    $("#f-fondo").checked = !(v.foto);
    $("#f-autoriza").checked = !!v.autorizacion;
    setFoto(v.foto || "", v.thumb || "");
    setTipoFields();
    show("form");
  }

  function readForm() {
    const tipo = tipoSel();
    const g = id => $("#" + id).value.trim();
    const d = {
      tipo, nombres: g("f-nombres"), apellidos: g("f-apellidos"),
      nombreCarnet: g("f-nombrecarnet") || C.shortName(g("f-nombres"), g("f-apellidos")),
      tipoDoc: $("#f-tipodoc").value, numDoc: g("f-numdoc").replace(/[.\s]/g, ""), rh: $("#f-rh").value,
      cargo: g("f-cargo"), dependencia: g("f-dependencia"), supervisor: g("f-supervisor"),
      fechaInicio: $("#f-inicio").value, fechaFin: $("#f-fin").value,
      codigo: g("f-codigo") || nextCode(tipo), foto: S.foto || "", thumb: S.thumb || ""
    };
    const prevA = S.editId ? (S.people.find(p => p.id === S.editId) || {}).autorizacion : "";
    d.autorizacion = $("#f-autoriza").checked ? prevA || new Date().toISOString() : "";
    if (tipo === "practicante") { d.institucion = g("f-institucion"); d.programa = g("f-programa"); }
    else { d.contrato = g("f-contrato"); d.objeto = g("f-objeto"); }
    return d;
  }

  function validate(d) {
    clearErrors();
    let ok = true;
    const req = [["nombres", "Escribe los nombres."], ["apellidos", "Escribe los apellidos."], ["numDoc", "Escribe el número de documento."], ["dependencia", "Selecciona el área."]];
    if (d.tipo === "planta") req.push(["cargo", "Escribe el cargo; sale en el carnet."]);
    else req.push(["fechaFin", "Indica hasta cuándo es válido el carnet."]);
    req.forEach(r => { if (!d[r[0]]) { fieldErr(r[0], r[1]); ok = false; } });
    if (d.numDoc && api.normDoc(d.numDoc).length < 4) { fieldErr("numDoc", "El documento debe tener al menos 4 caracteres."); ok = false; }
    if (d.numDoc && S.people.some(p => p.id !== S.editId && String(p.numDoc) === d.numDoc && p.tipoDoc === d.tipoDoc)) { fieldErr("numDoc", "Ya hay un funcionario con este documento."); ok = false; }
    if (d.fechaInicio && d.fechaFin && d.fechaFin < d.fechaInicio) { fieldErr("fechaFin", "Debe ser posterior a la fecha de inicio."); ok = false; }
    if (d.codigo && S.people.some(p => p.id !== S.editId && p.codigo === d.codigo)) { fieldErr("codigo", "Este código ya está en uso."); ok = false; }
    if (!d.autorizacion) { fieldErr("autorizacion", "Confirma que el titular autorizó el tratamiento de sus datos."); ok = false; }
    if (!ok) {
      const f = document.querySelector(".fld.bad input,.fld.bad select");
      if (f) f.focus();
    }
    return ok;
  }

  async function submitForm(ev) {
    ev.preventDefault();
    const d = readForm();
    if (!validate(d)) return;
    const prev = S.editId ? S.people.find(p => p.id === S.editId) : null;
    d.creado = prev && prev.creado ? prev.creado : new Date().toISOString();
    d.actualizado = new Date().toISOString();
    const b = $("#form-save");
    b.disabled = true;
    try {
      const rec = await persist(S.editId || api.rnd(20), d, prev);
      toast(S.editId ? "Cambios guardados" : "Funcionario registrado");
      renderAll();
      openDetail(rec.id);
    } catch (e) { handle(e); }
    b.disabled = false;
  }

  function readFile(f) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(f);
    });
  }

  function fotoDe(c) {
    const t = document.createElement("canvas");
    t.width = 96;
    t.height = 104;
    t.getContext("2d").drawImage(c, 0, 0, 96, 104);
    return [c.toDataURL("image/jpeg", 0.82), t.toDataURL("image/jpeg", 0.7)];
  }

  function fondoNota(t, k) {
    const n = $("#fondo-nota");
    n.textContent = t || "";
    n.dataset.k = k || "";
    n.hidden = !t;
  }

  async function aplicarFondo() {
    const base = S.fotoBase;
    if (!base) return;
    const job = ++S.fondoJob;
    if (!$("#f-fondo").checked) {
      const f = fotoDe(base);
      setFoto(f[0], f[1]);
      fondoNota("");
      return;
    }
    if (!window.FondoBlanco) { fondoNota("No se pudo cargar el recorte de fondo. Se usa la foto original.", "bad"); return; }
    fondoNota("Poniendo fondo blanco…", "load");
    $("#photo-box").classList.add("busy");
    try {
      const out = await window.FondoBlanco.aplicar(base);
      if (job !== S.fondoJob) return;
      const f = fotoDe(out);
      setFoto(f[0], f[1]);
      fondoNota("Fondo blanco aplicado. Revisa que el borde se vea bien; si no, desmarca la casilla.", "ok");
    } catch (e) {
      if (job !== S.fondoJob) return;
      fondoNota((e && /persona/.test(e.message) ? "No se encontró una persona en la foto." : "No se pudo quitar el fondo.") + " Se usa la foto original.", "bad");
    }
    $("#photo-box").classList.remove("busy");
  }

  async function pickFoto(ev) {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      const img = await C.loadImg(await readFile(f));
      const tw = 700, th = 750, r = tw / th;
      let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
      if (sw / sh > r) { const nw = sh * r; sx = (sw - nw) / 2; sw = nw; }
      else { const nh = sw / r; sy = (sh - nh) * 0.3; sh = nh; }
      const c = document.createElement("canvas");
      c.width = tw;
      c.height = th;
      const x = c.getContext("2d");
      x.fillStyle = "#FFFFFF";
      x.fillRect(0, 0, tw, th);
      x.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
      S.fotoBase = c;
      const o = fotoDe(c);
      setFoto(o[0], o[1]);
      $("#fondo-row").hidden = false;
      await aplicarFondo();
    } catch (e) { toast("No se pudo leer la imagen. Prueba con otra foto."); }
  }

  async function fondoExistente() {
    if (S.fotoBase || !S.foto) return aplicarFondo();
    try {
      const img = await C.loadImg(S.foto);
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      S.fotoBase = c;
    } catch (e) { return; }
    return aplicarFondo();
  }

  function fillCfg() {
    const c = S.cfg;
    $("#c-nombre").value = c.nombre || "";
    $("#c-subtitulo").value = c.subtitulo || "";
    $("#c-nit").value = c.nit || "";
    $("#c-telefono").value = c.telefono || "";
    $("#c-direccion").value = c.direccion || "";
    $("#c-ciudad").value = c.ciudad || "";
    $("#c-legal").value = c.legal || "";
  }

  async function submitCfg(ev) {
    ev.preventDefault();
    clearErrors();
    const g = id => $("#" + id).value.trim();
    const d = { nombre: g("c-nombre"), subtitulo: g("c-subtitulo"), nit: g("c-nit"), telefono: g("c-telefono"), direccion: g("c-direccion"), ciudad: g("c-ciudad"), legal: g("c-legal") };
    if (!d.nombre) {
      fieldErr("c-nombre", "Escribe el nombre de la entidad.");
      $("#c-nombre").focus();
      return;
    }
    const b = $("#cfg-save");
    b.disabled = true;
    try {
      await api.commit([{ set: "ajustes/entidad", data: d }], { accion: "ajustes" });
      S.cfg = Object.assign({}, C.CFG0, d);
      renderBrand();
      toast("Datos de la entidad guardados");
    } catch (e) { handle(e); }
    b.disabled = false;
  }

  function renderDetailHead(p) {
    $("#det-n").textContent = C.fullName(p);
    $("#det-pills").innerHTML = pills(p) + '<span class="pill nt">' + esc(p.codigo || "") + "</span>";
    $("#link-url").value = linkOf(p);
    drawInstallQR(linkOf(p));
    const msg = "Hola " + C.cardName(p) + ", este es tu carnet virtual de " + (S.cfg.nombre || "EDUMAS") + ". Ábrelo, escribe tu número de documento e instálalo en tu celular:\n\n" +
      linkOf(p) + "\n\nSi tienes iPhone, ábrelo en Safari y toca Compartir → Agregar a pantalla de inicio.";
    $("#link-wa").href = "https://wa.me/?text=" + encodeURIComponent(msg);
    $("#link-ver").href = verOf(p);
    $("#det-toggle").textContent = p.activo === false ? "Reactivar carnet" : "Desactivar carnet";
  }

  async function openDetail(id) {
    const base = S.people.find(x => x.id === id);
    if (!base) { show("lista"); return; }
    S.sel = id;
    S.cards = null;
    show("detalle");
    $("#confirm").hidden = true;
    $("#img-front").removeAttribute("src");
    $("#img-back").removeAttribute("src");
    renderDetailHead(base);
    renderHist();
    if (!S.regs || Date.now() - S.regsAt > 60000) loadRegs(true);
    await paint(id);
  }

  async function paint(id) {
    const tk = ++S.token;
    try {
      const p = await ensureFull(id);
      if (!p || tk !== S.token) return;
      renderDetailHead(p);
      const o = { qr: verOf(p), stamp: C.estado(p).stamp };
      const r = await Promise.all([C.front(p, S.cfg, o), C.back(p, S.cfg, o)]);
      if (tk !== S.token) return;
      S.cards = { id, front: r[0], back: r[1], name: slug(C.cardName(p)), title: C.fullName(p) };
      $("#img-front").src = r[0].toDataURL("image/png");
      $("#img-back").src = r[1].toDataURL("image/png");
    } catch (e) { handle(e); }
  }

  const RES = { activo: ["ok", "Activo"], vencido: ["bad", "Vencido"], inactivo: ["off", "Inactivo"] };

  function fmtFecha(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const p = n => String(n).padStart(2, "0");
    let h = d.getHours();
    const ap = h >= 12 ? "p. m." : "a. m.";
    h = h % 12 || 12;
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " · " + h + ":" + p(d.getMinutes()) + " " + ap;
  }

  function mapUrl(r) { return "https://www.google.com/maps?q=" + r.lat + "," + r.lng; }

  function lugarTxt(r) {
    if (r.ubicacion === "si") return r.lugar || (Number(r.lat).toFixed(5) + ", " + Number(r.lng).toFixed(5));
    if (r.ubicacion === "denegada") return "Sin ubicación (no se dio permiso)";
    return "Sin ubicación (no disponible)";
  }

  async function loadRegs(force) {
    if (S.regs && !force) { renderRegs(); return; }
    $("#rg-empty").hidden = false;
    $("#rg-list").hidden = true;
    $("#rg-empty-t").textContent = "Cargando registros…";
    try {
      S.regs = await api.query("registros", "fecha", 1000);
      S.regsAt = Date.now();
      renderRegs();
      if (S.view === "detalle") renderHist();
    } catch (e) {
      $("#rg-empty-t").textContent = "No se pudieron cargar los registros";
      $("#rg-empty-p").textContent = e && (e.http === 403 || e.status === "PERMISSION_DENIED") ? "Publica las reglas nuevas de la base de datos con firebase deploy." : "Revisa la conexión e intenta de nuevo.";
    }
  }

  function regsFiltered() {
    const per = $("#rg-per").value, res = $("#rg-res").value, q = norm($("#rg-q").value);
    const now = new Date();
    let desde = 0;
    if (per === "hoy") desde = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    else if (per !== "todo") desde = now.getTime() - Number(per) * 864e5;
    return (S.regs || []).filter(r => {
      if (desde && new Date(r.fecha).getTime() < desde) return false;
      if (res && r.resultado !== res) return false;
      if (q && !norm([r.nombre, r.cargo, r.lugar, C.tipoLabel(r.tipo)].join(" ")).includes(q)) return false;
      return true;
    });
  }

  function renderRegs() {
    const rows = regsFiltered();
    const fun = new Set(rows.map(r => r.v)).size;
    const conUb = rows.filter(r => r.ubicacion === "si").length;
    const alert = rows.filter(r => r.resultado !== "activo").length;
    $("#rg-stats").innerHTML = [[rows.length, "Presentaciones"], [fun, "Funcionarios"], [conUb, "Con ubicación"], [alert, "Vencidos o inactivos"]]
      .map(s => '<div class="stat"><b>' + s[0] + "</b><span>" + s[1] + "</span></div>").join("");
    if (!rows.length) {
      $("#rg-list").hidden = true;
      $("#rg-empty").hidden = false;
      $("#rg-empty-t").textContent = (S.regs || []).length ? "Sin registros en este filtro" : "Aún no hay presentaciones";
      $("#rg-empty-p").textContent = (S.regs || []).length ? "Cambia el periodo o la búsqueda." : "Aparecen aquí cuando alguien escanea el QR de un carnet.";
      return;
    }
    $("#rg-empty").hidden = true;
    $("#rg-list").hidden = false;
    $("#rg-list").innerHTML = rows.map(r => {
      const rs = RES[r.resultado] || ["nt", r.resultado];
      const lugar = r.ubicacion === "si"
        ? esc(lugarTxt(r)) + ' · <a href="' + esc(mapUrl(r)) + '" target="_blank" rel="noopener">Ver en mapa</a>' + (r.precision ? " (±" + esc(r.precision) + " m)" : "")
        : esc(lugarTxt(r));
      return '<div class="rg"><div><div class="rg-n">' + esc(r.nombre) + '</div><div class="rg-m">' + esc([C.tipoLabel(r.tipo), r.cargo].filter(Boolean).join(" · ")) +
        '</div><div class="rg-m">' + lugar + '</div></div><div class="rg-t">' + esc(fmtFecha(r.fecha)) + '<br><span class="pill ' + rs[0] + '">' + esc(rs[1]) + "</span></div></div>";
    }).join("");
  }

  function csvCell(v) {
    let s = String(v == null ? "" : v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportRegs() {
    const rows = regsFiltered();
    if (!rows.length) { toast("No hay registros para descargar."); return; }
    const head = ["Fecha", "Hora", "Funcionario", "Tipo", "Cargo", "Resultado", "Lugar", "Latitud", "Longitud", "Precisión (m)", "Mapa", "Dispositivo"];
    const lines = [head.join(";")].concat(rows.map(r => {
      const d = new Date(r.fecha), p = n => String(n).padStart(2, "0");
      return [p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(), p(d.getHours()) + ":" + p(d.getMinutes()), r.nombre, C.tipoLabel(r.tipo), r.cargo,
        (RES[r.resultado] || [0, r.resultado])[1], lugarTxt(r), r.lat == null ? "" : r.lat, r.lng == null ? "" : r.lng, r.precision || "",
        r.ubicacion === "si" ? mapUrl(r) : "", r.dispositivo || ""].map(csvCell).join(";");
    }));
    const n = new Date(), p = x => String(x).padStart(2, "0");
    saveBlob(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), "registro-presentaciones-" + n.getFullYear() + p(n.getMonth() + 1) + p(n.getDate()) + ".csv");
  }

  function renderHist() {
    const box = $("#det-hist"), p = S.people.find(x => x.id === S.sel);
    if (!box || !p) return;
    if (!S.regs) { box.innerHTML = "<p>Cargando…</p>"; return; }
    const vs = [p.vtoken].concat(p.vtokensPrev || []);
    const mine = S.regs.filter(r => vs.indexOf(r.v) >= 0);
    if (!mine.length) { box.innerHTML = "<p>Todavía no se ha presentado con su carnet.</p>"; return; }
    box.innerHTML = "<p>" + mine.length + (mine.length === 1 ? " presentación registrada." : " presentaciones registradas.") + "</p>" +
      mine.slice(0, 5).map(r => "<div><b>" + esc(fmtFecha(r.fecha)) + "</b> · " + (r.ubicacion === "si"
        ? esc(lugarTxt(r)) + ' · <a href="' + esc(mapUrl(r)) + '" target="_blank" rel="noopener">Ver en mapa</a>'
        : esc(lugarTxt(r))) + "</div>").join("");
  }

  function saveBlob(blob, name) {
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
  }

  function toBlob(c, type, q) { return new Promise(res => c.toBlob(res, type, q)); }

  async function download(kind) {
    const k = S.cards;
    if (!k || k.id !== S.sel) { toast("El carnet aún se está generando."); return; }
    try {
      if (kind === "frente" || kind === "reverso") {
        saveBlob(await toBlob(kind === "frente" ? k.front : k.back, "image/png"), "carnet-" + k.name + "-" + kind + ".png");
        return;
      }
      if (!window.jspdf || !window.jspdf.jsPDF) { toast("No se pudo cargar el generador de PDF."); return; }
      const J = window.jspdf.jsPDF, tj = kind === "tarjeta", cw = tj ? 90 : 61.2, ch = tj ? 125 : 85;
      const fi = k.front.toDataURL("image/jpeg", 0.95), bi = k.back.toDataURL("image/jpeg", 0.95);
      let doc;
      if (tj) {
        doc = new J({ unit: "mm", format: [cw, ch], orientation: "portrait" });
        doc.addImage(fi, "JPEG", 0, 0, cw, ch);
        doc.addPage([cw, ch], "portrait");
        doc.addImage(bi, "JPEG", 0, 0, cw, ch);
      } else {
        doc = new J({ unit: "mm", format: "letter", orientation: "portrait" });
        const gap = 14, x0 = (215.9 - (cw * 2 + gap)) / 2, y0 = 38;
        doc.setFontSize(10);
        doc.setTextColor(90);
        doc.text("Carnet · " + k.title + " · imprimir al 100 % (sin ajustar a la página)", x0, 24);
        [[fi, x0], [bi, x0 + cw + gap]].forEach(q => {
          doc.addImage(q[0], "JPEG", q[1], y0, cw, ch);
          doc.setDrawColor(120);
          doc.setLineWidth(0.15);
          [[q[1], y0], [q[1] + cw, y0], [q[1], y0 + ch], [q[1] + cw, y0 + ch]].forEach(m => {
            const dx = m[0] === q[1] ? -1 : 1, dy = m[1] === y0 ? -1 : 1;
            doc.line(m[0] + dx * 1.5, m[1], m[0] + dx * 6, m[1]);
            doc.line(m[0], m[1] + dy * 1.5, m[0], m[1] + dy * 6);
          });
        });
        doc.setFontSize(8);
        doc.text("Frente", x0, y0 + ch + 10);
        doc.text("Reverso", x0 + cw + gap, y0 + ch + 10);
      }
      saveBlob(doc.output("blob"), "carnet-" + k.name + (tj ? "-ambas-caras" : "-carta") + ".pdf");
    } catch (e) { toast("No se pudo generar el archivo."); }
  }

  function ask(text, fn) {
    $("#confirm-t").textContent = text;
    $("#confirm").hidden = false;
    confirmFn = fn;
    $("#confirm").scrollIntoView({ block: "nearest" });
  }

  async function toggleActivo() {
    const p = await ensureFull(S.sel);
    if (!p) return;
    const full = strip(p);
    full.activo = p.activo === false;
    full.actualizado = new Date().toISOString();
    await api.commit([
      { set: "funcionarios/" + p.id, data: full },
      { set: "carnets/" + full.carnetId, data: pubCarnet(full) },
      { set: "verificacion/" + full.vtoken, data: pubVerif(full) }
    ], { accion: full.activo ? "reactivar" : "desactivar", funcionario: p.id, nombre: C.fullName(full) });
    putLocal(Object.assign({ id: p.id, full: true }, full));
    toast(full.activo ? "Carnet reactivado" : "Carnet desactivado");
    renderAll();
    await paint(p.id);
  }

  async function newLink() {
    const p = await ensureFull(S.sel);
    if (!p) return;
    const full = strip(p);
    const old = full.carnetId, oldV = full.vtoken;
    full.token = api.rnd(24);
    full.vtoken = api.rnd(16);
    full.vtokensPrev = (full.vtokensPrev || []).concat(oldV ? [oldV] : []).slice(-20);
    full.carnetId = await api.carnetId(full.token, full.numDoc);
    full.actualizado = new Date().toISOString();
    const ops = [
      { set: "funcionarios/" + p.id, data: full },
      { set: "carnets/" + full.carnetId, data: pubCarnet(full) },
      { set: "verificacion/" + full.vtoken, data: pubVerif(full) },
      { del: "carnets/" + old }
    ];
    if (oldV) ops.push({ del: "verificacion/" + oldV });
    await api.commit(ops, { accion: "nuevo_enlace_qr", funcionario: p.id, nombre: C.fullName(full) });
    putLocal(Object.assign({ id: p.id, full: true }, full));
    toast("Enlace, QR de instalación y QR del carnet nuevos. Los anteriores ya no sirven.");
    await paint(p.id);
  }

  function qrMatrix(text) {
    if (typeof qrcode !== "function") return null;
    if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs["UTF-8"]) qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    return q;
  }

  function paintQR(x, q, a, b, size) {
    const n = q.getModuleCount(), cell = size / n;
    x.fillStyle = "#000000";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(a + c * cell, b + r * cell, cell + 0.5, cell + 0.5);
  }

  function drawInstallQR(url) {
    const c = $("#qr-install"), x = c.getContext("2d"), q = qrMatrix(url);
    x.fillStyle = "#FFFFFF";
    x.fillRect(0, 0, c.width, c.height);
    if (q) paintQR(x, q, 16, 16, c.width - 32);
  }

  async function downloadInstallQR() {
    const p = S.people.find(x => x.id === S.sel);
    if (!p) return;
    const q = qrMatrix(linkOf(p));
    if (!q) { toast("No se pudo generar el QR."); return; }
    const W = 1080, H = 1500, c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d");
    x.fillStyle = "#FFFFFF";
    x.fillRect(0, 0, W, H);
    try {
      const ban = await C.loadImg("/assets/banner.jpg");
      x.drawImage(ban, 0, 0, W, Math.round(W * ban.naturalHeight / ban.naturalWidth));
    } catch (e) {
      x.fillStyle = "#04214D";
      x.fillRect(0, 0, W, 222);
    }
    x.textAlign = "center";
    x.fillStyle = "#0B1730";
    x.font = "800 52px Montserrat, Arial, sans-serif";
    x.fillText("Tu carnet virtual", W / 2, 330);
    x.font = "600 40px Montserrat, Arial, sans-serif";
    x.fillStyle = "#0C3472";
    x.fillText(C.cardName(p).toUpperCase(), W / 2, 395);
    paintQR(x, q, 190, 450, 700);
    x.fillStyle = "#0B1730";
    x.font = "600 38px Montserrat, Arial, sans-serif";
    x.fillText("Escanéalo con la cámara del celular", W / 2, 1230);
    x.font = "400 32px Montserrat, Arial, sans-serif";
    x.fillStyle = "#3A4763";
    x.fillText("Escribe tu número de documento", W / 2, 1290);
    x.fillText("e instálalo en tu pantalla de inicio.", W / 2, 1335);
    x.fillText("En iPhone: Safari → Compartir → Agregar a inicio.", W / 2, 1400);
    c.toBlob(b => saveBlob(b, "qr-carnet-" + slug(C.cardName(p)) + ".png"), "image/png");
  }

  async function migrar(ev) {
    ev.preventDefault();
    const b = $("#mig-run");
    b.disabled = true;
    let n = 0;
    try {
      for (const q of S.people.slice()) {
        const p = await ensureFull(q.id);
        if (!p || !p.carnetId || !p.vtoken) continue;
        const full = strip(p);
        await api.commit([
          { set: "carnets/" + full.carnetId, data: pubCarnet(full) },
          { set: "verificacion/" + full.vtoken, data: pubVerif(full) }
        ]);
        n++;
        b.textContent = "Actualizando… " + n + " de " + S.people.length;
      }
      await api.commit([], { accion: "republicar_carnets", total: n });
      toast(n + " carnets actualizados");
    } catch (e) { handle(e); }
    b.textContent = "Actualizar carnets publicados";
    b.disabled = false;
  }

  async function removeSel() {
    const p = await ensureFull(S.sel);
    if (!p) return;
    const vs = [p.vtoken].concat(p.vtokensPrev || []).filter(Boolean);
    let regs = [];
    for (const v of vs) regs = regs.concat(await api.queryEq("registros", "v", v, 500));
    const ops = [{ del: "funcionarios/" + p.id }, { del: "carnets/" + p.carnetId }, { del: "verificacion/" + p.vtoken }].concat(regs.map(r => ({ del: "registros/" + r.id })));
    for (let i = 0; i < ops.length; i += 400) {
      const last = i + 400 >= ops.length;
      await api.commit(ops.slice(i, i + 400), last ? { accion: "eliminar", funcionario: p.id, nombre: C.fullName(p), registrosBorrados: regs.length } : undefined);
    }
    if (S.regs) S.regs = S.regs.filter(r => vs.indexOf(r.v) < 0);
    S.people = S.people.filter(x => x.id !== p.id);
    toast("Funcionario eliminado");
    renderAll();
    show("lista");
  }

  async function copyText(text, input) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copiado");
    } catch (e) {
      if (input) { input.focus(); input.select(); }
      toast("Selecciona el texto y cópialo.");
    }
  }

  function bind() {
    document.addEventListener("click", ev => {
      const g = ev.target.closest("[data-go]");
      if (g) { go(g.dataset.go); return; }
      const r = ev.target.closest(".row");
      if (r) { openDetail(r.dataset.id); return; }
      const f = ev.target.closest("[data-filter]");
      if (f) { S.filter = f.dataset.filter; renderChips(); renderList(); return; }
      const d = ev.target.closest("[data-dl]");
      if (d) { download(d.dataset.dl); return; }
    });
    $("#g-login").addEventListener("submit", submitLogin);
    $("#v-send").addEventListener("click", async () => {
      msg("#v-err", "");
      try {
        await api.sendVerify();
        msg("#v-info", "Te enviamos el enlace. Ábrelo desde tu correo y luego toca «Ya lo verifiqué».");
      } catch (e) { msg("#v-err", e && e.offline ? "Sin conexión a internet." : /TOO_MANY/.test((e && e.reason) || "") ? "Demasiados intentos. Espera unos minutos." : "No se pudo enviar el correo. Intenta de nuevo."); }
    });
    $("#v-done").addEventListener("click", async () => {
      msg("#v-err", "");
      try {
        if (await api.checkVerified()) enter();
        else msg("#v-err", "Todavía no aparece verificado. Abre el enlace del correo y vuelve a intentarlo.");
      } catch (e) { if (e && e.http === 401) toLogin("Tu sesión venció. Entra de nuevo."); else msg("#v-err", "No se pudo comprobar. Intenta de nuevo."); }
    });
    $("#v-out").addEventListener("click", () => toLogin(""));
    $("#mig").addEventListener("submit", migrar);
    $("#salir").addEventListener("click", () => { S.people = []; toLogin(""); });
    $("#l-reset").addEventListener("click", async () => {
      msg("#l-err", "");
      try {
        const mail = $("#l-mail").value.trim().toLowerCase();
        if (!api.isAdmin(mail)) { msg("#l-err", "Escribe primero el correo de administrador."); return; }
        await api.resetPassword(mail);
        msg("#l-info", "Te enviamos un correo a " + mail + " para cambiar la contraseña.");
      } catch (e) {
        msg("#l-err", e.offline ? "Sin conexión a internet." : "No se pudo enviar el correo. Intenta de nuevo.");
      }
    });
    $("#g-retry").addEventListener("click", enter);
    $("#q").addEventListener("input", ev => { S.q = ev.target.value; renderList(); });
    $("#form").addEventListener("submit", submitForm);
    $("#cfg").addEventListener("submit", submitCfg);
    $("#tipo-pr").addEventListener("change", setTipoFields);
    $("#tipo-ct").addEventListener("change", setTipoFields);
    $("#tipo-fp").addEventListener("change", setTipoFields);
    $("#f-codigo").addEventListener("input", ev => { ev.target.dataset.touched = "1"; });
    $("#f-nombrecarnet").addEventListener("input", ev => {
      if (ev.target.value.trim()) ev.target.dataset.touched = "1";
      else delete ev.target.dataset.touched;
    });
    const autoName = () => {
      const nc = $("#f-nombrecarnet");
      if (!nc.dataset.touched) nc.value = C.shortName($("#f-nombres").value, $("#f-apellidos").value);
    };
    $("#f-nombres").addEventListener("input", autoName);
    $("#f-apellidos").addEventListener("input", autoName);
    $("#f-foto").addEventListener("change", pickFoto);
    $("#f-fondo").addEventListener("change", fondoExistente);
    $("#f-foto").addEventListener("click", () => { if (window.FondoBlanco && $("#f-fondo").checked) window.FondoBlanco.precargar(); });
    $("#foto-quitar").addEventListener("click", () => { $("#f-foto").value = ""; setFoto("", ""); });
    $("#link-copy").addEventListener("click", () => copyText($("#link-url").value, $("#link-url")));
    $("#qr-dl").addEventListener("click", downloadInstallQR);
    $("#rg-reload").addEventListener("click", () => loadRegs(true));
    $("#rg-csv").addEventListener("click", exportRegs);
    $("#rg-q").addEventListener("input", renderRegs);
    $("#rg-per").addEventListener("change", renderRegs);
    $("#rg-res").addEventListener("change", renderRegs);
    $("#det-edit").addEventListener("click", async () => {
      try {
        const p = await ensureFull(S.sel);
        if (p) openForm(p.id);
      } catch (e) { handle(e); }
    });
    $("#det-toggle").addEventListener("click", () => {
      const p = S.people.find(x => x.id === S.sel);
      if (!p) return;
      if (p.activo === false) ask("¿Reactivar el carnet de " + C.fullName(p) + "?", toggleActivo);
      else ask("¿Desactivar el carnet de " + C.fullName(p) + "? En su celular y al escanear el QR aparecerá como inactivo.", toggleActivo);
    });
    $("#det-link").addEventListener("click", () => {
      ask("¿Generar enlace y QR nuevos? El enlace, el QR de instalación y el QR del carnet anteriores dejan de funcionar; el funcionario debe abrir el enlace nuevo.", newLink);
    });
    $("#det-del").addEventListener("click", () => {
      const p = S.people.find(x => x.id === S.sel);
      ask("¿Eliminar a " + (p ? C.fullName(p) : "este funcionario") + "? Su carnet deja de funcionar y se borran sus datos y sus registros de presentación. No se puede deshacer.", removeSel);
    });
    $("#confirm-no").addEventListener("click", () => { $("#confirm").hidden = true; confirmFn = null; });
    $("#confirm-si").addEventListener("click", async () => {
      const fn = confirmFn, b = $("#confirm-si");
      if (!fn) return;
      b.disabled = true;
      try {
        await fn();
        $("#confirm").hidden = true;
        confirmFn = null;
      } catch (e) { handle(e); }
      b.disabled = false;
    });
  }

  bind();
  try { $("#l-mail").value = localStorage.getItem("carnets.ultimo") || api.adminEmail; } catch (e) { $("#l-mail").value = api.adminEmail; }
  if (!api.configured) gate("config");
  else if (!api.session()) gate("login");
  else enter();
})();
