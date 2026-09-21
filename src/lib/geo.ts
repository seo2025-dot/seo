/**
 * Geolocalización e internacionalización: dónde está una persona (país, ciudad, zona horaria y coordenadas aproximadas).
 * Todo es puro y funciona sin red. Principios:
 *   · Privacidad primero: las coordenadas se redondean a 2 decimales (≈1,1 km) antes de guardarse o de ir en una URL; la ubicación
 *     exacta nunca sale del dispositivo. El GPS solo se usa si la persona lo pide y lo acepta.
 *   · Sin permiso también hay ubicación razonable: se deduce el país de la zona horaria del dispositivo y, si no, se usa Cuenca.
 *   · Sin banderas emoji: Windows no las dibuja (salen como letras «EC», «CO»…). Se muestra el código del país.
 */

export interface Pais {
  codigo: string;
  nombre: string;
  /** Zona horaria de la capital (referencia para la hora y para deducir el país). */
  zona: string;
  capital: string;
  lat: number;
  lng: number;
  moneda: string;
  /** Zonas horarias IANA de las que se deduce el país. */
  zonas: string[];
}

export const PAISES: Pais[] = [
  { codigo: "EC", nombre: "Ecuador", zona: "America/Guayaquil", capital: "Quito", lat: -0.1807, lng: -78.4678, moneda: "USD", zonas: ["America/Guayaquil", "Pacific/Galapagos"] },
  { codigo: "CO", nombre: "Colombia", zona: "America/Bogota", capital: "Bogotá", lat: 4.711, lng: -74.0721, moneda: "COP", zonas: ["America/Bogota"] },
  { codigo: "PE", nombre: "Perú", zona: "America/Lima", capital: "Lima", lat: -12.0464, lng: -77.0428, moneda: "PEN", zonas: ["America/Lima"] },
  { codigo: "MX", nombre: "México", zona: "America/Mexico_City", capital: "Ciudad de México", lat: 19.4326, lng: -99.1332, moneda: "MXN", zonas: ["America/Mexico_City", "America/Monterrey", "America/Merida", "America/Cancun", "America/Tijuana", "America/Chihuahua", "America/Hermosillo", "America/Mazatlan"] },
  { codigo: "AR", nombre: "Argentina", zona: "America/Argentina/Buenos_Aires", capital: "Buenos Aires", lat: -34.6037, lng: -58.3816, moneda: "ARS", zonas: ["America/Argentina/Buenos_Aires", "America/Buenos_Aires", "America/Argentina/Cordoba", "America/Argentina/Mendoza"] },
  { codigo: "CL", nombre: "Chile", zona: "America/Santiago", capital: "Santiago", lat: -33.4489, lng: -70.6693, moneda: "CLP", zonas: ["America/Santiago", "America/Punta_Arenas"] },
  { codigo: "BO", nombre: "Bolivia", zona: "America/La_Paz", capital: "La Paz", lat: -16.4897, lng: -68.1193, moneda: "BOB", zonas: ["America/La_Paz"] },
  { codigo: "UY", nombre: "Uruguay", zona: "America/Montevideo", capital: "Montevideo", lat: -34.9011, lng: -56.1645, moneda: "UYU", zonas: ["America/Montevideo"] },
  { codigo: "PY", nombre: "Paraguay", zona: "America/Asuncion", capital: "Asunción", lat: -25.2637, lng: -57.5759, moneda: "PYG", zonas: ["America/Asuncion"] },
  { codigo: "VE", nombre: "Venezuela", zona: "America/Caracas", capital: "Caracas", lat: 10.4806, lng: -66.9036, moneda: "VES", zonas: ["America/Caracas"] },
  { codigo: "BR", nombre: "Brasil", zona: "America/Sao_Paulo", capital: "Brasilia", lat: -15.7939, lng: -47.8828, moneda: "BRL", zonas: ["America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "America/Recife", "America/Bahia"] },
  { codigo: "PA", nombre: "Panamá", zona: "America/Panama", capital: "Ciudad de Panamá", lat: 8.9824, lng: -79.5199, moneda: "USD", zonas: ["America/Panama"] },
  { codigo: "CR", nombre: "Costa Rica", zona: "America/Costa_Rica", capital: "San José", lat: 9.9281, lng: -84.0907, moneda: "CRC", zonas: ["America/Costa_Rica"] },
  { codigo: "GT", nombre: "Guatemala", zona: "America/Guatemala", capital: "Ciudad de Guatemala", lat: 14.6349, lng: -90.5069, moneda: "GTQ", zonas: ["America/Guatemala"] },
  { codigo: "SV", nombre: "El Salvador", zona: "America/El_Salvador", capital: "San Salvador", lat: 13.6929, lng: -89.2182, moneda: "USD", zonas: ["America/El_Salvador"] },
  { codigo: "HN", nombre: "Honduras", zona: "America/Tegucigalpa", capital: "Tegucigalpa", lat: 14.0723, lng: -87.1921, moneda: "HNL", zonas: ["America/Tegucigalpa"] },
  { codigo: "DO", nombre: "República Dominicana", zona: "America/Santo_Domingo", capital: "Santo Domingo", lat: 18.4861, lng: -69.9312, moneda: "DOP", zonas: ["America/Santo_Domingo"] },
  { codigo: "US", nombre: "Estados Unidos", zona: "America/New_York", capital: "Washington D. C.", lat: 38.9072, lng: -77.0369, moneda: "USD", zonas: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "America/Detroit"] },
  { codigo: "CA", nombre: "Canadá", zona: "America/Toronto", capital: "Ottawa", lat: 45.4215, lng: -75.6972, moneda: "CAD", zonas: ["America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg", "America/Halifax"] },
  { codigo: "ES", nombre: "España", zona: "Europe/Madrid", capital: "Madrid", lat: 40.4168, lng: -3.7038, moneda: "EUR", zonas: ["Europe/Madrid", "Atlantic/Canary"] },
  { codigo: "PT", nombre: "Portugal", zona: "Europe/Lisbon", capital: "Lisboa", lat: 38.7223, lng: -9.1393, moneda: "EUR", zonas: ["Europe/Lisbon", "Atlantic/Azores"] },
  { codigo: "FR", nombre: "Francia", zona: "Europe/Paris", capital: "París", lat: 48.8566, lng: 2.3522, moneda: "EUR", zonas: ["Europe/Paris"] },
  { codigo: "IT", nombre: "Italia", zona: "Europe/Rome", capital: "Roma", lat: 41.9028, lng: 12.4964, moneda: "EUR", zonas: ["Europe/Rome"] },
  { codigo: "DE", nombre: "Alemania", zona: "Europe/Berlin", capital: "Berlín", lat: 52.52, lng: 13.405, moneda: "EUR", zonas: ["Europe/Berlin"] },
  { codigo: "GB", nombre: "Reino Unido", zona: "Europe/London", capital: "Londres", lat: 51.5074, lng: -0.1278, moneda: "GBP", zonas: ["Europe/London"] },
];

export const PAIS_POR_CODIGO: Record<string, Pais> = Object.fromEntries(PAISES.map((p) => [p.codigo, p]));

/** Ciudades de referencia (para poner nombre a unas coordenadas sin llamar a ningún servicio externo). */
export interface Ciudad {
  nombre: string;
  pais: string;
  lat: number;
  lng: number;
}

export const CIUDADES: Ciudad[] = [
  { nombre: "Cuenca", pais: "EC", lat: -2.9001, lng: -79.0059 },
  { nombre: "Quito", pais: "EC", lat: -0.1807, lng: -78.4678 },
  { nombre: "Guayaquil", pais: "EC", lat: -2.1894, lng: -79.8891 },
  { nombre: "Loja", pais: "EC", lat: -3.9931, lng: -79.2042 },
  { nombre: "Ambato", pais: "EC", lat: -1.2417, lng: -78.6197 },
  { nombre: "Riobamba", pais: "EC", lat: -1.6636, lng: -78.6546 },
  { nombre: "Machala", pais: "EC", lat: -3.2581, lng: -79.9554 },
  { nombre: "Manta", pais: "EC", lat: -0.9677, lng: -80.7089 },
  { nombre: "Portoviejo", pais: "EC", lat: -1.0546, lng: -80.4545 },
  { nombre: "Esmeraldas", pais: "EC", lat: 0.9682, lng: -79.6517 },
  { nombre: "Ibarra", pais: "EC", lat: 0.3517, lng: -78.1223 },
  { nombre: "Azogues", pais: "EC", lat: -2.7397, lng: -78.8486 },
  { nombre: "Santo Domingo", pais: "EC", lat: -0.2531, lng: -79.1754 },
  { nombre: "Bogotá", pais: "CO", lat: 4.711, lng: -74.0721 },
  { nombre: "Medellín", pais: "CO", lat: 6.2442, lng: -75.5812 },
  { nombre: "Cali", pais: "CO", lat: 3.4516, lng: -76.532 },
  { nombre: "Lima", pais: "PE", lat: -12.0464, lng: -77.0428 },
  { nombre: "Arequipa", pais: "PE", lat: -16.409, lng: -71.5375 },
  { nombre: "Ciudad de México", pais: "MX", lat: 19.4326, lng: -99.1332 },
  { nombre: "Guadalajara", pais: "MX", lat: 20.6597, lng: -103.3496 },
  { nombre: "Buenos Aires", pais: "AR", lat: -34.6037, lng: -58.3816 },
  { nombre: "Santiago", pais: "CL", lat: -33.4489, lng: -70.6693 },
  { nombre: "São Paulo", pais: "BR", lat: -23.5505, lng: -46.6333 },
  { nombre: "Panamá", pais: "PA", lat: 8.9824, lng: -79.5199 },
  { nombre: "Madrid", pais: "ES", lat: 40.4168, lng: -3.7038 },
  { nombre: "Barcelona", pais: "ES", lat: 41.3874, lng: 2.1686 },
  { nombre: "Nueva York", pais: "US", lat: 40.7128, lng: -74.006 },
  { nombre: "Miami", pais: "US", lat: 25.7617, lng: -80.1918 },
  { nombre: "Los Ángeles", pais: "US", lat: 34.0522, lng: -118.2437 },
  { nombre: "Londres", pais: "GB", lat: 51.5074, lng: -0.1278 },
  { nombre: "París", pais: "FR", lat: 48.8566, lng: 2.3522 },
  { nombre: "Roma", pais: "IT", lat: 41.9028, lng: 12.4964 },
];

// ── Ubicación de una persona ────────────────────────────────────────────────
export type FuenteUbicacion = "gps" | "manual" | "zona_horaria" | "defecto";

export interface Ubicacion {
  pais: string;
  ciudad?: string;
  /** Coordenadas aproximadas (2 decimales). */
  lat: number;
  lng: number;
  /** Zona horaria IANA, p. ej. «America/Guayaquil». */
  zona: string;
  fuente: FuenteUbicacion;
}

export const CUENCA: Ubicacion = { pais: "EC", ciudad: "Cuenca", lat: -2.9, lng: -79.01, zona: "America/Guayaquil", fuente: "defecto" };

/** ≈1,1 km: suficiente para «cerca de mí» y demasiado grueso para saber dónde vive alguien. */
export const redondearCoordenada = (n: number, decimales = 2) => Math.round(n * 10 ** decimales) / 10 ** decimales;

export const coordenadasValidas = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const R_TIERRA_KM = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** «450 m», «3,2 km», «48 km»: distancia legible para tarjetas y listados. */
export function textoDistancia(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

/** Ciudad de referencia más cercana (y a cuántos km está). Sirve para poner nombre a unas coordenadas. */
export function ciudadMasCercana(lat: number, lng: number, pais?: string): { ciudad: Ciudad; km: number } | null {
  let mejor: { ciudad: Ciudad; km: number } | null = null;
  for (const c of CIUDADES) {
    if (pais && c.pais !== pais) continue;
    const km = distanciaKm({ lat, lng }, c);
    if (!mejor || km < mejor.km) mejor = { ciudad: c, km };
  }
  return mejor;
}

/** País de una zona horaria IANA (null si no es de los que conocemos). */
export const paisDeZona = (zona: string): string | null => PAISES.find((p) => p.zonas.includes(zona))?.codigo ?? null;

/** Zona horaria del dispositivo. */
export function zonaDelDispositivo(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Es una zona horaria IANA que este navegador entiende. */
export function zonaValida(zona: string): boolean {
  try {
    new Intl.DateTimeFormat("es", { timeZone: zona });
    return /^[A-Za-z_]+(\/[A-Za-z_+\-0-9]+){1,2}$/.test(zona);
  } catch {
    return false;
  }
}

/** Ubicación sin pedir permiso: el país sale de la zona horaria del dispositivo y las coordenadas son las de su capital. */
export function ubicacionPorZona(zona: string | null): Ubicacion {
  const pais = zona ? paisDeZona(zona) : null;
  if (!pais || !zona) return CUENCA;
  const p = PAIS_POR_CODIGO[pais];
  return { pais, ciudad: p.capital, lat: redondearCoordenada(p.lat), lng: redondearCoordenada(p.lng), zona, fuente: "zona_horaria" };
}

/** Ubicación elegida a mano: un país y, si se quiere, una de las ciudades de referencia. */
export function ubicacionManual(codigoPais: string, ciudad?: string): Ubicacion | null {
  const p = PAIS_POR_CODIGO[codigoPais];
  if (!p) return null;
  const c = ciudad ? CIUDADES.find((x) => x.pais === p.codigo && x.nombre === ciudad) : undefined;
  return { pais: p.codigo, ciudad: c?.nombre ?? p.capital, lat: redondearCoordenada(c?.lat ?? p.lat), lng: redondearCoordenada(c?.lng ?? p.lng), zona: p.zona, fuente: "manual" };
}

/**
 * Ubicación a partir del GPS del dispositivo. El país es el de la ciudad de referencia más cercana si está a menos de 600 km; si no,
 * el de la zona horaria del dispositivo. Las coordenadas se redondean aquí: nada más preciso sale de esta función.
 */
export function ubicacionDesdeGps(lat: number, lng: number, zonaDispositivo: string | null): Ubicacion | null {
  if (!coordenadasValidas(lat, lng)) return null;
  const cerca = ciudadMasCercana(lat, lng);
  const pais = (cerca && cerca.km <= 600 ? cerca.ciudad.pais : null) ?? (zonaDispositivo ? paisDeZona(zonaDispositivo) : null) ?? "EC";
  const enPais = ciudadMasCercana(lat, lng, pais);
  return {
    pais,
    ciudad: enPais && enPais.km <= 80 ? enPais.ciudad.nombre : undefined,
    lat: redondearCoordenada(lat),
    lng: redondearCoordenada(lng),
    zona: zonaDispositivo && zonaValida(zonaDispositivo) ? zonaDispositivo : PAIS_POR_CODIGO[pais]?.zona ?? "America/Guayaquil",
    fuente: "gps",
  };
}

/** Lee una ubicación guardada (localStorage) descartando lo que no sea válido. */
export function leerUbicacion(texto: string | null): Ubicacion | null {
  if (!texto) return null;
  try {
    const u = JSON.parse(texto) as Partial<Ubicacion>;
    if (!u.pais || !PAIS_POR_CODIGO[u.pais] || !coordenadasValidas(u.lat, u.lng) || typeof u.zona !== "string" || !zonaValida(u.zona)) return null;
    const fuente: FuenteUbicacion = u.fuente === "gps" || u.fuente === "manual" || u.fuente === "zona_horaria" ? u.fuente : "defecto";
    return { pais: u.pais, ciudad: typeof u.ciudad === "string" ? u.ciudad.slice(0, 60) : undefined, lat: redondearCoordenada(u.lat as number), lng: redondearCoordenada(u.lng as number), zona: u.zona, fuente };
  } catch {
    return null;
  }
}

/** «Cuenca, Ecuador» / «Ecuador». */
export function etiquetaUbicacion(u: Pick<Ubicacion, "pais" | "ciudad">): string {
  const pais = PAIS_POR_CODIGO[u.pais]?.nombre ?? u.pais;
  return u.ciudad && u.ciudad !== pais ? `${u.ciudad}, ${pais}` : pais;
}

/** Desfase (en minutos respecto de UTC) de una zona horaria en un instante concreto. */
export function desfaseMinutos(zona: string, ms: number): number {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: zona, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const partes = Object.fromEntries(f.formatToParts(ms).map((p) => [p.type, Number(p.value)]));
  const comoUtc = Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour, partes.minute, partes.second);
  return Math.round((comoUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}
