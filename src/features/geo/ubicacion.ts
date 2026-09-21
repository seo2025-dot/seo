"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { CUENCA, leerUbicacion, ubicacionDesdeGps, ubicacionPorZona, zonaDelDispositivo, type Ubicacion } from "@/lib/geo";
import { haySupabase, supabase } from "@/lib/supabaseClient";

const CLAVE = "conectari:ubicacion:v1";

// La ubicación vive en el dispositivo (localStorage) y se comparte entre componentes y pestañas con un almacén mínimo para
// useSyncExternalStore. Sin permiso del GPS se deduce el país de la zona horaria; hasta leerla en el navegador, el servidor y la
// primera pintura usan Cuenca (así no hay diferencias entre servidor y cliente).
let actual: Ubicacion | undefined;
const oyentes = new Set<() => void>();

function leer(): Ubicacion {
  try {
    const guardada = leerUbicacion(localStorage.getItem(CLAVE));
    if (guardada) return guardada;
  } catch {
    /* almacenamiento bloqueado */
  }
  return ubicacionPorZona(zonaDelDispositivo());
}

export function obtenerUbicacion(): Ubicacion {
  if (typeof window === "undefined") return CUENCA;
  actual ??= leer();
  return actual;
}

export function guardarUbicacion(u: Ubicacion) {
  actual = u;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(u));
  } catch {
    /* sin almacenamiento: vale mientras la pestaña siga abierta */
  }
  oyentes.forEach((f) => f());
}

function suscribir(aviso: () => void) {
  oyentes.add(aviso);
  const alCambiar = (e: StorageEvent) => {
    if (e.key === CLAVE || e.key === null) {
      actual = leer();
      aviso();
    }
  };
  window.addEventListener("storage", alCambiar);
  return () => {
    oyentes.delete(aviso);
    window.removeEventListener("storage", alCambiar);
  };
}

/** La ubicación de la persona (siempre hay una: GPS, la que eligió, la de su zona horaria o Cuenca). */
export function useUbicacion() {
  const ubicacion = useSyncExternalStore(suscribir, obtenerUbicacion, () => CUENCA);
  return { ubicacion, cambiar: guardarUbicacion };
}

export type ResultadoGps = { ok: true; ubicacion: Ubicacion } | { ok: false; motivo: "sin_soporte" | "denegado" | "no_disponible" | "tiempo" };

/** Pide la posición al dispositivo. El navegador pregunta a la persona; aquí solo se guarda una versión redondeada (~1 km). */
export function pedirGps(): Promise<ResultadoGps> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve({ ok: false, motivo: "sin_soporte" });
  return new Promise((resolver) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const u = ubicacionDesdeGps(p.coords.latitude, p.coords.longitude, zonaDelDispositivo());
        resolver(u ? { ok: true, ubicacion: u } : { ok: false, motivo: "no_disponible" });
      },
      (e) => resolver({ ok: false, motivo: e.code === 1 ? "denegado" : e.code === 3 ? "tiempo" : "no_disponible" }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  });
}

/** Guarda (o borra, con `null`) la ubicación aproximada en el perfil. Solo su dueña o dueño la ve; los demás ven únicamente el país. */
export async function guardarEnPerfil(u: Ubicacion | null): Promise<string | null> {
  if (!haySupabase) return "Sin conexión con el servidor.";
  const { error } = u
    ? await supabase().rpc("set_my_location", { p_country: u.pais, p_city: u.ciudad ?? null, p_lat: u.lat, p_lng: u.lng, p_timezone: u.zona })
    : await supabase().rpc("clear_my_location");
  if (!error) return null;
  return /schema cache|does not exist|Could not find/i.test(error.message) ? "Aplica la actualización 012 de la base de datos." : error.message;
}

/** Reloj que se actualiza solo (cada 15 s). Es `null` hasta que la página está en el navegador. */
export function useReloj(cadaMs = 15_000): number | null {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    setMs(Date.now());
    const t = setInterval(() => setMs(Date.now()), cadaMs);
    return () => clearInterval(t);
  }, [cadaMs]);
  return ms;
}

/** Cuántas veces ha entrado hoy la persona (una por sesión del navegador): sirve para variar la frase de bienvenida. */
export function useVisitaDelDia(clave: string): number {
  const [visita, setVisita] = useState(0);
  const contar = useCallback(() => {
    try {
      const k = `conectari:visitas:${clave}`;
      let n = Number(localStorage.getItem(k) ?? "0") || 0;
      if (!sessionStorage.getItem("conectari:sesion-contada:" + clave)) {
        n += 1;
        localStorage.setItem(k, String(n));
        sessionStorage.setItem("conectari:sesion-contada:" + clave, "1");
      }
      return n;
    } catch {
      return 0;
    }
  }, [clave]);
  useEffect(() => {
    setVisita(contar());
  }, [contar]);
  return visita;
}
