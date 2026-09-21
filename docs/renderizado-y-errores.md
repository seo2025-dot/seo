# Cuando una persona ve «código» en vez de la página

## Qué pasaba

Next.js sirve **la misma dirección de dos formas**: HTML (cuando abres la página) y un flujo de datos llamado RSC (`Content-Type: text/x-component`, se ve
como `0:{"a":"$@1"…}`) para la navegación interna entre páginas. Las distingue con cabeceras de la petición (`RSC: 1`) y con `Vary`.

Las páginas prerenderizadas salían con `Cache-Control: s-maxage=31536000` (un año). Cualquier caché entre el servidor y la persona (CDN como
Cloudflare, el proxy del hosting, o incluso el del operador móvil) que **ignore `Vary` o el parámetro `_rsc`** guardaba la respuesta de datos y
después se la servía a otra persona como si fuera la página: en el navegador o en el teléfono aparecía texto de código en lugar de la página.
Con un año de caché, además, tras publicar una versión nueva el HTML viejo apuntaba a archivos que ya no existen y la página se rompía.

## Qué se cambió

1. **`next.config.ts` → `CABECERAS_CACHE`** (probado con el servidor real):
   | Petición | `Cache-Control` |
   |---|---|
   | Datos (`RSC: 1`) | `private, no-store, max-age=0, must-revalidate` + `CDN-Cache-Control: no-store` |
   | Página HTML | `private, no-cache, max-age=0, must-revalidate` |

   Ninguna caché compartida puede guardar ya los datos RSC ni el HTML (depende de la sesión de cada persona); el navegador revalida siempre. `Vary`
   se conserva. Los archivos estáticos (`/_next/static`, imágenes) siguen cacheándose como siempre.
2. **Pantallas de error limpias** (antes salía una página rota o la pantalla en inglés de Next):
   - `src/app/error.tsx`: mensaje en español con «Intentar de nuevo» e «Ir al inicio».
   - `src/app/global-error.tsx`: último recurso si falla el diseño general; lleva su propio `<html>` y estilos en línea.
   - `src/app/not-found.tsx`: 404 en español.
3. **Recuperación automática de versión vieja** (`src/lib/carga.ts`, `RecuperarDeCarga`): si el navegador no puede cargar un archivo de la aplicación
   (pestaña abierta durante un despliegue) recarga la página **una sola vez** (máximo una cada 30 s: nunca hay bucle); si vuelve a fallar se muestra
   la pantalla de error con su botón.
4. Las rutas de retorno de las pasarelas de pago siempre **redirigen** a una página; ninguna deja JSON en pantalla (lo comprueba una prueba).

## Cómo comprobarlo con el servidor en marcha

```bash
curl -sI localhost:3000/que-es | grep -i cache-control                 # private, no-cache, max-age=0, must-revalidate   (HTML)
curl -sI -H "RSC: 1" localhost:3000/que-es | grep -i "cache-control\|content-type"   # private, no-store …  text/x-component
```

## Si usas Cloudflare u otro CDN delante

- No actives reglas «Cache Everything» ni «Ignorar cadena de consulta» para las páginas: la respuesta `text/x-component` de una dirección terminaría
  guardada como si fuera el HTML. Con estos encabezados ya no se guardan, pero una regla forzada del CDN puede ignorarlos.
- Tras cambiar la configuración, purga la caché del CDN una vez para eliminar respuestas antiguas guardadas.
- Puedes cachear sin problema `/_next/static/*` e imágenes.

Pruebas: `npx tsx supabase/tests/renderizado.test.mjs`.
