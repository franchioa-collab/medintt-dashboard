'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Tarea, Mes, EstadoTarea } from '@/lib/types';
import { getMesActual } from '@/lib/constants';

interface EmpresaCardProps {
  id: string;
  nombre: string;
  tareas: Tarea[];
  error?: string;
}

export function EmpresaCard({ id, nombre, tareas, error }: EmpresaCardProps) {
  const mesActual = getMesActual() as Mes;

  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md border-2 border-red-300">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{nombre}</h3>
            <p className="text-sm text-red-600 mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const tareasAplicables = tareas.filter(
    (t) => t.estadosMes[mesActual] !== 'N/A'
  );
  const cumplidas = tareasAplicables.filter(
    (t) => t.estadosMes[mesActual] === 'Cumplido'
  ).length;

  const porcentaje =
    tareasAplicables.length > 0
      ? Math.round((cumplidas / tareasAplicables.length) * 100)
      : 0;

  // Calcular severidad del semáforo
  const obligacionesLegales = tareas.filter((t) => t.tipo === 'Obligación legal');
  const obligacionesIncumplidas = obligacionesLegales.filter(
    (t) =>
      t.estadosMes[mesActual] !== 'Cumplido' &&
      t.estadosMes[mesActual] !== 'N/A'
  ).length;

  let severidad: 'verde' | 'amarillo' | 'rojo';
  let colorSemaforoClass: string;

  if (obligacionesIncumplidas === 0) {
    severidad = 'verde';
    colorSemaforoClass = 'bg-green-500';
  } else if (obligacionesIncumplidas <= 2) {
    severidad = 'amarillo';
    colorSemaforoClass = 'bg-amarillo';
  } else {
    severidad = 'rojo';
    colorSemaforoClass = 'bg-red-600';
  }

  return (
    <Link href={`/empresa/${id}`}>
      <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition cursor-pointer border-t-4 border-navy">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{nombre}</h3>

        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-3xl font-bold text-navy">
              {porcentaje}
              <span className="text-lg">%</span>
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {cumplidas} de {tareasAplicables.length} completadas
            </p>
          </div>

          <div className={`w-16 h-16 rounded-full ${colorSemaforoClass} flex items-center justify-center`}>
            <span className="text-white text-2xl">
              {severidad === 'verde' && '✓'}
              {severidad === 'amarillo' && '⚠'}
              {severidad === 'rojo' && '✕'}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          {obligacionesIncumplidas} obligación{obligacionesIncumplidas !== 1 ? 'es' : ''} legal{
            obligacionesIncumplidas !== 1 ? 'es' : ''
          } incumplida{obligacionesIncumplidas !== 1 ? 's' : ''}
        </p>
      </div>
    </Link>
  );
}
