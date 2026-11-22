import type { Metadata, Viewport } from "next";
import PwaRegister from "./pwa-register";
import ConnectionStatus from "./connection-status";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nawaratt",
  description: "Warehouse, delivery and finance daily control app for Nawaratt Medical.",
  applicationName: "Nawaratt",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/app-icon-192.png", apple: "/app-icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0b2d58",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="my">
      <body className="antialiased">
        <ConnectionStatus />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
