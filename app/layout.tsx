// import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
// import { ThemeProvider } from "@/app/contexts/theme";

// import "@/app/styles/global.css";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

// export const metadata: Metadata = {
//   title: "Dark Mode System Version",
//   description: "Platform for local businesses to manage appointments and orders.",
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en">
//       <body
//         className={`${geistSans.variable} ${geistMono.variable} antialiased`}
//       >
//         <ThemeProvider>{children}</ThemeProvider>
//       </body>
//     </html>
//   );
// }

// import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
// import { ThemeProvider } from "@/app/contexts/theme";
// import { AuthProvider } from "@/app/contexts/auth"; // adjust import path
// import "@/app/styles/global.css";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

// export const metadata: Metadata = {
//   title: "YuhBusiness",
//   description: "Platform for local businesses to manage appointments and orders.",
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en">
//       <body
//         className={`${geistSans.variable} ${geistMono.variable} antialiased`}
//       >
//         <ThemeProvider>
//           <AuthProvider>{children}</AuthProvider>
//         </ThemeProvider>
//       </body>
//     </html>
//   );
// }

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/app/contexts/theme";
import { AuthProvider } from "@/app/contexts/auth";
import { RealtimeProvider } from "@/app/contexts/realtime";
import "@/app/styles/global.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YuhBusiness",
  description:
    "Platform for local businesses to manage appointments and orders.",
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
            <RealtimeProvider>{children}</RealtimeProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
