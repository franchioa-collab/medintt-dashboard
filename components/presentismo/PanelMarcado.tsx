'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUbicacionActual } from '@/hooks/useUbicacionActual';
import type { ErrorGeolocalizacion } from '@/lib/presentismo/types';
import type { TipoMarcacion } from '@/lib/presentismo/database.types';

const MENSAJES_ERROR: Record<ErrorGeolocalizacion, string> = {
  permiso_denegado: 'Activá el permiso de ubicación en tu celular para poder marcar.',
  tiempo_agotado: 'No pudimos obtener tu ubicación a tiempo. Probá de nuevo.',
  no_disponible: 'No pudimos obtener tu ubicación. Revisá que el GPS esté activado.',
  no_soportado: 'Tu navegador no soporta geolocalización.',
};

interface Props {
  proximaAccion: TipoMarcacion;
}

export default function PanelMarcado({ proximaAccion }: Props) {
  const router = useRouter();
  const { obtenerUbicacion } = useUbicacionActual();
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: 'ok' | 'error'; mensaje: string } | null>(null);

  async function marcar() {
    setProcesando(true);
    setResultado(null);

    const { coordenadas, error } = await obtenerUbicacion();
    if (!coordenadas) {
      setProcesando(false);
      setResultado({ tipo: 'error', mensaje: MENSAJES_ERROR[error ?? 'no_disponible'] });
      return;
    }

    const res = await fetch('/presentismo/api/marcar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: proximaAccion,
        lat: coordenadas.lat,
        lon: coordenadas.lon,
        precisionMetros: coordenadas.precisionMetros,
      }),
    });

    setProcesando(false);

    if (!res.ok) {
      setResultado({ tipo: 'error', mensaje: 'No pudimos registrar tu marcación. Probá de nuevo.' });
      return;
    }

    const { marcacion } = await res.json();
    const dentro = marcacion.resultado === 'dentro_de_zona';
    const partes = [proximaAccion === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado'];
    if (!dentro) partes.push('fuera del área asignada');
    if (marcacion.tarde) partes.push('tarde');

    setResultado({ tipo: 'ok', mensaje: partes.join(' — ') });
    router.refresh();
  }

  const label = proximaAccion === 'ingreso' ? 'Marcar ingreso' : 'Marcar egreso';

  return (
    <div className="bg-white rounded-lg shadow-md p-6 text-center space-y-4">
      <button
        onClick={marcar}
        disabled={procesando}
        className={`w-full rounded-md py-4 text-lg font-bold text-white disabled:opacity-50 ${
          proximaAccion === 'ingreso' ? 'bg-green-600' : 'bg-navy'
        }`}
      >
        {procesando ? 'Obteniendo ubicación…' : label}
      </button>

      {resultado && (
        <p className={`text-sm ${resultado.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
          {resultado.mensaje}
        </p>
      )}
    </div>
  );
}
