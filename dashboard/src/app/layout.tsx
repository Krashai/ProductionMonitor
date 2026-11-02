import type { Metadata } from "next";
import "./globals.css";
import { SplashScreen } from "@/components/SplashScreen";

export const metadata: Metadata = {
  title: "LineON",
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
        {/* Ekran powitalny tylko przy pełnym załadowaniu — layout nie remontuje się przy nawigacji */}
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
