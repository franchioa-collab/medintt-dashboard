import { redirect } from 'next/navigation';
import Link from 'next/link';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor, crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import { ROLES_ADMIN_EMPRESA } from '@/lib/presentismo/constants';
import { fechaLocalYMD, rangoDiaActualISO } from '@/lib/presentismo/fecha';
import type { ChequeoUbicacion } from '@/lib/presentismo/database.types';

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export default async function RecorridoPage({
  params,
  searchParams,
}: {
  params: Promise<{ empleadoId: string }>;
  searchParams: Promise<{ fecha?: string }>;
}) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null;
  if (!ROLES_ADMIN_EMPRESA.includes(sesion.perfil.rol) && sesion.perfil.rol !== 'supervisor_sede') {
    redirect('/presentismo');
  }

  const { empleadoId } = await params;
  const { fecha: fechaParam } = await searchParams;
  const fecha = fechaParam ?? fechaLocalYMD();
  const fechaDate = new Date(`${fecha}T12:00:00-03:00`);
  const { inicio, fin } = rangoDiaActualISO(fechaDate);

  const supabase = await crearClienteServidor();
  const { data: chequeosData } = await supabase
    .from('chequeos_ubicacion')
    .select('*')
    .eq('empleado_id', empleadoId)
    .eq('estado', 'confirmado_campo')
    .gte('enviado_en', inicio)
    .lte('enviado_en', fin)
    .order('enviado_en', { ascending: true });

  const puntos = (chequeosData ?? []) as ChequeoUbicacion[];

  const admin = crearClienteAdmin();
  const { data: empleado } = await admin
    .from('perfiles')
    .select('nombre_completo')
    .eq('id', empleadoId)
    .eq('organizacion_id', sesion.organizacion.id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/presentismo/admin/reportes?fecha=${fecha}`} className="text-celeste underline text-sm">
          ← Volver a reportes
        </Link>
        <h1 className="text-xl font-bold text-navy mt-1">
          Recorrido de {empleado?.nombre_completo ?? 'empleado'}
        </h1>
        <p className="text-sm text-gray-500">{fecha}</p>
      </div>

      <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
        {puntos.length === 0 && (
          <p className="p-4 text-sm text-gray-500">No hay puntos de recorrido guardados ese día.</p>
        )}
        {puntos.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between text-sm">
            <span className="text-gray-700">{formatearHora(p.enviado_en)}</span>
            <span className="text-gray-500">
              {p.latitud?.toFixed(5)}, {p.longitud?.toFixed(5)}
            </span>
            <a
              href={`https://www.google.com/maps?q=${p.latitud},${p.longitud}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-celeste underline"
            >
              Ver en el mapa
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
