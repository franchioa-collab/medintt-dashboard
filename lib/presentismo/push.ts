import webpush from 'web-push';

let configurado = false;

function asegurarConfiguracion() {
  if (configurado) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configurado = true;
}

export interface SuscripcionPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface ResultadoEnvioPush {
  ok: boolean;
  /** true si la suscripción ya no es válida y conviene borrarla (410/404). */
  expirada: boolean;
}

/** Manda una notificación push a un dispositivo. No lanza si falla el envío. */
export async function enviarPush(
  suscripcion: SuscripcionPush,
  payload: { titulo: string; cuerpo: string; chequeoId: string }
): Promise<ResultadoEnvioPush> {
  asegurarConfiguracion();

  try {
    await webpush.sendNotification(
      {
        endpoint: suscripcion.endpoint,
        keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth },
      },
      JSON.stringify({
        title: payload.titulo,
        body: payload.cuerpo,
        chequeoId: payload.chequeoId,
      })
    );
    return { ok: true, expirada: false };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    return { ok: false, expirada: status === 404 || status === 410 };
  }
}
