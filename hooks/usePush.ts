'use client';

import { useCallback, useState } from 'react';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Seguro = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64Seguro);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type EstadoPush = 'no_soportado' | 'inactivo' | 'activando' | 'activo' | 'rechazado' | 'error';

async function enviarSuscripcionAlServidor(suscripcion: PushSubscription): Promise<boolean> {
  const json = suscripcion.toJSON();
  const res = await fetch('/presentismo/api/push/suscribir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    }),
  });
  return res.ok;
}

/**
 * Si el navegador ya tiene una suscripción push activa (de un intento previo
 * que se haya cortado antes de avisarle al servidor), se la vuelve a mandar.
 * Sirve para autocurar el caso en que el usuario navegó a otra pantalla
 * mientras se registraba, dejando el navegador suscripto pero el backend sin
 * el registro.
 */
export async function sincronizarSuscripcionExistente(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  try {
    const registro = await navigator.serviceWorker.getRegistration('/presentismo/');
    const suscripcion = await registro?.pushManager.getSubscription();
    if (!suscripcion) return false;
    await enviarSuscripcionAlServidor(suscripcion);
    return true;
  } catch {
    return false;
  }
}

/** Registra el service worker y suscribe al empleado a los avisos push de chequeo. */
export function usePush() {
  const [estado, setEstado] = useState<EstadoPush>('inactivo');

  const activar = useCallback(async (): Promise<boolean> => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setEstado('no_soportado');
      return false;
    }

    setEstado('activando');

    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        setEstado('rechazado');
        return false;
      }

      const registro = await navigator.serviceWorker.register('/presentismo/sw.js');
      await navigator.serviceWorker.ready;

      const suscripcionExistente = await registro.pushManager.getSubscription();
      const suscripcion =
        suscripcionExistente ??
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
          ) as BufferSource,
        }));

      const ok = await enviarSuscripcionAlServidor(suscripcion);
      if (!ok) {
        setEstado('error');
        return false;
      }

      setEstado('activo');
      return true;
    } catch {
      setEstado('error');
      return false;
    }
  }, []);

  return { estado, activar };
}
