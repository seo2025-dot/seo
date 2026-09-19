import type { FotoGuardada, ItemFoto } from "@/features/fotos/tipos";

export interface ResultadoSincronizacion {
  /** Fotos nuevas que se subieron bien: key del item → foto guardada. */
  subidas: Record<string, FotoGuardada>;
  /** Mensajes legibles de lo que falló (un fallo no impide procesar el resto). */
  errores: string[];
  /** Ids finales en el orden pedido (solo las que existen en el servidor). */
  ids: string[];
}

type Fetch = typeof fetch;

async function mensajeDe(r: Response): Promise<string> {
  try {
    return ((await r.json()) as { mensaje?: string }).mensaje ?? `Error ${r.status}`;
  } catch {
    return `Error ${r.status}`;
  }
}

/**
 * Lleva la galería del servidor al estado que el usuario ha dejado en pantalla:
 *  1. borra las fotos guardadas que quitó (así se libera cupo antes de subir);
 *  2. sube las nuevas UNA A UNA (progreso, y un fallo no bloquea las demás);
 *  3. reordena todo con una sola petición.
 * Las peticiones a /api/photos llevan las cookies de sesión (mismo origen).
 */
export async function sincronizarFotos(
  items: ItemFoto[],
  idsIniciales: string[],
  progreso?: (hecho: number, total: number) => void,
  peticion: Fetch = fetch,
): Promise<ResultadoSincronizacion> {
  const errores: string[] = [];
  const subidas: Record<string, FotoGuardada> = {};
  const mantenidas = new Set(items.flatMap((i) => (i.tipo === "guardada" ? [i.id] : [])));
  const aBorrar = idsIniciales.filter((id) => !mantenidas.has(id));
  const nuevas = items.filter((i): i is Extract<ItemFoto, { tipo: "nueva" }> => i.tipo === "nueva");
  const total = aBorrar.length + nuevas.length + 1;
  let hecho = 0;
  const avanzar = () => progreso?.(++hecho, total);

  for (const id of aBorrar) {
    try {
      const r = await peticion(`/api/photos/${id}`, { method: "DELETE" });
      if (!r.ok && r.status !== 404) errores.push(`No se pudo eliminar una foto: ${await mensajeDe(r)}`);
    } catch {
      errores.push("No se pudo eliminar una foto: sin conexión.");
    }
    avanzar();
  }

  for (const n of nuevas) {
    try {
      const f = new FormData();
      f.set("file", n.file, n.file.name);
      const r = await peticion("/api/photos", { method: "POST", body: f });
      if (r.ok) {
        const { foto } = (await r.json()) as { foto: FotoGuardada };
        subidas[n.key] = foto;
      } else {
        errores.push(`«${n.file.name}»: ${await mensajeDe(r)}`);
      }
    } catch {
      errores.push(`«${n.file.name}»: sin conexión.`);
    }
    avanzar();
  }

  const ids = items.flatMap((i) => (i.tipo === "guardada" ? [i.id] : subidas[i.key] ? [subidas[i.key].id] : []));
  const ordenActual = [...idsIniciales.filter((id) => mantenidas.has(id))];
  const hayCambioDeOrden = ids.length > 1 && (ids.length !== ordenActual.length || ids.some((id, i) => id !== ordenActual[i]));
  if (hayCambioDeOrden) {
    try {
      const r = await peticion("/api/photos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!r.ok) errores.push(`No se pudo guardar el orden: ${await mensajeDe(r)}`);
    } catch {
      errores.push("No se pudo guardar el orden: sin conexión.");
    }
  }
  avanzar();
  return { subidas, errores, ids };
}
