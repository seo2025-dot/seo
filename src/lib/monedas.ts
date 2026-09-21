/**
 * Economía de monedas: usos gratis, tarifas de uso y paquetes de recarga.
 * La fuente de verdad son las tablas `coin_prices`, `coin_packages` y `coin_settings` (actualización 010, editables por un administrador);
 * los valores de aquí son los de fábrica y sirven para mostrar la interfaz mientras carga y para las pruebas de paridad.
 */

export type AccionUso = "order_place" | "order_accept" | "request_create" | "offer_send" | "event_publish" | "event_reserve" | "chat_message" | "provider_boost";

export interface PrecioUso {
  accion: AccionUso;
  etiqueta: string;
  /** Usos gratis por persona (en `chat_message`: mensajes gratis por conversación). */
  gratis: number;
  /** Monedas por uso (en `chat_message`: cada 5 mensajes). */
  coste: number;
  /** Quién paga: sirve para explicarlo en pantalla. */
  quien: string;
}

export const PRECIOS_DEFECTO: PrecioUso[] = [
  { accion: "order_place", etiqueta: "Hacer un pedido", gratis: 3, coste: 1, quien: "Quien pide" },
  { accion: "order_accept", etiqueta: "Aceptar un pedido (negocio)", gratis: 3, coste: 5, quien: "El negocio, al aceptar" },
  { accion: "request_create", etiqueta: "Pedir ofertas", gratis: 3, coste: 2, quien: "Quien pide" },
  { accion: "offer_send", etiqueta: "Enviar una oferta (profesional)", gratis: 3, coste: 3, quien: "El profesional, al ofertar" },
  { accion: "event_publish", etiqueta: "Publicar un evento", gratis: 3, coste: 10, quien: "El organizador" },
  { accion: "event_reserve", etiqueta: "Reservar entradas", gratis: 3, coste: 1, quien: "Quien reserva" },
  { accion: "chat_message", etiqueta: "Mensajes en citas (cada 5)", gratis: 3, coste: 1, quien: "Quien escribe" },
  { accion: "provider_boost", etiqueta: "Destacar mi negocio 24 h", gratis: 0, coste: 30, quien: "El negocio" },
];

export interface UsoAccion {
  accion: string;
  gratisUsados: number;
  pagadosUsados: number;
  gastadas: number;
}

export interface EstadoUso {
  /** Usos gratis que le quedan (0 si ya los gastó). */
  gratisRestantes: number;
  /** Monedas que costará el próximo uso (0 si aún es gratis). */
  cuesta: number;
  /** ¿El próximo uso es gratis? */
  gratis: boolean;
}

/** Qué pasará la próxima vez que use esta acción. Mismas reglas que `_charge()` en SQL. */
export function estadoUso(precio: Pick<PrecioUso, "gratis" | "coste">, uso?: Pick<UsoAccion, "gratisUsados"> | null): EstadoUso {
  const restantes = Math.max(0, precio.gratis - (uso?.gratisUsados ?? 0));
  return { gratisRestantes: restantes, cuesta: restantes > 0 ? 0 : precio.coste, gratis: restantes > 0 || precio.coste === 0 };
}

/**
 * Coste del siguiente mensaje de cita, con `enviados` mensajes ya escritos en esa conversación. Mismas reglas que `_messages_charge()`:
 * los primeros `gratis` son gratis y después se cobra el primero de cada bloque de 5.
 */
export function costeMensaje(precio: Pick<PrecioUso, "gratis" | "coste">, enviados: number): number {
  if (enviados < precio.gratis || precio.coste === 0) return 0;
  return (enviados - precio.gratis) % 5 === 0 ? precio.coste : 0;
}

/** Mensajes que puede escribir aún sin que se cobre nada (hasta el próximo cobro). */
export function mensajesHastaCobro(precio: Pick<PrecioUso, "gratis" | "coste">, enviados: number): number {
  if (precio.coste === 0) return Infinity;
  let n = 0;
  while (costeMensaje(precio, enviados + n) === 0 && n < 1000) n++;
  return n;
}

export const textoMonedas = (n: number) => `${n} ${n === 1 ? "moneda" : "monedas"}`;

/** «Gratis · te quedan 2» / «Gratis» / «1 moneda» para una etiqueta junto a un botón. */
export function textoCoste(e: EstadoUso): string {
  if (e.gratis && e.gratisRestantes > 0) return `Gratis · te ${e.gratisRestantes === 1 ? "queda 1" : `quedan ${e.gratisRestantes}`}`;
  return e.cuesta === 0 ? "Gratis" : textoMonedas(e.cuesta);
}

// ── Saldo insuficiente ──────────────────────────────────────────────────────
const RE_SALDO = /insufficient_coins(?::([a-z_]+):(\d+))?/;

export const esSaldoInsuficiente = (mensaje: string) => RE_SALDO.test(mensaje);

/** `insufficient_coins:order_accept:5` → { accion: "order_accept", coste: 5 } (sin datos si es el error genérico de los canjes). */
export function detalleSaldo(mensaje: string): { accion?: AccionUso; coste?: number } | null {
  const m = RE_SALDO.exec(mensaje);
  if (!m) return null;
  return m[1] ? { accion: m[1] as AccionUso, coste: Number(m[2]) } : {};
}

const VERBO: Record<AccionUso, string> = {
  order_place: "hacer este pedido",
  order_accept: "aceptar este pedido",
  request_create: "publicar tu solicitud",
  offer_send: "enviar tu oferta",
  event_publish: "publicar este evento",
  event_reserve: "reservar estas entradas",
  chat_message: "seguir escribiendo en esta cita",
  provider_boost: "destacar tu negocio",
};

/** Mensaje amable cuando falta saldo. Empieza por 🪙: las pantallas usan ese prefijo para ofrecer «Recargar» y «Ganar monedas». */
export function mensajeSaldoInsuficiente(mensaje: string): string | null {
  const d = detalleSaldo(mensaje);
  if (!d) return null;
  if (!d.accion || d.coste === undefined) return "🪙 No tienes suficientes monedas.";
  return `🪙 Necesitas ${textoMonedas(d.coste)} para ${VERBO[d.accion] ?? "continuar"}. Recarga o gánalas con retos.`;
}

export const esMensajeDeMonedas = (texto: string) => texto.startsWith("🪙");

// ── Paquetes de recarga ─────────────────────────────────────────────────────
export interface PaqueteMonedas {
  id: string;
  etiqueta: string;
  centavos: number;
  monedas: number;
  insignia?: string;
}

export const PAQUETES_DEFECTO: PaqueteMonedas[] = [
  { id: "mini", etiqueta: "Recarga mini", centavos: 50, monedas: 50 },
  { id: "plus", etiqueta: "Recarga plus", centavos: 150, monedas: 165, insignia: "Más popular" },
  { id: "pro", etiqueta: "Recarga pro", centavos: 350, monedas: 420, insignia: "Mejor precio" },
];

export const BONO_PRIMERA_COMPRA_PCT = 25;

/** Monedas extra de la primera compra (mismo redondeo que `create_coin_payment`: hacia abajo). */
export const bonoPrimeraCompra = (monedas: number, pct = BONO_PRIMERA_COMPRA_PCT) => Math.floor((monedas * pct) / 100);

export const dolares = (centavos: number) => `$${(centavos / 100).toFixed(2)}`;

/** Centavos de dólar que cuesta cada moneda (para comparar paquetes). */
export const centavosPorMoneda = (p: Pick<PaqueteMonedas, "centavos" | "monedas">) => p.centavos / p.monedas;

/** Cuánto más barata sale cada moneda que en el paquete más pequeño, en %. */
export function ahorroFrente(p: PaqueteMonedas, base: PaqueteMonedas): number {
  return Math.max(0, Math.round((1 - centavosPorMoneda(p) / centavosPorMoneda(base)) * 100));
}

export type Pasarela = "payphone" | "paypal" | "prueba";
export const PASARELAS: Record<Pasarela, { etiqueta: string; ayuda: string }> = {
  payphone: { etiqueta: "PayPhone", ayuda: "Tarjeta o app PayPhone (Ecuador)" },
  paypal: { etiqueta: "PayPal", ayuda: "PayPal o tarjeta internacional" },
  prueba: { etiqueta: "Pago de prueba", ayuda: "Solo en desarrollo: acredita al instante sin cobrar" },
};

// ── Movimientos ─────────────────────────────────────────────────────────────
/** Texto legible del motivo de un movimiento de la billetera (`wallet_ledger.reason`). */
export function textoMovimiento(motivo: string): string {
  const [tipo, resto] = motivo.split(":");
  const uso = PRECIOS_DEFECTO.find((p) => p.accion === resto)?.etiqueta;
  switch (tipo) {
    case "purchase": return "Recarga de monedas";
    case "use": return uso ?? "Uso de la plataforma";
    case "refund": return `Devolución${PRECIOS_DEFECTO.find((p) => p.accion === resto) ? `: ${PRECIOS_DEFECTO.find((p) => p.accion === resto)!.etiqueta.toLowerCase()}` : ""}`;
    case "challenge": return "Reto completado";
    case "admin": return `Regalo: ${(motivo.slice(6) || "soporte").trim()}`;
    case "daily_checkin": return "Bono diario";
    case "wheel": return "Ruleta";
    case "referral": return "Invitaste a alguien";
    case "referred_welcome": return "Bienvenida por invitación";
    case "mission": return "Misión cumplida";
    case "daily": return "Reto diario";
    case "boost": return "Destacar un anuncio";
    case "super_likes": return "Pack de super likes";
    case "premium_reading": return "Lectura premium";
    case "directory_first_provider": return "Tu primer negocio publicado";
    default: return tipo.startsWith("referral_milestone") ? "Hito de invitaciones" : "Movimiento";
  }
}
