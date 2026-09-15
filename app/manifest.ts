import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YuhBusiness",
    short_name: "YuhBusiness",
    description:
      "Professional online storefront for appointment, ordering, and retail businesses.",
    start_url: "/",
    id: "/",
    display: "standalone",
    background_color: "#070b14",
    theme_color: "#070b14",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
