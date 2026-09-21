import { signoDeFecha, infoSigno } from "@/lib/astrologia";
import { CUENCA, desfaseMinutos, PAIS_POR_CODIGO, type Ubicacion } from "@/lib/geo";

/**
 * «El día de hoy» en el lugar donde está la persona: hora, saludo, fase de la luna, amanecer y ocaso, efemérides y una frase de entrada
 * que cambia cada día y en cada visita. Todo se calcula en el dispositivo, sin red y sin datos inventados: si un dato no se puede
 * garantizar para ese país (p. ej. los feriados) no se muestra.
 */

const MIN = 60_000;
const DIA = 86_400_000;

// ── Fecha y hora local ──────────────────────────────────────────────────────
export interface FechaLocal {
  anio: number;
  /** 1–12 */
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  /** 0 = domingo … 6 = sábado */
  diaSemana: number;
  /** Día del año (1–366). */
  diaDelAnio: number;
}

/** Descompone un instante en la fecha y la hora de una zona horaria (usa el desfase real de esa zona ese día, con horario de verano). */
export function fechaLocal(ms: number, zona: string): FechaLocal {
  const d = new Date(ms + desfaseMinutos(zona, ms) * MIN);
  const anio = d.getUTCFullYear();
  return {
    anio,
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
    hora: d.getUTCHours(),
    minuto: d.getUTCMinutes(),
    diaSemana: d.getUTCDay(),
    diaDelAnio: Math.floor((Date.UTC(anio, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(anio, 0, 0)) / DIA),
  };
}

export const claveDiaLocal = (f: Pick<FechaLocal, "anio" | "mes" | "dia">) => `${f.anio}-${String(f.mes).padStart(2, "0")}-${String(f.dia).padStart(2, "0")}`;
export const horaTexto = (f: Pick<FechaLocal, "hora" | "minuto">) => `${String(f.hora).padStart(2, "0")}:${String(f.minuto).padStart(2, "0")}`;

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const nombreDia = (f: Pick<FechaLocal, "diaSemana">) => DIAS_SEMANA[f.diaSemana];
export const nombreMes = (f: Pick<FechaLocal, "mes">) => MESES[f.mes - 1];
/** «martes 23 de septiembre» */
export const fechaLarga = (f: FechaLocal) => `${nombreDia(f)} ${f.dia} de ${nombreMes(f)}`;

// ── Saludo según la hora ────────────────────────────────────────────────────
export type Momento = "manana" | "tarde" | "atardecer" | "noche";

export function momentoDelDia(hora: number): Momento {
  if (hora >= 5 && hora < 12) return "manana";
  if (hora >= 12 && hora < 18) return "tarde";
  if (hora >= 18 && hora < 21) return "atardecer";
  return "noche";
}

export const SALUDO: Record<Momento, { texto: string; emoji: string }> = {
  manana: { texto: "Buenos días", emoji: "🌅" },
  tarde: { texto: "Buenas tardes", emoji: "☀️" },
  atardecer: { texto: "Buenas tardes", emoji: "🌇" },
  noche: { texto: "Buenas noches", emoji: "🌙" },
};

// ── Luna ────────────────────────────────────────────────────────────────────
const MES_SINODICO = 29.530588853;
/** Luna nueva de referencia: 6 de enero de 2000, 18:14 UTC. */
const LUNA_NUEVA_REF = Date.UTC(2000, 0, 6, 18, 14);

export interface FaseLunar {
  /** Días desde la última luna nueva (0–29,5). */
  edad: number;
  nombre: string;
  emoji: string;
  /** Porcentaje del disco iluminado (0–100). */
  iluminacion: number;
}

const FASES: { hasta: number; nombre: string; emoji: string }[] = [
  { hasta: 1.85, nombre: "Luna nueva", emoji: "🌑" },
  { hasta: 5.54, nombre: "Luna creciente", emoji: "🌒" },
  { hasta: 9.23, nombre: "Cuarto creciente", emoji: "🌓" },
  { hasta: 12.92, nombre: "Gibosa creciente", emoji: "🌔" },
  { hasta: 16.61, nombre: "Luna llena", emoji: "🌕" },
  { hasta: 20.3, nombre: "Gibosa menguante", emoji: "🌖" },
  { hasta: 23.99, nombre: "Cuarto menguante", emoji: "🌗" },
  { hasta: 27.68, nombre: "Luna menguante", emoji: "🌘" },
  { hasta: 99, nombre: "Luna nueva", emoji: "🌑" },
];

/** Fase de la luna con el mes sinódico medio: es aproximada (±½ día), suficiente para «hoy hay luna llena». */
export function faseLunar(ms: number): FaseLunar {
  const edad = (((ms - LUNA_NUEVA_REF) / DIA) % MES_SINODICO + MES_SINODICO) % MES_SINODICO;
  const f = FASES.find((x) => edad < x.hasta)!;
  return { edad, nombre: f.nombre, emoji: f.emoji, iluminacion: Math.round(((1 - Math.cos((2 * Math.PI * edad) / MES_SINODICO)) / 2) * 100) };
}

// ── Sol: amanecer y ocaso ───────────────────────────────────────────────────
export interface SolDelDia {
  /** «06:05», o null si el sol no sale o no se pone ese día (latitudes polares). */
  amanece: string | null;
  anochece: string | null;
  /** Horas de luz. */
  horasDeLuz: number | null;
}

const grados = (r: number) => (r * 180) / Math.PI;
const radianes = (g: number) => (g * Math.PI) / 180;

/** Amanecer y ocaso con las ecuaciones de la NOAA (precisión de ~1–2 minutos), en la hora local de la zona indicada. */
export function solDelDia(ms: number, lugar: Pick<Ubicacion, "lat" | "lng" | "zona">): SolDelDia {
  const f = fechaLocal(ms, lugar.zona);
  const gamma = ((2 * Math.PI) / 365) * (f.diaDelAnio - 1);
  const ecTiempo = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const cosH = Math.cos(radianes(90.833)) / (Math.cos(radianes(lugar.lat)) * Math.cos(decl)) - Math.tan(radianes(lugar.lat)) * Math.tan(decl);
  if (cosH > 1 || cosH < -1) return { amanece: null, anochece: null, horasDeLuz: null };
  const h = grados(Math.acos(cosH));
  const desfase = desfaseMinutos(lugar.zona, ms);
  const aTexto = (minutosUtc: number) => {
    const local = Math.round(minutosUtc + desfase);
    const m = ((local % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  return { amanece: aTexto(720 - 4 * (lugar.lng + h) - ecTiempo), anochece: aTexto(720 - 4 * (lugar.lng - h) - ecTiempo), horasDeLuz: Math.round((h / 7.5) * 10) / 10 };
}

// ── Efemérides ──────────────────────────────────────────────────────────────
export type TipoEfemeride = "feriado" | "local" | "mundial" | "popular";
export interface Efemeride {
  titulo: string;
  detalle?: string;
  tipo: TipoEfemeride;
}

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). Devuelve mes (1-12) y día. */
export function pascua(anio: number): { mes: number; dia: number } {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

/** n-ésimo domingo de un mes (n = 1…). */
export function enesimoDomingo(anio: number, mes: number, n: number): number {
  const primerDia = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay();
  return 1 + ((7 - primerDia) % 7) + (n - 1) * 7;
}

interface Fija {
  m: number;
  d: number;
  titulo: string;
  detalle?: string;
  tipo: TipoEfemeride;
  /** Solo para este país (si falta, es de todo el mundo). */
  pais?: string;
}

// Solo fechas comprobables. Los feriados nacionales están curados para Ecuador; en otros países se muestran las conmemoraciones mundiales.
const FIJAS: Fija[] = [
  { m: 1, d: 1, titulo: "Año Nuevo", tipo: "feriado", pais: "EC" },
  { m: 2, d: 11, titulo: "Día Internacional de la Mujer y la Niña en la Ciencia", tipo: "mundial" },
  { m: 2, d: 14, titulo: "Día del Amor y la Amistad", tipo: "popular" },
  { m: 3, d: 8, titulo: "Día Internacional de la Mujer", tipo: "mundial" },
  { m: 3, d: 20, titulo: "Día Internacional de la Felicidad", detalle: "Proclamado por la ONU: hoy, regala una sonrisa.", tipo: "mundial" },
  { m: 3, d: 22, titulo: "Día Mundial del Agua", tipo: "mundial" },
  { m: 4, d: 7, titulo: "Día Mundial de la Salud", tipo: "mundial" },
  { m: 4, d: 12, titulo: "Fundación española de Cuenca (1557)", detalle: "Cuenca celebra su fundación.", tipo: "local", pais: "EC" },
  { m: 4, d: 22, titulo: "Día de la Tierra", tipo: "mundial" },
  { m: 5, d: 1, titulo: "Día Internacional del Trabajo", tipo: "feriado", pais: "EC" },
  { m: 5, d: 15, titulo: "Día Internacional de las Familias", tipo: "mundial" },
  { m: 5, d: 24, titulo: "Batalla de Pichincha (1822)", detalle: "La victoria que selló la independencia de Ecuador.", tipo: "feriado", pais: "EC" },
  { m: 6, d: 1, titulo: "Día Internacional de la Niñez", tipo: "mundial" },
  { m: 6, d: 5, titulo: "Día Mundial del Medio Ambiente", tipo: "mundial" },
  { m: 8, d: 10, titulo: "Primer Grito de Independencia (1809)", detalle: "Quito, 1809: el primer paso hacia la independencia.", tipo: "feriado", pais: "EC" },
  { m: 9, d: 21, titulo: "Día Internacional de la Paz", tipo: "mundial" },
  { m: 9, d: 27, titulo: "Día Mundial del Turismo", tipo: "mundial" },
  { m: 10, d: 1, titulo: "Día Internacional de las Personas Mayores", tipo: "mundial" },
  { m: 10, d: 5, titulo: "Día Mundial de los Docentes", tipo: "mundial" },
  { m: 10, d: 9, titulo: "Independencia de Guayaquil (1820)", tipo: "feriado", pais: "EC" },
  { m: 10, d: 10, titulo: "Día Mundial de la Salud Mental", detalle: "Cuidar la mente también es cuidarse.", tipo: "mundial" },
  { m: 10, d: 16, titulo: "Día Mundial de la Alimentación", tipo: "mundial" },
  { m: 11, d: 1, titulo: "Día de Todos los Santos", tipo: "popular" },
  { m: 11, d: 2, titulo: "Día de los Difuntos", tipo: "feriado", pais: "EC" },
  { m: 11, d: 3, titulo: "Independencia de Cuenca (1820)", detalle: "Cuenca celebra su independencia.", tipo: "feriado", pais: "EC" },
  { m: 11, d: 20, titulo: "Día Universal del Niño", tipo: "mundial" },
  { m: 12, d: 5, titulo: "Día Internacional del Voluntariado", tipo: "mundial" },
  { m: 12, d: 10, titulo: "Día de los Derechos Humanos", tipo: "mundial" },
  { m: 12, d: 25, titulo: "Navidad", tipo: "feriado", pais: "EC" },
  { m: 12, d: 31, titulo: "Año Viejo", detalle: "En Ecuador se despide el año con los años viejos y las viudas.", tipo: "popular", pais: "EC" },
];

/** Fechas móviles de un año: Carnaval, Viernes Santo, Pascua y los días de la Madre y del Padre (Ecuador). */
function moviles(anio: number, pais: string): { m: number; d: number; titulo: string; tipo: TipoEfemeride }[] {
  const { mes, dia } = pascua(anio);
  const base = Date.UTC(anio, mes - 1, dia);
  const de = (offset: number) => {
    const x = new Date(base + offset * DIA);
    return { m: x.getUTCMonth() + 1, d: x.getUTCDate() };
  };
  const lista = [
    { ...de(0), titulo: "Domingo de Pascua", tipo: "popular" as const },
    ...(pais === "EC"
      ? [
          { ...de(-48), titulo: "Carnaval (lunes)", tipo: "feriado" as const },
          { ...de(-47), titulo: "Carnaval (martes)", tipo: "feriado" as const },
          { ...de(-2), titulo: "Viernes Santo", tipo: "feriado" as const },
          { m: 5, d: enesimoDomingo(anio, 5, 2), titulo: "Día de la Madre", tipo: "popular" as const },
          { m: 6, d: enesimoDomingo(anio, 6, 3), titulo: "Día del Padre", tipo: "popular" as const },
        ]
      : []),
  ];
  return lista;
}

/** Efemérides de un día para un país. Solo hay datos curados de Ecuador; en el resto aparecen las conmemoraciones mundiales. */
export function efemerides(f: Pick<FechaLocal, "anio" | "mes" | "dia">, pais: string): Efemeride[] {
  const fijas = FIJAS.filter((x) => x.m === f.mes && x.d === f.dia && (!x.pais || x.pais === pais)).map((x): Efemeride => ({ titulo: x.titulo, detalle: x.detalle, tipo: x.tipo }));
  const variables = moviles(f.anio, pais).filter((x) => x.m === f.mes && x.d === f.dia).map((x): Efemeride => ({ titulo: x.titulo, tipo: x.tipo }));
  return [...variables, ...fijas].sort((a, b) => (a.tipo === "feriado" ? 0 : 1) - (b.tipo === "feriado" ? 0 : 1));
}

/** La próxima efeméride (con cuenta atrás) dentro de los próximos `dentroDe` días, sin contar hoy. */
export function proximaEfemeride(f: Pick<FechaLocal, "anio" | "mes" | "dia">, pais: string, dentroDe = 45): { efemeride: Efemeride; dias: number } | null {
  const base = Date.UTC(f.anio, f.mes - 1, f.dia);
  for (let i = 1; i <= dentroDe; i++) {
    const x = new Date(base + i * DIA);
    const lista = efemerides({ anio: x.getUTCFullYear(), mes: x.getUTCMonth() + 1, dia: x.getUTCDate() }, pais).filter((e) => e.tipo === "feriado" || e.tipo === "local" || e.tipo === "popular");
    if (lista.length > 0) return { efemeride: lista[0], dias: i };
  }
  return null;
}

// ── Tema del día de la semana y frases de entrada ───────────────────────────
export const TEMA_SEMANA: { texto: string; accion: { texto: string; href: string } }[] = [
  { texto: "Domingo de pausa: descansa, agradece y prepárate con calma para la semana.", accion: { texto: "Invita a alguien querido", href: "/invitar" } },
  { texto: "Lunes de nuevos comienzos: elige una sola cosa importante y empieza por ella.", accion: { texto: "Empieza con un reto", href: "/retos" } },
  { texto: "Martes de constancia: sigue con lo que empezaste, aunque sea en pequeño.", accion: { texto: "Descubre un negocio", href: "/directorio" } },
  { texto: "Mitad de semana: revisa cómo vas y ajusta sin culpa.", accion: { texto: "Mira la comunidad", href: "/comunidad" } },
  { texto: "Jueves de conexión: escribe a alguien a quien hace tiempo no saludas.", accion: { texto: "Conoce a alguien", href: "/explorar" } },
  { texto: "Viernes de cierre: agradece lo logrado y suelta lo que no pudo ser.", accion: { texto: "Pide algo rico", href: "/directorio/delivery" } },
  { texto: "Sábado de disfrute: sal a tu ciudad, comparte y descubre algo nuevo.", accion: { texto: "Mira la cartelera", href: "/directorio/eventos" } },
];

const FRASES: Record<Momento, ((n: string) => string)[]> = {
  manana: [
    (n) => `${n}, la ciudad ya despertó: ¿qué vas a descubrir hoy?`,
    (n) => `Un buen día empieza con una buena intención, ${n}. ¿Cuál es la tuya?`,
    (n) => `${n}, hoy es una página en blanco. Escribe algo de lo que te sientas orgullosa u orgulloso.`,
    (n) => `Con calma y con ganas, ${n}: el día es largo y hay mucho por hacer bien.`,
    (n) => `${n}, empieza por lo pequeño: lo grande llega solo.`,
    (n) => `Hay gente esperando conocer a alguien como tú, ${n}. Sal a buscarla.`,
    (n) => `${n}, respira hondo: este día todavía no ha pasado y puede ser tuyo.`,
    (n) => `El café, la ciudad y tú, ${n}: buena combinación para empezar.`,
  ],
  tarde: [
    (n) => `${n}, mitad del día: buen momento para revisar lo que ya lograste.`,
    (n) => `Una pausa también es productiva, ${n}. Toma agua y sigue.`,
    (n) => `${n}, a esta hora la ciudad está en movimiento. ¿Te sumas?`,
    (n) => `Lo que hoy salió bien merece un momento de reconocimiento, ${n}.`,
    (n) => `${n}, escribe a alguien y alégrale la tarde.`,
    (n) => `Todavía queda tarde por delante, ${n}: aprovéchala con intención.`,
    (n) => `${n}, si algo se complicó, respira: aún hay tiempo de enderezar el día.`,
    (n) => `Buen momento para descubrir algo nuevo cerca de ti, ${n}.`,
  ],
  atardecer: [
    (n) => `${n}, el día baja el ritmo. Mira lo que hiciste bien hoy.`,
    (n) => `Atardecer en tu ciudad, ${n}: un buen momento para agradecer.`,
    (n) => `${n}, cierra lo pendiente pequeño y deja lo grande para mañana.`,
    (n) => `A esta hora se conversa mejor, ${n}. ¿Con quién te apetece hablar?`,
    (n) => `${n}, si tuviste un día pesado, esta hora es para soltar.`,
    (n) => `La luz cambia y el ánimo también, ${n}. Aprovecha para salir un rato.`,
  ],
  noche: [
    (n) => `${n}, el día ya casi termina: quédate con lo bueno.`,
    (n) => `Buena hora para descansar la mente, ${n}. Mañana será otro día.`,
    (n) => `${n}, antes de dormir, piensa en una cosa por la que dar gracias.`,
    (n) => `Las mejores conversaciones a veces llegan de noche, ${n}.`,
    (n) => `${n}, deja el celular un rato antes de dormir: tu mente lo agradecerá.`,
    (n) => `Cierra el día con calma, ${n}: hiciste lo que pudiste y eso cuenta.`,
  ],
};

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Frase de entrada: depende del momento del día, de la fecha y de cuántas veces ha entrado hoy la persona (`visita`), así que no es
 * la misma dos días seguidos ni dos visitas seguidas.
 */
export function fraseDeEntrada(nombre: string, f: Pick<FechaLocal, "anio" | "mes" | "dia" | "hora">, visita = 0): string {
  const lista = FRASES[momentoDelDia(f.hora)];
  return lista[(hash(claveDiaLocal(f)) + visita) % lista.length](nombre);
}

// ── Todo junto ──────────────────────────────────────────────────────────────
export interface PulsoDelDia {
  fecha: FechaLocal;
  hora: string;
  fechaLarga: string;
  saludo: { texto: string; emoji: string };
  luna: FaseLunar;
  sol: SolDelDia;
  signo?: { nombre: string; simbolo: string };
  hoy: Efemeride[];
  proxima: { efemeride: Efemeride; dias: number } | null;
  tema: (typeof TEMA_SEMANA)[number];
  lugar: string;
}

export function pulsoDelDia(ms: number, lugar: Ubicacion = CUENCA): PulsoDelDia {
  const fecha = fechaLocal(ms, lugar.zona);
  const signo = signoDeFecha(claveDiaLocal(fecha));
  const info = signo ? infoSigno(signo) : undefined;
  return {
    fecha,
    hora: horaTexto(fecha),
    fechaLarga: fechaLarga(fecha),
    saludo: SALUDO[momentoDelDia(fecha.hora)],
    luna: faseLunar(ms),
    sol: solDelDia(ms, lugar),
    signo: info ? { nombre: info.nombre, simbolo: info.simbolo } : undefined,
    hoy: efemerides(fecha, lugar.pais),
    proxima: proximaEfemeride(fecha, lugar.pais),
    tema: TEMA_SEMANA[fecha.diaSemana],
    lugar: lugar.ciudad ?? PAIS_POR_CODIGO[lugar.pais]?.nombre ?? lugar.pais,
  };
}
