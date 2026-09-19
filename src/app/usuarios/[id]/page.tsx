"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocial } from "@/context/SocialContext";
import PerfilView from "@/components/PerfilView";

export default function PerfilPublicoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { sesion } = useSocial();

  // Tu propio perfil vive en /perfil (con edición); dentro de la app tu usuario se llama "yo".
  const esMio = id === "yo" || (sesion.uid !== null && id === sesion.uid);
  useEffect(() => {
    if (esMio) router.replace("/perfil");
  }, [esMio, router]);

  return <PerfilView usuarioId={esMio ? "yo" : id} />;
}
