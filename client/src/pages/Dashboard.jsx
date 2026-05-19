import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { api } from '../services/api';

const colors = ['#0a6ed1', '#107e3e', '#e9730c', '#bb0000', '#6a6d70', '#5d36ff', '#00a2ae'];

function Card({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${accent || 'text-sap-dark'}`}>{value}</div>
    </div>
  );
}

export default function Dashboard({ message = '' }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((res) => setData(res.data));
  }, []);

  if (!data) return <p>Carregando dashboard...</p>;
  const title = data.latestImport?.file_name ? `Dashboard Principal - ${data.latestImport.file_name}` : 'Dashboard Principal';

  return (
    <>
      <PageHeader title={title} subtitle="Visão executiva da classificação, validação e geração de resultados SAP." />
      {message && <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-sap-blue">{message}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Materiais importados" value={data.cards.total} />
        <Card label="Classificados" value={data.cards.totalClassified} />
        <Card label="OK / aprovados" value={data.cards.totalOk} accent="text-sap-green" />
        <Card label="Concluído" value={`${data.cards.percentComplete}%`} accent="text-sap-blue" />
        <Card label="Validar" value={data.cards.totalValidar} accent="text-sap-amber" />
        <Card label="Revisar" value={data.cards.totalRevisar} accent="text-rose-700" />
        <Card label="Pendente" value={data.cards.totalPendente} />
      </div>
      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-sap-dark">Avanço da padronização</h2>
          <span className="text-sm font-bold text-sap-blue">{data.cards.percentComplete}% concluído</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-sap-green" style={{ width: `${data.cards.percentComplete}%` }} />
        </div>
        <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
          <span><strong className="text-sap-dark">{data.cards.totalOk}</strong> itens OK/aprovados/concluídos</span>
          <span><strong className="text-sap-dark">{data.cards.totalValidar}</strong> aguardando validação</span>
          <span><strong className="text-sap-dark">{data.cards.totalRevisar}</strong> em revisão técnica</span>
        </div>
      </section>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-sap-dark">Materiais por status</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data.byStatus} dataKey="value" nameKey="name" outerRadius={100} label>
                {data.byStatus.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-sap-dark">Materiais por PDM</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.byPdm}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0a6ed1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>
      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-sap-dark">Últimas alterações</h2>
        <div className="table-wrap">
          <table className="min-w-full">
            <thead><tr><th>Código</th><th>Ação</th><th>Entidade</th><th>Novo valor</th><th>Usuário</th><th>Perfil</th><th>Data</th></tr></thead>
            <tbody>
              {data.latest.map((item) => (
                <tr key={item.id}>
                  <td className="font-bold">{item.codigo}</td><td>{item.action || item.field}</td><td>{item.entity}</td>
                  <td>{item.field === 'status' ? <StatusBadge value={item.new_value} /> : item.new_value}</td>
                  <td>{item.user}</td><td>{item.user_role}</td><td>{item.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
