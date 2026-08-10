import { redirect, notFound } from 'next/navigation';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor, crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import { DIAS_SEMANA, ROLES_ADMIN_EMPRESA } from '@/lib/presentismo/constants';
import FormularioAsignacion from '@/components/presentismo/admin/FormularioAsignacion';
import BotonEliminarAsignacion from '@/components/presentismo/admin/BotonEliminarAsignacion';
import TogglesSupervisorSede from '@/components/presentismo/admin/TogglesSupervisorSede';
import type { EmpleadoSede, Perfil, Sede } from '@/lib/presentismo/database.types';

const NOMBRES_ROL: Record<Perfil['rol'], string> = {
  super_admin: 'Administrador general',
  admin: 'Administrador',
  supervisor_sede: 'Supervisor de sede',
  empleado: 'Empleado',
};

function nombresDias(dias: number[]) {
  return dias
    .map((d) => DIAS_SEMANA.find((ds) => ds.valor === d)?.abrev)
    .filter(Boolean)
    .join(', ');
}

export default async function DetalleEmpleadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await obtenerSesionActual();
  if (!sesion) return null;
  if (!ROLES_ADMIN_EMPRESA.includes(sesion.perfil.rol)) redirect('/presentismo');

  const supabase = await crearClienteServidor();
  // La RLS de perfiles solo permite ver la fila propia (evita recursión); se
  // busca al empleado con el cliente admin, filtrando por su organización.
  const admin = crearClienteAdmin();

  const [{ data: empleado }, { data: sedesData }, { data: asignacionesData }] = await Promise.all([
    admin.from('perfiles').select('*').eq('id', id).eq('organizacion_id', sesion.organizacion.id).single(),
    supabase.from('sedes').select('*').order('nombre'),
    supabase
      .from('empleado_sedes')
      .select('*, sede:sedes(*)')
      .eq('empleado_id', id),
  ]);

  if (!empleado) notFound();

  const sedes = (sedesData ?? []) as Sede[];
  const asignaciones = (asignacionesData ?? []) as (EmpleadoSede & { sede: Sede })[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">{(empleado as Perfil).nombre_completo}</h1>
        <p className="text-sm text-gray-500">{NOMBRES_ROL[(empleado as Perfil).rol]}</p>
      </div>

      {(empleado as Perfil).rol === 'supervisor_sede' && (
        <div className="bg-white rounded-lg shadow-md p-4 space-y-2">
          <h2 className="text-sm font-bold text-gray-700">Sedes que supervisa</h2>
          <TogglesSupervisorSede empleadoId={id} sedes={sedes} />
        </div>
      )}

      <FormularioAsignacion empleadoId={id} sedes={sedes} />

      <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
        <h2 className="text-sm font-bold text-gray-700 p-4 pb-0">Sedes y horarios asignados</h2>
        {asignaciones.length === 0 && (
          <p className="p-4 text-sm text-gray-500">Todavía no tiene sedes asignadas.</p>
        )}
        {asignaciones.map((a) => (
          <div key={a.id} className="p-4 flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-gray-800 flex items-center gap-1.5">
                {a.sede.nombre}
                {a.es_flotante && (
                  <span className="px-1.5 py-0.5 rounded bg-lila/20 text-lila text-xs font-medium">
                    Campo
                  </span>
                )}
              </p>
              <p className="text-gray-500">
                {nombresDias(a.dias_semana)} · {a.hora_inicio.slice(0, 5)} a {a.hora_fin.slice(0, 5)}
              </p>
            </div>
            <BotonEliminarAsignacion asignacionId={a.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
