import { redirect } from 'next/navigation';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';
import FormularioSede from '@/components/presentismo/admin/FormularioSede';
import type { Sede } from '@/lib/presentismo/database.types';

export default async function SedesPage() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null;
  if (sesion.perfil.rol !== 'admin') redirect('/presentismo');

  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('sedes').select('*').order('nombre');
  const sedes = (data ?? []) as Sede[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Sedes</h1>
        <p className="text-sm text-gray-500">
          Cada sede es un área geográfica válida para marcar presentismo. Un empleado puede tener
          varias sedes asignadas (su lugar habitual + sedes de clientes que visita).
        </p>
      </div>

      <FormularioSede />

      <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
        {sedes.length === 0 && (
          <p className="p-4 text-sm text-gray-500">Todavía no hay sedes cargadas.</p>
        )}
        {sedes.map((sede) => (
          <div key={sede.id} className="p-4 text-sm">
            <p className="font-medium text-gray-800">{sede.nombre}</p>
            <p className="text-gray-500">
              {sede.latitud.toFixed(5)}, {sede.longitud.toFixed(5)} · radio {sede.radio_metros} m
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
