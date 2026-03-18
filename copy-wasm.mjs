import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'node_modules/onnxruntime-web/dist');
const destDir = path.join(process.cwd(), 'node_modules/@xenova/transformers/dist');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Only copy the WASM backends we actually need for the serverless function.
// We DO NOT need WebGL, WebGPU, or Multi-threaded binaries in Lambda (Lambda is single threaded).
// Keeping only the basic SIMD and non-SIMD standard cpu WASM modules.
const REQUIRED_EXACT_FILES = [
  'ort-wasm.wasm', 'ort-wasm.mjs',
  'ort-wasm-simd.wasm', 'ort-wasm-simd.mjs'
];

if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    if (REQUIRED_EXACT_FILES.includes(file)) {
      const srcFile = path.join(srcDir, file);
      const destFile = path.join(destDir, file);
      fs.copyFileSync(srcFile, destFile);
      console.log(`Copied ${file} to @xenova/transformers/dist/`);
    } else {
      // Force-delete any unused massive binaries (WebGL, WebGPU, full bundles)
      // before Netlify's esbuild zips node_modules. This solves the 250MB hard limit.
      const srcFile = path.join(srcDir, file);
      fs.rmSync(srcFile, { force: true });
      console.log(`Deleted unused massive binary: ${file} to save Lambda size`);
    }
  }
} else {
  console.log('Source directory onnxruntime-web/dist not found, skipping copy.');
}
