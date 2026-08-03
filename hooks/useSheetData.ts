'use client';

import { useEffect, useState } from 'react';
import type { DatosDashboard } from '@/lib/types';

interface UseSheetDataReturn {
  datos: DatosDashboard | null;
  cargando: boolean;
  error: string | null;
  refrescar: () => Promise<void>;
}

export function useSheetData(): UseSheetDataReturn {
  const [datos, setDatos] = useState<DatosDashboard | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<number>(0);

  const traerDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const response = await fetch('/api/sheets');

      if (!response.ok) {
        throw new Error('Error al cargar datos');
      }

      const data: DatosDashboard = await response.json();
      setDatos(data);
      setUltimaActualizacion(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  const refrescar = async () => {
    // Evitar múltiples refreshes en poco tiempo
    const ahora = Date.now();
    if (ahora - ultimaActualizacion < 10000) {
      setError('Esperando caché... intenta en unos segundos');
      return;
    }
    await traerDatos();
  };

  useEffect(() => {
    traerDatos();
  }, []);

  return { datos, cargando, error, refrescar };
}
