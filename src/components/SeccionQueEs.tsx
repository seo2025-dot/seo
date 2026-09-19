import Image from "next/image";
import Link from "next/link";
import { QUE_ES_BREVE } from "@/lib/marca";

/** Bloque institucional discreto de la portada: texto breve y enlace a la página completa. */
export default function SeccionQueEs() {
  return (
    <section aria-labelledby="que-es" className="mx-auto mt-4 max-w-6xl px-4 pb-16">
      <div className="flex flex-col items-center gap-5 rounded-3xl border border-brand-100 bg-brand-50/60 p-6 sm:flex-row sm:items-start sm:p-8">
        <Image src="/brand/conectari-icono.png" alt="" aria-hidden width={586} height={512} className="h-14 w-auto shrink-0 sm:h-16" />
        <div className="text-center sm:text-left">
          <h2 id="que-es" className="text-lg font-extrabold text-ink">
            ¿Qué es conectari<span className="texto-marca">.com</span>?
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{QUE_ES_BREVE}</p>
          <Link href="/que-es" className="mt-3 inline-block text-sm font-bold text-brand-700 transition hover:translate-x-1 hover:underline">
            Conoce más sobre conectari.com →
          </Link>
        </div>
      </div>
    </section>
  );
}
