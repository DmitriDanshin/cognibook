import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "CogniBook - Умное чтение и обучение",
  description:
    "Веб-приложение для чтения специализированной литературы и проверки знаний с детальной обратной связью",
  keywords: ["электронные книги", "epub", "тесты", "обучение", "quiz"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-right" duration={2000} closeButton />
      </body>
    </html>
  );
}
