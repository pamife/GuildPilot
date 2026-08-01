import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuildPilot - Personal Local Discord Management",
  description: "Local-only Discord server structure editor & web dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-discord-dark text-discord-text min-h-screen antialiased selection:bg-discord-brand selection:text-white">
        {children}
      </body>
    </html>
  );
}
