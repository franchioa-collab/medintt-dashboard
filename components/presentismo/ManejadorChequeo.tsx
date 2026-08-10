'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUbicacionActual } from '@/hooks/useUbicacionActual';

/**
 * Cuando el empleado toca el aviso push de chequeo, el service worker abre
 * /presentismo?chequeo=<id>. Este componente detecta ese parámetro, captura
 * la ubicación al toque y confirma el chequeo, sin que el empleado tenga que
 * hacer nada más que tocar el aviso.
 */
export default function ManejadorChequeo() {
  const searchParams = useSearchParams();
  const chequeoId = searchParams.get('chequeo');
  const { obtenerUbicacion } = useUbicacionActual();
  const [estado, setEstado] = useState<'procesando' | 'ok' | 'error' | null>(null);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!chequeoId) return;
    let cancelado = false;

    async function responder() {
      setEstado('procesando');
      const { coordenadas } = await obtenerUbicacion();
      if (cancelado) return;

      if (!coordenadas) {
        setEstado('error');
        setMensaje('No pudimos obtener tu ubicación. Activá el GPS y volvé a tocar el aviso.');
        return;
      }

      const res = await fetch(`/presentismo/api/chequeo/${chequeoId}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: coordenadas.lat, lon: coordenadas.lon }),
      });

      if (cancelado) return;

      if (!res.ok) {
        setEstado('error');
        setMensaje('No pudimos confirmar el chequeo. Puede que ya haya vencido.');
        return;
      }

      const { chequeo } = await res.json();
      setEstado('ok');
      setMensaje(
        chequeo.estado === 'confirmado_dentro'
          ? 'Ubicación confirmada, todo en orden.'
          : chequeo.estado === 'confirmado_campo'
            ? 'Ubicación registrada.'
            : 'Ubicación confirmada — quedó registrado que estabas fuera del área asignada.'
      );
    }

    responder();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chequeoId]);

  if (!chequeoId || !estado) return null;

  return (
    <div
      className={`rounded-lg shadow-md p-4 text-sm ${
        estado === 'error' ? 'bg-red-50 text-red-700' : 'bg-celeste/10 text-navy'
      }`}
    >
      {estado === 'procesando' ? 'Confirmando tu ubicación…' : mensaje}
    </div>
  );
}
