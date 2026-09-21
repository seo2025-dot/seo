"use client";

import { useState } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import TabAjustes from "@/features/monedas/admin/TabAjustes";
import TabPersonas from "@/features/monedas/admin/TabPersonas";
import TabRegistro from "@/features/monedas/admin/TabRegistro";
import TabResumen from "@/features/monedas/admin/TabResumen";
import TabVentas from "@/features/monedas/admin/TabVentas";

const PESTANAS = [
  { id: "resumen", etiqueta: "Resumen", emoji: "📊" },
  { id: "ventas", etiqueta: "Ventas", emoji: "💳" },
  { id: "ajustes", etiqueta: "Tarifas y paquetes", emoji: "🏷️" },
  { id: "personas", etiqueta: "Personas", emoji: "🧑" },
  { id: "registro", etiqueta: "Registro", emoji: "📝" },
] as const;
type Pestana = (typeof PESTANAS)[number]["id"];

/** Panel de administración de monedas. Solo para quienes están en `app_admins`; además, cada función de la base comprueba `is_admin()`. */
export default function PanelAdminMonedas() {
  const { esAdmin, sesion } = useSocial();
  const [pestana, setPestana] = useState<Pestana>("resumen");

  if (!sesion.lista) return <div className="mx-auto h-64 max-w-5xl animate-pulse px-4 py-10" />;
  if (!esAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-4xl" aria-hidden>
          🔒
        </p>
        <h1 className="mt-3 text-xl font-bold">Acceso restringido</h1>
        <p className="mt-1 text-sm text-slate-500">Solo los administradores pueden ver la economía de monedas.</p>
        <Link href="/" className="boton-marca mt-6 inline-block rounded-full px-7 py-2.5 text-sm font-bold text-white">
          Ir al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-ink">Administración de monedas</h1>
          <p className="text-slate-500">Ventas, tarifas, paquetes, retos y soporte. Todo cambio queda registrado.</p>
        </div>
        <nav aria-label="Otras áreas de administración" className="flex gap-2 text-sm">
          <Link href="/admin/kyc" className="rounded-full border border-slate-300 px-4 py-1.5 font-semibold text-slate-600 hover:border-brand-400">
            Identidad
          </Link>
          <Link href="/admin/personas" className="rounded-full border border-slate-300 px-4 py-1.5 font-semibold text-slate-600 hover:border-brand-400">
            Personas demo
          </Link>
        </nav>
      </header>

      <div role="tablist" aria-label="Secciones" className="-mx-4 mt-6 flex gap-1 overflow-x-auto px-4 pb-1">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" role="tab" id={`tab-${p.id}`} aria-selected={pestana === p.id} aria-controls={`panel-${p.id}`} onClick={() => setPestana(p.id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${pestana === p.id ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            <span aria-hidden>{p.emoji}</span> {p.etiqueta}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`tab-${pestana}`} className="mt-6">
        {pestana === "resumen" && <TabResumen />}
        {pestana === "ventas" && <TabVentas />}
        {pestana === "ajustes" && <TabAjustes />}
        {pestana === "personas" && <TabPersonas />}
        {pestana === "registro" && <TabRegistro />}
      </div>
    </div>
  );
}
