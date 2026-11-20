import { ServiceWorkerRegistrar } from "@/features/offline/ServiceWorkerRegistrar";
import type { Metadata, Viewport } from "next";
import { Heebo, Karantina } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { ToastHost } from "@/components/ui/Toast";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

// Direction D: Heebo for UI/body, Karantina for big display type and numbers.
const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

const karantina = Karantina({
  variable: "--font-karantina",
  weight: "700",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Trip Helper", template: "%s · Trip Helper" },
  description: "הבית הקבוע של הטיול המשפחתי: משימות, ציוד, מקומות ומסלול, עם פרומטים מוכנים לכל צ'אט.",
  applicationName: "Trip Helper",
  appleWebApp: { capable: true, title: "Trip Helper", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#1f2333" },
  ],
};

// Applies the saved theme before first paint so there's no light/dark flash.
const themeScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${karantina.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          {children}
          <ToastHost />
          <ServiceWorkerRegistrar />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
