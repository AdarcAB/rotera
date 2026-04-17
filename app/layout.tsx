import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rotera — byten och speltid för barnfotboll",
  description:
    "Planera och exekvera byten i barn- och ungdomsfotboll. Speltidsgaranti, rotation, live-läge.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
