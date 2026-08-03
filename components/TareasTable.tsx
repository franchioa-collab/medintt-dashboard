'use client';

import { useMemo, useState } from 'react';
import { BadgeEstado } from './BadgeEstado';
import { BadgeTipo } from './BadgeTipo';
import { Tarea, Mes, Frente } from '@/lib/types';
import { FRENTES } from '@/lib/constants';

interface TareasTableProps {
  tareas: Tarea[];
  mes: Mes;
  filtroFrentes?: Frente[];
}

export function TareasTable({ tareas, mes, filtroFrentes = FRENTES as unknown as Frente[] }: TareasTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const tareasFiltradasOrdenadas = useMemo(() => {
    return tareas
      .filter((t) => filtroFrentes.includes(t.frente))
      .sort((a, b) => {
        // Ordenar por número de frente (extracto el número inicial)
        const numFrenteA = parseInt(a.frente.charAt(0));
        const numFrenteB = parseInt(b.frente.charAt(0));
        if (numFrenteA !== numFrenteB) return numFrenteA - numFrenteB;
        // Luego por número de tarea
        return a.numero - b.numero;
      });
  }, [tareas, filtroFrentes]);

  const toggleRow = (numero: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(numero)) {
      newExpanded.delete(numero);
    } else {
      newExpanded.add(numero);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-navy text-white">
            <th className="text-left px-4 py-3">N°</th>
            <th className="text-left px-4 py-3">Frente</th>
            <th className="text-left px-4 py-3">Tarea</th>
            <th className="text-center px-4 py-3">Tipo</th>
            <th className="text-center px-4 py-3">Responsable</th>
            <th className="text-center px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {tareasFiltradasOrdenadas.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-6 text-gray-500">
                No hay tareas para mostrar
              </td>
            </tr>
          ) : (
            tareasFiltradasOrdenadas.map((tarea) => {
              const isExpanded = expandedRows.has(tarea.numero);
              return (
                <tbody key={tarea.numero}>
                  <tr
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleRow(tarea.numero)}
                  >
                    <td className="px-4 py-3 font-semibold text-navy">{tarea.numero}</td>
                    <td className="px-4 py-3">{tarea.frente}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{tarea.tarea}</td>
                    <td className="px-4 py-3 text-center">
                      <BadgeTipo tipo={tarea.tipo} />
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      {tarea.responsable.join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <BadgeEstado estado={tarea.estadosMes[mes]} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="space-y-3">
                          <div>
                            <p className="font-semibold text-sm text-gray-700">Referencia Normativa</p>
                            <p className="text-sm text-gray-600">{tarea.referenciaNormativa}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-gray-700">Periodicidad</p>
                            <p className="text-sm text-gray-600">{tarea.periodicidad}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-gray-700">Evidencia / Registro</p>
                            <p className="text-sm text-gray-600">{tarea.evidencia}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-gray-700">Colabora</p>
                            <p className="text-sm text-gray-600">{tarea.colabora.join(', ') || '—'}</p>
                          </div>
                          {tarea.observaciones && (
                            <div>
                              <p className="font-semibold text-sm text-gray-700">Observaciones</p>
                              <p className="text-sm text-gray-600">{tarea.observaciones}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
