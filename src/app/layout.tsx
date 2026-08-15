import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/providers/SessionProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { ScrollToTop } from "@/components/shared/ScrollToTop";
import { FloatingSupportButton } from "@/components/shared/FloatingSupportButton";
import { PageTransition } from "@/components/shared/PageTransition";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "ЕНЦПР — Единый центр продуктовых решений",
  description:
    "Единый независимый центр продуктовых решений, закупок и технических заданий строительной отрасли",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "ЕНЦПР — Единый центр продуктовых решений",
    description:
      "Единый независимый центр продуктовых решений, закупок и технических заданий строительной отрасли",
    type: "website",
    locale: "ru_RU",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <SessionProvider>
            <TooltipProvider>
              <Header />
              <main className="flex-1">
                <PageTransition>
                  {children}
                </PageTransition>
              </main>
              <Footer />
              <OfflineBanner />
              <ScrollToTop />
              <FloatingSupportButton />
              <Toaster />
            </TooltipProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
