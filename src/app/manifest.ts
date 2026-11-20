import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Trip Helper",
    short_name: "Trip Helper",
    description: "הבית הקבוע של הטיול המשפחתי",
    lang: "he",
    dir: "rtl",
    start_url: "/trips",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f0e8",
    theme_color: "#1c1b19",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The artwork keeps everything inside the central 80% safe zone, so it doubles as maskable.
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
