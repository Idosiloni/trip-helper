// Google My Maps export (KML, or KMZ = zip with doc.kml) → points.
// Runs in the browser; nothing is uploaded (SPEC 8.3).
import { unzipSync, strFromU8 } from "fflate";

export type KmlPoint = { name: string; description: string | null; lat: number; lng: number; layer: string | null };

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").trim();
}

/** Strips the HTML My Maps puts in descriptions ("<br>", images). */
function plain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function byTag(root: Element | Document, tag: string): Element[] {
  // KML is namespaced; match by local name so both kml:Placemark and Placemark work.
  return Array.from(root.getElementsByTagNameNS("*", tag)).concat(
    root.getElementsByTagNameNS("*", tag).length ? [] : Array.from(root.getElementsByTagName(tag)),
  );
}

function childByTag(el: Element, tag: string): Element | null {
  for (const c of Array.from(el.children)) if (c.localName === tag) return c;
  return null;
}

/** Parses KML text. Only Point placemarks are taken (lines and shapes are skipped). */
export function parseKml(xml: string): KmlPoint[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("bad kml");
  const out: KmlPoint[] = [];
  for (const pm of byTag(doc, "Placemark")) {
    const point = byTag(pm, "Point")[0];
    if (!point) continue;
    const coords = text(byTag(point, "coordinates")[0]).split(/[\s]+/)[0];
    const [lng, lat] = coords.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const name = text(childByTag(pm, "name")).slice(0, 120);
    if (!name) continue;
    const folder = pm.parentElement?.localName === "Folder" ? text(childByTag(pm.parentElement, "name")) : "";
    const desc = plain(text(childByTag(pm, "description"))).slice(0, 4000);
    out.push({ name, description: desc || null, lat, lng, layer: folder || null });
  }
  return out;
}

/** KMZ is a zip; the main file is doc.kml (or the first .kml inside). */
export function kmzToKml(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const name = files["doc.kml"] ? "doc.kml" : Object.keys(files).find((f) => f.toLowerCase().endsWith(".kml"));
  if (!name) throw new Error("no kml in kmz");
  return strFromU8(files[name]);
}

export async function readKmlFile(file: File): Promise<KmlPoint[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  // Zip files start with "PK".
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  return parseKml(isZip ? kmzToKml(buf) : new TextDecoder().decode(buf));
}
