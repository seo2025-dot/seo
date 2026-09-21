import Link from "next/link";
import { OPCIONES_ZONA, AvisoConfiguracion, EstadoVacio, InvitacionAlta } from "@/features/directorio/Bloques";
import TarjetaEvento from "@/features/directorio/eventos/TarjetaEvento";
import TarjetaProveedor from "@/features/directorio/TarjetaProveedor";
import { CATEGORIAS_EVENTO, CUANDO, agruparPorDia, filtrosEventoActivos, hrefCartelera, type FiltrosEvento } from "@/lib/directorio/eventos";
import { FILTROS_INICIALES } from "@/lib/directorio/filtros";
import { buscarProveedores, eventosCartelera } from "@/lib/directorio/servidor";

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

/** Cartelera de la sección Eventos: próximos eventos agrupados por día, con filtros en la URL (funcionan sin JavaScript). */
export default async function Cartelera({ filtros }: { filtros: FiltrosEvento }) {
  const [{ datos, error }, organizadores] = await Promise.all([eventosCartelera(filtros), filtrosEventoActivos(filtros) === 0 && filtros.pagina === 1 ? buscarProveedores("eventos", FILTROS_INICIALES) : null]);
  const grupos = agruparPorDia(datos.items.map((x) => x.evento));
  const porId = new Map(datos.items.map((x) => [x.evento.id, x]));
  const activos = filtrosEventoActivos(filtros);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Ruta" className="mb-2 text-sm text-slate-500">
        <Link href="/directorio" className="hover:underline">
          Directorio
        </Link>{" "}
        <span aria-hidden>›</span> <span className="font-semibold text-slate-700">Eventos y entradas</span>
      </nav>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-ink sm:text-4xl">
            <span aria-hidden>🎟️</span> Eventos <span className="texto-marca">en tu ciudad</span>
          </h1>
          <p className="mt-1 max-w-2xl text-slate-600">Conciertos, teatro, talleres y ferias. Reserva tus entradas gratis, sin comisiones: pagas en la puerta.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/directorio/entradas" className="rounded-full border border-slate-300 px-5 py-2 text-sm font-bold text-ink hover:border-brand-400">
            🎫 Mis entradas
          </Link>
          <Link href="/directorio/mi-negocio/eventos/nuevo" className="boton-marca rounded-full px-5 py-2 text-sm font-bold text-white">
            + Publicar un evento
          </Link>
        </div>
      </header>

      <section aria-label="Buscar y filtrar" className="space-y-3">
        <form action="/directorio/eventos" method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
          {filtros.categoria && <input type="hidden" name="cat" value={filtros.categoria} />}
          {filtros.cuando && <input type="hidden" name="cuando" value={filtros.cuando} />}
          {filtros.gratis && <input type="hidden" name="gratis" value="1" />}
          <label className="sr-only" htmlFor="ev-q">
            Buscar eventos
          </label>
          <input id="ev-q" name="q" type="search" defaultValue={filtros.q} maxLength={60} placeholder="Concierto, taller de cerámica, feria…" autoComplete="off" className={`${campo} flex-1`} />
          <label className="sr-only" htmlFor="ev-zona">
            Zona
          </label>
          <select id="ev-zona" name="zona" defaultValue={filtros.zona} className={`${campo} sm:w-56`}>
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

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Cuándo">
          <Chip href={hrefCartelera(filtros, { cuando: "" })} activo={!filtros.cuando}>
            Cualquier fecha
          </Chip>
          {CUANDO.map((c) => (
            <Chip key={c.id} href={hrefCartelera(filtros, { cuando: filtros.cuando === c.id ? "" : c.id })} activo={filtros.cuando === c.id}>
              {c.etiqueta}
            </Chip>
          ))}
          <Chip href={hrefCartelera(filtros, { gratis: !filtros.gratis })} activo={filtros.gratis}>
            🆓 Gratis
          </Chip>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Categorías">
          <Chip href={hrefCartelera(filtros, { categoria: "" })} activo={!filtros.categoria}>
            Todas
          </Chip>
          {CATEGORIAS_EVENTO.map((c) => (
            <Chip key={c.id} href={hrefCartelera(filtros, { categoria: filtros.categoria === c.id ? "" : c.id })} activo={filtros.categoria === c.id}>
              {c.emoji} {c.etiqueta}
            </Chip>
          ))}
          {activos > 0 && (
            <Link href="/directorio/eventos" className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold text-slate-500 underline hover:text-ink">
              Quitar filtros
            </Link>
          )}
        </div>
      </section>

      <div className="mt-6">
        {error && <AvisoConfiguracion mensaje={error} />}
        {!error && datos.items.length === 0 ? (
          activos > 0 ? (
            <EstadoVacio emoji="🔎" titulo="Ningún evento coincide con estos filtros" texto="Prueba con otra fecha o categoría, o mira toda la cartelera." accion={{ href: "/directorio/eventos", etiqueta: "Quitar filtros" }} />
          ) : (
            <EstadoVacio
              emoji="🎟️"
              titulo="Aún no hay eventos publicados"
              texto="La cartelera la llena la comunidad. Si organizas un concierto, un taller o una feria, sé la primera persona en publicarlo: es gratis y toma menos de 5 minutos."
              accion={{ href: "/directorio/mi-negocio/eventos/nuevo", etiqueta: "Publicar un evento" }}
            />
          )
        ) : (
          <>
            {grupos.map((g) => (
              <section key={g.clave} aria-labelledby={`dia-${g.clave}`} className="mb-8">
                <h2 id={`dia-${g.clave}`} className="mb-3 text-xl font-black capitalize text-ink">
                  {g.etiqueta}
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {g.eventos.map((ev, i) => {
                    const p = porId.get(ev.id);
                    return p ? <TarjetaEvento key={ev.id} e={p} prioridad={i < 3 && g === grupos[0]} /> : null;
                  })}
                </div>
              </section>
            ))}
            {(filtros.pagina > 1 || datos.hayMas) && (
              <nav aria-label="Paginación" className="mt-4 flex items-center justify-center gap-3">
                {filtros.pagina > 1 && (
                  <Link href={hrefCartelera(filtros, { pagina: filtros.pagina - 1 })} rel="prev" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-ink hover:border-brand-400">
                    ← Anterior
                  </Link>
                )}
                {datos.hayMas && (
                  <Link href={hrefCartelera(filtros, { pagina: filtros.pagina + 1 })} rel="next" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-ink hover:border-brand-400">
                    Siguiente →
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>

      {organizadores && organizadores.datos.items.length > 0 && (
        <section aria-labelledby="orgs-titulo" className="mt-12">
          <h2 id="orgs-titulo" className="mb-4 text-2xl font-black text-ink">
            Organizadores y salas
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {organizadores.datos.items.slice(0, 6).map((p) => (
              <TarjetaProveedor key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      <InvitacionAlta vertical="eventos" className="mt-14" />
    </div>
  );
}
