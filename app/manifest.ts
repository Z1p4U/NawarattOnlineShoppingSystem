import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nawaratt",
    short_name: "Nawaratt",
    description: "Nawaratt Medical daily operations control.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07162c",
    theme_color: "#0b2d58",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
