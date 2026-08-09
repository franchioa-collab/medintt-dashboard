import { redirect } from 'next/navigation';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor, crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import { ROLES_ADMIN_EMPRESA } from '@/lib/presentismo/constants';
import { rangoDiaActualISO } from '@/lib/presentismo/fecha';
import BadgeResultado from '@/components/presentismo/BadgeResultado';
import type { ChequeoUbicacion, Marcacion, Sede } from '@/lib/presentismo/database.types';

const LIMITE = 100;

type MarcacionConSede = Marcacion & { sede: Pick<Sede, 'nombre'> | null };
type ChequeoConSede = ChequeoUbicacion & { sede: Pick<Sede, 'nombre'> | null };

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
  if (!ROLES_ADMIN_EMPRESA.includes(sesion.perfil.rol) && sesion.perfil.rol !== 'supervisor_sede') {
    redirect('/presentismo');
  }

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from('marcaciones')
    .select('*, sede:sedes(nombre)')
    .order('timestamp_marcacion', { ascending: false })
    .limit(LIMITE);

  const marcaciones = (data ?? []) as MarcacionConSede[];

  // Alertas de hoy: chequeos periódicos (Etapa 2) que quedaron fuera de zona
  // o sin responder a tiempo. Misma RLS que marcaciones (admin ve toda la
  // organización, supervisor solo sus sedes).
  const { inicio } = rangoDiaActualISO();
  const { data: chequeosData } = await supabase
    .from('chequeos_ubicacion')
    .select('*, sede:sedes(nombre)')
    .in('estado', ['confirmado_fuera', 'vencido'])
    .gte('enviado_en', inicio)
    .order('enviado_en', { ascending: false });

  const alertas = (chequeosData ?? []) as ChequeoConSede[];

  // La RLS de perfiles solo permite ver la fila propia (evita recursión); los
  // nombres de los empleados involucrados se resuelven aparte con el cliente
  // admin. Las listas de arriba ya vienen scopeadas por su propia RLS
  // (admin ve toda la organización, supervisor solo sus sedes).
  const empleadoIds = [
    ...new Set([...marcaciones.map((m) => m.empleado_id), ...alertas.map((a) => a.empleado_id)]),
  ];
  const admin = crearClienteAdmin();
  const { data: perfilesData } = await admin
    .from('perfiles')
    .select('id, nombre_completo')
    .in('id', empleadoIds.length > 0 ? empleadoIds : ['']);
  const nombrePorEmpleadoId = new Map(
    (perfilesData ?? []).map((p) => [p.id, p.nombre_completo])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Presentismo del equipo</h1>
        <p className="text-sm text-gray-500">Últimas marcaciones registradas.</p>
      </div>

      {alertas.length > 0 && (
        <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100 border-l-4 border-red-400">
          <h2 className="text-sm font-bold text-gray-700 p-4 pb-2">Alertas de hoy</h2>
          {alertas.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-center justify-between text-sm gap-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">
                  {nombrePorEmpleadoId.get(a.empleado_id) ?? 'Empleado'}
                </p>
                <p className="text-gray-500 truncate">
                  {a.estado === 'vencido' ? 'No confirmó el chequeo' : 'Fuera de zona'} ·{' '}
                  {formatearFechaHora(a.enviado_en)}
                  {a.sede?.nombre ? ` · ${a.sede.nombre}` : ''}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-medium shrink-0">
                {a.estado === 'vencido' ? 'Sin confirmar' : 'Fuera de zona'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
        {marcaciones.length === 0 && (
          <p className="p-4 text-sm text-gray-500">Todavía no hay marcaciones registradas.</p>
        )}
        {marcaciones.map((m) => (
          <div key={m.id} className="p-4 flex items-center justify-between text-sm gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate">
                {nombrePorEmpleadoId.get(m.empleado_id) ?? 'Empleado'}
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
