import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default function HomeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
