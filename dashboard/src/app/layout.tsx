import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LineGantt Dashboard",
  description: "Real-time production monitoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
