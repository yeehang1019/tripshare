import type { Metadata, Viewport } from "next";
import "./globals.css";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html:`try{var m=localStorage.getItem('tripshare-theme');document.documentElement.dataset.theme=localStorage.getItem('tripshare-lighting-explicit')==='1'&&(m==='light'||m==='night')?m:matchMedia('(prefers-color-scheme: dark)').matches?'night':'light'}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'night':'light'}`}}/>
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
