import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TripShare · Shared expenses",
  description: "Simple shared expenses, fair splits, and your spending at a glance.",
  manifest: "/manifest.webmanifest",
  applicationName: "TripShare",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TripShare",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/app-icon-180.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f4ff" },
    { media: "(prefers-color-scheme: dark)", color: "#10081f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
