(function () {
  const C = window.CARNET_CONFIG || {};
  const FS = (C.firestoreHost || "https://firestore.googleapis.com") + "/v1/";
  const ROOT = "projects/" + C.projectId + "/databases/(default)/documents";
  const AUTH = (C.authHost || "https://identitytoolkit.googleapis.com") + "/v1/";
  const TOK = (C.tokenHost || "https://securetoken.googleapis.com") + "/v1/token";
  const MAX_SES = 8 * 3600 * 1000;
  const SK = "carnets.sesion";
  const configured = !!C.apiKey && !!C.projectId && !/PEGA_AQUI/.test(C.apiKey + C.projectId);
  const adminEmail = String(C.adminEmail || "").trim().toLowerCase();
  const adminEmails = [adminEmail].concat(C.adminEmails || []).map(e => String(e || "").trim().toLowerCase()).filter((e, i, a) => e && a.indexOf(e) === i);
  const isAdmin = e => adminEmails.indexOf(String(e || "").trim().toLowerCase()) >= 0;
  let ses = null;
  let refreshing = null;

  try { localStorage.removeItem(SK); } catch (e) {}
  try { ses = JSON.parse(sessionStorage.getItem(SK) || "null"); } catch (e) { ses = null; }
  if (ses && !(ses.inicio && Date.now() - ses.inicio < MAX_SES)) ses = null;

  function saveSes() {
    try {
      if (ses) sessionStorage.setItem(SK, JSON.stringify(ses));
      else sessionStorage.removeItem(SK);
    } catch (e) {}
  }

  function claims(tok) {
    try {
      const b = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(b + "===".slice((b.length + 3) % 4)))));
    } catch (e) { return {}; }
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

  function vencida() {
    if (ses && Date.now() - (ses.inicio || 0) >= MAX_SES) { ses = null; saveSes(); }
    return !ses;
  }

  async function refresh() {
    const j = await call("POST", TOK + "?key=" + encodeURIComponent(C.apiKey),
      "grant_type=refresh_token&refresh_token=" + encodeURIComponent(ses.refreshToken),
      { "Content-Type": "application/x-www-form-urlencoded" });
    ses.idToken = j.id_token;
    ses.refreshToken = j.refresh_token;
    ses.exp = Date.now() + Number(j.expires_in) * 1000;
    ses.verificado = claims(ses.idToken).email_verified === true;
    saveSes();
  }

  async function idToken(force) {
    if (vencida()) {
      const e = new Error("Sin sesión");
      e.http = 401;
      throw e;
    }
    if (!force && Date.now() < ses.exp - 60000) return ses.idToken;
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
    ses = { idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + Number(j.expiresIn) * 1000, uid: j.localId, email: j.email, inicio: Date.now(), verificado: claims(j.idToken).email_verified === true };
    saveSes();
    return ses;
  }

  function signOut() { ses = null; saveSes(); }

  async function sendVerify() {
    const tok = await idToken();
    return call("POST", AUTH + "accounts:sendOobCode?key=" + encodeURIComponent(C.apiKey),
      JSON.stringify({ requestType: "VERIFY_EMAIL", idToken: tok }), { "Content-Type": "application/json" });
  }

  async function checkVerified() {
    await idToken(true);
    return !!(ses && ses.verificado);
  }

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

  async function commit(ops, log) {
    const writes = ops.map(o => o.del
      ? { delete: ROOT + "/" + o.del }
      : { update: { name: ROOT + "/" + o.set, fields: encFields(o.data) } });
    if (log) {
      writes.push({
        update: { name: ROOT + "/bitacora/" + rnd(20), fields: encFields(Object.assign({ usuario: ses ? ses.email : "" }, log)) },
        currentDocument: { exists: false },
        updateTransforms: [{ fieldPath: "fecha", setToServerValue: "REQUEST_TIME" }]
      });
    }
    return fs("POST", ROOT + ":commit", { writes }, true);
  }

  async function getMany(paths, auth) {
    const j = await fs("POST", ROOT + ":batchGet", { documents: paths.map(p => ROOT + "/" + p) }, auth);
    const out = {};
    let readTime = "";
    (j || []).forEach(x => {
      if (x.readTime && !readTime) readTime = x.readTime;
      if (x.found) out[x.found.name.split("/documents/")[1]] = decDoc(x.found);
      else if (x.missing) out[x.missing.split("/documents/")[1]] = null;
    });
    return { docs: out, time: readTime ? Date.parse(readTime) : 0 };
  }

  async function queryEq(col, field, value, limit) {
    const body = { structuredQuery: { from: [{ collectionId: col }], where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: enc(value) } }, limit: limit || 500 } };
    const j = await fs("POST", ROOT + ":runQuery", body, true);
    return (j || []).filter(x => x.document).map(x => decDoc(x.document));
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
    signIn, signOut, resetPassword, sendVerify, checkVerified, get, getMany, list, commit, addPublic, query, queryEq, rnd, sha, normDoc, carnetId
  };
})();
