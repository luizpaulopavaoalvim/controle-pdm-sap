import React from 'react';

const styles = {
  PENDENTE: 'bg-slate-100 text-slate-700',
  OK: 'bg-emerald-100 text-emerald-800',
  VALIDAR: 'bg-amber-100 text-amber-800',
  REVISAR: 'bg-rose-100 text-rose-800',
  APROVADO: 'bg-blue-100 text-blue-800',
  DEVOLVIDO: 'bg-orange-100 text-orange-800',
  CONCLUIDO: 'bg-green-100 text-green-800'
};

export default function StatusBadge({ value }) {
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${styles[value] || styles.PENDENTE}`}>{value}</span>;
}
