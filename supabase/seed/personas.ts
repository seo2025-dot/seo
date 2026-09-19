/**
 * PERSONA ENGINE — genera personas simuladas COMPLETAS (perfil + onboarding hecho + 10 fotos) para pruebas de UI y rendimiento.
 *
 *   npx tsx supabase/seed/personas.ts                 → supabase/seed_personas.sql con 3 personas
 *   npx tsx supabase/seed/personas.ts --count 200     → 200 personas (prueba de carga: 2 000 fotos)
 *   npx tsx supabase/seed/personas.ts --count 50 --out ruta.sql
 *
 * Las fotos son URLs de picsum.photos (deterministas por semilla: misma persona → mismas fotos): no hace falta subir
 * archivos, así que el SQL se puede pegar en el SQL Editor de Supabase. Para probar el pipeline de subida real
 * (procesado + miniaturas + Storage) usa el onboarding de la app.
 * Las personas son perfiles DEMO (is_demo = true, sin contraseña: no pueden iniciar sesión); un administrador puede
 * hacerlas interactuar desde /admin/personas.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signoDeFecha } from "@/lib/astrologia";

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
}

const FOTOS_POR_PERSONA = 10;

/** Personas escritas a mano (las que se incluyen por defecto). */
const A_MANO: Omit<Persona, "n">[] = [
  {
    nombre: "Valentina Cruz",
    usuario: "@vale.cruz",
    nacimiento: "1998-04-02",
    ubicacion: "Centro",
    bio: "Diseñadora de interiores. Busco roomie ordenada y con buena onda; me encantan los mercados y cocinar los domingos.",
    intereses: ["roomie", "amigos"],
    zonas: ["Centro", "Barrio Histórico"],
    relaciones: ["amistad", "roomie"],
    estilo: ["Viajero", "Foodie", "Creativo"],
  },
  {
    nombre: "Mateo Salinas",
    usuario: "@mateo.salinas",
    nacimiento: "1991-11-18",
    ubicacion: "Zona Norte",
    bio: "Ingeniero y futuro propietario. Comparto lo que voy aprendiendo sobre hipotecas y busco socios para pequeñas inversiones.",
    intereses: ["comprador", "inversor"],
    zonas: ["Zona Norte", "Las Lomas"],
    relaciones: ["pareja", "socios"],
    estilo: ["Deportista", "Emprendedor"],
  },
  {
    nombre: "Lucía Andrade",
    usuario: "@lucia.andrade",
    nacimiento: "1995-08-27",
    ubicacion: "Puerto Nuevo",
    bio: "Psicóloga y amante de los gatos. Alquilando cerca del puerto; busco planes tranquilos, buenos libros y gente sincera.",
    intereses: ["inquilino", "amigos"],
    zonas: ["Puerto Nuevo", "Centro"],
    relaciones: ["pareja", "amistad"],
    estilo: ["Lector", "Mascotas", "Espiritual"],
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

function generar(n: number): Persona {
  if (n <= A_MANO.length) return { n, ...A_MANO[n - 1] };
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
    bio: `Persona simulada #${n}. Interesada en ${zonas.join(" y ")}.`,
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

export function fotosDe(p: Persona) {
  const base = slug(p.nombre, p.n);
  return Array.from({ length: FOTOS_POR_PERSONA }, (_, i) => ({
    orden: i,
    url: `https://picsum.photos/seed/${base}-${i}/900/1200`,
    miniatura: `https://picsum.photos/seed/${base}-${i}/240/300`,
  }));
}

export function generarSql(cantidad: number): string {
  const L: string[] = [];
  L.push("-- ============================================================================");
  L.push(`-- PERSONAS SIMULADAS (${cantidad}) con ${FOTOS_POR_PERSONA} fotos cada una — GENERADO por supabase/seed/personas.ts`);
  L.push("-- Requiere haber aplicado schema.sql (incluye la actualización 002: profile_photos). Es idempotente.");
  L.push("-- Son perfiles DEMO: no pueden iniciar sesión. Un administrador puede simularlas en /admin/personas.");
  L.push("-- ============================================================================");
  L.push("");
  for (let n = 1; n <= cantidad; n++) {
    const p = generar(n);
    const fotos = fotosDe(p);
    const id = uid(n);
    const signo = signoDeFecha(p.nacimiento);
    const edad = new Date().getFullYear() - Number(p.nacimiento.slice(0, 4));
    L.push(`-- Persona ${n}: ${p.nombre}`);
    L.push(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)`);
    L.push(`values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', ${lit(`demo+persona${n}@inmobiliaria.social.invalid`)}, '', now(), '{"provider":"email","providers":["email"]}', ${lit(JSON.stringify({ full_name: p.nombre }))}::jsonb, now(), now(), '', '', '', '')`);
    L.push(`on conflict (id) do nothing;`);
    L.push(`update public.user_private set birth_date = '${p.nacimiento}' where user_id = '${id}';`);
    L.push(`update public.profiles set display_name = ${lit(p.nombre)}, handle = ${lit(p.usuario)}, bio = ${lit(p.bio)}, location = ${lit(p.ubicacion)},`);
    L.push(`  interests = ${arr(p.intereses)}, zones = ${arr(p.zonas)}, relations = ${arr(p.relaciones)}, lifestyle = ${arr(p.estilo)},`);
    L.push(`  age = ${Math.min(100, Math.max(18, edad))}, sign = ${signo ? lit(signo) : "null"}, avatar_url = ${lit(fotos[0].miniatura)},`);
    L.push(`  email_verified = true, identity_verified = true, kyc_status = 'verified', is_demo = true, onboarding_completed = true`);
    L.push(`where id = '${id}';`);
    for (const f of fotos) {
      L.push(`insert into public.profile_photos (user_id, sort_order, storage_path, thumb_path, width, height, mime)`);
      L.push(`select '${id}', ${f.orden}, ${lit(f.url)}, ${lit(f.miniatura)}, 900, 1200, 'image/jpeg'`);
      L.push(`where not exists (select 1 from public.profile_photos where user_id = '${id}' and sort_order = ${f.orden});`);
    }
    L.push("");
  }
  return L.join("\n");
}

// Ejecución como script (no al importarlo desde un test).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const val = (nombre: string) => {
    const i = args.indexOf(nombre);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const cantidad = Math.max(1, Math.min(5000, Number(val("--count") ?? 3)));
  const salida = val("--out") ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "seed_personas.sql");
  const sql = generarSql(cantidad);
  fs.writeFileSync(salida, sql, "utf8");
  console.log(`${salida}: ${cantidad} personas, ${cantidad * FOTOS_POR_PERSONA} fotos (${(sql.length / 1024).toFixed(0)} KB)`);
}
