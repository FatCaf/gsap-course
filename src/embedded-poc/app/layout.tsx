import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embedded Stream POC",
  description: "Secure Twitch and YouTube Embeds",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
