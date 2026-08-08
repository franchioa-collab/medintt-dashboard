'use client';

import { useState, useMemo } from 'react';
import { useSheetData } from '@/hooks/useSheetData';
import { BadgeEstado } from '@/components/BadgeEstado';
import { BadgeTipo } from '@/components/BadgeTipo';
import { RefreshButton } from '@/components/RefreshButton';
import { MESES, FRENTES, getMesActual } from '@/lib/constants';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Mes, Frente, TipoTarea, Tarea } from '@/lib/types';

export default function MesPage() {
  const { datos, cargando, error, refrescar } = useSheetData();
  const [mes, setMes] = useState<Mes>(getMesActual());
  const [frentesSeleccionados, setFrentesSeleccionados] = useState<Frente[]>(
    FRENTES as unknown as Frente[]
  );
  const [tiposSeleccionados, setTiposSeleccionados] = useState<TipoTarea[]>([
    'Obligación legal',
    'Estándar de certificación',
    'Buena práctica',
  ]);

  const tareasConsolidadas = useMemo(() => {
    if (!datos) return [];

    const todasLasTareas: (Tarea & { empresa: string; empresaId: string })[] = [];

    datos.empresas.forEach((e) => {
      e.tareas.forEach((t) => {
        todasLasTareas.push({
          ...t,
          empresa: e.nombre,
          empresaId: e.id,
        });
      });
    });

    // Filtrar
    return todasLasTareas
      .filter((t) => frentesSeleccionados.includes(t.frente))
      .filter((t) => tiposSeleccionados.includes(t.tipo))
      .filter((t) => {
        // Mostrar solo lo pendiente (no Cumplido ni N/A)
        const estado = t.estadosMes[mes];
        return estado !== 'Cumplido' && estado !== 'N/A';
      })
      .sort((a, b) => {
        // Ordenar por tipo (Obligación legal primero)
        if (a.tipo !== b.tipo) {
          const tipoOrder = {
            'Obligación legal': 0,
            'Estándar de certificación': 1,
            'Buena práctica': 2,
          };
          return tipoOrder[a.tipo] - tipoOrder[b.tipo];
        }
        // Luego por empresa
        if (a.empresa !== b.empresa) {
          return a.empresa.localeCompare(b.empresa);
        }
        // Finalmente por número de tarea
        return a.numero - b.numero;
      });
  }, [datos, mes, frentesSeleccionados, tiposSeleccionados]);

  const toggleFrente = (frente: Frente) => {
    setFrentesSeleccionados((prev) =>
      prev.includes(frente) ? prev.filter((f) => f !== frente) : [...prev, frente]
    );
  };

  const toggleTipo = (tipo: TipoTarea) => {
    setTiposSeleccionados((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-navy mr-2" size={32} />
        <p className="text-gray-600">Cargando datos...</p>
      </div>
    );
  }

  if (error && !datos) {
    return (
      <div className="space-y-6">
        <Link href="/" className="flex items-center gap-2 text-navy hover:underline w-fit">
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
            <h2 className="text-2xl font-bold text-navy">Consolidado Mensual</h2>
            <p className="text-gray-600 text-sm mt-1">
              Tareas pendientes en todas las empresas cliente
            </p>
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
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy w-full sm:w-64"
          >
            {MESES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Filtros en dos columnas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Frentes */}
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

          {/* Tipos */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Filtrar por Tipo
            </label>
            <div className="space-y-2">
              {(['Obligación legal', 'Estándar de certificación', 'Buena práctica'] as TipoTarea[]).map(
                (tipo) => (
                  <label key={tipo} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={tiposSeleccionados.includes(tipo)}
                      onChange={() => toggleTipo(tipo)}
                      className="rounded border-gray-300 focus:ring-navy"
                    />
                    <span className="text-sm text-gray-700">{tipo}</span>
                  </label>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-navy mb-4">
          Tareas Pendientes - {mes} ({tareasConsolidadas.length})
        </h3>

        {tareasConsolidadas.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No hay tareas pendientes con los filtros seleccionados
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-navy text-white">
                  <th className="text-left px-4 py-3">Empresa</th>
                  <th className="text-left px-4 py-3">N°</th>
                  <th className="text-left px-4 py-3">Frente</th>
                  <th className="text-left px-4 py-3">Tarea</th>
                  <th className="text-center px-4 py-3">Tipo</th>
                  <th className="text-center px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {tareasConsolidadas.map((tarea) => (
                  <tr key={`${tarea.empresaId}-${tarea.numero}`} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/empresa/${tarea.empresaId}?mes=${mes}`}
                        className="text-navy hover:underline font-semibold"
                      >
                        {tarea.empresa}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-navy font-semibold">{tarea.numero}</td>
                    <td className="px-4 py-3">{tarea.frente}</td>
                    <td className="px-4 py-3 max-w-sm truncate">{tarea.tarea}</td>
                    <td className="px-4 py-3 text-center">
                      <BadgeTipo tipo={tarea.tipo} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <BadgeEstado estado={tarea.estadosMes[mes]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {datos && (
        <p className="text-xs text-gray-500 text-center mt-6">
          Última actualización: {new Date(datos.timestamp).toLocaleString('es-AR')}
        </p>
      )}
    </div>
  );
}
