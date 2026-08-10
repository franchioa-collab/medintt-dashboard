import { Suspense } from 'react';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';
import { rangoDiaActualISO } from '@/lib/presentismo/fecha';
import PantallaConsentimiento from '@/components/presentismo/PantallaConsentimiento';
import PantallaConsentimientoCampo from '@/components/presentismo/PantallaConsentimientoCampo';
import PanelMarcado from '@/components/presentismo/PanelMarcado';
import BadgeResultado from '@/components/presentismo/BadgeResultado';
import RegistroPush from '@/components/presentismo/RegistroPush';
import ManejadorChequeo from '@/components/presentismo/ManejadorChequeo';
import type { Marcacion } from '@/lib/presentismo/database.types';

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export default async function PresentismoHomePage() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null; // el layout ya redirige a /presentismo/login

  if (!sesion.perfil.consentimiento_aceptado_at) {
    return <PantallaConsentimiento />;
  }

  const supabase = await crearClienteServidor();

  if (!sesion.perfil.consentimiento_flotante_aceptado_at) {
    const { data: asignacionFlotante } = await supabase
      .from('empleado_sedes')
      .select('id')
      .eq('empleado_id', sesion.userId)
      .eq('es_flotante', true)
      .limit(1)
      .maybeSingle();

    if (asignacionFlotante) {
      return <PantallaConsentimientoCampo />;
    }
  }

  const { inicio, fin } = rangoDiaActualISO();

  const { data: marcacionesHoy } = await supabase
    .from('marcaciones')
    .select('*')
    .eq('empleado_id', sesion.userId)
    .gte('timestamp_marcacion', inicio)
    .lte('timestamp_marcacion', fin)
    .order('timestamp_marcacion', { ascending: true });

  const marcaciones = (marcacionesHoy ?? []) as Marcacion[];
  const ultima = marcaciones[marcaciones.length - 1];
  const proximaAccion = !ultima || ultima.tipo === 'egreso' ? 'ingreso' : 'egreso';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Hola, {sesion.perfil.nombre_completo.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'America/Argentina/Buenos_Aires',
          })}
        </p>
      </div>

      <Suspense fallback={null}>
        <ManejadorChequeo />
      </Suspense>

      <PanelMarcado proximaAccion={proximaAccion} />

      <RegistroPush />

      {marcaciones.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-2">Hoy</h2>
          <ul className="space-y-1.5">
            {marcaciones.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} · {formatearHora(m.timestamp_marcacion)}
                </span>
                <BadgeResultado resultado={m.resultado} tarde={m.tarde} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
