import { redirect } from 'next/navigation';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import EncabezadoOrganizacion from '@/components/presentismo/EncabezadoOrganizacion';
import NavPresentismo from '@/components/presentismo/NavPresentismo';

export default async function PresentismoAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await obtenerSesionActual();
  if (!sesion) redirect('/presentismo/login');

  return (
    <div className="min-h-screen bg-gray-50">
      <EncabezadoOrganizacion organizacion={sesion.organizacion} perfil={sesion.perfil} />
      <NavPresentismo rol={sesion.perfil.rol} />
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
