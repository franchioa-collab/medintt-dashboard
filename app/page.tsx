'use client';

import { useSheetData } from '@/hooks/useSheetData';
import { EmpresaCard } from '@/components/EmpresaCard';
import { RefreshButton } from '@/components/RefreshButton';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const { datos, cargando, error, refrescar } = useSheetData();

  return (
    <div className="space-y-8">
      {/* Encabezado con botón de refresh */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Vista General</h2>
          <p className="text-gray-600 text-sm mt-1">
            Estado de salud ocupacional de todas las empresas cliente
          </p>
        </div>
        <RefreshButton onRefresh={refrescar} disabled={cargando} error={error} />
      </div>

      {/* Estado de carga */}
      {cargando && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-navy mr-2" size={32} />
          <p className="text-gray-600">Cargando datos...</p>
        </div>
      )}

      {/* Error general */}
      {error && !datos && (
        <div className="p-6 bg-red-50 rounded-lg border-l-4 border-red-600">
          <div className="flex gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-red-900">Error al cargar datos</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Grid de empresas */}
      {datos && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {datos.empresas.map((empresa) => (
              <EmpresaCard
                key={empresa.id}
                id={empresa.id}
                nombre={empresa.nombre}
                tareas={empresa.tareas}
                error={empresa.error}
              />
            ))}
          </div>

          {/* Links a otras vistas */}
          <div className="mt-12 p-6 bg-white rounded-lg shadow-md border-t-4 border-celeste">
            <h3 className="text-lg font-semibold text-navy mb-4">Otras vistas</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/mes"
                className="px-4 py-2 bg-celeste text-white rounded-md font-semibold hover:opacity-90 transition text-center"
              >
                Ver consolidado mensual
              </Link>
            </div>
          </div>

          {/* Última actualización */}
          <p className="text-xs text-gray-500 text-center mt-6">
            Última actualización: {new Date(datos.timestamp).toLocaleString('es-AR')}
          </p>
        </>
      )}
    </div>
  );
}
