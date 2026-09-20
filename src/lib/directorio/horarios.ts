import { DIAS, ETIQUETA_DIA, estaAbierto, partesEcuador, textoHorarioDia, type DiaId, type Horario } from "@/data/directorio";

const ABREV: Record<DiaId, string> = { lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue", vie: "Vie", sab: "Sáb", dom: "Dom" };

export interface PresetHorario {
  id: string;
  etiqueta: string;
  horario: Horario;
  abierto24h: boolean;
}

const dias = (lista: readonly DiaId[], tramos: [string, string][]): Horario => Object.fromEntries(lista.map((d) => [d, tramos]));
const LUN_VIE = DIAS.slice(0, 5);
const LUN_SAB = DIAS.slice(0, 6);

/** Preajustes de horario para publicar rápido (después se puede ajustar día por día). */
export const PRESETS_HORARIO: PresetHorario[] = [
  { id: "restaurante", etiqueta: "Restaurante: 11:00–15:00 y 18:00–22:00, todos los días", horario: dias(DIAS, [["11:00", "15:00"], ["18:00", "22:00"]]), abierto24h: false },
  { id: "farmacia", etiqueta: "Farmacia: lun–sáb 08:00–20:00 y dom 09:00–13:00", horario: { ...dias(LUN_SAB, [["08:00", "20:00"]]), dom: [["09:00", "13:00"]] }, abierto24h: false },
  { id: "lun-vie", etiqueta: "Lunes a viernes, 08:00–18:00", horario: dias(LUN_VIE, [["08:00", "18:00"]]), abierto24h: false },
  { id: "lun-sab", etiqueta: "Lunes a sábado, 09:00–19:00", horario: dias(LUN_SAB, [["09:00", "19:00"]]), abierto24h: false },
  { id: "diario", etiqueta: "Todos los días, 08:00–20:00", horario: dias(DIAS, [["08:00", "20:00"]]), abierto24h: false },
  { id: "24h", etiqueta: "Abierto las 24 horas", horario: {}, abierto24h: true },
];

export function presetHorario(id: string): PresetHorario {
  return PRESETS_HORARIO.find((p) => p.id === id) ?? PRESETS_HORARIO.find((p) => p.id === "lun-vie")!;
}

/** Sustituye los tramos de un día (sin mutar). Un día sin tramos queda fuera del horario (= cerrado). */
export function ponerTramos(h: Horario, dia: DiaId, tramos: [string, string][]): Horario {
  const copia: Horario = { ...h };
  if (tramos.length === 0) delete copia[dia];
  else copia[dia] = tramos.map(([a, b]) => [a, b] as [string, string]);
  return copia;
}

/** Copia los tramos de un día a otros días. */
export function copiarTramos(h: Horario, desde: DiaId, hacia: readonly DiaId[]): Horario {
  return hacia.reduce((acc, d) => ponerTramos(acc, d, h[desde] ?? []), h);
}

/** Resumen compacto: «Lun–Vie 08:00–18:00 · Sáb 09:00–13:00 · Dom cerrado». Agrupa días consecutivos con el mismo horario. */
export function resumenHorario(h: Horario, abierto24h: boolean): string {
  if (abierto24h) return "Abierto 24 horas";
  if (DIAS.every((d) => (h[d] ?? []).length === 0)) return "Sin horario publicado";
  const grupos: { desde: DiaId; hasta: DiaId; texto: string }[] = [];
  for (const d of DIAS) {
    const texto = textoHorarioDia(h, d);
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.texto === texto) ultimo.hasta = d;
    else grupos.push({ desde: d, hasta: d, texto });
  }
  return grupos
    .map((g) => `${g.desde === g.hasta ? ABREV[g.desde] : `${ABREV[g.desde]}–${ABREV[g.hasta]}`} ${g.texto === "Cerrado" ? "cerrado" : g.texto}`)
    .join(" · ");
}

/**
 * Estado legible para la tarjeta: «Abierto ahora · cierra a las 19:00», «Cerrado · abre hoy a las 15:00»,
 * «Cerrado · abre el Lun a las 08:00», «Abierto 24 horas» o «Sin horario».
 */
export function textoEstadoAbierto(h: Horario, abierto24h: boolean, ahora: Date = new Date()): { abierto: boolean; texto: string } {
  if (abierto24h) return { abierto: true, texto: "Abierto 24 horas" };
  if (DIAS.every((d) => (h[d] ?? []).length === 0)) return { abierto: false, texto: "Sin horario publicado" };
  const { dia, indiceDia, hora } = partesEcuador(ahora);
  if (estaAbierto(h, false, ahora)) {
    const tramo = (h[dia] ?? []).find(([a, b]) => hora >= a && hora < b);
    return { abierto: true, texto: `Abierto ahora · cierra ${tramo?.[1] === "24:00" ? "a medianoche" : `a las ${tramo?.[1]}`}` };
  }
  for (let salto = 0; salto < 7; salto++) {
    const d = DIAS[(indiceDia + salto) % 7];
    const proximo = (h[d] ?? []).find(([a]) => salto > 0 || a > hora);
    if (proximo) {
      const cuando = salto === 0 ? "hoy" : salto === 1 ? "mañana" : `el ${ABREV[d]}`;
      return { abierto: false, texto: `Cerrado · abre ${cuando} a las ${proximo[0]}` };
    }
  }
  return { abierto: false, texto: "Cerrado" };
}

/**
 * Convierte el valor de un `<input type="datetime-local">` («2026-06-01T20:00»), que se escribe en hora de Ecuador, en un instante
 * ISO exacto (UTC-5 fijo, sin depender de la zona del dispositivo). Devuelve null si el texto no es una fecha y hora válidas.
 */
export function instanteEcuador(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}:00-05:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Lo contrario: un instante (ms) como valor de `datetime-local` en hora de Ecuador. */
export function valorLocalEcuador(ms: number): string {
  return new Date(ms - 5 * 3_600_000).toISOString().slice(0, 16);
}

export { ETIQUETA_DIA };
