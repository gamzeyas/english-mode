import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "English Mode",
    template: "%s · English Mode",
  },
  description: "Your adaptive, voice-first personal English coach.",
  applicationName: "English Mode",
  appleWebApp: {
    capable: true,
    title: "English Mode",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/manifest-assets/icon.svg", type: "image/svg+xml" }],
    apple: "/manifest-assets/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#14151c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
