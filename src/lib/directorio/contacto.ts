/** Mismo patrón que `provider_contacts.phone/whatsapp` en SQL: +opcional, 7 a 20 caracteres de dígitos, espacios, paréntesis y guiones. */
export const PATRON_TELEFONO = /^\+?[0-9][0-9 ()-]{6,19}$/;

export const telefonoValido = (t: string) => PATRON_TELEFONO.test(t.trim());

/**
 * Número en formato internacional sin «+» (el que usa wa.me), para teléfonos de Ecuador escritos de cualquier forma:
 *   0991234567 · 099 123 4567 · +593 99 123 4567 · 593991234567 · 07 2345678 (fijo de Cuenca)
 * Un número con «+» de otro país se respeta tal cual. Devuelve null si no tiene una longitud plausible.
 */
export function normalizarTelefonoEC(texto: string): string | null {
  let d = texto.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2); // 00593…
  // Número internacional escrito con «+» y otro país (+1 555…): se respeta tal cual.
  if (texto.trim().startsWith("+") && !d.startsWith("593")) return d.length >= 9 && d.length <= 15 ? d : null;
  if (d.startsWith("593")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  // Ya sin prefijo de país ni cero inicial: celular = 9 dígitos que empiezan en 9; fijo = 8 dígitos (código de área + número)
  const nacional = d;
  if (nacional.length < 8 || nacional.length > 12) return null;
  return `593${nacional}`;
}

/** Enlace de WhatsApp con mensaje opcional; null si el número no es válido. */
export function enlaceWhatsapp(telefono: string, mensaje?: string): string | null {
  const n = normalizarTelefonoEC(telefono);
  if (!n) return null;
  return `https://wa.me/${n}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;
}

export function enlaceTel(telefono: string): string | null {
  const n = normalizarTelefonoEC(telefono);
  return n ? `tel:+${n}` : null;
}

/** Mensaje inicial para pedir por WhatsApp. */
export const mensajePedido = (negocio: string) => `Hola ${negocio}, los vi en conectari.com. Quisiera hacer un pedido. ¿Me ayudan?`;

/** Formato legible para mostrar (0991234567 → 099 123 4567). Si no reconoce el formato lo deja como está. */
export function formatearTelefono(texto: string): string {
  const t = texto.trim();
  const d = t.replace(/\D/g, "");
  if (/^09\d{8}$/.test(d)) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  if (/^0[2-7]\d{7}$/.test(d)) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  return t;
}
