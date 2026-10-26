import type { Metadata } from "next";
import "./globals.css";
import "./brand.css";
import {isVercelHosted} from '../lib/hosting';
import MarketingConsent from '../components/marketing-consent';

export const metadata: Metadata = {
  title: "Aperte Play · Seu momento começa com um play",
  description: "Solicite 5 horas grátis de Aperte Play pelo WhatsApp. Planos mensal por R$ 25, semestral por R$ 100 e anual por R$ 99,99. " + (isVercelHosted ? "Checkout no site com Mercado Pago em ativação." : "Pagamentos no site em demonstração."),
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
      <body className="antialiased">{children}<MarketingConsent pixelId={process.env.META_TRACKING_ENABLED === 'true' ? process.env.META_PIXEL_ID ?? '' : ''}/></body>
    </html>
  );
}
