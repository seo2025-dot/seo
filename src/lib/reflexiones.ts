/**
 * Reflexiones de autoconocimiento y progreso, inspiradas en la filosofía espiritista de Allan Kardec
 * (El Libro de los Espíritus, El Evangelio según el Espiritismo). Las que llevan `fuente` son frases conocidas de la obra;
 * las demás son reflexiones propias inspiradas en sus ideas y se presentan así, sin atribuirle palabras que no dijo.
 */

export type TemaReflexion = "autoconocimiento" | "progreso" | "comunidad" | "vinculos";

export interface Reflexion {
  texto: string;
  tema: TemaReflexion;
  /** Obra o nota de origen; solo para citas textuales. */
  fuente?: string;
}

export const REFLEXIONES: Reflexion[] = [
  { tema: "progreso", texto: "Nacer, morir, renacer todavía y progresar sin cesar: tal es la ley.", fuente: "Lema espiritista atribuido a Allan Kardec" },
  { tema: "comunidad", texto: "Fuera de la caridad no hay salvación.", fuente: "Allan Kardec, El Evangelio según el Espiritismo" },
  { tema: "autoconocimiento", texto: "Conocerte a ti mismo es el primer paso de todo progreso: nadie mejora lo que no se atreve a mirar." },
  { tema: "autoconocimiento", texto: "Cada tarde puedes preguntarte: ¿qué hice hoy para ser mejor persona que ayer? Esa pregunta ya es evolución." },
  { tema: "progreso", texto: "El progreso moral no se mide por lo que logras, sino por lo que dejas atrás: el rencor, la prisa, el egoísmo." },
  { tema: "progreso", texto: "Cada dificultad es una lección que se repite hasta que la aprendemos. Agradécela: te está enseñando algo." },
  { tema: "comunidad", texto: "Una comunidad crece cuando cada persona se pregunta qué puede dar, no solo qué puede recibir." },
  { tema: "comunidad", texto: "La bondad pequeña y constante transforma más que un gesto grande y aislado." },
  { tema: "vinculos", texto: "Las afinidades más profundas nacen de la simpatía entre las almas, no de las apariencias." },
  { tema: "vinculos", texto: "Los encuentros importantes rara vez son casualidad: cada persona que cruza tu camino trae algo que aprender o algo que ofrecer." },
  { tema: "vinculos", texto: "Ama sin poseer, acompaña sin corregir y crece sin dejar de mirar a quien camina contigo." },
  { tema: "autoconocimiento", texto: "Lo que te irrita de otros suele señalar algo que aún puedes trabajar en ti. Es una brújula, no una condena." },
  { tema: "progreso", texto: "Evolucionar es un camino de pasos cortos: hoy basta con ser un poco más paciente, un poco más honesto." },
];

/** Reflexión determinista por fecha (la misma para todos durante el día). `desplazamiento` permite otra distinta. */
export function reflexionDelDia(fecha = new Date(), desplazamiento = 0): Reflexion {
  const dia = Math.floor(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) / 86_400_000);
  return REFLEXIONES[(((dia + desplazamiento) % REFLEXIONES.length) + REFLEXIONES.length) % REFLEXIONES.length];
}
