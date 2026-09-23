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

const siteTitle = "YuhBusiness | Online Storefronts for Belize Businesses";
const siteDescription =
  "Create a professional storefront, accept bookings and orders, sell products, and manage your Belizean business from one dashboard.";
const siteUrl = new URL("/", metadataBase).toString();
const siteLogoUrl = new URL("/icon-512.png", metadataBase).toString();

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
  title: {
    default: siteTitle,
    template: "%s | YuhBusiness",
  },
  description: siteDescription,
  manifest: "/manifest.webmanifest",
  applicationName: "YuhBusiness",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: siteTitle,
    description: siteDescription,
    siteName: "YuhBusiness",
    images: [
      {
        url: siteLogoUrl,
        width: 512,
        height: 512,
        alt: "YuhBusiness logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
    images: [siteLogoUrl],
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

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}#website`,
      name: "YuhBusiness",
      alternateName: ["Yuh Business", "yuhbusiness.com"],
      url: siteUrl,
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}#organization`,
      name: "YuhBusiness",
      alternateName: "Yuh Business",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: siteLogoUrl,
        contentUrl: siteLogoUrl,
        width: 512,
        height: 512,
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-BZ" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteStructuredData).replace(/</g, "\\u003c"),
          }}
        />
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
