'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PantallaConsentimientoCampo() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aceptar() {
    setCargando(true);
    setError(null);

    const res = await fetch('/presentismo/api/consentimiento-campo', { method: 'POST' });

    if (!res.ok) {
      setCargando(false);
      setError('No pudimos guardar tu aceptación. Probá de nuevo.');
      return;
    }

    router.refresh();
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <h2 className="text-lg font-bold text-navy">Trabajo en campo</h2>
      <p className="text-sm text-gray-700">
        Tu puesto está configurado como trabajo en campo, sin un lugar fijo. Esto cambia lo que
        hacemos con tu ubicación:
      </p>
      <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1.5">
        <li>
          Durante tu horario laboral asignado, la app va a registrar tu ubicación en cada aviso de
          chequeo que confirmes — no solo si te alejás de un área, como en el esquema general.
        </li>
        <li>Con esos puntos, tu empleador puede ver el recorrido del día.</li>
        <li>Fuera de tu horario laboral, la app no accede a tu ubicación bajo ninguna circunstancia.</li>
        <li>Podés consultar tu propio historial de marcaciones cuando quieras.</li>
      </ul>
      <p className="text-xs text-gray-500">
        Tratamiento de datos conforme a la Ley 25.326 de Protección de Datos Personales.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={aceptar}
        disabled={cargando}
        className="w-full bg-navy text-white rounded-md py-3 font-medium disabled:opacity-50"
      >
        {cargando ? 'Guardando…' : 'Entiendo y acepto'}
      </button>
    </div>
  );
}
