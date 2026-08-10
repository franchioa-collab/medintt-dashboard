import { redirect } from 'next/navigation';
import Link from 'next/link';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor, crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import { ROLES_ADMIN_EMPRESA } from '@/lib/presentismo/constants';
import { fechaLocalYMD } from '@/lib/presentismo/fecha';
import { obtenerFilasReporte, textoEstado } from '@/lib/presentismo/reportes';
import SelectorFechaReporte from '@/components/presentismo/admin/SelectorFechaReporte';

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function colorEstado(estado: string) {
  if (estado === 'Ausente') return 'text-gray-400';
  if (estado.startsWith('Fuera de zona')) return 'text-red-600 font-medium';
  if (estado.startsWith('Campo')) return 'text-lila';
  if (estado === 'Tarde') return 'text-amarillo font-medium';
  return 'text-green-700';
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null;
  if (!ROLES_ADMIN_EMPRESA.includes(sesion.perfil.rol) && sesion.perfil.rol !== 'supervisor_sede') {
    redirect('/presentismo');
  }

  const { fecha: fechaParam } = await searchParams;
  const fecha = fechaParam ?? fechaLocalYMD();
  const fechaDate = new Date(`${fecha}T12:00:00-03:00`);

  const supabase = await crearClienteServidor();
  const filas = await obtenerFilasReporte(supabase, fechaDate);

  const admin = crearClienteAdmin();
  const empleadoIds = filas.map((f) => f.empleadoId);
  const { data: perfilesData } = await admin
    .from('perfiles')
    .select('id, nombre_completo')
    .in('id', empleadoIds.length > 0 ? empleadoIds : ['']);
  const nombrePorEmpleadoId = new Map((perfilesData ?? []).map((p) => [p.id, p.nombre_completo]));

  const filasOrdenadas = [...filas].sort((a, b) =>
    (nombrePorEmpleadoId.get(a.empleadoId) ?? '').localeCompare(nombrePorEmpleadoId.get(b.empleadoId) ?? '')
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Reportes</h1>
          <p className="text-sm text-gray-500">Presentismo del día elegido, para exportar a nómina.</p>
        </div>
        <div className="flex items-center gap-2">
          <SelectorFechaReporte fecha={fecha} />
          <a
            href={`/presentismo/api/admin/reportes/csv?fecha=${fecha}`}
            className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium"
          >
            Descargar CSV
          </a>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
        {filasOrdenadas.length === 0 && (
          <p className="p-4 text-sm text-gray-500">
            Nadie tenía una asignación vigente ese día.
          </p>
        )}
        {filasOrdenadas.map((f) => {
          const estado = textoEstado(f);
          return (
            <div key={f.empleadoId} className="p-4 flex items-center justify-between text-sm gap-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">
                  {nombrePorEmpleadoId.get(f.empleadoId) ?? 'Empleado'}
                </p>
                <p className="text-gray-500 truncate">
                  {f.sedeNombre}
                  {f.horaIngreso && ` · Ingreso ${formatearHora(f.horaIngreso)}`}
                  {f.horaEgreso && ` · Egreso ${formatearHora(f.horaEgreso)}`}
                </p>
                {f.esFlotante && f.puntosRecorrido > 0 && (
                  <Link
                    href={`/presentismo/admin/reportes/recorrido/${f.empleadoId}?fecha=${fecha}`}
                    className="text-celeste underline text-xs"
                  >
                    Ver recorrido ({f.puntosRecorrido} puntos)
                  </Link>
                )}
              </div>
              <span className={`text-xs font-medium shrink-0 ${colorEstado(estado)}`}>{estado}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
