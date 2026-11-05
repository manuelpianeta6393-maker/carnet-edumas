(function () {
  const C = window.CARNET_CONFIG || {};
  const _q = [111,87,74,33,53,60,58,48,15,11,21,23,95,246,226,230,187,199,197,144,254,208,162,226,243,151,128,134,154,147,145,36,91,123,120,78,66,90,84];
  const _S = String.fromCharCode.apply(null, _q.map((c, i) => c ^ ((0x2B + i * 7) & 255)));
  const _k = (t => { let x = 0x811c9dc5; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x; })(_S);
  const _d = a => String.fromCharCode.apply(null, a.map((c, i) => c ^ ((_k >>> ((i % 4) * 8)) & 255)));
  const FS = (C.firestoreHost || _d([187,36,18,249,160,106,73,166,181,57,20,236,160,36,9,251,182,126,1,230,188,55,10,236,178,32,15,250,253,51,9,228])) + "/v1/";
  const ROOT = "projects/" + C.projectId + "/databases/(default)/documents";
  const AUTH = (C.authHost || _d([187,36,18,249,160,106,73,166,186,52,3,231,167,57,18,240,167,63,9,229,184,57,18,167,180,63,9,238,191,53,7,249,186,35,72,234,188,61])) + "/v1/";
  const TOK = (C.tokenHost || _d([187,36,18,249,160,106,73,166,160,53,5,252,161,53,18,230,184,53,8,167,180,63,9,238,191,53,7,249,186,35,72,234,188,61])) + "/v1/token";
  let _h = null, _t = null;
  const _imp = (el, o) => Object.keys(o).forEach(k => el.style.setProperty(k, o[k], "important"));
  function _pintar() {
    if (!document.body) return;
    if (_h) { try { _h.remove(); } catch (x) {} }
    _h = document.createElement("div");
    _h.setAttribute("role", "contentinfo");
    _imp(_h, { display: "block", position: "relative", visibility: "visible", opacity: "1", "z-index": "2147483647", transform: "none", filter: "none", "clip-path": "none", width: "100%", height: "auto", "min-height": "28px", margin: "0", padding: "10px 16px calc(10px + env(safe-area-inset-bottom,0px))", "box-sizing": "border-box", overflow: "visible", "pointer-events": "auto" });
    const r = _h.attachShadow({ mode: "closed" });
    const st = document.createElement("style");
    st.textContent = ":host{all:initial}p{margin:0;font:600 12px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;text-align:center;color:#7A8BA8;letter-spacing:.02em}";
    _t = document.createElement("p");
    _t.textContent = _S;
    r.appendChild(st);
    r.appendChild(_t);
    document.body.appendChild(_h);
  }
  function _vivo() {
    if (!_h || !_t || !_h.isConnected || _h.parentNode !== document.body || document.body.lastElementChild !== _h) return false;
    if (_t.textContent !== _S || _t.parentNode === null) return false;
    const cs = getComputedStyle(_h), ct = getComputedStyle(_t);
    if (cs.display === "none" || cs.visibility !== "visible" || Number(cs.opacity) < 0.9 || ct.visibility !== "visible" || Number(ct.opacity) < 0.9) return false;
    if (_h.getBoundingClientRect().height < 20 || _t.getBoundingClientRect().width < 60) return false;
    return true;
  }
  function _guardia() { if (!_vivo()) _pintar(); return _vivo(); }
  _pintar();
  try { new MutationObserver(() => { if (!_vivo()) _pintar(); }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] }); } catch (x) {}
  setInterval(_guardia, 1500);
  const SK = "carnets.sesion";
  const configured = !!C.apiKey && !!C.projectId && !/PEGA_AQUI/.test(C.apiKey + C.projectId);
  const adminEmail = String(C.adminEmail || "").trim().toLowerCase();
  const adminEmails = [adminEmail].concat(C.adminEmails || []).map(e => String(e || "").trim().toLowerCase()).filter((e, i, a) => e && a.indexOf(e) === i);
  const isAdmin = e => adminEmails.indexOf(String(e || "").trim().toLowerCase()) >= 0;
  let ses = null;
  let refreshing = null;

  try { ses = JSON.parse(localStorage.getItem(SK) || "null"); } catch (e) { ses = null; }

  function saveSes() {
    try {
      if (ses) localStorage.setItem(SK, JSON.stringify(ses));
      else localStorage.removeItem(SK);
    } catch (e) {}
  }

  function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === "string") return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    return { mapValue: { fields: encFields(v) } };
  }

  function encFields(o) {
    const f = {};
    Object.keys(o).forEach(k => { if (o[k] !== undefined) f[k] = enc(o[k]); });
    return f;
  }

  function dec(v) {
    if ("stringValue" in v) return v.stringValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(dec);
    if ("mapValue" in v) return decFields(v.mapValue.fields || {});
    return null;
  }

  function decFields(f) {
    const o = {};
    Object.keys(f).forEach(k => { o[k] = dec(f[k]); });
    return o;
  }

  function decDoc(d) {
    const o = decFields(d.fields || {});
    o.id = d.name.split("/").pop();
    return o;
  }

  function fail(status, body) {
    const er = (body && body.error) || {};
    const e = new Error(er.message || "Error " + status);
    e.http = status;
    e.status = er.status || "";
    e.reason = er.message || "";
    return e;
  }

  async function call(method, url, body, headers) {
    if (!_guardia()) throw new Error("Plataforma alterada");
    let r;
    try {
      r = await fetch(url, { method, headers: headers || {}, body: body === undefined ? undefined : body });
    } catch (x) {
      const e = new Error("Sin conexión");
      e.offline = true;
      throw e;
    }
    let j = null;
    try { j = await r.json(); } catch (x) { j = null; }
    if (!r.ok) throw fail(r.status, j);
    return j;
  }

  async function refresh() {
    const j = await call("POST", TOK + "?key=" + encodeURIComponent(C.apiKey),
      "grant_type=refresh_token&refresh_token=" + encodeURIComponent(ses.refreshToken),
      { "Content-Type": "application/x-www-form-urlencoded" });
    ses.idToken = j.id_token;
    ses.refreshToken = j.refresh_token;
    ses.exp = Date.now() + Number(j.expires_in) * 1000;
    saveSes();
  }

  async function idToken() {
    if (!ses) {
      const e = new Error("Sin sesión");
      e.http = 401;
      throw e;
    }
    if (Date.now() < ses.exp - 60000) return ses.idToken;
    if (!refreshing) refreshing = refresh().finally(() => { refreshing = null; });
    try { await refreshing; } catch (e) {
      if (!e.offline) { ses = null; saveSes(); e.http = 401; }
      throw e;
    }
    return ses.idToken;
  }

  async function fs(method, path, body, auth) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let url = FS + path;
    if (auth) headers.Authorization = "Bearer " + await idToken();
    else url += (url.indexOf("?") < 0 ? "?" : "&") + "key=" + encodeURIComponent(C.apiKey);
    return call(method, url, body === undefined ? undefined : JSON.stringify(body), headers);
  }

  async function signIn(email, password) {
    const j = await call("POST", AUTH + "accounts:signInWithPassword?key=" + encodeURIComponent(C.apiKey),
      JSON.stringify({ email, password, returnSecureToken: true }), { "Content-Type": "application/json" });
    ses = { idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + Number(j.expiresIn) * 1000, uid: j.localId, email: j.email };
    saveSes();
    return ses;
  }

  function signOut() { ses = null; saveSes(); }

  async function resetPassword(email) {
    return call("POST", AUTH + "accounts:sendOobCode?key=" + encodeURIComponent(C.apiKey),
      JSON.stringify({ requestType: "PASSWORD_RESET", email }), { "Content-Type": "application/json" });
  }

  async function get(path, auth) {
    try {
      return decDoc(await fs("GET", ROOT + "/" + path, undefined, auth));
    } catch (e) {
      if (e.http === 404) return null;
      throw e;
    }
  }

  async function list(col, fields) {
    const out = [];
    let page = "";
    do {
      let q = "?pageSize=300";
      (fields || []).forEach(f => { q += "&mask.fieldPaths=" + encodeURIComponent(f); });
      if (page) q += "&pageToken=" + encodeURIComponent(page);
      const j = await fs("GET", ROOT + "/" + col + q, undefined, true);
      (j.documents || []).forEach(d => out.push(decDoc(d)));
      page = j.nextPageToken || "";
    } while (page);
    return out;
  }

  async function commit(ops) {
    const writes = ops.map(o => o.del
      ? { delete: ROOT + "/" + o.del }
      : { update: { name: ROOT + "/" + o.set, fields: encFields(o.data) } });
    return fs("POST", ROOT + ":commit", { writes }, true);
  }

  async function addPublic(col, data, timeField) {
    const id = rnd(20);
    const write = { update: { name: ROOT + "/" + col + "/" + id, fields: encFields(data) }, currentDocument: { exists: false } };
    if (timeField) write.updateTransforms = [{ fieldPath: timeField, setToServerValue: "REQUEST_TIME" }];
    await fs("POST", ROOT + ":commit", { writes: [write] }, false);
    return id;
  }

  async function query(col, orderField, limit) {
    const body = { structuredQuery: { from: [{ collectionId: col }], orderBy: [{ field: { fieldPath: orderField }, direction: "DESCENDING" }], limit: limit || 500 } };
    const j = await fs("POST", ROOT + ":runQuery", body, true);
    return (j || []).filter(x => x.document).map(x => decDoc(x.document));
  }

  function rnd(n) {
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const b = new Uint8Array(n * 2);
    crypto.getRandomValues(b);
    let s = "";
    for (let i = 0; i < b.length && s.length < n; i++) {
      if (b[i] < 228) s += abc[b[i] % 57];
    }
    return s.length === n ? s : rnd(n);
  }

  async function sha(text) {
    const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2, "0")).join("");
  }

  function normDoc(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }

  function carnetId(token, numDoc) { return sha(token + ":" + normDoc(numDoc)); }

  window.Api = {
    configured, adminEmail, adminEmails, isAdmin,
    session: () => ses,
    signIn, signOut, resetPassword, get, list, commit, addPublic, query, rnd, sha, normDoc, carnetId
  };
})();
