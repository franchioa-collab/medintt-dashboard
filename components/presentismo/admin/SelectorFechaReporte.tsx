'use client';

import { useRouter } from 'next/navigation';

export default function SelectorFechaReporte({ fecha }: { fecha: string }) {
  const router = useRouter();

  return (
    <input
      type="date"
      value={fecha}
      onChange={(e) => router.push(`/presentismo/admin/reportes?fecha=${e.target.value}`)}
      className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
    />
  );
}
