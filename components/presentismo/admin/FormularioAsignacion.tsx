'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS_SEMANA, DIAS_HABILES_DEFAULT } from '@/lib/presentismo/constants';
import type { Sede } from '@/lib/presentismo/database.types';

export default function FormularioAsignacion({
  empleadoId,
  sedes,
}: {
  empleadoId: string;
  sedes: Sede[];
}) {
  const router = useRouter();
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? '');
  const [diasSemana, setDiasSemana] = useState<number[]>(DIAS_HABILES_DEFAULT);
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFin, setHoraFin] = useState('17:00');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDia(dia: number) {
    setDiasSemana((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort()
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sedeId || diasSemana.length === 0) {
      setError('Elegí una sede y al menos un día.');
      return;
    }

    setEnviando(true);
    setError(null);

    const res = await fetch('/presentismo/api/admin/asignaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empleadoId, sedeId, diasSemana, horaInicio, horaFin }),
    });

    setEnviando(false);

    if (!res.ok) {
      setError('No pudimos guardar la asignación.');
      return;
    }

    router.refresh();
  }

  if (sedes.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Primero cargá al menos una sede en{' '}
        <a href="/presentismo/admin/sedes" className="text-celeste underline">
          Sedes
        </a>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 space-y-3">
      <h2 className="text-sm font-bold text-gray-700">Asignar sede y horario</h2>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Sede</label>
        <select
          value={sedeId}
          onChange={(e) => setSedeId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Días</label>
        <div className="flex flex-wrap gap-2">
          {DIAS_SEMANA.map((d) => (
            <button
              type="button"
              key={d.valor}
              onClick={() => toggleDia(d.valor)}
              className={`px-2 py-1 rounded text-xs border ${
                diasSemana.includes(d.valor)
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              {d.abrev}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hora inicio</label>
          <input
            required
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hora fin</label>
          <input
            required
            type="time"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? 'Guardando…' : 'Asignar'}
      </button>
    </form>
  );
}
