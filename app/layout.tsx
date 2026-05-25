import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoL Champions",
  description: "League of Legends champion showcase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" style={{ background: '#05050a' }}>
      <body className="h-full w-full overflow-hidden" style={{ background: '#05050a' }}>{children}</body>
    </html>
  );
}
