import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Osss – Gym-Software für BJJ",
    template: "%s | Osss",
  },
  description: "Mitgliederverwaltung, Belt-Tracking, Anwesenheit und Zahlungen für BJJ-Gyms.",
  applicationName: "Osss",
  keywords: ["BJJ", "Jiu-Jitsu", "Gym Software", "Mitgliederverwaltung", "Belt Tracking"],
  authors: [{ name: "Osss" }],
  creator: "Osss",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Osss",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Osss – Gym-Software für BJJ",
    description: "Mitgliederverwaltung, Belt-Tracking und Zahlungen für BJJ-Gyms.",
    type: "website",
    locale: "de_DE",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        {/* PWA: "Add to Home Screen" support */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Osss" />
        {/* Splash screen color for iOS */}
        <meta name="msapplication-TileColor" content="#0f172a" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
