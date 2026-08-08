import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Dashboard - Medintt',
  description: 'Dashboard de gestión de salud ocupacional - Medintt',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50">
        <div className="min-h-screen flex flex-col">
          <header className="bg-navy text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold">Medintt</h1>
                  <p className="text-celeste text-sm mt-1">
                    Dashboard de Gestión de Salud Ocupacional
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          <footer className="bg-navy text-white text-center py-4 mt-12 text-sm">
            <p>© 2024 Medintt - Consultora de Medicina Laboral</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
