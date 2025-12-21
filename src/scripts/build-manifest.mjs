// Node 18+ (ESM). Scans src/assets/seat-images and writes src/assets/manifest.json
import { promises as fs } from "node:fs";
import path from "node:path";

const BASE_DIR = path.resolve("src/assets/seat-images");
const OUT_FILE = path.resolve("src/assets/manifest.json");
const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

async function walk(dir, rel = "") {
  const out = {};
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const it of items) {
    if (it.name.startsWith(".")) continue;
    const abs = path.join(dir, it.name);
    const relPath = path.join(rel, it.name);
    if (it.isDirectory()) {
      const sub = await walk(abs, relPath);
      for (const [k, v] of Object.entries(sub)) out[k] = v;
    } else {
      const ext = path.extname(it.name).toLowerCase();
      if (IMG_EXT.has(ext)) {
        const key = path.dirname(relPath); // folder key
        out[key] ||= [];
        out[key].push(it.name);
      }
    }
  }
  return out;
}

const data = await walk(BASE_DIR);
await fs.writeFile(OUT_FILE, JSON.stringify(data, null, 2));
console.log(`Manifest written: ${OUT_FILE} (${Object.keys(data).length} folders)`);
