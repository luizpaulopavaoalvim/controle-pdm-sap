import React, { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';

export default function History() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ codigo: '', user: '', action: '', entity: '' });

  async function load() {
    const { data } = await api.get('/history', { params: filters });
    setRows(data);
  }

  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader title="Historico de Auditoria" subtitle="Rastreabilidade por usuario, perfil, acao, entidade, codigo, valores e data." />
      <div className="mb-4 grid gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <input placeholder="Codigo" value={filters.codigo} onChange={(e) => setFilters({ ...filters, codigo: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
        <input placeholder="Usuario" value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
        <input placeholder="Acao" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
        <input placeholder="Entidade" value={filters.entity} onChange={(e) => setFilters({ ...filters, entity: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
        <button onClick={load} className="rounded-md bg-sap-blue px-4 py-2 font-bold text-white">Filtrar</button>
      </div>
      <div className="table-wrap">
        <table className="min-w-[1200px]">
          <thead><tr><th>Usuario</th><th>Perfil</th><th>Acao</th><th>Entidade</th><th>Codigo</th><th>Campo</th><th>Valor anterior</th><th>Valor novo</th><th>Data e hora</th><th>Observacao</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.user}</td><td>{row.user_role}</td><td>{row.action || row.field}</td><td>{row.entity}</td>
                <td className="font-bold text-sap-blue">{row.codigo}</td><td>{row.field}</td><td>{row.old_value}</td><td>{row.new_value}</td><td>{row.created_at}</td><td>{row.note}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan="10" className="py-10 text-center text-sm font-semibold text-slate-500">Nenhum historico encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
