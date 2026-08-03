'use client';

import { useState } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { useSearchParams } from 'next/navigation';
import { TareasTable } from '@/components/TareasTable';
import { RefreshButton } from '@/components/RefreshButton';
import { EMPRESAS, MESES, FRENTES, getMesActual } from '@/lib/constants';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Mes, Frente } from '@/lib/types';

export default function EmpresaPage({ params }: { params: { id: string } }) {
  const { datos, cargando, error, refrescar } = useSheetData();
  const searchParams = useSearchParams();

  const empresaConfig = EMPRESAS[params.id as keyof typeof EMPRESAS];
  const mesParam = searchParams.get('mes') as Mes | null;
  const [mes, setMes] = useState<Mes>(mesParam || getMesActual());
  const [frentesSeleccionados, setFrentesSeleccionados] = useState<Frente[]>(
    FRENTES as unknown as Frente[]
  );

  if (!empresaConfig) {
    return (
      <div className="space-y-6">
        <Link href="/" className="flex items-center gap-2 text-navy hover:underline">
          <ArrowLeft size={18} />
          Volver
        </Link>
        <div className="p-6 bg-red-50 rounded-lg border-l-4 border-red-600">
          <p className="text-red-900 font-semibold">Empresa no encontrada</p>
        </div>
      </div>
    );
  }

  const empresa = datos?.empresas.find((e) => e.id === params.id);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-navy mr-2" size={32} />
        <p className="text-gray-600">Cargando datos...</p>
      </div>
    );
  }

  if (error && !empresa) {
    return (
      <div className="space-y-6">
        <Link href="/" className="flex items-center gap-2 text-navy hover:underline">
          <ArrowLeft size={18} />
          Volver
        </Link>
        <div className="p-6 bg-red-50 rounded-lg border-l-4 border-red-600">
          <div className="flex gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
            <div>
              <p className="text-red-900 font-semibold">Error al cargar datos</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="space-y-6">
        <Link href="/" className="flex items-center gap-2 text-navy hover:underline">
          <ArrowLeft size={18} />
          Volver
        </Link>
        <p className="text-gray-600">No se encontraron datos para esta empresa</p>
      </div>
    );
  }

  const toggleFrente = (frente: Frente) => {
    setFrentesSeleccionados((prev) =>
      prev.includes(frente) ? prev.filter((f) => f !== frente) : [...prev, frente]
    );
  };

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col gap-4">
        <Link href="/" className="flex items-center gap-2 text-navy hover:underline w-fit">
          <ArrowLeft size={18} />
          Volver
        </Link>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-navy">{empresaConfig.nombre}</h2>
            {empresa.error && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-300 rounded text-sm text-yellow-800">
                Advertencia: {empresa.error}
              </div>
            )}
          </div>
          <RefreshButton onRefresh={refrescar} error={error} />
        </div>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        {/* Selector de mes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Seleccionar mes
          </label>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value as Mes)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy"
          >
            {MESES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro de Frentes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Filtrar por Frente
          </label>
          <div className="space-y-2">
            {FRENTES.map((frente) => (
              <label key={frente} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={frentesSeleccionados.includes(frente)}
                  onChange={() => toggleFrente(frente)}
                  className="rounded border-gray-300 focus:ring-navy"
                />
                <span className="text-sm text-gray-700">{frente}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla de tareas */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-navy mb-4">Tareas - {mes}</h3>
        {empresa.tareas.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay tareas disponibles</p>
        ) : (
          <TareasTable tareas={empresa.tareas} mes={mes} filtroFrentes={frentesSeleccionados} />
        )}
      </div>

      {/* Nota sobre expansión */}
      <p className="text-xs text-gray-500 text-center">
        Haz click en una fila para ver más detalles
      </p>
    </div>
  );
}
