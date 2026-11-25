import type { Metadata, Viewport } from "next";
import "./globals.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { brand } from "@/config/brand";
import { features } from "@/config/features";

export const metadata: Metadata = {
  title: `${brand.name} - ${brand.tagline}`,
  description: "Cash flow and job cost for subcontractors",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Applies the saved light/dark choice before the page paints (no flash).
const themeScript = `try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const style = {
    "--brand-primary": brand.colors.primary,
    "--brand-accent": brand.colors.accent,
    "--brand-success": brand.colors.success,
    "--brand-danger": brand.colors.danger,
    "--brand-font": brand.font,
  } as React.CSSProperties;

  return (
    <html lang="en" style={style} suppressHydrationWarning>
      <head>{features.darkMode && <script dangerouslySetInnerHTML={{ __html: themeScript }} />}</head>
      <body>{children}</body>
    </html>
  );
}
