const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const nm = path.join(root, "node_modules");
const dst = path.join(root, "public", "assets");
const copiar = (de, a) => {
  fs.mkdirSync(path.dirname(a), { recursive: true });
  fs.copyFileSync(path.join(nm, de), path.join(dst, a));
  console.log(de, "->", "public/assets/" + a);
};
copiar("jspdf/dist/jspdf.umd.min.js", "jspdf.umd.min.js");
copiar("qrcode-generator/dist/qrcode.js", "qrcode.js");
const ms = "@mediapipe/selfie_segmentation";
[
  "selfie_segmentation.js",
  "selfie_segmentation.binarypb",
  "selfie_segmentation.tflite",
  "selfie_segmentation_solution_simd_wasm_bin.js",
  "selfie_segmentation_solution_simd_wasm_bin.wasm",
  "selfie_segmentation_solution_simd_wasm_bin.data",
  "selfie_segmentation_solution_wasm_bin.js",
  "selfie_segmentation_solution_wasm_bin.wasm"
].forEach(f => copiar(ms + "/" + f, "fondo/" + f));
