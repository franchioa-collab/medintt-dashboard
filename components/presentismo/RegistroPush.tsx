'use client';

import { useEffect, useState } from 'react';
import { usePush } from '@/hooks/usePush';

export default function RegistroPush() {
  const { estado, activar } = usePush();
  const [yaActivo, setYaActivo] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelado = false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setYaActivo(false);
      return;
    }
    navigator.serviceWorker
      .getRegistration('/presentismo/')
      .then((registro) => registro?.pushManager.getSubscription())
      .then((suscripcion) => {
        if (!cancelado) setYaActivo(Boolean(suscripcion));
      })
      .catch(() => {
        if (!cancelado) setYaActivo(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (yaActivo === null || yaActivo || estado === 'activo') return null;
  if (estado === 'no_soportado') return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-2">
      <h2 className="text-sm font-bold text-gray-700">Avisos de verificación</h2>
      <p className="text-sm text-gray-600">
        Durante tu horario laboral, cada tanto te va a llegar un aviso para confirmar tu
        ubicación en un toque — nada de mantener la app abierta todo el día.
      </p>
      {estado === 'rechazado' && (
        <p className="text-sm text-red-600">
          Bloqueaste las notificaciones. Activalas desde la configuración del navegador para
          este sitio si querés habilitarlo.
        </p>
      )}
      {estado === 'error' && (
        <p className="text-sm text-red-600">No pudimos activarlo. Probá de nuevo.</p>
      )}
      <button
        onClick={activar}
        disabled={estado === 'activando'}
        className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {estado === 'activando' ? 'Activando…' : 'Activar avisos'}
      </button>
    </div>
  );
}
