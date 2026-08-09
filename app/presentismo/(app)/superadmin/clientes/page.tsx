import { redirect } from 'next/navigation';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import FormularioNuevoCliente from '@/components/presentismo/superadmin/FormularioNuevoCliente';
import type { Organizacion } from '@/lib/presentismo/database.types';

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default async function ClientesPage() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null;
  if (sesion.perfil.rol !== 'super_admin') redirect('/presentismo');

  // Cada organización solo se ve a sí misma por RLS; para listarlas todas
  // (tarea exclusiva del dueño de la plataforma) usamos el cliente admin.
  const admin = crearClienteAdmin();
  const { data } = await admin.from('organizaciones').select('*').order('created_at', { ascending: false });
  const organizaciones = (data ?? []) as Organizacion[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Empresas clientes</h1>
        <p className="text-sm text-gray-500">
          Alta de empresas nuevas y su primer usuario administrador.
        </p>
      </div>

      <FormularioNuevoCliente />

      <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
        {organizaciones.length === 0 && (
          <p className="p-4 text-sm text-gray-500">Todavía no hay empresas cargadas.</p>
        )}
        {organizaciones.map((org) => (
          <div key={org.id} className="p-4 flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-gray-800">{org.nombre}</p>
              <p className="text-gray-500">Creada el {formatearFecha(org.created_at)}</p>
            </div>
            {!org.activa && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">Inactiva</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
