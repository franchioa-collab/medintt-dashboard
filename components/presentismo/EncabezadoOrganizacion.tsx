import type { Organizacion, Perfil } from '@/lib/presentismo/database.types';
import LogoutButton from './LogoutButton';

const NOMBRES_ROL: Record<Perfil['rol'], string> = {
  admin: 'Administrador',
  supervisor_sede: 'Supervisor de sede',
  empleado: 'Empleado',
};

export default function EncabezadoOrganizacion({
  organizacion,
  perfil,
}: {
  organizacion: Organizacion;
  perfil: Perfil;
}) {
  // Por ahora todas las organizaciones ven la marca Medintt. Si en el futuro
  // se carga un logo propio (organizacion.logo_url), se muestra automáticamente.
  return (
    <header className="bg-navy text-white shadow-md">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {organizacion.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organizacion.logo_url}
              alt={organizacion.nombre}
              className="h-9 w-9 rounded object-contain bg-white shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-bold truncate">
              {organizacion.logo_url ? organizacion.nombre : 'Medintt · Presentismo'}
            </p>
            <p className="text-xs text-celeste truncate">
              {perfil.nombre_completo} · {NOMBRES_ROL[perfil.rol]}
            </p>
          </div>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
