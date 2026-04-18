import type { Metadata, Viewport } from "next";
import "./globals.css";

const appUrl = process.env.APP_URL ?? "https://rotera-one.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Rotera — byten och speltid för barnfotboll",
    template: "%s · Rotera",
  },
  description:
    "Planera och exekvera byten i barn- och ungdomsfotboll. Speltidsgaranti, positionsrotation och live-läge för sidlinjen.",
  applicationName: "Rotera",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rotera",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Rotera",
    title: "Rotera — mindre kaos, mer rättvisa",
    description:
      "Speltidsgaranti, positionsrotation och live-läge för barn- och ungdomstränare.",
    locale: "sv_SE",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rotera — mindre kaos, mer rättvisa",
    description:
      "Speltidsgaranti, positionsrotation och live-läge för barn- och ungdomstränare.",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeScript = `
  try {
    var t = localStorage.getItem('rotera.theme') || 'system';
    var isDark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
