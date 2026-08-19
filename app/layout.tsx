import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leviathan",
  description: "Closed-universe search over your own documents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
