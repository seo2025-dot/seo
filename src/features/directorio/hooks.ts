"use client";

import { useEffect, useState } from "react";
import type { VerticalId } from "@/data/directorio";
import { mapearConteos } from "@/lib/directorio/mapeo";
import { haySupabase, supabase } from "@/lib/supabaseClient";

/** Se pide una vez por carga de página y se comparte entre quienes la usan. */
let promesa: Promise<Partial<Record<VerticalId, number>>> | null = null;
function pedirConteos() {
  if (!haySupabase) return Promise.resolve({});
  promesa ??= Promise.resolve(supabase().rpc("directory_counts")).then(({ data, error }) =>
    error ? {} : Object.fromEntries(mapearConteos((data ?? []) as { vertical: string; providers: number; verified: number }[]).map((c) => [c.vertical, c.negocios])),
  );
  return promesa;
}

/** Cifras reales de negocios activos por sección (para las tarjetas de la portada). Vacío hasta cargar o si la 006 no está aplicada. */
export function useConteosDirectorio(): Partial<Record<VerticalId, number>> {
  const [conteos, setConteos] = useState<Partial<Record<VerticalId, number>>>({});
  useEffect(() => {
    let vivo = true;
    void pedirConteos().then((c) => vivo && setConteos(c));
    return () => {
      vivo = false;
    };
  }, []);
  return conteos;
}
