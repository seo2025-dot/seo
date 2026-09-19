/** Configuración de la economía de puntos (monedas virtuales sin valor monetario). */

export const SEGMENTOS_RULETA = [5, 10, 20, 50, 10, 100, 5, 25];

export const COSTES = {
  boost: 100, // destacar un anuncio 24 h
  superLikes: 60, // pack de 3 super likes
  tiradaPremium: 50, // lectura de 3 cartas
} as const;

export const SUPER_LIKES_POR_PACK = 3;
export const HORAS_BOOST = 24;

export const BONUS_CHECKIN_BASE = 10;
export const BONUS_POR_DIA_RACHA = 2; // por día consecutivo (máx. 7)

export interface Mision {
  id: string;
  titulo: string;
  emoji: string;
  premio: number;
}

export const MISIONES: Mision[] = [
  { id: "perfil", titulo: "Completa tu perfil (nombre, zonas e intereses)", emoji: "🧑", premio: 30 },
  { id: "kyc", titulo: "Verifica tu identidad", emoji: "🛡️", premio: 100 },
  { id: "publicar", titulo: "Publica tu primera oferta o búsqueda", emoji: "📣", premio: 50 },
  { id: "guardar", titulo: "Guarda tu primera oferta", emoji: "❤️", premio: 15 },
  { id: "tarot", titulo: "Saca tu primera carta del día", emoji: "🔮", premio: 20 },
  { id: "amigo", titulo: "Consigue tu primer amigo o match", emoji: "🤝", premio: 25 },
];

/** Segmento (índice) elegido con probabilidad inversa al valor: los premios grandes son raros. */
export function elegirSegmento(): number {
  const pesos = SEGMENTOS_RULETA.map((v) => 1 / v);
  const total = pesos.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pesos.length; i++) {
    r -= pesos[i];
    if (r <= 0) return i;
  }
  return 0;
}
