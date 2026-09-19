/**
 * PERSONA ENGINE — genera personas simuladas COMPLETAS (perfil + onboarding hecho + fotos) para demostración y pruebas.
 *
 *   npx tsx supabase/seed/personas.ts                 → supabase/seed_personas.sql con las 5 personas de Ecuador
 *   npx tsx supabase/seed/personas.ts --count 200     → además genera personas de relleno (prueba de carga: 10 fotos c/u)
 *   npx tsx supabase/seed/personas.ts --count 50 --out ruta.sql
 *
 * Las 5 primeras son personas escritas a mano (Cuenca, Quito y Guayaquil): biografía madura, formación, estatura, descripción
 * de su pareja ideal (privada, alimenta el motor de recomendación), retrato (pravatar.cc) y escenas reales de su ciudad
 * (Wikimedia Commons, ver escenas_ecuador.ts). Todas las URLs son públicas y se comprobaron con HTTP 200: no hay que subir archivos.
 * Las siguientes (n > 5) son relleno para pruebas de carga y usan picsum.photos.
 *
 * Son perfiles DEMO (is_demo = true, sin contraseña: no pueden iniciar sesión). Un administrador puede hacerlas interactuar
 * desde /admin/personas. No ejecutes este seed en un entorno con usuarios reales sin que se sepa que son de demostración.
 *
 * Idempotente: se puede ejecutar varias veces; las fotos de cada persona se reemplazan por las de este archivo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signoDeFecha } from "@/lib/astrologia";
import { ESCENAS } from "./escenas_ecuador";

interface Foto {
  url: string;
  miniatura: string;
  ancho?: number;
  alto?: number;
}

interface Persona {
  n: number;
  nombre: string;
  usuario: string;
  nacimiento: string;
  ubicacion: string;
  bio: string;
  intereses: string[];
  zonas: string[];
  relaciones: string[];
  estilo: string[];
  // — Solo las personas de Ecuador (escritas a mano) —
  universidad?: string;
  colegio?: string;
  estatura?: number;
  parejaIdeal?: string;
  titular?: string;
  habilidades?: string[];
  fotos?: Foto[];
}

const FOTOS_RELLENO = 10;
const DESDE_RELLENO = 6; // las personas 1–5 son las de Ecuador

/** Retrato de pravatar.cc (foto nº `id` del catálogo; 900 px y 300 px). Se eligieron a mano solo adultos. */
const retrato = (id: number): Foto => ({ url: `https://i.pravatar.cc/900?img=${id}`, miniatura: `https://i.pravatar.cc/300?img=${id}`, ancho: 900, alto: 900 });
const escena = (clave: keyof typeof ESCENAS): Foto => ({ url: ESCENAS[clave].url, miniatura: ESCENAS[clave].miniatura, ancho: 960 });

/**
 * Las zonas usan el catálogo de la app (src/data/catalogos.ts) para que coincidan con las de las personas reales:
 * «Barrio Histórico» = casco histórico, «Las Lomas» = colinas/miradores, «Valle Alto» = valles (Cumbayá), «Puerto Nuevo» = puertos.
 */
const ECUADOR: Omit<Persona, "n">[] = [
  {
    nombre: "Emilia Vintimilla",
    usuario: "@emilia.vintimilla",
    nacimiento: "1994-10-08",
    ubicacion: "Cuenca · Centro Histórico y Turi",
    bio: "Restauro pintura colonial y modelo cerámica en un taller junto al Tomebamba. Creo en las sobremesas largas, en el silencio compartido y en el amor que se cultiva con paciencia. No busco impresionar a nadie: busco con quién construir un hogar y una vida honesta.",
    intereses: ["amigos"],
    zonas: ["Barrio Histórico", "Las Lomas"],
    relaciones: ["pareja", "amistad"],
    estilo: ["Creativo", "Lector", "Espiritual"],
    universidad: "Universidad de Cuenca",
    colegio: "Colegio Benigno Malo",
    estatura: 165,
    titular: "Restauradora de arte y ceramista",
    habilidades: ["Restauración", "Cerámica", "Historia del arte"],
    parejaIdeal:
      "Una persona de mirada serena y palabra honesta, que sepa escuchar sin apuro y quiera crecer conmigo, no competir. Sensible al arte, a la música y a la naturaleza; con estudios y curiosidad por seguir aprendiendo. Que cuide a su familia, cocine un domingo largo, camine junto al río y tenga la humildad de reconocer sus errores. Alguien que quiera construir un hogar estable, con compromiso y ternura.",
    fotos: [retrato(23), escena("cuenca-catedral"), escena("cuenca-turi-cafe"), escena("cuenca-tomebamba"), escena("cuenca-arcos")],
  },
  {
    nombre: "Mariana Larrea",
    usuario: "@mariana.larrea",
    nacimiento: "1991-05-19",
    ubicacion: "Quito · La Floresta y Cumbayá",
    bio: "Fundé una marca de café de especialidad junto a familias productoras de Loja e Intag. Madrugo, leo a los estoicos y practico algo simple: hacer bien lo que depende de mí. Quiero una pareja con quien crecer sin competir y una comunidad que se cuide entre sí.",
    intereses: ["amigos", "inversor"],
    zonas: ["Zona Norte", "Valle Alto"],
    relaciones: ["pareja", "socios"],
    estilo: ["Emprendedor", "Foodie", "Lector"],
    universidad: "Universidad San Francisco de Quito",
    colegio: "Colegio Alemán de Quito",
    estatura: 168,
    titular: "Fundadora · café de especialidad ecuatoriano",
    habilidades: ["Emprendimiento", "Comercio justo", "Liderazgo"],
    parejaIdeal:
      "Alguien de carácter tranquilo y ambición sana, que trabaje con propósito y no necesite aparentar. Emprendedor o con espíritu de construir, con estudios universitarios, lector, que disfrute del deporte, del buen café y de las caminatas por Cumbayá los fines de semana. Que hable con claridad, respete mis tiempos y quiera formar una familia y una comunidad en la que ambos crezcamos.",
    fotos: [retrato(28), escena("quito-floresta"), escena("quito-garcia-moreno"), escena("quito-santo-domingo"), escena("quito-atardecer")],
  },
  {
    nombre: "Génesis Villamar",
    usuario: "@genesis.villamar",
    nacimiento: "1997-02-11",
    ubicacion: "Guayaquil · Puerto Santa Ana",
    bio: "Guayaquileña de pura cepa: coach de liderazgo y voluntaria en un banco de alimentos. Risa fuerte, abrazo largo y disciplina de madrugada. Crecer es un deporte de equipo: busco una pareja que se atreva a mejorar conmigo, sin poses ni juegos, y amigos para hacer comunidad.",
    intereses: ["amigos", "anfitrion"],
    zonas: ["Puerto Nuevo", "Centro"],
    relaciones: ["pareja", "amistad"],
    estilo: ["Deportista", "Viajero", "Familiar"],
    universidad: "Universidad Casa Grande",
    colegio: "Colegio Americano de Guayaquil",
    estatura: 163,
    titular: "Coach de liderazgo y voluntaria social",
    habilidades: ["Liderazgo", "Coaching", "Voluntariado"],
    parejaIdeal:
      "Una persona sociable, alegre y de corazón generoso, con metas claras y ganas de evolucionar. Que le guste el deporte, viajar, bailar y reunir a la gente en casa; que sepa pedir perdón y celebrar los logros del otro. Con formación, trabajo digno y valores firmes. Quiero un compañero de vida que construya conmigo un hogar, una familia y un aporte real para nuestra ciudad.",
    fotos: [retrato(49), escena("gye-puerto-santa-ana"), escena("gye-callejones"), escena("gye-malecon"), escena("gye-las-penas"), escena("gye-capilla")],
  },
  {
    nombre: "Sebastián Astudillo",
    usuario: "@sebastian.astudillo",
    nacimiento: "1989-12-03",
    ubicacion: "Cuenca · Turi",
    bio: "Toco el violín en la Orquesta Sinfónica y enseño música a niños de un barrio de Cuenca. Aprendí que la disciplina es una forma de ternura. Busco una compañera de vida con quien envejecer entre música, montañas y una mesa siempre abierta.",
    intereses: ["amigos"],
    zonas: ["Las Lomas", "Centro"],
    relaciones: ["pareja", "amistad"],
    estilo: ["Creativo", "Espiritual", "Lector"],
    universidad: "Universidad de Cuenca",
    colegio: "Colegio Benigno Malo",
    estatura: 178,
    titular: "Violinista y docente de música",
    habilidades: ["Violín", "Composición", "Pedagogía musical"],
    parejaIdeal:
      "Una persona auténtica y de espíritu libre, que valore el arte y la conversación profunda por encima de las apariencias. Con vida y sueños propios, y ganas de compartirlos; que disfrute de un concierto, de una caminata por Turi y de cocinar en casa. Que crea en la constancia, el respeto y la fidelidad, y quiera construir una familia y una comunidad con calma y verdad.",
    fotos: [retrato(55), escena("cuenca-turi-mirador"), escena("cuenca-turi-valle"), escena("cuenca-rio-piedras"), escena("cuenca-turi-panoramica")],
  },
  {
    nombre: "Andrés Terán",
    usuario: "@andres.teran",
    nacimiento: "1987-07-24",
    ubicacion: "Quito · Cumbayá",
    bio: "Ingeniero civil: construyo vivienda accesible porque un hogar digno es la base de cualquier proyecto de vida. Corro al amanecer en el Metropolitano y cocino los sábados. Cero juegos: busco una relación adulta, con conversación real y un futuro que se levanta entre dos.",
    intereses: ["comprador", "inversor"],
    zonas: ["Valle Alto", "Zona Norte"],
    relaciones: ["pareja", "socios"],
    estilo: ["Deportista", "Emprendedor", "Casero"],
    universidad: "Pontificia Universidad Católica del Ecuador",
    colegio: "Colegio Alemán de Quito",
    estatura: 176,
    titular: "Ingeniero civil · vivienda accesible",
    habilidades: ["Construcción", "Gestión de proyectos", "Vivienda social"],
    parejaIdeal:
      "Una persona madura emocionalmente, sincera y con propósito, que sepa lo que quiere y lo diga sin rodeos. Independiente, con estudios y sentido del humor; que disfrute del deporte, de viajar y de una buena comida en casa. Que valore la familia y el compromiso, y quiera construir un hogar y una comunidad juntos, apoyándonos en los días difíciles y celebrando los buenos.",
    fotos: [retrato(59), escena("quito-teleferico-vista"), escena("quito-gondolas"), escena("quito-biblioteca"), escena("quito-estacion")],
  },
];

const NOMBRES = ["Camila", "Diego", "Sofía", "Andrés", "Paula", "Tomás", "Renata", "Bruno", "Elena", "Martín", "Julia", "Nicolás", "Carla", "Iván", "Marina", "Hugo", "Alma", "Felipe", "Irene", "Óscar"];
const APELLIDOS = ["Ramos", "Vega", "Navarro", "Ibarra", "Molina", "Paredes", "Suárez", "Campos", "Ortega", "Lozano", "Fuentes", "Herrera", "Cabrera", "Mendoza", "Rivas"];
const ZONAS = ["Zona Norte", "Centro", "Zona Sur", "Las Lomas", "Barrio Histórico", "Puerto Nuevo", "Country Los Pinos", "Valle Alto"];
const INTERESES = ["roomie", "inversor", "comprador", "amigos", "inquilino"];
const RELACIONES = ["pareja", "amistad", "roomie", "socios"];
const ESTILOS = ["Deportista", "Viajero", "Foodie", "Creativo", "Emprendedor", "Casero", "Nocturno", "Mascotas", "Lector", "Gamer"];

/** Generador pseudoaleatorio determinista: mismos parámetros → mismo SQL. */
function rng(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Los límites de la base de datos, comprobados al generar para no descubrirlos al ejecutar el SQL. */
function comprobar(p: Persona) {
  const dentro = (campo: string, v: string | undefined, max: number, min = 0) => {
    if (v !== undefined && (v.length < min || v.length > max)) throw new Error(`Persona ${p.n} (${p.nombre}): ${campo} debe tener entre ${min} y ${max} caracteres (tiene ${v.length})`);
  };
  dentro("nombre", p.nombre, 60, 1);
  dentro("bio", p.bio, 300);
  dentro("ubicación", p.ubicacion, 60);
  dentro("universidad", p.universidad, 120, 2);
  dentro("colegio", p.colegio, 120, 2);
  dentro("pareja ideal", p.parejaIdeal, 1000, 20);
  if (!/^@[a-z0-9_.]{2,40}$/.test(p.usuario)) throw new Error(`Persona ${p.n}: usuario inválido ${p.usuario}`);
  if (p.estatura !== undefined && (p.estatura < 120 || p.estatura > 230)) throw new Error(`Persona ${p.n}: estatura fuera de rango`);
  if ((p.fotos?.length ?? FOTOS_RELLENO) > 10) throw new Error(`Persona ${p.n}: máximo 10 fotos`);
}

function generar(n: number): Persona {
  if (n < DESDE_RELLENO) return { n, ...ECUADOR[n - 1] };
  const r = rng(n * 7919);
  const elegir = <T,>(l: T[]) => l[Math.floor(r() * l.length)];
  const varios = <T,>(l: T[], k: number) => [...l].sort(() => r() - 0.5).slice(0, 1 + Math.floor(r() * k));
  const nombre = `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`;
  const anio = 1970 + Math.floor(r() * 35);
  const mes = 1 + Math.floor(r() * 12);
  const dia = 1 + Math.floor(r() * 28);
  const zonas = varios(ZONAS, 3);
  return {
    n,
    nombre,
    usuario: `@sim.${n}`,
    nacimiento: `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
    ubicacion: zonas[0],
    bio: `Persona simulada #${n} (relleno para pruebas de carga). Interesada en ${zonas.join(" y ")}.`,
    intereses: varios(INTERESES, 2),
    zonas,
    relaciones: varios(RELACIONES, 2),
    estilo: varios(ESTILOS, 3),
  };
}

const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;
const arr = (a: string[]) => `array[${a.map(lit).join(", ")}]::text[]`;
const uid = (n: number) => `00000000-0000-4000-8000-${String(100 + n).padStart(12, "0")}`;
const slug = (nombre: string, n: number) => `${nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${n}`;

/** Galería de una persona: las suyas si las tiene; si no, picsum (relleno). El orden 0 es la principal y el avatar. */
export function fotosDe(p: Persona): (Foto & { orden: number })[] {
  if (p.fotos) return p.fotos.map((f, orden) => ({ ...f, orden }));
  const base = slug(p.nombre, p.n);
  return Array.from({ length: FOTOS_RELLENO }, (_, orden) => ({
    orden,
    url: `https://picsum.photos/seed/${base}-${orden}/900/1200`,
    miniatura: `https://picsum.photos/seed/${base}-${orden}/240/300`,
    ancho: 900,
    alto: 1200,
  }));
}

export function generarSql(cantidad: number): string {
  const personas = Array.from({ length: cantidad }, (_, i) => generar(i + 1));
  personas.forEach(comprobar);
  const L: string[] = [];
  L.push("-- ============================================================================");
  L.push(`-- PERSONAS SIMULADAS (${cantidad}) — GENERADO por supabase/seed/personas.ts; no lo edites a mano.`);
  L.push("-- Personas 1–5: Cuenca, Quito y Guayaquil, con retrato y escenas de su ciudad. Personas 6+: relleno de pruebas de carga.");
  L.push("-- Requiere schema.sql con las actualizaciones 002 (fotos) y 003 (universidad, colegio, estatura, pareja ideal).");
  L.push("-- Es idempotente y atómico (una sola transacción): si algo falla no queda nada a medias.");
  L.push("-- Son perfiles DEMO: no pueden iniciar sesión. Un administrador puede simularlas en /admin/personas.");
  L.push("--");
  L.push("-- Créditos de las imágenes: retratos de pravatar.cc; escenas de Wikimedia Commons con licencia libre:");
  const usadas = new Set(personas.flatMap((p) => p.fotos ?? []).map((f) => f.url));
  for (const [clave, e] of Object.entries(ESCENAS)) if (usadas.has(e.url)) L.push(`--   ${clave}: ${e.autor} (${e.licencia}) ${e.pagina}`);
  L.push("-- ============================================================================");
  L.push("");
  L.push("begin;");
  L.push("");
  for (const p of personas) {
    const fotos = fotosDe(p);
    const id = uid(p.n);
    const signo = signoDeFecha(p.nacimiento);
    const edad = new Date().getFullYear() - Number(p.nacimiento.slice(0, 4));
    const profesional = p.titular ? JSON.stringify({ headline: p.titular, skills: p.habilidades ?? [], portfolio: [] }) : null;
    L.push(`-- Persona ${p.n}: ${p.nombre}`);
    L.push(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)`);
    L.push(`values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', ${lit(`demo+persona${p.n}@inmobiliaria.social.invalid`)}, '', now(), '{"provider":"email","providers":["email"]}', ${lit(JSON.stringify({ full_name: p.nombre }))}::jsonb, now(), now(), '', '', '', '')`);
    L.push(`on conflict (id) do nothing;`);
    L.push(`update public.user_private set birth_date = '${p.nacimiento}', ideal_partner = ${p.parejaIdeal ? lit(p.parejaIdeal) : "null"} where user_id = '${id}';`);
    // El @usuario solo cambia si nadie más lo tiene (evita romper la restricción de unicidad si una persona real lo eligió).
    L.push(`update public.profiles set display_name = ${lit(p.nombre)},`);
    L.push(`  handle = case when exists (select 1 from public.profiles o where o.handle = ${lit(p.usuario)} and o.id <> '${id}') then handle else ${lit(p.usuario)} end,`);
    L.push(`  bio = ${lit(p.bio)}, location = ${lit(p.ubicacion)},`);
    L.push(`  interests = ${arr(p.intereses)}, zones = ${arr(p.zonas)}, relations = ${arr(p.relaciones)}, lifestyle = ${arr(p.estilo)},`);
    L.push(`  university = ${p.universidad ? lit(p.universidad) : "null"}, school = ${p.colegio ? lit(p.colegio) : "null"}, height_cm = ${p.estatura ?? "null"},`);
    L.push(`  professional = ${profesional ? `${lit(profesional)}::jsonb` : "null"},`);
    L.push(`  age = ${Math.min(100, Math.max(18, edad))}, sign = ${signo ? lit(signo) : "null"}, avatar_url = ${lit(fotos[0].miniatura)},`);
    L.push(`  email_verified = true, identity_verified = true, kyc_status = 'verified', is_demo = true, onboarding_completed = true`);
    L.push(`where id = '${id}';`);
    // Se reemplaza la galería completa (el índice único (user_id, sort_order) es diferible y no admite ON CONFLICT).
    L.push(`delete from public.profile_photos where user_id = '${id}';`);
    L.push(`insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime) values`);
    L.push(fotos.map((f) => `  ('${id}', ${f.orden}, ${lit(f.url)}, ${lit(f.miniatura)}, ${f.ancho ?? "null"}, ${f.alto ?? "null"}, 'image/jpeg')`).join(",\n") + ";");
    L.push("");
  }
  L.push("commit;");
  L.push("");
  return L.join("\n");
}

// Ejecución como script (no al importarlo desde un test).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const val = (nombre: string) => {
    const i = args.indexOf(nombre);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const cantidad = Math.max(1, Math.min(5000, Number(val("--count") ?? 5)));
  const salida = val("--out") ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "seed_personas.sql");
  const sql = generarSql(cantidad);
  fs.writeFileSync(salida, sql, "utf8");
  const total = Array.from({ length: cantidad }, (_, i) => fotosDe(generar(i + 1)).length).reduce((a, b) => a + b, 0);
  console.log(`${salida}: ${cantidad} personas, ${total} fotos (${(sql.length / 1024).toFixed(0)} KB)`);
}
