/**
 * Reflexiones diarias de tres tradiciones: el espiritismo de Allan Kardec, el estoicismo (Marco Aurelio, Séneca, Epicteto) y la psicología
 * (clínica y positiva). Criterio editorial, el mismo en las tres:
 *   · `fuente` SOLO en frases textuales que se pueden comprobar en la obra (traducción libre); son pocas y llevan obra y pasaje.
 *   · Todas las demás son reflexiones propias «inspiradas en» esa tradición. Cuando parten de un concepto concreto, `idea` dice de quién y
 *     dónde, sin ponerles palabras en la boca a quienes no las dijeron.
 */

export type TemaReflexion = "autoconocimiento" | "progreso" | "comunidad" | "vinculos" | "serenidad" | "gratitud" | "resiliencia" | "presente" | "esfuerzo";
export type Tradicion = "espiritismo" | "estoicismo" | "psicologia";

export interface Reflexion {
  texto: string;
  tema: TemaReflexion;
  tradicion: Tradicion;
  /** Obra y pasaje: solo para frases textuales. */
  fuente?: string;
  /** Concepto en el que se inspira la reflexión (no es una cita). */
  idea?: string;
}

export const TRADICIONES: Record<Tradicion, { nombre: string; emoji: string; inspirada: string; clase: string }> = {
  espiritismo: { nombre: "Espiritismo", emoji: "🕊️", inspirada: "inspirada en Allan Kardec", clase: "border-violet-200 from-violet-50 text-violet-700" },
  estoicismo: { nombre: "Estoicismo", emoji: "🏛️", inspirada: "inspirada en Marco Aurelio, Séneca y Epicteto", clase: "border-amber-200 from-amber-50 text-amber-800" },
  psicologia: { nombre: "Psicología", emoji: "🧠", inspirada: "inspirada en la psicología clínica y positiva", clase: "border-sky-200 from-sky-50 text-sky-800" },
};

const k = (tema: TemaReflexion, texto: string, extra: Partial<Reflexion> = {}): Reflexion => ({ tradicion: "espiritismo", tema, texto, ...extra });
const e = (tema: TemaReflexion, texto: string, extra: Partial<Reflexion> = {}): Reflexion => ({ tradicion: "estoicismo", tema, texto, ...extra });
const p = (tema: TemaReflexion, texto: string, extra: Partial<Reflexion> = {}): Reflexion => ({ tradicion: "psicologia", tema, texto, ...extra });

export const REFLEXIONES: Reflexion[] = [
  // ── Espiritismo ───────────────────────────────────────────────────────────
  k("progreso", "Nacer, morir, renacer todavía y progresar sin cesar: tal es la ley.", { fuente: "Lema espiritista atribuido a Allan Kardec" }),
  k("comunidad", "Fuera de la caridad no hay salvación.", { fuente: "Allan Kardec, El Evangelio según el Espiritismo" }),
  k("autoconocimiento", "Conocerte a ti mismo es el primer paso de todo progreso: nadie mejora lo que no se atreve a mirar."),
  k("autoconocimiento", "Cada tarde puedes preguntarte: ¿qué hice hoy para ser mejor persona que ayer? Esa pregunta ya es evolución."),
  k("progreso", "El progreso moral no se mide por lo que logras, sino por lo que dejas atrás: el rencor, la prisa, el egoísmo."),
  k("progreso", "Cada dificultad es una lección que se repite hasta que la aprendemos. Agradécela: te está enseñando algo."),
  k("comunidad", "Una comunidad crece cuando cada persona se pregunta qué puede dar, no solo qué puede recibir."),
  k("comunidad", "La bondad pequeña y constante transforma más que un gesto grande y aislado."),
  k("vinculos", "Las afinidades más profundas nacen de la simpatía entre las almas, no de las apariencias."),
  k("vinculos", "Los encuentros importantes rara vez son casualidad: cada persona que cruza tu camino trae algo que aprender o algo que ofrecer."),
  k("vinculos", "Ama sin poseer, acompaña sin corregir y crece sin dejar de mirar a quien camina contigo."),
  k("autoconocimiento", "Lo que te irrita de otros suele señalar algo que aún puedes trabajar en ti. Es una brújula, no una condena."),
  k("progreso", "Evolucionar es un camino de pasos cortos: hoy basta con ser un poco más paciente, un poco más honesto."),
  k("serenidad", "La paciencia es la forma más práctica de la fe: confía en que lo que hoy no entiendes tendrá su sentido dentro del conjunto."),
  k("gratitud", "Agradecer es reconocer que nada de lo que tienes lo hiciste solo: es humildad convertida en alegría."),
  k("resiliencia", "Las pruebas no llegan para quebrarnos, sino para mostrarnos una fuerza que no sabíamos tener."),
  k("vinculos", "Trata a cada persona como alguien que también está aprendiendo: cambiará tu manera de mirar y de hablar."),
  k("comunidad", "Sirve sin esperar aplauso. La mejor recompensa de una buena acción es la paz que deja."),
  k("autoconocimiento", "Haz cada noche un breve examen de conciencia: sin culpa, con honestidad y con ganas de mejorar mañana.", { idea: "El examen de conciencia nocturno que recomienda El Libro de los Espíritus" }),
  k("progreso", "Corregir un defecto pequeño cada semana es más eficaz que prometerte cambiar todo de un día."),
  k("presente", "La vida es una escuela y el día de hoy es una clase: préstale atención y saldrás distinta o distinto."),
  k("esfuerzo", "El trabajo honrado ennoblece: hazlo bien aunque nadie te vea."),
  k("serenidad", "Ante la injusticia, la calma es más fuerte que la ira: pensar antes de responder también es una forma de justicia."),

  // ── Estoicismo ────────────────────────────────────────────────────────────
  e("serenidad", "Divide tu día en dos listas: lo que depende de ti y lo que no. Pon toda tu energía en la primera y suelta la segunda.", { idea: "La dicotomía del control (Epicteto, Enquiridión 1)" }),
  e("serenidad", "Hay cosas que dependen de nosotros y otras que no.", { fuente: "Epicteto, Enquiridión 1 (traducción libre)" }),
  e("serenidad", "No nos perturban las cosas, sino la opinión que tenemos de ellas.", { fuente: "Epicteto, Enquiridión 5 (traducción libre)" }),
  e("presente", "No es que tengamos poco tiempo, sino que perdemos mucho.", { fuente: "Séneca, Sobre la brevedad de la vida 1 (traducción libre)" }),
  e("serenidad", "Sufrimos más en la imaginación que en la realidad.", { fuente: "Séneca, Cartas a Lucilio 13 (traducción libre)" }),
  e("autoconocimiento", "Deja de discutir cómo debe ser una buena persona. Sé una.", { fuente: "Marco Aurelio, Meditaciones 10.16 (traducción libre)" }),
  e("resiliencia", "El obstáculo no bloquea el camino: es el camino. Pregúntate qué virtud te está pidiendo practicar hoy.", { idea: "«Lo que se interpone en el camino se convierte en el camino» (Marco Aurelio, Meditaciones 5.20)" }),
  e("presente", "El pasado ya no te pertenece y el futuro todavía no. Lo único que puedes trabajar es este momento.", { idea: "La atención al presente en Marco Aurelio" }),
  e("autoconocimiento", "Antes de juzgar lo que te pasó, examina el juicio que haces sobre ello: casi siempre es ahí donde duele.", { idea: "Los juicios como origen de la perturbación (Epicteto)" }),
  e("progreso", "Elige una virtud para hoy —paciencia, justicia, valentía o moderación— y mídete solo contra ella.", { idea: "Las cuatro virtudes cardinales del estoicismo" }),
  e("gratitud", "Imagina por un momento que hoy pierdes lo que das por sentado. Luego míralo de nuevo: ya no es rutina, es un regalo.", { idea: "La visualización negativa (Séneca)" }),
  e("serenidad", "Prepárate para el día sabiendo que te cruzarás con prisas, ruido y gente difícil. Así, cuando lleguen, no te sorprenderán.", { idea: "La meditación matinal de Marco Aurelio (Meditaciones 2.1)" }),
  e("comunidad", "Somos parte de un mismo cuerpo. Lo que hoy hagas por otra persona lo haces, en el fondo, por el conjunto.", { idea: "El cosmopolitismo estoico" }),
  e("esfuerzo", "No esperes la motivación: haz lo que te toca. La acción ordenada crea el ánimo, no al revés."),
  e("vinculos", "Cuando alguien te hiera, recuerda que actúa según lo que cree correcto. Comprender no es justificar, pero te libera.", { idea: "Marco Aurelio sobre la ignorancia como causa de la injusticia" }),
  e("resiliencia", "La fortuna te quita cosas; tu carácter decide qué haces con lo que queda."),
  e("serenidad", "Antes de reaccionar, respira y pregúntate: ¿esto me importará dentro de una semana?"),
  e("presente", "Termina el día como quien cierra un libro: revisa qué hiciste bien, qué corregirás y déjalo descansar.", { idea: "El repaso nocturno del día (Séneca, Sobre la ira III, 36)" }),
  e("autoconocimiento", "La primera pregunta de la mañana: ¿qué quiero hacer bien hoy? La última de la noche: ¿lo hice?"),
  e("gratitud", "Agradece a quienes te enseñaron, incluso a quienes lo hicieron con dureza: aprendiste igual."),
  e("esfuerzo", "La comodidad no fortalece. Elige hoy una pequeña incomodidad voluntaria y comprueba que puedes con ella.", { idea: "La incomodidad voluntaria (Séneca, Cartas a Lucilio 18)" }),
  e("serenidad", "No puedes elegir el clima, pero sí cómo caminas bajo la lluvia."),
  e("comunidad", "Una comunidad sana se construye con justicia pequeña: cumplir lo prometido, pagar lo justo, decir la verdad."),
  e("progreso", "No pretendas ser sabia o sabio de golpe. Un poco menos de queja y un poco más de acción: eso ya es filosofía en práctica."),
  e("vinculos", "Elige con quién pasas el tiempo: el carácter se parece a la compañía que mantienes.", { idea: "La influencia de las amistades (Séneca, Cartas a Lucilio 7)" }),
  e("resiliencia", "Lo que ocurre es neutro; tu interpretación le pone el peso. Cambia la interpretación y cambiará la carga."),
  e("presente", "Haz lo que tienes delante con toda tu atención. Buena parte de la ansiedad vive en lo que todavía no toca."),
  e("autoconocimiento", "Observa qué te enoja: te dirá qué valoras y qué crees que te deben. Ambas cosas merecen revisión."),
  e("esfuerzo", "El día es corto y la tarea es honesta: empieza por lo más pequeño y sigue hasta que el ánimo te alcance."),
  e("gratitud", "Cada mañana es una segunda oportunidad que nadie te prometió. Úsala con cuidado."),
  e("serenidad", "La calma no es ausencia de problemas: es la decisión de no añadirles tu propio ruido."),
  e("comunidad", "Cuando ayudes, no lo anuncies: la ayuda que se cuenta a sí misma pierde la mitad de su valor."),
  e("vinculos", "Corrige con firmeza y sin humillar: la verdad dicha con calma llega más lejos que la dicha con furia."),
  e("progreso", "Mide tu avance por tus hábitos y no por tus resultados: los resultados dependen de muchas cosas; los hábitos, solo de ti."),
  e("resiliencia", "Quien ha imaginado lo peor y aun así sabe que puede seguir, camina con más ligereza."),

  // ── Psicología ────────────────────────────────────────────────────────────
  p("autoconocimiento", "Ponle nombre a lo que sientes: decir «estoy ansiosa» o «me siento triste» reduce su intensidad y te devuelve el control.", { idea: "Etiquetado emocional (investigación de Matthew Lieberman)" }),
  p("resiliencia", "Un fallo es un dato, no un veredicto. Pregúntate qué información te dio y qué probarás distinto la próxima vez.", { idea: "Mentalidad de crecimiento (Carol Dweck)" }),
  p("serenidad", "Cuando la mente se acelera, vuelve al cuerpo: cinco respiraciones lentas, exhalando más largo de lo que inhalas.", { idea: "Regulación a través de la respiración lenta" }),
  p("gratitud", "Anota tres cosas buenas de hoy, por pequeñas que sean. Hacerlo durante semanas entrena a la mente a notar lo que sí funciona.", { idea: "Los ejercicios de gratitud (Robert Emmons y Martin Seligman)" }),
  p("autoconocimiento", "Tus pensamientos automáticos no son hechos. Antes de creerlos, pregúntate qué evidencia hay a favor y en contra.", { idea: "Terapia cognitivo-conductual (Aaron Beck)" }),
  p("vinculos", "Escuchar de verdad es callar la respuesta que estás preparando. Prueba hoy a repetir con tus palabras lo que dijo la otra persona.", { idea: "La escucha activa (Carl Rogers)" }),
  p("serenidad", "Tratarte con la amabilidad con que tratarías a una amiga no te vuelve blanda: te hace más capaz de levantarte.", { idea: "Autocompasión (Kristin Neff)" }),
  p("esfuerzo", "Divide lo grande en un primer paso de dos minutos. Empezar es lo más difícil; seguir es casi inercia.", { idea: "Activación conductual" }),
  p("presente", "Elige una actividad de hoy y hazla con atención plena: sin pantalla, sin prisa, notando cada detalle.", { idea: "Mindfulness (Jon Kabat-Zinn)" }),
  p("vinculos", "Las relaciones se construyen en los pequeños momentos: una pregunta, un gesto, una atención. Responde a esos gestos de conexión.", { idea: "Los «gestos de conexión» en las parejas (John Gottman)" }),
  p("progreso", "Los hábitos se ganan repitiendo, no a fuerza de voluntad. Hazlos tan fáciles que sea difícil no hacerlos.", { idea: "Formación de hábitos" }),
  p("resiliencia", "Sentir miedo no significa que algo esté mal: significa que algo te importa. Da el paso con el miedo a tu lado."),
  p("autoconocimiento", "Lo que te dices en voz baja moldea lo que haces en voz alta. Cuida tu diálogo interno como cuidas tus palabras.", { idea: "El diálogo interno" }),
  p("comunidad", "Sentirse parte de algo mayor protege la salud mental. Hoy aporta a un grupo: una respuesta, una ayuda, una idea.", { idea: "El sentido de pertenencia" }),
  p("esfuerzo", "El descanso también es productivo. Dormir bien y parar a tiempo mejora tu ánimo y tu memoria más que insistir agotada o agotado.", { idea: "Sueño y rendimiento" }),
  p("presente", "Cuando rumies, pregúntate: ¿esto tiene una acción posible hoy? Si la hay, hazla; si no, devuelve la atención al presente.", { idea: "La rumiación" }),
  p("gratitud", "Dile hoy a alguien qué valoras de esa persona. Expresar aprecio fortalece el vínculo de quien lo dice y de quien lo recibe."),
  p("autoconocimiento", "Conocer tus valores simplifica las decisiones: elige lo que esté alineado con lo que más te importa, no con lo que más ruido hace.", { idea: "Terapia de aceptación y compromiso (ACT)" }),
  p("serenidad", "Las emociones son olas: suben, alcanzan un punto y bajan. No tienes que combatirlas, solo dejarlas pasar sin actuar por impulso."),
  p("progreso", "Celebra los avances pequeños: el cerebro repite lo que se siente recompensado. Reconocerlos es parte del método, no vanidad.", { idea: "Refuerzo positivo" }),
  p("vinculos", "Poner un límite con respeto es una forma de cuidar la relación, no de dañarla. Di lo que sí puedes y lo que no.", { idea: "Asertividad" }),
  p("resiliencia", "La adversidad no te define; cómo la enfrentas y con quién la compartes, sí. Pedir ayuda es una estrategia, no una debilidad."),
  p("presente", "Sal a caminar diez minutos sin auriculares: la atención sin estímulos constantes también es descanso."),
  p("esfuerzo", "El estado de flujo aparece cuando el reto está un poco por encima de tu nivel. Busca hoy una tarea que te exija sin abrumarte.", { idea: "Flujo (Mihály Csíkszentmihalyi)" }),
  p("autoconocimiento", "Tu estado de ánimo cambia cómo interpretas el mundo. Antes de decidir algo importante, pregúntate cómo estás.", { idea: "El sesgo del estado de ánimo en la toma de decisiones" }),
  p("comunidad", "Un gesto amable con una persona desconocida mejora el ánimo de ambas. Pruébalo hoy con alguien de tu ciudad.", { idea: "La conducta prosocial" }),
  p("serenidad", "Si no puedes resolver algo ahora, agéndalo: fija un momento para pensarlo y libera la mente hasta entonces.", { idea: "El «tiempo de preocupación» de la terapia cognitiva" }),
  p("progreso", "Cambiar duele menos cuando es gradual. Mejora un 1 % hoy y deja que el tiempo haga la suma."),
  p("vinculos", "La seguridad en los vínculos se construye siendo consistente: aparecer, cumplir y reparar después de un conflicto.", { idea: "Teoría del apego (John Bowlby)" }),
  p("gratitud", "Recordar quién te ayudó a llegar hasta aquí baja el estrés y sube la humildad. Hoy, agradécelo en voz alta."),
  p("resiliencia", "Cuando ya no podemos cambiar una situación, se nos desafía a cambiarnos a nosotros mismos.", { fuente: "Viktor Frankl, El hombre en busca de sentido (traducción libre)" }),
  p("autoconocimiento", "La curiosa paradoja es que cuando me acepto tal como soy, entonces puedo cambiar.", { fuente: "Carl Rogers, El proceso de convertirse en persona (traducción libre)" }),
];

// ── Selección diaria ────────────────────────────────────────────────────────
const N = REFLEXIONES.length;
const ORDEN_TRADICIONES: Tradicion[] = ["estoicismo", "psicologia", "espiritismo"];

/** Generador pseudoaleatorio determinista (mulberry32): la misma semilla da siempre el mismo orden. */
function aleatorio(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function barajar<T>(lista: T[], semilla: number): T[] {
  const a = [...lista];
  const r = aleatorio(semilla);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Orden de una «ronda»: todas las reflexiones exactamente una vez, barajadas de forma distinta en cada ronda e intercaladas de manera
 * proporcional entre las tres tradiciones (así, días seguidos rotan entre estoicismo, psicología y espiritismo).
 */
function ordenBase(ronda: number): Reflexion[] {
  const puntuadas: { r: Reflexion; punto: number; desempate: number }[] = [];
  ORDEN_TRADICIONES.forEach((t, ti) => {
    const lista = barajar(REFLEXIONES.filter((x) => x.tradicion === t), ronda * 31 + ti * 7 + 1);
    lista.forEach((r, i) => puntuadas.push({ r, punto: (i + 0.5) / lista.length, desempate: ti }));
  });
  return puntuadas.sort((a, b) => a.punto - b.punto || a.desempate - b.desempate).map((x) => x.r);
}

/** Orden final de la ronda: la primera no repite la última de la anterior (no habría dos días seguidos iguales al cambiar de ronda). */
export function ordenDeLaRonda(ronda: number): Reflexion[] {
  const orden = ordenBase(ronda);
  if (ronda > 0 && orden[0] === ordenBase(ronda - 1)[N - 1]) [orden[0], orden[1]] = [orden[1], orden[0]];
  return orden;
}

/** Número que identifica a una persona (para que dos personas no vean la misma reflexión el mismo día). */
export function semillaDePersona(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % N;
}

export const numeroDeDia = (fecha: Date) => Math.floor(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) / 86_400_000);

/**
 * La reflexión de un día. Cambia cada día sin repetirse hasta haber recorrido las {N}, rota entre las tres tradiciones y, si se pasa
 * `persona` (su id), cada persona ve una distinta el mismo día. `desplazamiento` da «otra reflexión» del mismo día.
 */
export function reflexionDelDia(fecha = new Date(), desplazamiento = 0, persona = ""): Reflexion {
  const dia = numeroDeDia(fecha) + desplazamiento + (persona ? semillaDePersona(persona) : 0);
  const ronda = Math.floor(dia / N);
  return ordenDeLaRonda(ronda)[((dia % N) + N) % N];
}
