import { NextResponse } from 'next/server';

// Next.js 14 no soporta el archivo especial `manifest.ts` anidado dentro de un
// segmento (solo en la raíz de app/), así que se sirve a mano como Route Handler.
export function GET() {
  return NextResponse.json(
    {
      name: 'Presentismo',
      short_name: 'Presentismo',
      description: 'Marcado de ingreso y egreso con validación de ubicación',
      start_url: '/presentismo',
      scope: '/presentismo',
      display: 'standalone',
      background_color: '#F9FAFB',
      theme_color: '#0B2A4A',
      icons: [
        { src: '/presentismo/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: '/presentismo/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  );
}
