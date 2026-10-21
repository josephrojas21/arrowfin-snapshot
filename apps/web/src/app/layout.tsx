import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArrowFin · Daily snapshot",
  description: "Your trading session, in focus.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
