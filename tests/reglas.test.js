const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { initializeTestEnvironment, assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp, updateDoc } = require("firebase/firestore");

const ADMIN = { email: "comunicaciones@edumas.gov.co", email_verified: true };
const casos = [];
const caso = (n, f) => casos.push([n, f]);

caso("admin verificado lee funcionarios", async env => {
  await assertSucceeds(getDoc(doc(env.authenticatedContext("a", ADMIN).firestore(), "funcionarios/x")));
});
caso("admin sin correo verificado no puede", async env => {
  const db = env.authenticatedContext("a", { email: ADMIN.email, email_verified: false }).firestore();
  await assertFails(getDoc(doc(db, "funcionarios/x")));
});
caso("otro correo no puede", async env => {
  const db = env.authenticatedContext("b", { email: "x@gmail.com", email_verified: true }).firestore();
  await assertFails(setDoc(doc(db, "carnets/x"), { a: 1 }));
});
caso("anónimo lee carnet por id y no lista", async env => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, "carnets/x")));
  await assertFails(getDocs(collection(db, "carnets")));
});
caso("registro válido", async env => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(db, "registros/r1"), { v: "V1", nombre: "Ana Pérez", tipo: "practicante", cargo: "", resultado: "activo", fecha: serverTimestamp(), ubicacion: "si", lat: 10.9, lng: -74.7, precision: 20, dispositivo: "Android" }));
});
caso("registro con nombre falso", async env => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "registros/r2"), { v: "V1", nombre: "Otro", resultado: "activo", fecha: serverTimestamp(), ubicacion: "no_disponible" }));
});
caso("registro con coordenadas fuera de rango", async env => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "registros/r3"), { v: "V1", nombre: "Ana Pérez", resultado: "activo", fecha: serverTimestamp(), ubicacion: "si", lat: 500, lng: 0 }));
});
caso("registro con fecha del cliente", async env => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "registros/r4"), { v: "V1", nombre: "Ana Pérez", resultado: "activo", fecha: new Date(), ubicacion: "no_disponible" }));
});
caso("registro no se puede editar", async env => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "registros/r5"), { v: "V1", nombre: "Ana Pérez" }));
  await assertFails(updateDoc(doc(env.unauthenticatedContext().firestore(), "registros/r5"), { nombre: "X" }));
});
caso("bitácora: admin crea con su correo y no puede borrar", async env => {
  const db = env.authenticatedContext("a", ADMIN).firestore();
  await assertSucceeds(setDoc(doc(db, "bitacora/b1"), { usuario: ADMIN.email, accion: "crear", fecha: serverTimestamp() }));
  await assertFails(setDoc(doc(db, "bitacora/b2"), { usuario: "otro@x.com", accion: "crear", fecha: serverTimestamp() }));
  await assertFails(deleteDoc(doc(db, "bitacora/b1")));
});

(async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-carnet-edumas",
    firestore: { rules: fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8") }
  });
  let fallas = 0;
  for (const [n, f] of casos) {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "verificacion/V1"), { nombre: "Ana Pérez", activo: true }));
    try { await f(env); console.log("OK   " + n); }
    catch (e) { fallas++; console.log("FALLA " + n + ": " + e.message); }
  }
  await env.cleanup();
  assert.strictEqual(fallas, 0, fallas + " prueba(s) fallaron");
})().catch(e => { console.error(e.message); process.exit(1); });
