import Link from "next/link";
import { VERTICAL_POR_ID, type VerticalId } from "@/data/directorio";
import { OPCIONES_ZONA } from "@/features/directorio/Bloques";
import { filtrosActivos, hrefLista, type FiltrosLista } from "@/lib/directorio/filtros";

const campo = "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

function Chip({ href, activo, children }: { href: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-pressed={activo}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${activo ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"}`}
    >
      {children}
    </Link>
  );
}

/**
 * Búsqueda y filtros de un listado. Todo vive en la URL y funciona sin JavaScript: el formulario es un GET y los filtros son enlaces.
 */
export default function FiltrosListado({ vertical, filtros }: { vertical: VerticalId; filtros: FiltrosLista }) {
  const v = VERTICAL_POR_ID[vertical];
  const activos = filtrosActivos(filtros);
  return (
    <section aria-label="Buscar y filtrar" className="space-y-3">
      <form action={`/directorio/${vertical}`} method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        {filtros.subtipo && <input type="hidden" name="subtipo" value={filtros.subtipo} />}
        {filtros.abierto && <input type="hidden" name="abierto" value="1" />}
        {filtros.entrega && <input type="hidden" name="entrega" value="1" />}
        {filtros.verificados && <input type="hidden" name="verificados" value="1" />}
        {filtros.deTurno && <input type="hidden" name="turno" value="1" />}
        <label className="sr-only" htmlFor="filtro-q">
          Buscar en {v.etiqueta}
        </label>
        <input id="filtro-q" name="q" type="search" defaultValue={filtros.q ?? ""} maxLength={60} placeholder={v.buscador} autoComplete="off" className={`${campo} flex-1`} />
        <label className="sr-only" htmlFor="filtro-zona">
          Zona
        </label>
        <select id="filtro-zona" name="zona" defaultValue={filtros.zona ?? ""} className={`${campo} sm:w-56`}>
          <option value="">Toda la ciudad</option>
          {OPCIONES_ZONA.map((z) => (
            <option key={z} value={z}>
              📍 {z}
            </option>
          ))}
        </select>
        <button type="submit" className="boton-marca rounded-xl px-7 py-2.5 text-sm font-bold text-white">
          Buscar
        </button>
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Categorías">
        <Chip href={hrefLista(vertical, filtros, { subtipo: undefined })} activo={!filtros.subtipo}>
          Todos
        </Chip>
        {v.subtipos.map((s) => (
          <Chip key={s.id} href={hrefLista(vertical, filtros, { subtipo: filtros.subtipo === s.id ? undefined : s.id })} activo={filtros.subtipo === s.id}>
            {s.emoji} {s.etiqueta}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
        {v.capacidades.turnos && (
          <Chip href={hrefLista(vertical, filtros, { deTurno: !filtros.deTurno })} activo={filtros.deTurno}>
            🚨 De turno ahora
          </Chip>
        )}
        <Chip href={hrefLista(vertical, filtros, { abierto: !filtros.abierto })} activo={filtros.abierto}>
          🟢 Abierto ahora
        </Chip>
        {v.capacidades.pedidos && (
          <Chip href={hrefLista(vertical, filtros, { entrega: !filtros.entrega })} activo={filtros.entrega}>
            🛵 A domicilio
          </Chip>
        )}
        <Chip href={hrefLista(vertical, filtros, { verificados: !filtros.verificados })} activo={filtros.verificados}>
          ✓ Verificados
        </Chip>
        {activos > 0 && (
          <Link href={`/directorio/${vertical}`} className="ml-1 text-sm font-semibold text-slate-500 underline hover:text-ink">
            Quitar filtros ({activos})
          </Link>
        )}
      </div>
    </section>
  );
}
