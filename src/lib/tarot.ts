export interface Arcano {
  n: number;
  nombre: string;
  simbolo: string;
  clave: string;
  amor: string;
  dinero: string;
  suerte: string;
}

// Solo con fines de entretenimiento: las lecturas no predicen el futuro ni sustituyen asesoría profesional.
export const ARCANOS: Arcano[] = [
  { n: 0, nombre: "El Loco", simbolo: "🃏", clave: "Nuevos comienzos", amor: "Anímate a abrir el corazón sin expectativas: la espontaneidad atrae.", dinero: "Buen día para explorar una idea distinta, pero mide el riesgo.", suerte: "La suerte acompaña a quien se atreve a dar el primer paso." },
  { n: 1, nombre: "El Mago", simbolo: "✨", clave: "Voluntad y talento", amor: "Tu carisma está en su punto más alto: comunica lo que sientes.", dinero: "Tienes los recursos para concretar ese negocio; enfócate y actúa.", suerte: "Hoy conviertes las oportunidades en resultados." },
  { n: 2, nombre: "La Sacerdotisa", simbolo: "🌙", clave: "Intuición", amor: "Escucha tu intuición: lo que no se dice también habla.", dinero: "Investiga antes de decidir; hay información que aún no ves.", suerte: "Los sueños y corazonadas traen pistas útiles." },
  { n: 3, nombre: "La Emperatriz", simbolo: "👑", clave: "Abundancia", amor: "Momento fértil para el cariño, los detalles y el disfrute.", dinero: "Se favorece lo que cuidas con constancia: inversiones a largo plazo.", suerte: "La abundancia crece donde pones atención amable." },
  { n: 4, nombre: "El Emperador", simbolo: "🏛️", clave: "Estructura", amor: "Estabilidad y compromiso: define límites y acuerdos claros.", dinero: "Ordena tus finanzas y negocia desde la solidez.", suerte: "La disciplina de hoy es la suerte de mañana." },
  { n: 5, nombre: "El Hierofante", simbolo: "📜", clave: "Tradición", amor: "Valores compartidos pesan más que la química del momento.", dinero: "Asesórate con alguien de confianza antes de firmar.", suerte: "Un consejo de alguien con experiencia te abre una puerta." },
  { n: 6, nombre: "Los Enamorados", simbolo: "💞", clave: "Elección", amor: "Una decisión del corazón se presenta: elige con honestidad.", dinero: "Alianzas y socios: elige con quién sí quieres construir.", suerte: "Las conexiones auténticas son tu mayor golpe de suerte." },
  { n: 7, nombre: "El Carro", simbolo: "🏇", clave: "Avance", amor: "Toma la iniciativa: el momento pide movimiento.", dinero: "Empuje y determinación: buen día para cerrar operaciones.", suerte: "Vas en la dirección correcta; no frenes ahora." },
  { n: 8, nombre: "La Fuerza", simbolo: "🦁", clave: "Coraje sereno", amor: "La paciencia y la ternura vencen a la impulsividad.", dinero: "Mantén la calma en negociaciones tensas: ganas por temple.", suerte: "Tu serenidad es tu amuleto de hoy." },
  { n: 9, nombre: "El Ermitaño", simbolo: "🕯️", clave: "Reflexión", amor: "Tiempo para conocerte mejor antes de conocer a otros.", dinero: "Revisa números y planes con calma; evita decisiones apuradas.", suerte: "La respuesta que buscas llega en el silencio." },
  { n: 10, nombre: "La Rueda de la Fortuna", simbolo: "🎡", clave: "Cambio de ciclo", amor: "Un giro inesperado puede acercarte a alguien.", dinero: "Aparece una oportunidad: mantente flexible para aprovecharla.", suerte: "La rueda gira a tu favor: estate atento a las señales." },
  { n: 11, nombre: "La Justicia", simbolo: "⚖️", clave: "Equilibrio", amor: "Busca reciprocidad: da y recibe en la misma medida.", dinero: "Lee bien los contratos; hoy premia la transparencia.", suerte: "Lo justo se resuelve a tu favor." },
  { n: 12, nombre: "El Colgado", simbolo: "🙃", clave: "Nueva perspectiva", amor: "Suelta el control: mirar distinto revela lo que buscas.", dinero: "Pausa estratégica: esperar puede ser la mejor jugada.", suerte: "Un cambio de enfoque desbloquea una situación estancada." },
  { n: 13, nombre: "La Muerte", simbolo: "🦋", clave: "Transformación", amor: "Cierra un ciclo con gratitud para dar espacio a algo nuevo.", dinero: "Deja ir lo que ya no rinde y reinvierte en lo que sí.", suerte: "Termina algo para que empiece lo mejor." },
  { n: 14, nombre: "La Templanza", simbolo: "🌈", clave: "Armonía", amor: "Mezcla justa de pasión y calma: la relación fluye.", dinero: "Diversifica y equilibra: evita extremos.", suerte: "La moderación te trae buenas noticias." },
  { n: 15, nombre: "El Diablo", simbolo: "⛓️", clave: "Apegos", amor: "Cuidado con dinámicas de dependencia o celos.", dinero: "Evita gastos impulsivos y promesas de ganancia fácil.", suerte: "Reconocer tu atadura es el primer paso para liberarte." },
  { n: 16, nombre: "La Torre", simbolo: "⚡", clave: "Ruptura necesaria", amor: "Una verdad sale a la luz: mejor ahora que después.", dinero: "Revisa tus bases: lo débil se cae, lo sólido queda.", suerte: "Lo inesperado te obliga a crecer." },
  { n: 17, nombre: "La Estrella", simbolo: "⭐", clave: "Esperanza", amor: "Sanación y confianza: se abre un tiempo amable.", dinero: "Proyectos con visión a futuro reciben buena energía.", suerte: "Tus deseos están más cerca de lo que parece." },
  { n: 18, nombre: "La Luna", simbolo: "🌕", clave: "Ilusión", amor: "No todo es lo que parece: pregunta antes de suponer.", dinero: "Desconfía de lo poco claro; pide todo por escrito.", suerte: "Ve despacio: la claridad llega con el amanecer." },
  { n: 19, nombre: "El Sol", simbolo: "☀️", clave: "Alegría", amor: "Un día luminoso para conectar, celebrar y mostrarte tal cual eres.", dinero: "Éxito y reconocimiento: buen momento para mostrar tu trabajo.", suerte: "Hoy la suerte brilla contigo." },
  { n: 20, nombre: "El Juicio", simbolo: "📯", clave: "Renacer", amor: "Perdona y decide: es hora de responder a un llamado interior.", dinero: "Evalúa tu trayectoria: es momento de dar un salto.", suerte: "Una segunda oportunidad llama a tu puerta." },
  { n: 21, nombre: "El Mundo", simbolo: "🌍", clave: "Culminación", amor: "Plenitud: una relación o etapa llega a su punto de madurez.", dinero: "Cierre exitoso de un proyecto y apertura de uno mayor.", suerte: "Todo encaja: celebra lo logrado." },
];

export const POSICIONES_PREMIUM = ["Pasado", "Presente", "Futuro"] as const;

/** Elige `cantidad` arcanos distintos al azar. */
export function sacarCartas(cantidad: number): number[] {
  const mazo = ARCANOS.map((a) => a.n);
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
  }
  return mazo.slice(0, cantidad);
}
