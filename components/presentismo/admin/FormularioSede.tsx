'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useUbicacionActual } from '@/hooks/useUbicacionActual';
import { RADIO_METROS_DEFAULT } from '@/lib/presentismo/constants';

export default function FormularioSede() {
  const router = useRouter();
  const { obtenerUbicacion, cargando: obteniendoUbicacion } = useUbicacionActual();
  const [nombre, setNombre] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [radioMetros, setRadioMetros] = useState(String(RADIO_METROS_DEFAULT));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function usarUbicacionActual() {
    const { coordenadas } = await obtenerUbicacion();
    if (coordenadas) {
      setLatitud(coordenadas.lat.toFixed(6));
      setLongitud(coordenadas.lon.toFixed(6));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const res = await fetch('/presentismo/api/admin/sedes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        latitud: Number(latitud),
        longitud: Number(longitud),
        radioMetros: Number(radioMetros),
      }),
    });

    setEnviando(false);

    if (!res.ok) {
      setError('No pudimos guardar la sede. Revisá los datos.');
      return;
    }

    setNombre('');
    setLatitud('');
    setLongitud('');
    setRadioMetros(String(RADIO_METROS_DEFAULT));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 space-y-3">
      <h2 className="text-sm font-bold text-gray-700">Nueva sede</h2>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
        <input
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Planta Norte"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Latitud</label>
          <input
            required
            type="number"
            step="any"
            value={latitud}
            onChange={(e) => setLatitud(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Longitud</label>
          <input
            required
            type="number"
            step="any"
            value={longitud}
            onChange={(e) => setLongitud(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={usarUbicacionActual}
        disabled={obteniendoUbicacion}
        className="text-xs text-celeste underline disabled:opacity-50"
      >
        {obteniendoUbicacion ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}
      </button>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Radio de tolerancia (metros)</label>
        <input
          required
          type="number"
          min={10}
          value={radioMetros}
          onChange={(e) => setRadioMetros(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? 'Guardando…' : 'Guardar sede'}
      </button>
    </form>
  );
}
