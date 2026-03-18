import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'node_modules/onnxruntime-web/dist');
const destDir = path.join(process.cwd(), 'node_modules/@xenova/transformers/dist');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    if (file.endsWith('.wasm') || file.endsWith('.mjs')) {
      const srcFile = path.join(srcDir, file);
      const destFile = path.join(destDir, file);
      fs.copyFileSync(srcFile, destFile);
      console.log(`Copied ${file} to @xenova/transformers/dist/`);
    }
  }
} else {
  console.log('Source directory onnxruntime-web/dist not found, skipping copy.');
}
