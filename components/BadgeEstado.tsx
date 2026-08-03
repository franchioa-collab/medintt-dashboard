import { COLORES_ESTADO } from '@/lib/constants';
import type { EstadoTarea } from '@/lib/types';

interface BadgeEstadoProps {
  estado: EstadoTarea;
}

export function BadgeEstado({ estado }: BadgeEstadoProps) {
  const colorClass = COLORES_ESTADO[estado];

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${colorClass}`}>
      {estado}
    </span>
  );
}
