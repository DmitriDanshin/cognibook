import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/pwa/register-sw";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

const APP_NAME = "CogniBook";
const APP_DESCRIPTION = "Веб-приложение для чтения и проверки знаний с детальной обратной связью";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: `${APP_NAME} - Умное чтение и обучение`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: ["epub", "markdown", "тесты", "обучение", "quiz", "книги", "pwa"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icons/icon-48x48.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-right" duration={2000} closeButton />
        <RegisterSW />
      </body>
    </html>
  );
}

