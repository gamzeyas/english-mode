// Regenerates PWA PNG icons from the SVG sources: `node scripts/generate-icons.mjs`
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = new URL("../public/manifest-assets/", import.meta.url);
const icon = await readFile(new URL("icon.svg", dir));
const maskable = await readFile(new URL("icon-maskable.svg", dir));

const outputs = [
  [icon, 192, "icon-192.png"],
  [icon, 512, "icon-512.png"],
  [maskable, 512, "icon-maskable-512.png"],
  [maskable, 180, "apple-touch-icon.png"],
];

for (const [svg, size, name] of outputs) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(name, dir)));
  console.log(`wrote ${name}`);
}
