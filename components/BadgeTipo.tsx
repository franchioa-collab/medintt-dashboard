import { COLORES_TIPO } from '@/lib/constants';
import type { TipoTarea } from '@/lib/types';

interface BadgeTipoProps {
  tipo: TipoTarea;
}

export function BadgeTipo({ tipo }: BadgeTipoProps) {
  const colorClass = COLORES_TIPO[tipo];

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${colorClass}`}>
      {tipo}
    </span>
  );
}
