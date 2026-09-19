"use client";

import { useCallback, useEffect, useState } from "react";
import type { FotoGuardada } from "@/features/fotos/tipos";
import { urlMedia } from "@/lib/media/urls";
import { haySupabase, supabase } from "@/lib/supabaseClient";

interface FilaFoto {
  id: string;
  user_id: string;
  sort_order: number;
  storage_path: string;
  thumb_path: string;
  width: number | null;
  height: number | null;
}

const aFoto = (f: FilaFoto): FotoGuardada => ({
  id: f.id,
  url: urlMedia(f.storage_path),
  thumbUrl: urlMedia(f.thumb_path),
  ancho: f.width ?? undefined,
  alto: f.height ?? undefined,
});

/** Galería (hasta 10 fotos, en orden) de un usuario. `uid` es el uuid real, no el alias "yo". */
export function useFotosPerfil(uid: string | null | undefined) {
  const [fotos, setFotos] = useState<FotoGuardada[]>([]);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    if (!uid || !haySupabase) {
      setFotos([]);
      setCargando(false);
      return;
    }
    const { data } = await supabase().from("profile_photos").select("*").eq("user_id", uid).order("sort_order");
    setFotos(((data ?? []) as FilaFoto[]).map(aFoto));
    setCargando(false);
  }, [uid]);

  useEffect(() => {
    setCargando(true);
    void recargar();
  }, [recargar]);

  return { fotos, cargando, recargar };
}

/** Miniaturas de varias personas a la vez (una sola consulta): uid → fotos en orden. */
export async function fotosDeVarios(uids: string[]): Promise<Record<string, FotoGuardada[]>> {
  if (uids.length === 0 || !haySupabase) return {};
  const { data } = await supabase().from("profile_photos").select("*").in("user_id", uids).order("sort_order");
  const out: Record<string, FotoGuardada[]> = {};
  for (const f of (data ?? []) as FilaFoto[]) (out[f.user_id] ??= []).push(aFoto(f));
  return out;
}
