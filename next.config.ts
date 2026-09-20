import type { NextConfig } from "next";

// Las imágenes subidas por los usuarios se sirven desde Supabase Storage.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;

/**
 * Alias amigables de las secciones del directorio (mejor para recordar y para el SEO): /farmacias → /directorio/salud, etc.
 * Deben coincidir con `VERTICALES[].alias` de src/data/directorio.ts (hay un test de paridad; este archivo no puede importar código de src).
 */
const ALIAS_DIRECTORIO: [alias: string, seccion: string][] = [
  ["taxis", "movilidad"],
  ["delivery", "delivery"],
  ["farmacias", "salud"],
  ["eventos", "eventos"],
  ["mascotas", "mascotas"],
  ["hogar", "hogar"],
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  async rewrites() {
    return ALIAS_DIRECTORIO.map(([alias, seccion]) => ({ source: `/${alias}`, destination: `/directorio/${seccion}` }));
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Fotos de las personas de demostración (supabase/seed/personas.ts): retratos de muestra y escenas de Wikimedia Commons.
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "thumb.wikimedia.org" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : []),
    ],
  },
};

export default nextConfig;
