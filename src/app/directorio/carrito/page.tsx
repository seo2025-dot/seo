import type { Metadata } from "next";
import PaginaCarrito from "@/features/directorio/carrito/PaginaCarrito";

export const metadata: Metadata = { title: "Tu carrito", robots: { index: false } };

export default function CarritoPage() {
  return <PaginaCarrito />;
}
