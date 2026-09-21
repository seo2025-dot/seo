import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";
import Navbar, { BottomNav } from "@/components/Navbar";
import Footer from "@/components/Footer";
import AvisoDatos from "@/components/AvisoDatos";
import GuardaOnboarding from "@/features/onboarding/GuardaOnboarding";
import BienvenidaModal from "@/components/BienvenidaModal";
import SaludoRecurrente from "@/components/SaludoRecurrente";
import CapturaReferido from "@/components/CapturaReferido";
import RecuperarDeCarga from "@/components/RecuperarDeCarga";
import { SocialProvider } from "@/context/SocialContext";
import { LEMA } from "@/lib/marca";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Tipografía redondeada y amable, a juego con el wordmark del logotipo (solo titulares).
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["700", "800", "900"] });

export const metadata: Metadata = {
  title: { default: `conectari.com | ${LEMA}`, template: "%s | conectari.com" },
  description:
    "Inmuebles, vehículos, negocios, empleos freelance y comunidad en tu ciudad. Trato directo entre personas, con perfiles y valoraciones verificadas.",
};

export const viewport: Viewport = { themeColor: "#ff5202" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${nunito.variable}`}>
      <body className="flex min-h-screen flex-col pb-16 font-sans lg:pb-0">
        <RecuperarDeCarga />
        <SocialProvider>
          <Navbar />
          <AvisoDatos />
          <GuardaOnboarding />
          <CapturaReferido />
          <BienvenidaModal />
          <SaludoRecurrente />
          <main className="flex-1">{children}</main>
          <BottomNav />
        </SocialProvider>
        <Footer />
      </body>
    </html>
  );
}
