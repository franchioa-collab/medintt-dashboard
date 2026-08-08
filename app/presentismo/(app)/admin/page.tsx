import { redirect } from 'next/navigation';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';
import BadgeResultado from '@/components/presentismo/BadgeResultado';
import type { Marcacion, Perfil, Sede } from '@/lib/presentismo/database.types';

const LIMITE = 100;

type MarcacionConDetalle = Marcacion & {
  empleado: Pick<Perfil, 'nombre_completo'> | null;
  sede: Pick<Sede, 'nombre'> | null;
};

function formatearFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export default async function EquipoPage() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null;
  if (sesion.perfil.rol !== 'admin' && sesion.perfil.rol !== 'supervisor_sede') {
    redirect('/presentismo');
  }

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from('marcaciones')
    .select('*, empleado:perfiles(nombre_completo), sede:sedes(nombre)')
    .order('timestamp_marcacion', { ascending: false })
    .limit(LIMITE);

  const marcaciones = (data ?? []) as MarcacionConDetalle[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Presentismo del equipo</h1>
        <p className="text-sm text-gray-500">Últimas marcaciones registradas.</p>
      </div>

      <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
        {marcaciones.length === 0 && (
          <p className="p-4 text-sm text-gray-500">Todavía no hay marcaciones registradas.</p>
        )}
        {marcaciones.map((m) => (
          <div key={m.id} className="p-4 flex items-center justify-between text-sm gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate">
                {m.empleado?.nombre_completo ?? 'Empleado'}
              </p>
              <p className="text-gray-500 truncate">
                {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} · {formatearFechaHora(m.timestamp_marcacion)}
                {m.sede?.nombre ? ` · ${m.sede.nombre}` : ''}
              </p>
            </div>
            <BadgeResultado resultado={m.resultado} tarde={m.tarde} />
          </div>
        ))}
      </div>
    </div>
  );
}
