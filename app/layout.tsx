import type { Metadata } from "next";
import "./globals.css";
import "./brand.css";
import {isVercelHosted} from '../lib/hosting';

export const metadata: Metadata = {
  title: "Aperte Play · Seu momento começa com um play",
  description: "Solicite 6 horas grátis de Aperte Play pelo WhatsApp. Planos mensal por R$ 25, semestral por R$ 100 e anual por R$ 170. " + (isVercelHosted ? "Checkout no site com Mercado Pago em ativação." : "Pagamentos no site em demonstração."),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
