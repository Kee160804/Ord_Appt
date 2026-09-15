import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/app/contexts/theme";
import { AuthProvider } from "@/app/contexts/auth";
import { PwaRegister } from "@/components/PwaRegister";
import "@/app/styles/global.css";

const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const metadataBase = (() => {
  try {
    return new URL(configuredAppUrl || "https://yuhbusiness.com");
  } catch {
    return new URL("https://yuhbusiness.com");
  }
})();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase,
  title: "YuhBusiness",
  description:
    "Platform for local businesses to manage appointments, orders, retail sales, and customer relationships.",
  manifest: "/manifest.webmanifest",
  applicationName: "YuhBusiness",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: "YuhBusiness",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "YuhBusiness",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#070b14" },
  ],
};

// Run before hydration to avoid briefly showing the wrong saved theme.
const themeBootstrapScript = `
  (() => {
    try {
      const savedTheme = window.localStorage.getItem("theme");
      const theme = savedTheme === "dark" ? "dark" : "light";
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(theme);
      root.style.colorScheme = theme;
      root.style.backgroundColor = theme === "dark" ? "#070b14" : "white";
      root.style.color = theme === "dark" ? "white" : "#111827";
    } catch {
      // Keep the server-rendered light theme if storage is unavailable.
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-BZ" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <PwaRegister />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
