import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuildPilot — Dein Community Control Center",
  description:
    "Dein Discord. Dein Control Center. Verwalte Community, Kanäle, Rollen und Support mit GuildPilot.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
