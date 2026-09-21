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

/**
 * Cachés y «código en vez de la página». Next.js sirve la MISMA dirección de dos formas: HTML para quien abre la página y un flujo de datos
 * (RSC, `text/x-component`) para la navegación interna, y las distingue por cabeceras de la petición (`RSC: 1`) y por `Vary`. Las páginas
 * prerenderizadas salen con `Cache-Control: s-maxage=31536000`: cualquier caché intermedia (CDN, proxy del hosting o del operador móvil) que
 * ignore `Vary` o el parámetro `_rsc` guarda el flujo de datos y después lo sirve como si fuera la página, y la persona ve texto como
 * `0:{"a":"$@1"…}` en el navegador o en el teléfono. Además, un HTML guardado un año apunta a archivos de una versión anterior y la página
 * se rompe tras cada despliegue. Por eso:
 *   · las respuestas de datos (RSC) no se guardan NUNCA en ninguna caché;
 *   · el HTML no se guarda en cachés compartidas (depende de la sesión de cada persona) y el navegador lo revalida siempre: nunca queda una versión
 *     vieja tras publicar.
 * Exportado para que lo compruebe supabase/tests/renderizado.test.mjs.
 */
export const CABECERAS_CACHE = [
  {
    source: "/:path*",
    has: [{ type: "header" as const, key: "rsc", value: "1" }],
    headers: [
      { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
      { key: "CDN-Cache-Control", value: "no-store" },
    ],
  },
  {
    // Documentos HTML (rutas sin extensión que no son de la API ni de _next) pedidos como página, no como datos.
    source: "/((?!_next/|api/|brand/)[^.]*)",
    missing: [{ type: "header" as const, key: "rsc" }],
    headers: [{ key: "Cache-Control", value: "private, no-cache, max-age=0, must-revalidate" }],
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return CABECERAS_CACHE;
  },
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
