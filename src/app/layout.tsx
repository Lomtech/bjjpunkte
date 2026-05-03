import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Osss – Gym Management Software",
    template: "%s | Osss",
  },
  description: "Mitgliederverwaltung, Belt-Tracking, Anwesenheit und Zahlungen für Kampfsport-Gyms.",
  applicationName: "Osss",
  keywords: ["Gym Software", "Kampfsport", "Mitgliederverwaltung", "Belt Tracking", "BJJ", "Judo", "Karate"],
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
    title: "Osss – Gym Management Software",
    description: "Mitgliederverwaltung, Belt-Tracking und Zahlungen für Kampfsport-Gyms.",
    type: "website",
    locale: "de_DE",
  },
};

export const viewport: Viewport = {
  themeColor: "#FBBF24",
  colorScheme: "light",
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
    <html lang="de" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        {/* Preconnect to critical origins for faster cold start */}
        <link rel="preconnect" href="https://ktwgvuasjezokhsfpfqb.supabase.co" />
        <link rel="dns-prefetch" href="https://ktwgvuasjezokhsfpfqb.supabase.co" />
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
