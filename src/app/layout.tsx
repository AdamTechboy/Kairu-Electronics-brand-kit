import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SonnerToaster } from "@/components/app/sonner-toaster";

export const metadata: Metadata = {
  title: "Muhammad Kairu Electronics — Brand Kit & Design Studio",
  description:
    "Private design studio for Muhammad Kairu Electronics: edit the logo, generate product flyers with prices and availability, design business cards, complimentary cards, letterheads and social posts, and download real print-ready files.",
  keywords: ["brand kit", "logo editor", "flyer generator", "Muhammad Kairu Electronics", "solar energy", "electronics retail"],
  authors: [{ name: "Muhammad Kairu Electronics" }],
  icons: { icon: "/api/site-logo", apple: "/api/site-logo" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1F2A44",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
        <SonnerToaster />
      </body>
    </html>
  );
}
