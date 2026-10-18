import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "@/styles/globals.css";

const display = Cormorant_Garamond({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-display", display: "swap" });
const body = Jost({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Adonis Host", template: "%s · Adonis Host" },
  description: "Administrarea Hostelului Adonis Costinești — rezervări, camere, oaspeți, canale.",
  icons: { icon: "/brand/adonis-app-icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
