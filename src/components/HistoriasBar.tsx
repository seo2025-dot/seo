"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { POR_ID } from "@/lib/marca";

const ORDEN = ["inmuebles", "vehiculos", "negocios", "taxis", "eventos", "busco", "citas", "astrologia", "empleos", "recompensas", "comunidad"];

/** Banner superior de categorías rápidas estilo "historias". `claro` = sobre un fondo de color (etiquetas oscuras). */
export default function HistoriasBar({ claro = false }: { claro?: boolean }) {
  return (
    <nav aria-label="Categorías rápidas" className="flex gap-4 overflow-x-auto px-1 py-2">
      {ORDEN.map((id, i) => {
        const h = POR_ID[id];
        return (
          <motion.div
            key={h.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.92 }}
            className="shrink-0"
          >
            <Link href={h.href} className="group flex w-16 flex-col items-center gap-1.5">
              <span className={`rounded-full bg-gradient-to-tr ${h.degradado} p-[3px] shadow-md transition group-hover:shadow-lg group-hover:shadow-brand-500/40`}>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl transition-transform duration-300 group-hover:scale-110">{h.emoji}</span>
              </span>
              <span className={`text-[11px] font-semibold ${claro ? "text-ink" : "text-slate-600"}`}>{h.etiqueta}</span>
            </Link>
          </motion.div>
        );
      })}
    </nav>
  );
}
