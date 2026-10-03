import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team Invitation",
  robots: { index: false, follow: false, nocache: true },
};

export default function TeamInviteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
