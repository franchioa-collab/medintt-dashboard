'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RolUsuario } from '@/lib/presentismo/database.types';

const ITEMS: { href: string; label: string; roles: RolUsuario[] }[] = [
  { href: '/presentismo', label: 'Marcar', roles: ['super_admin', 'admin', 'supervisor_sede', 'empleado'] },
  {
    href: '/presentismo/historial',
    label: 'Mi historial',
    roles: ['super_admin', 'admin', 'supervisor_sede', 'empleado'],
  },
  {
    href: '/presentismo/admin',
    label: 'Presentismo del equipo',
    roles: ['super_admin', 'admin', 'supervisor_sede'],
  },
  { href: '/presentismo/admin/sedes', label: 'Sedes', roles: ['super_admin', 'admin'] },
  { href: '/presentismo/admin/empleados', label: 'Empleados', roles: ['super_admin', 'admin'] },
  { href: '/presentismo/superadmin/clientes', label: 'Empresas clientes', roles: ['super_admin'] },
  {
    href: '/presentismo/cuenta',
    label: 'Mi cuenta',
    roles: ['super_admin', 'admin', 'supervisor_sede', 'empleado'],
  },
];

export default function NavPresentismo({ rol }: { rol: RolUsuario }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => item.roles.includes(rol));

  return (
    <nav className="bg-white border-b border-gray-200 overflow-x-auto">
      <div className="max-w-3xl mx-auto px-4 flex gap-1">
        {items.map((item) => {
          const activo = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                activo ? 'border-celeste text-navy' : 'border-transparent text-gray-500 hover:text-navy'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
