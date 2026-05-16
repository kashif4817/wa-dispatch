import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const jetBrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata = {
  title: "WhatsApp Bulk Sender",
  description: "Local desktop campaign sender for expected WhatsApp contacts.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${manrope.variable} ${jetBrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
