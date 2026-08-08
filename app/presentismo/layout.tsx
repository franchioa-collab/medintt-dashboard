import type { Metadata, Viewport } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Presentismo',
  description: 'Control de presentismo con geolocalización',
  manifest: '/presentismo/manifest.webmanifest',
  icons: {
    icon: '/presentismo/icon.svg',
    apple: '/presentismo/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Presentismo',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B2A4A',
};

export default function PresentismoRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
