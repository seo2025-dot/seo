/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import { VerificadoCheck } from "@/components/PerfilBadges";
import type { Recomendacion } from "@/features/conexion/hooks";
import type { Usuario } from "@/types/social";

/** Anillo con el porcentaje de compatibilidad. */
function Anillo({ valor }: { valor: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const color = valor >= 60 ? "#059669" : valor >= 30 ? "#f59e0b" : "#94a3b8";
  return (
    <div className="relative h-12 w-12" role="img" aria-label={`Compatibilidad ${valor}%`}>
      <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - valor / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black tabular-nums text-ink">{valor}%</span>
    </div>
  );
}

export default function TarjetaAfinidad({
  usuario,
  rec,
  enviado,
  onConectar,
}: {
  usuario: Usuario;
  rec: Recomendacion;
  enviado: boolean;
  onConectar: () => void;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/usuarios/${usuario.id}`} className="relative block aspect-[4/5] overflow-hidden bg-slate-100" aria-label={`Ver el perfil de ${usuario.nombre}`}>
        {usuario.foto ? (
          <img src={usuario.foto} alt={`Foto de ${usuario.nombre}`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Avatar nombre={usuario.nombre} tamano="xl" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent p-4 pt-16 text-white">
          <h3 className="flex items-center gap-1.5 text-lg font-black leading-tight">
            {usuario.nombre}
            {usuario.edad && <span className="font-semibold text-white/80">{usuario.edad}</span>}
            {usuario.verificaciones.identidad && <VerificadoCheck className="h-4 w-4" />}
          </h3>
          <p className="mt-0.5 truncate text-xs text-white/80">
            {[usuario.estatura ? `${usuario.estatura} cm` : null, usuario.ubicacion || null].filter(Boolean).join(" · ")}
          </p>
        </div>
        {usuario.demo && (
          <span className="absolute left-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur" title="Perfil de demostración: no es una persona real">
            Perfil demo
          </span>
        )}
        <div className="absolute right-3 top-3 rounded-full bg-white/95 p-0.5 shadow">
          <Anillo valor={rec.puntaje} />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {(usuario.universidad || usuario.colegio) && (
          <p className="text-xs text-slate-500">
            {usuario.universidad && <>🎓 {usuario.universidad}</>}
            {usuario.universidad && usuario.colegio && " · "}
            {usuario.colegio && <>🏫 {usuario.colegio}</>}
          </p>
        )}
        {rec.motivos.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Por qué encajan">
            {rec.motivos.slice(0, 3).map((m) => (
              <li key={m} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800">
                {m}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={onConectar}
            disabled={enviado}
            className="boton-marca flex-1 rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60 disabled:[background-image:none] disabled:bg-slate-300"
          >
            {enviado ? "Interés enviado ✓" : "Conectar"}
          </button>
          <Link href={`/usuarios/${usuario.id}`} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-ink hover:border-brand-300">
            Perfil
          </Link>
        </div>
      </div>
    </article>
  );
}
