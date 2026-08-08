import { redirect } from 'next/navigation';
import Link from 'next/link';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import FormularioEmpleado from '@/components/presentismo/admin/FormularioEmpleado';
import type { Perfil } from '@/lib/presentismo/database.types';

const NOMBRES_ROL: Record<Perfil['rol'], string> = {
  admin: 'Administrador',
  supervisor_sede: 'Supervisor de sede',
  empleado: 'Empleado',
};

export default async function EmpleadosPage() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null;
  if (sesion.perfil.rol !== 'admin') redirect('/presentismo');

  // La RLS de perfiles solo permite ver la fila propia (evita recursión); el
  // listado de todo el equipo se hace con el cliente admin, ya filtrado a la
  // organización del que pidió la página (verificada arriba como admin).
  const admin = crearClienteAdmin();
  const { data } = await admin
    .from('perfiles')
    .select('*')
    .eq('organizacion_id', sesion.organizacion.id)
    .order('nombre_completo');
  const empleados = (data ?? []) as Perfil[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-navy">Empleados</h1>

      <FormularioEmpleado />

      <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
        {empleados.map((emp) => (
          <Link
            key={emp.id}
            href={`/presentismo/admin/empleados/${emp.id}`}
            className="p-4 flex items-center justify-between text-sm hover:bg-gray-50"
          >
            <div>
              <p className="font-medium text-gray-800">{emp.nombre_completo}</p>
              <p className="text-gray-500">{NOMBRES_ROL[emp.rol]}</p>
            </div>
            {!emp.activo && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">Inactivo</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
