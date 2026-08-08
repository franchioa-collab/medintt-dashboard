'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { RolUsuario } from '@/lib/presentismo/database.types';

const OPCIONES_ROL: { valor: RolUsuario; etiqueta: string }[] = [
  { valor: 'empleado', etiqueta: 'Empleado' },
  { valor: 'supervisor_sede', etiqueta: 'Supervisor de sede' },
  { valor: 'admin', etiqueta: 'Administrador' },
];

export default function FormularioEmpleado() {
  const router = useRouter();
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RolUsuario>('empleado');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setPasswordTemporal(null);

    const res = await fetch('/presentismo/api/admin/empleados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombreCompleto, email, rol }),
    });

    setEnviando(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(
        data?.error === 'email_en_uso'
          ? 'Ese email ya está registrado.'
          : 'No pudimos crear el empleado. Revisá los datos.'
      );
      return;
    }

    const { passwordTemporal: temp } = await res.json();
    setPasswordTemporal(temp);
    setNombreCompleto('');
    setEmail('');
    setRol('empleado');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 space-y-3">
      <h2 className="text-sm font-bold text-gray-700">Nuevo empleado</h2>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
        <input
          required
          value={nombreCompleto}
          onChange={(e) => setNombreCompleto(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as RolUsuario)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          {OPCIONES_ROL.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {passwordTemporal && (
        <div className="bg-amarillo/20 border border-amarillo rounded-md p-3 text-sm text-gray-800">
          <p className="font-medium">Empleado creado.</p>
          <p>
            Contraseña temporal: <span className="font-mono font-bold">{passwordTemporal}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Compartila de forma segura. El empleado puede cambiarla desde su cuenta.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? 'Creando…' : 'Crear empleado'}
      </button>
    </form>
  );
}
