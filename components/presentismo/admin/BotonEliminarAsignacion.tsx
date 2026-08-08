'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BotonEliminarAsignacion({ asignacionId }: { asignacionId: string }) {
  const router = useRouter();
  const [eliminando, setEliminando] = useState(false);

  async function handleClick() {
    setEliminando(true);
    const res = await fetch(`/presentismo/api/admin/asignaciones/${asignacionId}`, {
      method: 'DELETE',
    });
    setEliminando(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={eliminando}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      {eliminando ? 'Quitando…' : 'Quitar'}
    </button>
  );
}
