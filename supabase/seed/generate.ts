/**
 * Genera supabase/seed.sql a partir de los datos de ejemplo de esta carpeta.
 *   npx tsx supabase/seed/generate.ts
 *
 * El seed crea usuarios DEMO (is_demo = true, sin contraseña: no pueden iniciar sesión) para que la app
 * no arranque vacía. No lo ejecutes en producción con usuarios reales.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROPIEDADES } from "./propiedades";
import { avatarDemo } from "./retratos";
import { DEMANDAS_INICIALES, GIGS, NEGOCIOS, VACANTES, VEHICULOS } from "./mercado";
import { USUARIOS } from "./usuarios";
import { crearPostsIniciales } from "./posts";

const salida = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "seed.sql");

const lit = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`;
const arr = (a: string[] | undefined) => `array[${(a ?? []).map((x) => lit(x)).join(", ")}]::text[]`;
const json = (o: unknown) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;

const uuid = (prefijo: string, id: string) => {
  const n = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1_000_000_007, 7).toString(16).padStart(12, "0");
  return `${prefijo}0000000-0000-4000-8000-${n.slice(-12)}`;
};
const uid = (id: string) => `00000000-0000-4000-8000-${id.replace(/\D/g, "").padStart(12, "0")}`;

const L: string[] = [];
const w = (s = "") => L.push(s);

w("-- ============================================================================");
w("-- Datos de demostración (GENERADO por supabase/seed/generate.ts — no editar a mano).");
w("-- Ejecutar DESPUÉS de schema.sql, en el SQL Editor de Supabase. Los usuarios demo no pueden iniciar sesión.");
w("-- ============================================================================");
w();

// ── Usuarios demo ──
for (const u of USUARIOS) {
  w(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)`);
  w(`values ('00000000-0000-0000-0000-000000000000', '${uid(u.id)}', 'authenticated', 'authenticated', ${lit(`demo+${u.id}@inmobiliaria.social.invalid`)}, '', now(), '{"provider":"email","providers":["email"]}', ${json({ full_name: u.nombre })}, now(), now(), '', '', '', '')`);
  w(`on conflict (id) do nothing;`);
}
w();
for (const u of USUARIOS) {
  const prof = u.profesional ? json({ headline: u.profesional.titular, skills: u.profesional.skills, portfolio: u.profesional.portafolio }) : "null";
  w(`update public.profiles set display_name = ${lit(u.nombre)}, handle = ${lit(u.usuario)}, bio = ${lit(u.bio)}, location = ${lit(u.ubicacion)},`);
  w(`  interests = ${arr(u.intereses)}, zones = ${arr(u.zonas)}, relations = ${arr(u.relaciones)}, lifestyle = ${arr(u.estilo)}, budget = ${lit(u.presupuesto)},`);
  w(`  age = ${lit(u.edad)}, sign = ${lit(u.signo)}, professional = ${prof}, badges = ${arr(u.badges)},`);
  w(`  identity_verified = ${u.verificaciones.identidad}, phone_verified = ${u.verificaciones.telefono}, email_verified = ${u.verificaciones.email},`);
  w(`  kyc_status = ${lit(u.verificaciones.identidad ? "verified" : "none")}, rating = ${u.rating}, reviews_count = ${u.resenas}, response_rate = ${u.respuesta},`);
  const avatar = avatarDemo(u.id);
  w(`  ${avatar ? `avatar_url = ${lit(avatar)}, ` : ""}is_demo = true, onboarding_completed = true, created_at = make_timestamptz(${u.miembroDesde}, 3, 1, 0, 0, 0)`);
  w(`where id = '${uid(u.id)}';`);
}
w();

// ── Ofertas ──
const flash = (dto?: number) => (dto ? `${dto}, date_trunc('day', now()) + interval '1 day'` : "null, null");
const hace = (dias: number) => `now() - interval '${dias} days'`;

for (const p of PROPIEDADES) {
  w(`insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, area, attrs, images, flash_discount, flash_until, created_at)`);
  w(`values ('${uuid("a", p.id)}', '${uid(p.duenoId)}', 'offer', 'property', '${p.operacion === "venta" ? "sale" : "rent"}', ${lit(p.tipo)}, ${lit(p.titulo)}, ${lit(p.descripcion)}, ${p.precio}, ${lit(p.moneda)}, ${lit(p.ubicacion)}, ${p.superficie}, ${json({ bedrooms: p.dormitorios, bathrooms: p.banos, amenities: p.comodidades })}, ${arr([p.imagen])}, ${flash(p.relampago)}, ${hace(p.publicadaHace)})`);
  w(`on conflict (id) do nothing;`);
}
for (const v of VEHICULOS) {
  w(`insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, attrs, images, flash_discount, flash_until, created_at)`);
  w(`values ('${uuid("b", v.id)}', '${uid(v.duenoId)}', 'offer', 'vehicle', '${v.operacion === "venta" ? "sale" : "rent"}', ${lit(v.categoria)}, ${lit(v.titulo)}, ${lit(v.descripcion)}, ${v.precio}, ${lit(v.moneda)}, ${lit(v.ubicacion)}, ${json({ brand: v.marca, model: v.modelo, year: v.anio, km: v.km, extras: v.extras })}, ${arr([v.imagen])}, ${flash(v.relampago)}, ${hace(v.publicadaHace)})`);
  w(`on conflict (id) do nothing;`);
}
for (const n of NEGOCIOS) {
  w(`insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, price, currency, zone, attrs, images, created_at)`);
  w(`values ('${uuid("c", n.id)}', '${uid(n.duenoId)}', 'offer', 'business', null, ${lit(n.rubro)}, ${lit(n.titulo)}, ${lit(n.descripcion)}, ${n.inversion}, ${lit(n.moneda)}, ${lit(n.ubicacion)}, ${json({ return: n.retorno })}, ${arr([n.imagen])}, ${hace(n.publicadaHace)})`);
  w(`on conflict (id) do nothing;`);
}
w();

// ── Búsquedas (demandas) — se insertan después de las ofertas: el motor las cruza al instante ──
DEMANDAS_INICIALES.forEach((d, i) => {
  const cat = d.categoria === "inmueble" ? "property" : "vehicle";
  const titulo = `Busco ${d.tipo || (d.categoria === "inmueble" ? "inmueble" : "vehículo")}${d.zona ? ` en ${d.zona}` : ""}`;
  w(`insert into public.listings (id, owner_id, kind, category, operation, subtype, title, description, budget_max, currency, zone, min_area, created_at)`);
  w(`values ('${uuid("d", d.id)}', '${uid(d.autorId)}', 'demand', '${cat}', '${d.operacion === "comprar" ? "sale" : "rent"}', ${lit(d.tipo)}, ${lit(titulo)}, ${lit(d.nota)}, ${d.presupuestoMax}, ${lit(d.moneda)}, ${lit(d.zona)}, ${lit(d.superficieMin)}, now() - interval '${(i + 1) * 4} hours')`);
  w(`on conflict (id) do nothing;`);
});
w();

// ── Servicios y vacantes ──
for (const g of GIGS) {
  w(`insert into public.jobs (id, owner_id, kind, title, description, category, price_from, currency, delivery_days, image_url, sales_count)`);
  w(`values ('${uuid("e", g.id)}', '${uid(g.autorId)}', 'gig', ${lit(g.titulo)}, ${lit(g.descripcion)}, ${lit(g.categoria)}, ${g.precioDesde}, ${lit(g.moneda)}, ${g.entregaDias}, ${lit(g.imagen)}, ${g.ventas})`);
  w(`on conflict (id) do nothing;`);
}
const ahora = Date.now();
for (const v of VACANTES) {
  const horas = Math.max(1, Math.round((ahora - v.ts) / 3_600_000));
  w(`insert into public.jobs (id, owner_id, kind, title, description, job_type, modality, location, budget_text, skills, created_at)`);
  w(`values ('${uuid("f", v.id)}', '${uid(v.autorId)}', 'vacancy', ${lit(v.titulo)}, ${lit(v.descripcion)}, ${lit(v.tipo)}, ${lit(v.modalidad)}, ${lit(v.ubicacion)}, ${lit(v.presupuesto)}, ${arr(v.skills)}, now() - interval '${horas} hours')`);
  w(`on conflict (id) do nothing;`);
}
w();

// ── Comunidad ──
for (const p of crearPostsIniciales(ahora)) {
  const min = Math.max(1, Math.round((ahora - p.ts) / 60_000));
  w(`insert into public.posts (id, author_id, kind, body, zone, image_url, created_at)`);
  w(`values ('${uuid("1", p.id)}', '${uid(p.autorId)}', ${lit(p.tipo)}, ${lit(p.texto)}, ${lit(p.zona)}, ${lit(p.imagen)}, now() - interval '${min} minutes')`);
  w(`on conflict (id) do nothing;`);
  for (const l of p.likes.filter((x) => x !== "yo")) {
    w(`insert into public.post_likes (post_id, user_id) values ('${uuid("1", p.id)}', '${uid(l)}') on conflict do nothing;`);
  }
  for (const c of p.comentarios) {
    const m = Math.max(1, Math.round((ahora - c.ts) / 60_000));
    w(`insert into public.post_comments (id, post_id, author_id, body, created_at) values ('${uuid("2", c.id)}', '${uuid("1", p.id)}', '${uid(c.autorId)}', ${lit(c.texto)}, now() - interval '${m} minutes') on conflict (id) do nothing;`);
  }
}

// Las notificaciones que el motor generó para los usuarios demo no aportan nada.
w();
w("delete from public.notifications where user_id in (select id from public.profiles where is_demo);");

fs.writeFileSync(salida, L.join("\n") + "\n", "utf8");
console.log(`seed.sql generado: ${L.length} líneas`);
