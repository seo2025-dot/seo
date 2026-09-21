/**
 * Dirección pública de la web (`https://conectari.com`) para construir redirecciones y enlaces en el servidor.
 *
 * NO se puede usar `new URL(request.url).origin`: detrás del proxy del hosting (Hostinger, etc.) Next.js ve la dirección INTERNA del servidor
 * (`https://0.0.0.0:3000`, `http://localhost:3000`), así que, por ejemplo, tras confirmar el correo la persona era enviada a una dirección que no existe.
 *
 * Orden: 1) `NEXT_PUBLIC_SITE_URL` (lo que tú configuras); 2) las cabeceras `X-Forwarded-Host` / `X-Forwarded-Proto` que pone el proxy;
 * 3) la dirección de la petición (desarrollo local). Solo se devuelve el origen (esquema + servidor), nunca una ruta.
 */

type Cabeceras = { get(nombre: string): string | null };

const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;

function origenValido(texto: string | undefined | null): string | null {
  if (!texto) return null;
  try {
    const u = new URL(texto.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

export function origenPublico(request: { url: string; headers: Cabeceras }, env: Record<string, string | undefined> = process.env): string {
  const configurado = origenValido(env.NEXT_PUBLIC_SITE_URL);
  if (configurado) return configurado;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (host && HOST.test(host)) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    return `${proto === "http" ? "http" : "https"}://${host}`;
  }
  return new URL(request.url).origin;
}
