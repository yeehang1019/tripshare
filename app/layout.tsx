import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TripShare · Shared expenses",
  description: "Simple shared expenses, fair splits, and your spending at a glance.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
