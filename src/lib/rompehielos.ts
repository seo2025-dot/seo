import type { Anuncio } from "@/types/mercado";
import type { Usuario } from "@/types/social";
import { formatearPrecio } from "@/lib/formato";
import { precioFinal } from "@/lib/anuncios";
import { infoSigno } from "@/lib/astrologia";
import { compatibilidad, ETIQUETA_INTERES, primerNombre } from "@/lib/social";

/** 3 rompehielos para el chat tras guardar una oferta y conectar con su dueño. */
export function rompehielosAnuncio(a: Anuncio, dueno: Usuario): string[] {
  const nombre = primerNombre(dueno.nombre);
  const saludo = `¡Hola ${nombre}! Me encantó "${a.titulo}" en ${a.ubicacion}. ¿Sigue disponible?`;
  const precio = formatearPrecio(precioFinal(a), a.moneda);

  let segundo: string;
  if (a.tipo === "negocio") segundo = `¿Podrías compartirme balances y facturación? La inversión de ${precio} me interesa.`;
  else if (a.tipo === "vehiculo") segundo = a.operacion === "alquiler" ? "¿Qué incluye el alquiler (seguro, kilometraje) y qué depósito piden?" : "¿Tiene historial de servicios y aceptas inspección mecánica?";
  else if (a.subtipo === "terreno") segundo = "¿El terreno cuenta con escritura y todos los servicios conectados?";
  else if (a.operacion === "alquiler") segundo = `¿Qué requisitos piden para alquilar? El valor de ${precio}/mes, ¿incluye gastos?`;
  else segundo = `¿Hay margen para negociar el precio de ${precio}?`;

  const tercero =
    a.tipo === "vehiculo"
      ? "¿Podría probarlo esta semana? Tengo disponibilidad por la tarde."
      : "¿Podríamos agendar una visita o videollamada esta semana?";
  return [saludo, segundo, tercero];
}

/** 3 rompehielos para el Match persona-persona, con guiño astral cuando hay datos. */
export function rompehielosPersona(yo: Usuario, otro: Usuario): string[] {
  const nombre = primerNombre(otro.nombre);
  const { zonasComunes, interesesComunes } = compatibilidad(yo, otro);
  const zona = zonasComunes[0] ?? otro.zonas[0] ?? "la ciudad";
  const interes = interesesComunes[0] ?? otro.intereses[0];

  const porInteres: Record<string, string> = {
    roomie: `¿Sigues buscando roomie? Estoy armando plan para compartir en ${zona}, ¿te cuento?`,
    inversor: `¿Te interesaría analizar oportunidades en ${zona} entre los dos?`,
    comprador: `Yo también estoy mirando para comprar. ¿Compartimos información de ${zona}?`,
    amigos: `¿Te gustaría tomar un café y charlar sobre ${zona}?`,
    inquilino: `¿Ya encontraste algo para alquilar en ${zona}? Puedo pasarte algunos datos.`,
    anfitrion: `Vi que también publicas propiedades en ${zona}, ¿intercambiamos consejos?`,
  };

  const astral =
    yo.signo && otro.signo
      ? `Soy ${infoSigno(yo.signo).nombre} y tú ${infoSigno(otro.signo).nombre} ${infoSigno(otro.signo).simbolo}: ¿crees en la compatibilidad astral? 😄`
      : `Me cayó muy bien tu perfil${interes ? ` (${ETIQUETA_INTERES[interes]})` : ""}, ¿hablamos?`;

  return [
    `¡Hola ${nombre}! Vi que también te interesa ${zona}. ¿Qué estás buscando por ahí?`,
    interes ? porInteres[interes] : `¿Qué tal si compartimos experiencias sobre ${zona}?`,
    astral,
  ];
}

export const RESPUESTAS_RAPIDAS = {
  anuncio: ["📅 Quiero agendar una visita", "📸 ¿Tienes más fotos?", "💬 ¿Cuáles son los gastos?"],
  directo: ["☕ ¿Quedamos para un café?", "📍 ¿Qué zonas estás mirando?", "🔮 ¿Cuál es tu signo?"],
  servicio: ["💬 ¿Cuál es el precio final?", "⏱️ ¿En cuánto tiempo entregas?", "🖼️ ¿Puedo ver tu portafolio?"],
  empleo: ["💰 ¿Cuál es la remuneración?", "📆 ¿Cuándo sería el inicio?"],
} as const;
