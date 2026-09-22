import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Signal — Qu'est-ce que je ne dois pas rater ?",
  description:
    "Chaque semaine, une sélection ultra-filtrée de films, séries, albums et livres qui méritent vraiment ton temps.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="min-h-screen bg-ink font-sans antialiased">{children}</body>
    </html>
  );
}
