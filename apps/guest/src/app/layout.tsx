import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "@/styles/globals.css";

const display = Cormorant_Garamond({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-display", display: "swap" });
const body = Jost({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Hostel Adonis Costinești", template: "%s · Hostel Adonis" },
  description: "Check-in online, informații pentru sejur și oferte la Hostel Adonis, la 35 m de Marea Neagră.",
  icons: { icon: "/brand/adonis-app-icon.svg" },
  robots: { index: false }, // paginile sunt personale, pe token
};

export const viewport: Viewport = { themeColor: "#081a25", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
