import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Beacon — Discord Analytics",
    template: "%s | Beacon",
  },
  description:
    "Self-hosted Discord analytics and social feed notification bot. Track your server growth, message activity, and get notified about YouTube, Twitch, Reddit, and RSS updates.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
