/**
 * Género y «a quién quiero conocer». Al inscribirse se pregunta a todas las personas si son hombre o mujer (con la opción de no decirlo) y a
 * quién les gustaría conocer; la plataforma se adapta: recomienda solo a quienes encajan en los dos sentidos y habla en el género de cada persona.
 *
 * Privacidad: ambos datos son PRIVADOS (`user_private`): solo los lee su dueña o dueño. Nadie ve el género de otra persona; el servidor
 * lo usa por dentro para filtrar (`recommend_people`, `people_i_may_meet`). La regla de encaje es la misma en SQL (`_seek_ok`) y aquí.
 */

export type Genero = "hombre" | "mujer" | "no_dice";
export type Busca = "hombres" | "mujeres" | "todos";

export const GENEROS: { id: Genero; etiqueta: string }[] = [
  { id: "mujer", etiqueta: "Mujer" },
  { id: "hombre", etiqueta: "Hombre" },
  { id: "no_dice", etiqueta: "Prefiero no decirlo" },
];

export const BUSCAS: { id: Busca; etiqueta: string }[] = [
  { id: "mujeres", etiqueta: "Mujeres" },
  { id: "hombres", etiqueta: "Hombres" },
  { id: "todos", etiqueta: "Me gustaría conocer a todos" },
];

export const esGenero = (v: unknown): v is Genero => GENEROS.some((g) => g.id === v);
export const esBusca = (v: unknown): v is Busca => BUSCAS.some((b) => b.id === v);

/** ¿Encaja una persona de ese género con lo que alguien busca? Sin preferencia («todos» o sin dato) encaja cualquiera, también quien no dijo su género. */
export function encaja(busca: Busca | null | undefined, genero: Genero | null | undefined): boolean {
  if (!busca || busca === "todos") return true;
  return busca === "hombres" ? genero === "hombre" : genero === "mujer";
}

/** ¿Se quieren conocer las dos personas? (la regla de `recommend_people` y `people_i_may_meet`). */
export function seQuierenConocer(a: { genero?: Genero | null; busca?: Busca | null }, b: { genero?: Genero | null; busca?: Busca | null }): boolean {
  return encaja(a.busca, b.genero) && encaja(b.busca, a.genero);
}

/** Palabra que concuerda con el género de la persona; quien no lo dijo recibe una fórmula neutra (sin adivinar por el nombre). */
export function concordar(genero: Genero | null | undefined, formas: { hombre: string; mujer: string; neutro: string }): string {
  return genero === "hombre" ? formas.hombre : genero === "mujer" ? formas.mujer : formas.neutro;
}

export const bienvenida = (g: Genero | null | undefined) => concordar(g, { hombre: "Bienvenido", mujer: "Bienvenida", neutro: "Te damos la bienvenida" });
