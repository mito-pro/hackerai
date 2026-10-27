import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HACKER_AI NEXUS :: Inteligencia artificial. Produtividade. Controle.",
  description:
    "Plataforma inteligente de conversacao idealizada por Mistico Virus: acesso por OTP, painel administrativo, planos com controle de tokens e integracao com APIs de IA gratuitas, com motor local proprio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <div className="scanline" />
        {children}
      </body>
    </html>
  );
}
