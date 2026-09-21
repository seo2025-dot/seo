/**
 * Pruebas del paquete «todo en uno» supabase/actualizar_todo.sql (las actualizaciones 002 a 014 juntas, para pegarlas de una vez en el SQL Editor):
 *   npm i --no-save embedded-postgres pg tsx
 *   npx tsx supabase/tests/actualizar-todo.test.mjs
 *
 * Verifica que el archivo está al día con los update_0NN.sql y que, aplicado sobre una base en CUALQUIER punto (solo el esquema inicial, a medias o ya
 * completa), la deja igual que schema.sql completo aplicando solo lo que falta, sin errores y sin perder datos; y que volver a ejecutarlo no hace nada.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { YA_APLICADA, paquete } from "../generar_actualizar_todo.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, "..");
const puerto = 55447;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "todo-test-"));
const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "pw", port: puerto, persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C", "--no-sync"], onLog: () => {}, onError: () => {} });
await server.initialise();
await server.start();

let ok = 0;
let fallos = 0;
const test = async (nombre, fn) => {
  try {
    await fn();
    ok++;
    console.log("  ✓", nombre);
  } catch (e) {
    fallos++;
    console.log("  ✗", nombre, "\n     ", String(e.message).split("\n")[0]);
  }
};
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");
const esquema = leer("schema.sql");
const hasta = (n) => esquema.slice(0, esquema.indexOf(`-- ACTUALIZACION-${n}-INICIO`));
const TODAS = Object.keys(YA_APLICADA);

await test("actualizar_todo.sql está al día: todas las actualizaciones, en orden, cada una con su comprobación «ya aplicada»", () => {
  assert.equal(TODAS.length, 13, "002 … 014");
  assert.equal(leer("actualizar_todo.sql"), paquete(), "regenéralo con: node supabase/generar_actualizar_todo.mjs");
  const orden = [...leer("actualizar_todo.sql").matchAll(/^-- ▶▶▶ update_(\d{3})_/gm)].map((m) => m[1]);
  assert.deepEqual(orden, TODAS);
});

const conexion = (database) => ({ host: "localhost", port: puerto, user: "postgres", password: "pw", database });
let primera = true;
async function conBase(nombre, fn) {
  const admin = new pg.Client(conexion("postgres"));
  await admin.connect();
  await admin.query(`create database ${nombre}`);
  await admin.end();
  const c = new pg.Client(conexion(nombre));
  await c.connect();
  const avisos = [];
  c.on("notice", (n) => avisos.push(n.message));
  try {
    const bootstrap = fs.readFileSync(path.join(aqui, "bootstrap.sql"), "utf8");
    await c.query(primera ? bootstrap : bootstrap.replace(/^create role .*$/gm, ""));
    primera = false;
    await fn(c, avisos);
  } finally {
    await c.end();
  }
}
const firma = async (c) => ({
  tablas: (await c.query("select table_name, column_name, data_type from information_schema.columns where table_schema = 'public' order by 1, 2")).rows.map((r) => `${r.table_name}.${r.column_name}:${r.data_type}`),
  funciones: (await c.query("select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1")).rows.map((r) => r.f),
  triggers: (await c.query("select tgname from pg_trigger where not tgisinternal order by 1")).rows.map((r) => r.tgname),
});
const aplicadas = (avisos) => avisos.filter((a) => /: aplicada$/.test(a)).map((a) => a.match(/Actualización (\d{3})/)[1]);
const omitidas = (avisos) => avisos.filter((a) => /se omite$/.test(a)).map((a) => a.match(/Actualización (\d{3})/)[1]);

let esperada;
await test("sobre una base con solo el esquema inicial: aplica las 13 en orden y deja lo mismo que schema.sql completo", async () => {
  await conBase("completa", async (c) => {
    await c.query(esquema);
    esperada = await firma(c);
  });
  await conBase("desde_base", async (c, avisos) => {
    await c.query(hasta("002"));
    await c.query(leer("actualizar_todo.sql"));
    assert.deepEqual(aplicadas(avisos), TODAS);
    assert.deepEqual(omitidas(avisos), []);
    const f = await firma(c);
    assert.deepEqual(f.tablas, esperada.tablas, "mismas tablas y columnas");
    assert.deepEqual(f.funciones, esperada.funciones, "mismas funciones");
    assert.deepEqual(f.triggers, esperada.triggers, "mismos disparadores");
    // Ejecutarlo otra vez no hace nada
    avisos.length = 0;
    await c.query(leer("actualizar_todo.sql"));
    assert.deepEqual(aplicadas(avisos), []);
    assert.deepEqual(omitidas(avisos), TODAS);
  });
});
await test("sobre una base que ya lo tiene todo (con datos): se salta todo, sin errores ni pérdida de datos", async () => {
  await conBase("ya_actualizada", async (c, avisos) => {
    await c.query(esquema);
    await c.query(`insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'dato@test.dev', '{"full_name":"Dato Previo"}')`);
    await c.query("insert into public.providers (owner_id, vertical, subtype, name) select id, 'delivery', 'restaurante', 'Negocio previo' from auth.users limit 1");
    await c.query(leer("actualizar_todo.sql"));
    assert.deepEqual(omitidas(avisos), TODAS);
    assert.equal((await c.query("select count(*)::int n from public.providers where name = 'Negocio previo'")).rows[0].n, 1);
    assert.equal((await c.query("select count(*)::int n from public.profiles where display_name = 'Dato Previo'")).rows[0].n, 1);
  });
});
await test("sobre una base a medias, en cualquier punto (le falta desde la 003, 006, 009, 011 o 014): aplica solo las que faltan y llega al mismo resultado", async () => {
  for (const n of ["003", "006", "009", "011", "014"]) {
    // «hasta(n)» = todo lo anterior a la actualización n
    await conBase(`a_medias_${n}`, async (c, avisos) => {
      await c.query(hasta(n));
      await c.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'medio@test.dev', '{\"full_name\":\"Dato Medio\"}')");
      await c.query(leer("actualizar_todo.sql"));
      const faltaban = TODAS.filter((x) => x >= n);
      assert.deepEqual(aplicadas(avisos), faltaban, `desde la ${n}`);
      assert.deepEqual(omitidas(avisos), TODAS.filter((x) => x < n), `desde la ${n}`);
      const f = await firma(c);
      assert.deepEqual(f.funciones, esperada.funciones, `funciones desde la ${n}`);
      assert.deepEqual(f.tablas, esperada.tablas, `tablas desde la ${n}`);
      assert.equal((await c.query("select count(*)::int n from public.profiles where display_name = 'Dato Medio'")).rows[0].n, 1, "los datos previos se conservan");
    });
  }
});

console.log(`\n${ok} pruebas OK, ${fallos} con fallo`);
await server.stop();
fs.rmSync(dir, { recursive: true, force: true });
process.exit(fallos ? 1 : 0);
