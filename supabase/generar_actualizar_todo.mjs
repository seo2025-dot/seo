// Genera supabase/actualizar_todo.sql: las actualizaciones update_002 … update_0NN juntas, para pegarlas de una vez en el SQL Editor de Supabase.
// Cada actualización va protegida por una comprobación «¿ya está aplicada?» (mira si existe algo que ella crea), así que el archivo sirve igual si
// no tienes ninguna, si tienes algunas o si ya las tienes todas: aplica solo las que faltan, en orden. (Las actualizaciones sueltas son idempotentes
// solo aplicadas en su turno: volver a ejecutar una antigua sobre una base más nueva puede fallar; este paquete evita ese problema.)
// Uso: node supabase/generar_actualizar_todo.mjs   (y luego: npx tsx supabase/tests/actualizar-todo.test.mjs)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(fileURLToPath(import.meta.url));
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8").replace(/\r\n/g, "\n");

const columna = (tabla, col) => `exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = '${tabla}' and column_name = '${col}')`;
const tabla = (t) => `to_regclass('public.${t}') is not null`;
const funcion = (f) => `exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '${f}')`;

/** Algo que crea cada actualización y que ninguna posterior quita: si existe, esa actualización ya está aplicada. */
export const YA_APLICADA = {
  "002": tabla("profile_photos"),
  "003": columna("profiles", "university"),
  "004": columna("profiles", "core_values"),
  "005": columna("post_likes", "reaction"),
  "006": tabla("providers"),
  "007": funcion("search_directory"),
  "008": columna("orders", "customer_phone"),
  "009": funcion("cancel_event"),
  "010": tabla("coin_prices"),
  "011": funcion("admin_coin_stats"),
  "012": columna("profiles", "country"),
  "013": columna("user_private", "gender"),
  "014": tabla("admin_alerts"),
};

export function paquete() {
  const archivos = fs.readdirSync(raiz).filter((f) => /^update_\d{3}_.*\.sql$/.test(f)).sort();
  for (const f of archivos) if (!YA_APLICADA[f.slice(7, 10)]) throw new Error(`Falta la comprobación «ya aplicada» de ${f} en generar_actualizar_todo.mjs`);
  const cab = `-- ============================================================================
-- ACTUALIZAR TODO · Actualizaciones ${archivos[0].slice(7, 10)} a ${archivos[archivos.length - 1].slice(7, 10)} juntas (generado; no lo edites a mano)
--
-- Pégalo ENTERO en Supabase > SQL Editor > New query > Run. Aplica solo las actualizaciones que le falten a tu base de datos, en orden, y se salta
-- las que ya tiene: sirve igual si no tienes ninguna, si tienes algunas o si ya las tienes todas (en «Messages» verás cuáles aplicó).
-- Si instalas desde cero usa schema.sql. Se regenera con: node supabase/generar_actualizar_todo.mjs
-- ============================================================================
`;
  const bloques = archivos.map((f) => {
    const n = f.slice(7, 10);
    return `
-- ▶▶▶ ${f}
do $guard_${n}$
begin
  if ${YA_APLICADA[n]} then
    raise notice 'Actualización ${n}: ya estaba aplicada, se omite';
  else
    execute $upd_${n}$
${leer(f).trim()}
    $upd_${n}$;
    raise notice 'Actualización ${n}: aplicada';
  end if;
end
$guard_${n}$;
`;
  });
  return cab + bloques.join("");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(path.join(raiz, "actualizar_todo.sql"), paquete());
  console.log("actualizar_todo.sql generado");
}
