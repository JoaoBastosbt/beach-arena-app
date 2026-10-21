import type { Metadata, Viewport } from "next";
import { Barlow, Inter } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const barlow = Barlow({ variable: "--font-barlow", subsets: ["latin"], weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "Beach Arena — Gestão de arenas", template: "%s · Beach Arena" },
  description: "Gestão de arenas e escolas de esportes de areia: turmas, chamada, planos, reposições, treinos e financeiro.",
};

export const viewport: Viewport = {
  themeColor: "#082a3b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${barlow.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
