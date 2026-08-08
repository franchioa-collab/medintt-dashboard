'use client';

import { useCallback, useState } from 'react';
import type { CoordenadasActuales, ErrorGeolocalizacion } from '@/lib/presentismo/types';

interface EstadoUbicacion {
  cargando: boolean;
  coordenadas: CoordenadasActuales | null;
  error: ErrorGeolocalizacion | null;
}

function mapearError(error: GeolocationPositionError): ErrorGeolocalizacion {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'permiso_denegado';
    case error.TIMEOUT:
      return 'tiempo_agotado';
    default:
      return 'no_disponible';
  }
}

export interface ResultadoUbicacion {
  coordenadas: CoordenadasActuales | null;
  error: ErrorGeolocalizacion | null;
}

/** Pide la posición GPS actual del dispositivo (una sola lectura, alta precisión). */
export function useUbicacionActual() {
  const [estado, setEstado] = useState<EstadoUbicacion>({
    cargando: false,
    coordenadas: null,
    error: null,
  });

  const obtenerUbicacion = useCallback((): Promise<ResultadoUbicacion> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const resultado: ResultadoUbicacion = { coordenadas: null, error: 'no_soportado' };
      setEstado({ cargando: false, ...resultado });
      return Promise.resolve(resultado);
    }

    setEstado((prev) => ({ ...prev, cargando: true, error: null }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (posicion) => {
          const coordenadas: CoordenadasActuales = {
            lat: posicion.coords.latitude,
            lon: posicion.coords.longitude,
            precisionMetros: posicion.coords.accuracy ?? null,
          };
          setEstado({ cargando: false, coordenadas, error: null });
          resolve({ coordenadas, error: null });
        },
        (error) => {
          const errorMapeado = mapearError(error);
          setEstado({ cargando: false, coordenadas: null, error: errorMapeado });
          resolve({ coordenadas: null, error: errorMapeado });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  return { ...estado, obtenerUbicacion };
}
