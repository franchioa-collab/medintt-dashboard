import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';
import { fechaLocalYMD } from '@/lib/presentismo/fecha';
import BadgeResultado from '@/components/presentismo/BadgeResultado';
import type { Marcacion, Sede } from '@/lib/presentismo/database.types';

const LIMITE = 100;

type MarcacionConSede = Marcacion & { sede: Pick<Sede, 'nombre'> | null };

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function formatearFecha(ymd: string) {
  const [anio, mes, dia] = ymd.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default async function HistorialPage() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null; // el layout ya redirige a /presentismo/login

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from('marcaciones')
    .select('*, sede:sedes(nombre)')
    .eq('empleado_id', sesion.userId)
    .order('timestamp_marcacion', { ascending: false })
    .limit(LIMITE);

  const marcaciones = (data ?? []) as MarcacionConSede[];

  const grupos = new Map<string, MarcacionConSede[]>();
  for (const m of marcaciones) {
    const clave = fechaLocalYMD(new Date(m.timestamp_marcacion));
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(m);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-navy">Mi historial</h1>

      {grupos.size === 0 && (
        <p className="text-sm text-gray-500">Todavía no tenés marcaciones registradas.</p>
      )}

      {[...grupos.entries()].map(([fecha, items]) => (
        <div key={fecha} className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-2 capitalize">{formatearFecha(fecha)}</h2>
          <ul className="space-y-1.5">
            {items.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm gap-2">
                <span className="text-gray-700 truncate">
                  {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} · {formatearHora(m.timestamp_marcacion)}
                  {m.sede?.nombre ? ` · ${m.sede.nombre}` : ''}
                </span>
                <BadgeResultado resultado={m.resultado} tarde={m.tarde} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
