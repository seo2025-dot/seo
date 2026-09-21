import type { Metadata } from "next";
import PanelAdminMonedas from "@/features/monedas/admin/PanelAdminMonedas";

export const metadata: Metadata = { title: "Administración de monedas", robots: { index: false } };

export default function AdminMonedasPage() {
  return <PanelAdminMonedas />;
}
