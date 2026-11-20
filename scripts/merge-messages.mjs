// Deep-merges a JSON fragment into messages/he.json (dev helper).
// Usage: node scripts/merge-messages.mjs <fragment.json>
import fs from "node:fs";

const target = "messages/he.json";
const base = JSON.parse(fs.readFileSync(target, "utf8"));
const patch = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

function merge(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object") merge(a[k], v);
    else a[k] = v;
  }
  return a;
}

fs.writeFileSync(target, JSON.stringify(merge(base, patch), null, 2) + "\n");
console.log("merged", Object.keys(patch).join(", "));
