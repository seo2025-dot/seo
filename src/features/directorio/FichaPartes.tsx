/* eslint-disable @next/next/no-img-element */
import { CANALES, DIAS, ETIQUETA_DIA, partesEcuador, textoHorarioDia, type Horario } from "@/data/directorio";
import { textoDinero, textoPrecio, type GrupoCatalogo } from "@/lib/directorio/mapeo";
import { InsigniaTurno } from "@/features/directorio/Insignias";
import type { Proveedor, Resena, TurnoGuardia } from "@/types/directorio";

const FORMATO_TURNO = new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const FORMATO_FECHA = new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", day: "numeric", month: "short", year: "numeric" });

/** Catálogo agrupado por sección. Los artículos con receta se muestran solo como información. */
export function MenuProveedor({ grupos, plural }: { grupos: GrupoCatalogo[]; plural: string }) {
  const total = grupos.reduce((n, g) => n + g.items.length, 0);
  if (total === 0) {
    return <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Este negocio aún no publicó sus {plural}. Pregúntales por WhatsApp.</p>;
  }
  return (
    <div className="space-y-6">
      {grupos.map((g) => (
        <section key={g.seccion || "todos"} aria-label={g.seccion || `Todos los ${plural}`}>
          {g.seccion && <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">{g.seccion}</h3>}
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {g.items.map((i) => (
              <li key={i.id} className={`flex items-start gap-3 p-3.5 ${i.disponible ? "" : "opacity-55"}`}>
                {i.imagen && <img src={i.imagen} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">{i.nombre}</p>
                  {i.descripcion && <p className="mt-0.5 text-sm text-slate-500">{i.descripcion}</p>}
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {i.receta && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">℞ Con receta médica</span>}
                    {!i.disponible && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">Agotado</span>}
                  </p>
                </div>
                <p className="shrink-0 text-right font-black tabular-nums text-ink">{textoPrecio(i)}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-slate-400">Precios en dólares y sujetos a disponibilidad. Confirma con el negocio antes de pedir.</p>
    </div>
  );
}

/** Horario semanal con el día de hoy (hora de Ecuador) resaltado. */
export function HorarioSemanal({ horario, abierto24h }: { horario: Horario; abierto24h: boolean }) {
  if (abierto24h) return <p className="text-sm font-semibold text-emerald-700">Abierto las 24 horas, todos los días.</p>;
  if (DIAS.every((d) => (horario[d] ?? []).length === 0)) return <p className="text-sm text-slate-500">Este negocio aún no publicó su horario.</p>;
  const hoy = partesEcuador(new Date()).dia;
  return (
    <dl className="space-y-1 text-sm">
      {DIAS.map((d) => (
        <div key={d} className={`flex justify-between gap-3 rounded-lg px-2 py-1 ${d === hoy ? "bg-brand-50 font-bold text-brand-900" : "text-slate-600"}`}>
          <dt>{ETIQUETA_DIA[d]}{d === hoy && <span className="ml-1 text-[11px] font-semibold">(hoy)</span>}</dt>
          <dd className="tabular-nums">{textoHorarioDia(horario, d)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TurnosProveedor({ turnos, verificado }: { turnos: TurnoGuardia[]; verificado: boolean }) {
  if (turnos.length === 0) return null;
  const ahora = Date.now();
  return (
    <section aria-labelledby="turnos-titulo" className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
      <h2 id="turnos-titulo" className="flex items-center gap-2 text-sm font-black text-rose-900">
        🚨 Turnos
      </h2>
      <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
        {turnos.map((t) => {
          const ahoraMismo = t.desde <= ahora && ahora < t.hasta;
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-x-2">
              <span className="capitalize">{FORMATO_TURNO.format(t.desde)}</span>
              <span aria-hidden>→</span>
              <span className="capitalize">{FORMATO_TURNO.format(t.hasta)}</span>
              {ahoraMismo && <InsigniaTurno verificado={verificado} />}
              {t.nota && <span className="w-full text-xs text-slate-500">{t.nota}</span>}
            </li>
          );
        })}
      </ul>
      {!verificado && <p className="mt-2 text-[11px] text-amber-800">Turnos declarados por el establecimiento; aún sin verificar por conectari.com.</p>}
    </section>
  );
}

export function InfoEntrega({ p }: { p: Proveedor }) {
  const etiquetas = p.canales.map((c) => CANALES.find((x) => x.id === c)?.etiqueta).filter(Boolean);
  return (
    <div className="space-y-2 text-sm">
      <ul className="flex flex-wrap gap-1.5" aria-label="Cómo atiende">
        {etiquetas.map((e) => (
          <li key={e} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {e}
          </li>
        ))}
      </ul>
      {p.canales.includes("entrega") && (
        <p className="text-slate-600">
          🛵 Envío {p.costoEnvio > 0 ? textoDinero(p.costoEnvio) : "gratis"}
          {p.pedidoMinimo > 0 && <> · pedido mínimo {textoDinero(p.pedidoMinimo)}</>}
        </p>
      )}
    </div>
  );
}

export function ListaResenas({ resenas }: { resenas: Resena[] }) {
  if (resenas.length === 0) return <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Aún no hay reseñas. Solo pueden opinar quienes han contactado o contratado al negocio.</p>;
  return (
    <ul className="space-y-3">
      {resenas.map((r) => (
        <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold text-ink">{r.autor}</span>
            <span className="text-amber-400" role="img" aria-label={`${r.rating} de 5 estrellas`}>
              {"★".repeat(r.rating)}
              <span className="text-slate-200">{"★".repeat(5 - r.rating)}</span>
            </span>
            {r.compraVerificada && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">✓ Compra verificada</span>}
            <span className="ml-auto text-xs text-slate-400">{FORMATO_FECHA.format(r.fecha)}</span>
          </div>
          {r.comentario && <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-700">{r.comentario}</p>}
        </li>
      ))}
    </ul>
  );
}
