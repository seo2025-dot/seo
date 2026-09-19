import type { ItemFoto } from "@/features/fotos/tipos";
import { MAX_FOTOS } from "@/lib/media/config";
import type { Interes, TipoRelacion } from "@/types/social";

export interface Borrador {
  nombre: string;
  usuario: string;
  nacimiento: string; // YYYY-MM-DD
  ubicacion: string;
  intereses: Interes[];
  zonas: string[];
  relaciones: TipoRelacion[];
  estilo: string[];
  bio: string;
  fotos: ItemFoto[];
}

export const BORRADOR_VACIO: Borrador = {
  nombre: "",
  usuario: "",
  nacimiento: "",
  ubicacion: "",
  intereses: [],
  zonas: [],
  relaciones: [],
  estilo: [],
  bio: "",
  fotos: [],
};

export type Errores = Record<string, string>;

/** El servidor exige @ + 2–40 caracteres: minúsculas sin acentos, números, _ o . */
export function normalizarUsuario(s: string): string {
  return s
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 40);
}

/** Años cumplidos a `hoy`; null si la fecha no es válida o es futura. */
export function edadDesde(nacimiento: string, hoy = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nacimiento);
  if (!m) return null;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(a, mes - 1, d);
  if (fecha.getFullYear() !== a || fecha.getMonth() !== mes - 1 || fecha.getDate() !== d) return null; // 31 de febrero…
  if (fecha > hoy || a < 1900) return null;
  let edad = hoy.getFullYear() - a;
  if (hoy.getMonth() < mes - 1 || (hoy.getMonth() === mes - 1 && hoy.getDate() < d)) edad--;
  return edad;
}

export function validarBasico(b: Borrador, hoy = new Date()): Errores {
  const e: Errores = {};
  if (b.nombre.trim().length < 2) e.nombre = "Escribe tu nombre (mínimo 2 caracteres).";
  if (b.nombre.trim().length > 60) e.nombre = "El nombre es demasiado largo (máx. 60).";
  const usuario = normalizarUsuario(b.usuario || b.nombre);
  if (usuario.length < 2) e.usuario = "Elige un nombre de usuario de al menos 2 caracteres (letras, números, _ o .).";
  const edad = edadDesde(b.nacimiento, hoy);
  if (!b.nacimiento) e.nacimiento = "Indica tu fecha de nacimiento.";
  else if (edad === null) e.nacimiento = "La fecha de nacimiento no es válida.";
  else if (edad < 18) e.nacimiento = "Debes tener 18 años o más para usar la plataforma.";
  else if (edad > 100) e.nacimiento = "La fecha de nacimiento no es válida.";
  return e;
}

export function validarIntereses(b: Borrador): Errores {
  const e: Errores = {};
  if (b.intereses.length === 0) e.intereses = "Elige al menos un interés.";
  if (b.zonas.length === 0) e.zonas = "Elige al menos una zona.";
  return e;
}

export function validarFotos(b: Borrador): Errores {
  const e: Errores = {};
  if (b.fotos.length === 0) e.fotos = "Sube al menos una foto para que la comunidad te conozca.";
  if (b.fotos.length > MAX_FOTOS) e.fotos = `Máximo ${MAX_FOTOS} fotos.`;
  return e;
}

export function validarBio(b: Borrador): Errores {
  return b.bio.length > 300 ? { bio: "La descripción no puede superar los 300 caracteres." } : {};
}

export const PASOS = [
  { id: "basico", titulo: "Sobre ti", validar: validarBasico },
  { id: "intereses", titulo: "Intereses", validar: validarIntereses },
  { id: "fotos", titulo: "Fotos", validar: validarFotos },
  { id: "confirmar", titulo: "Confirmar", validar: validarBio },
] as const;
