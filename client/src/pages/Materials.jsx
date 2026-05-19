import { Check, Edit3, FileCheck2, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { api } from '../services/api';

const statusOptions = ['', 'PENDENTE', 'OK', 'VALIDAR', 'REVISAR', 'APROVADO', 'DEVOLVIDO', 'CONCLUIDO'];

export default function Materials({ user, finalOnly = false }) {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ status: '', pdm: '', responsible: '', centro: '', tipo: '', q: '', minConfidence: 0 });
  const [editing, setEditing] = useState(null);

  async function load() {
    const { data } = await api.get('/materials', { params: finalOnly ? { ...filters, status: '' } : filters });
    setRows(finalOnly ? data.filter((row) => row.final_result || ['OK', 'APROVADO', 'CONCLUIDO'].includes(row.status)) : data);
  }

  useEffect(() => { load(); }, []);
  const pdms = useMemo(() => [...new Set(rows.map((row) => row.suggested_pdm_name).filter(Boolean))], [rows]);

  async function setStatus(row, status) {
    await api.post(`/materials/${row.id}/status`, { status, user: user.username });
    await load();
  }

  async function generate(row) {
    await api.post(`/materials/${row.id}/generate`, { user: user.username });
    await load();
  }

  async function saveEdit(event) {
    event.preventDefault();
    await api.put(`/materials/${editing.id}`, { ...editing, user: user.username, note: 'Edicao pela tela' });
    setEditing(null);
    await load();
  }

  return (
    <>
      <PageHeader
        title={finalOnly ? 'Resultado Final' : 'Classificacao de Materiais'}
        subtitle={finalOnly ? 'De duplo clique em uma linha para editar os textos antes da exportacao.' : 'Aprovacao, validacao, revisao e geracao do resultado final por material.'}
        actions={!finalOnly && (
          <button onClick={load} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">Atualizar</button>
        )}
      />
      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">{finalOnly ? 'Itens no resultado' : 'Itens listados'}</div>
          <div className="mt-1 text-2xl font-bold text-sap-dark">{rows.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Confianca media</div>
          <div className="mt-1 text-2xl font-bold text-sap-blue">
            {rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.confidence || 0), 0) / rows.length) : 0}%
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Com texto final</div>
          <div className="mt-1 text-2xl font-bold text-sap-green">{rows.filter((row) => row.short_pt && row.short_en).length}</div>
        </div>
      </section>
      {!finalOnly && (
        <section className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4 xl:grid-cols-7">
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {statusOptions.map((item) => <option key={item} value={item}>{item || 'Todos status'}</option>)}
          </select>
          <select value={filters.pdm} onChange={(e) => setFilters({ ...filters, pdm: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos PDMs</option>{pdms.map((pdm) => <option key={pdm}>{pdm}</option>)}
          </select>
          <input placeholder="Responsavel" value={filters.responsible} onChange={(e) => setFilters({ ...filters, responsible: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input placeholder="Centro" value={filters.centro} onChange={(e) => setFilters({ ...filters, centro: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input placeholder="Tipo material" value={filters.tipo} onChange={(e) => setFilters({ ...filters, tipo: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input type="number" placeholder="Conf. minima" value={filters.minConfidence} onChange={(e) => setFilters({ ...filters, minConfidence: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-md bg-sap-blue px-3 py-2 text-sm font-bold text-white"><Search size={16} /> Filtrar</button>
          <input placeholder="Texto livre ou codigo" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2 xl:col-span-3" />
        </section>
      )}
      <div className="table-wrap">
        <table className={finalOnly ? 'min-w-[1500px]' : 'min-w-[1800px]'}>
          <thead>
            {finalOnly ? (
              <tr>
                <th>CODIGO</th><th>TEXTO BREVE PT</th><th>TEXTO LONGO PT</th><th>TEXTO BREVE EN</th><th>TEXTO LONGO EN</th><th>Modificado por</th><th>Data</th>
              </tr>
            ) : (
              <tr>
                <th>Codigo</th><th>Texto Breve Original</th><th>PDM Sugerido</th><th>ID PDM</th><th>Status</th><th>Confianca</th><th>Responsavel</th><th>Observacao</th><th>Modificado por</th><th>Data</th><th>Texto Breve PT</th><th>Texto Longo PT</th><th>Texto Breve EN</th><th>Texto Longo EN</th><th>Acoes</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row) => finalOnly ? (
              <tr key={row.id} onDoubleClick={() => setEditing(row)} title="De duplo clique para editar os textos antes da exportacao">
                <td className="font-bold text-sap-blue">{row.codigo}</td>
                <td className="font-semibold">{row.short_pt}</td>
                <td className="max-w-lg">{row.long_pt}</td>
                <td className="font-semibold">{row.short_en}</td>
                <td className="max-w-lg">{row.long_en}</td>
                <td>{row.modified_by_name || row.responsible}</td>
                <td>{row.modified_at || row.updated_at}</td>
              </tr>
            ) : (
              <tr key={row.id}>
                <td className="font-bold text-sap-blue">{row.codigo}</td>
                <td className="max-w-xs">{row.descricao}</td>
                <td>{row.suggested_pdm_name}</td>
                <td>{row.suggested_pdm_id}</td>
                <td><StatusBadge value={row.status} /></td>
                <td>{row.confidence}%</td>
                <td>{row.responsible}</td>
                <td>{row.observacao}</td>
                <td><div className="font-semibold">{row.modified_by_name || row.responsible}</div><div className="text-xs text-slate-500">{row.modified_by_role}</div></td>
                <td>{row.modified_at || row.updated_at}</td>
                <td className="font-semibold">{row.short_pt}</td>
                <td className="max-w-md">{row.long_pt}</td>
                <td className="font-semibold">{row.short_en}</td>
                <td className="max-w-md">{row.long_en}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <button title="Aprovar" onClick={() => setStatus(row, 'APROVADO')} className="rounded bg-green-100 p-2 text-green-800"><ShieldCheck size={16} /></button>
                    <button title="OK" onClick={() => setStatus(row, 'OK')} className="rounded bg-emerald-100 p-2 text-emerald-800"><Check size={16} /></button>
                    <button title="Validar" onClick={() => setStatus(row, 'VALIDAR')} className="rounded bg-amber-100 p-2 text-amber-800"><FileCheck2 size={16} /></button>
                    <button title="Revisar" onClick={() => setStatus(row, 'REVISAR')} className="rounded bg-rose-100 p-2 text-rose-800"><RotateCcw size={16} /></button>
                    <button title="Editar" onClick={() => setEditing(row)} className="rounded bg-slate-100 p-2 text-slate-700"><Edit3 size={16} /></button>
                    <button onClick={() => generate(row)} className="rounded bg-sap-blue px-2 py-1 text-xs font-bold text-white">Gerar</button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={finalOnly ? 7 : 15} className="py-10 text-center text-sm font-semibold text-slate-500">
                  Nenhum material encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={saveEdit} className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-5 shadow-fiori">
            <h2 className="mb-1 text-lg font-bold">Editar material {editing.codigo}</h2>
            <p className="mb-4 text-sm text-slate-500">Modificado por: {user.name}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {['descricao','texto_longo_original','centro','deposito','tipo_material','fabricante','part_number','modelo','dimensao','material','aplicacao','observacao','suggested_pdm_id','suggested_pdm_name','short_pt','long_pt','short_en','long_en'].map((field) => (
                <label key={field} className="text-sm font-bold text-slate-700">
                  {field}
                  <textarea value={editing[field] || ''} onChange={(e) => setEditing({ ...editing, [field]: e.target.value })} className="mt-1 h-20 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-slate-300 px-4 py-2 font-bold">Cancelar</button>
              <button className="rounded-md bg-sap-blue px-4 py-2 font-bold text-white">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
