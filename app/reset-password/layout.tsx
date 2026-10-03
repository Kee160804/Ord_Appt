import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false, nocache: true },
};

export default function ResetPasswordLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
