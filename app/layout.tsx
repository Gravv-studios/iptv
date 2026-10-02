import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lume TV · Seu acesso, em um só lugar",
  description: "Assinatura, renovação e acesso IPTV. Demonstração privada.",
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
