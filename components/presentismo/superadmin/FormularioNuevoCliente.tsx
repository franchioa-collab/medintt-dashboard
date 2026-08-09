'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function FormularioNuevoCliente() {
  const router = useRouter();
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [nombreAdmin, setNombreAdmin] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ passwordTemporal: string; nombreEmpresa: string } | null>(
    null
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setResultado(null);

    const res = await fetch('/presentismo/api/superadmin/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombreEmpresa, nombreAdmin, emailAdmin }),
    });

    setEnviando(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(
        data?.error === 'email_en_uso'
          ? 'Ese email ya está registrado.'
          : 'No pudimos crear la empresa. Revisá los datos.'
      );
      return;
    }

    const { passwordTemporal } = await res.json();
    setResultado({ passwordTemporal, nombreEmpresa });
    setNombreEmpresa('');
    setNombreAdmin('');
    setEmailAdmin('');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 space-y-3">
      <h2 className="text-sm font-bold text-gray-700">Nueva empresa cliente</h2>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de la empresa</label>
        <input
          required
          value={nombreEmpresa}
          onChange={(e) => setNombreEmpresa(e.target.value)}
          placeholder="Ej. Acme S.A."
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Nombre completo del primer administrador
        </label>
        <input
          required
          value={nombreAdmin}
          onChange={(e) => setNombreAdmin(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email de ese administrador</label>
        <input
          required
          type="email"
          value={emailAdmin}
          onChange={(e) => setEmailAdmin(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {resultado && (
        <div className="bg-amarillo/20 border border-amarillo rounded-md p-3 text-sm text-gray-800">
          <p className="font-medium">Empresa &ldquo;{resultado.nombreEmpresa}&rdquo; creada.</p>
          <p>
            Contraseña temporal: <span className="font-mono font-bold">{resultado.passwordTemporal}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Compartísela de forma segura al administrador de esa empresa, junto con el link de
            ingreso. Puede cambiarla desde su cuenta.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? 'Creando…' : 'Crear empresa cliente'}
      </button>
    </form>
  );
}
