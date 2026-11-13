import type { Metadata, Viewport } from "next";
import "./globals.css";
import FxLayer from "@/components/fx/fx-layer";
import BreachFX from "@/components/fx/breach-fx";

const title = "HACKER_AI NEXUS :: Inteligencia artificial. Produtividade. Controle.";
const description =
  "Plataforma inteligente de conversacao idealizada por Mistico Virus: acesso por OTP, painel administrativo, planos com controle de tokens e integracao com APIs de IA gratuitas, com motor local proprio.";
const baseUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title,
  description,
  applicationName: "HACKER_AI NEXUS",
  keywords: [
    "IA",
    "inteligencia artificial",
    "chat",
    "terminal",
    "OTP",
    "planos",
    "tokens",
    "HACKER_AI",
    "NEXUS",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "HACKER_AI NEXUS",
    title,
    description,
    images: [{ url: "/emblem-hackerai.png", width: 512, height: 512, alt: "HACKER_AI NEXUS" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/emblem-hackerai.png"],
  },
  icons: {
    icon: [{ url: "/emblem-hackerai.png", sizes: "any", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased touch-manipulation">
        <FxLayer />
        <BreachFX />
        <div className="scanline" />
        {children}
      </body>
    </html>
  );
}
