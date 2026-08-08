'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PantallaConsentimiento() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aceptar() {
    setCargando(true);
    setError(null);

    const res = await fetch('/presentismo/api/consentimiento', { method: 'POST' });

    if (!res.ok) {
      setCargando(false);
      setError('No pudimos guardar tu aceptación. Probá de nuevo.');
      return;
    }

    router.refresh();
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <h2 className="text-lg font-bold text-navy">Antes de empezar</h2>
      <p className="text-sm text-gray-700">
        Para marcar tu ingreso y egreso, esta app necesita tu ubicación GPS en el momento exacto
        en que marcás. Esto es lo que hacemos con esa información:
      </p>
      <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1.5">
        <li>Guardamos tu ubicación solo en el momento en que marcás ingreso o egreso.</li>
        <li>
          Durante tu horario laboral, la app puede verificar cada tanto si seguís dentro del área
          asignada. A tu empleador solo le llega si estás &ldquo;dentro&rdquo; o
          &ldquo;fuera&rdquo; del área — nunca tu ubicación exacta ni tu recorrido.
        </li>
        <li>Fuera de tu horario laboral, la app no accede a tu ubicación bajo ninguna circunstancia.</li>
        <li>No se guarda un historial continuo de posiciones, solo los eventos de marcado.</li>
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
