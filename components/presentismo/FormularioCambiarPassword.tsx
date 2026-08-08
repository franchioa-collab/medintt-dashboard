'use client';

import { useState, type FormEvent } from 'react';
import { crearClienteBrowser } from '@/lib/presentismo/supabase-browser';

export default function FormularioCambiarPassword() {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setEnviando(true);
    const supabase = crearClienteBrowser();
    const { error: errorSupabase } = await supabase.auth.updateUser({ password });
    setEnviando(false);

    if (errorSupabase) {
      setError('No pudimos actualizar tu contraseña. Probá de nuevo.');
      return;
    }

    setPassword('');
    setConfirmacion('');
    setOk(true);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 space-y-3 max-w-sm">
      <h2 className="text-sm font-bold text-gray-700">Cambiar contraseña</h2>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contraseña</label>
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Repetir contraseña</label>
        <input
          required
          type="password"
          minLength={8}
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-green-700">Contraseña actualizada.</p>}

      <button
        type="submit"
        disabled={enviando}
        className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
