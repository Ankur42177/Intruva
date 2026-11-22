import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { MotionPrefsProvider, motionBootScript } from "@/components/layout/MotionPrefs";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Intruva — Prompt intelligence",
    template: "%s · Intruva",
  },
  description:
    "Diagnose what your prompt is missing, keep what you meant, and catch secrets and risky instructions before you send it to AI.",
};

export const viewport: Viewport = {
  themeColor: "#05060b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${instrument.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionBootScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <MotionPrefsProvider>
          <ToastProvider>
            <AmbientBackground />
            <SiteHeader />
            <main id="main" className="flex flex-1 flex-col">
              {children}
            </main>
          </ToastProvider>
        </MotionPrefsProvider>
      </body>
    </html>
  );
}
