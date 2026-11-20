// MapLibre 6 runs tile parsing in a module web worker that the bundler doesn't
// emit. Copy the worker (and the shared chunk it imports) into public/ so it's
// served at /maplibre/, and point MapLibre at it with setWorkerUrl().
// Runs before `dev` and `build` (npm pre-scripts), so Vercel builds get it too.
import fs from "node:fs";
import path from "node:path";

const src = path.join("node_modules", "maplibre-gl", "dist");
const dest = path.join("public", "maplibre");
fs.mkdirSync(dest, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
}
console.log("copied MapLibre worker to public/maplibre");
