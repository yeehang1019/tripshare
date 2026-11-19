import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./glass-neon.css";
import "./core-flows.css";
import "./approved-design.css";
import "./ui-corrections.css";
import "./glass-polish.css";
import "./settlement-glass.css";
import "./flat-layout.css";
import DeviceLighting from "./device-lighting";

export const metadata: Metadata = {
  title: "TripShare · Trip & Money",
  description: "Plan your journey in Trip. Track expenses and payments in Money.",
  manifest: "/manifest.webmanifest",
  applicationName: "TripShare",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TripShare",
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
    { media: "(prefers-color-scheme: light)", color: "#F2F2F5" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0918" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html:`try{var m=localStorage.getItem('tripshare-theme');document.documentElement.dataset.theme=localStorage.getItem('tripshare-lighting-explicit')==='1'&&(m==='light'||m==='night'||m==='system')?(m==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'night':'light'):m):'light'}catch{document.documentElement.dataset.theme='light'}`}}/>
        <link rel="preload" href="/fonts/jetbrains-mono-latin-700-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/app-icon-180.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased"><DeviceLighting/>{children}</body>
    </html>
  );
}
