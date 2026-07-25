import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "Kapāpala Mobile Access", description: "Mobile public access portal", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "Kapāpala Access", statusBarStyle: "default" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#174d35" };
export default function MobileLayout({children}:{children:React.ReactNode}){return children;}
