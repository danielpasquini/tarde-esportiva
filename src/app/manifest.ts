import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tarde Esportiva",
    short_name: "Tarde Esportiva",
    description: "Organização e gestão de peladas de futebol sem burocracia.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F1EA",
    theme_color: "#1A2E22",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
