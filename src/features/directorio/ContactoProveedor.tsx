"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSocial } from "@/context/SocialContext";
import { enlaceTel, enlaceWhatsapp, formatearTelefono, mensajePedido } from "@/lib/directorio/contacto";
import { haySupabase, supabase } from "@/lib/supabaseClient";
import type { ContactoProveedor as Contacto } from "@/types/directorio";

interface FilaContacto {
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
}

/**
 * Contacto del negocio: solo con sesión (la base de datos no lo entrega a anónimos). Sin sesión se invita a entrar o registrarse;
 * es a la vez la protección contra el rastreo de teléfonos y el embudo de registro del directorio.
 */
export default function ContactoProveedor({ proveedorId, nombre, ruta }: { proveedorId: string; nombre: string; ruta: string }) {
  const { sesion, hidratado } = useSocial();
  const [contacto, setContacto] = useState<Contacto | null | undefined>(undefined);

  useEffect(() => {
    if (!hidratado || !sesion.uid || !haySupabase) return;
    let vivo = true;
    void Promise.resolve(supabase().from("provider_contacts").select("*").eq("provider_id", proveedorId).maybeSingle()).then(({ data }) => {
      if (!vivo) return;
      const f = data as FilaContacto | null;
      setContacto(f ? { telefono: f.phone ?? undefined, whatsapp: f.whatsapp ?? undefined, direccion: f.address ?? undefined } : null);
    });
    return () => {
      vivo = false;
    };
  }, [hidratado, sesion.uid, proveedorId]);

  if (!hidratado) return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />;

  if (!sesion.uid) {
    return (
      <section aria-labelledby="contacto-titulo" className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <h2 id="contacto-titulo" className="text-sm font-black text-brand-900">
          Contactar a {nombre}
        </h2>
        <p className="mt-1 text-sm text-brand-900/80">Inicia sesión para ver su WhatsApp, teléfono y dirección. Es gratis y toma un minuto.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/login?next=${encodeURIComponent(ruta)}`} className="boton-marca rounded-full px-5 py-2 text-sm font-bold text-white">
            Iniciar sesión
          </Link>
          <Link href={`/registro?next=${encodeURIComponent(ruta)}`} className="rounded-full border border-brand-300 bg-white px-5 py-2 text-sm font-bold text-brand-800 hover:bg-brand-100">
            Crear cuenta
          </Link>
        </div>
      </section>
    );
  }

  if (contacto === undefined) return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />;

  const wa = contacto?.whatsapp ? enlaceWhatsapp(contacto.whatsapp, mensajePedido(nombre)) : null;
  const tel = contacto?.telefono ? enlaceTel(contacto.telefono) : null;
  const mapa = contacto?.direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${contacto.direccion}, Cuenca, Ecuador`)}` : null;

  if (!wa && !tel && !contacto?.direccion) {
    return (
      <section aria-labelledby="contacto-titulo" className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 id="contacto-titulo" className="text-sm font-black text-ink">
          Contacto
        </h2>
        <p className="mt-1 text-sm text-slate-500">Este negocio todavía no publicó su contacto.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="contacto-titulo" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 id="contacto-titulo" className="text-sm font-black text-ink">
        Contacto
      </h2>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
          <span aria-hidden>💬</span> Pedir por WhatsApp
        </a>
      )}
      {tel && contacto?.telefono && (
        <a href={tel} className="flex items-center justify-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-ink hover:border-brand-400">
          <span aria-hidden>📞</span> Llamar · {formatearTelefono(contacto.telefono)}
        </a>
      )}
      {contacto?.direccion && (
        <p className="text-sm text-slate-600">
          📍 {contacto.direccion}
          {mapa && (
            <>
              {" "}
              <a href={mapa} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
                Ver en el mapa
              </a>
            </>
          )}
        </p>
      )}
    </section>
  );
}
