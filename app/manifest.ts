import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rotera — byten och speltid för barnfotboll",
    short_name: "Rotera",
    description:
      "Planera och exekvera byten i barn- och ungdomsfotboll. Speltidsgaranti, rotation, live-läge.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#16a34a",
    orientation: "portrait",
    lang: "sv",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
