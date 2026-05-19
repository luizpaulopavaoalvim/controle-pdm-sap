import React, { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';

const initial = {
  id_padrao: '',
  nome_valido: '',
  descricao_pdm: '',
  tipo_material: '',
  palavra_chave: '',
  estrutura_texto_breve_pt: '',
  estrutura_texto_longo_pt: '',
  estrutura_texto_breve_en: '',
  estrutura_texto_longo_en: '',
  observacao: ''
};

const labels = {
  id_padrao: 'Id Padrão',
  nome_valido: 'Nome Válido',
  descricao_pdm: 'Descrição',
  tipo_material: 'Tipo de material',
  palavra_chave: 'Palavras-chave',
  estrutura_texto_breve_pt: 'Estrutura texto breve PT',
  estrutura_texto_longo_pt: 'Estrutura texto longo PT',
  estrutura_texto_breve_en: 'Estrutura texto breve EN',
  estrutura_texto_longo_en: 'Estrutura texto longo EN',
  observacao: 'Observação'
};

export default function Pdms({ user }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initial);
  const [editingId, setEditingId] = useState(null);
  const [q, setQ] = useState('');

  async function load() {
    const { data } = await api.get('/pdms', { params: { q } });
    setRows(data);
  }

  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    if (editingId) await api.put(`/pdms/${editingId}`, { ...form, user: user.username });
    else await api.post('/pdms', { ...form, user: user.username });
    setForm(initial);
    setEditingId(null);
    await load();
  }

  function edit(row) {
    setEditingId(row.id);
    setForm({
      id_padrao: row.id_padrao || row.id_pdm || '',
      nome_valido: row.nome_valido || row.nome_pdm || '',
      descricao_pdm: row.descricao_pdm || '',
      tipo_material: row.tipo_material || '',
      palavra_chave: row.palavra_chave || '',
      estrutura_texto_breve_pt: row.estrutura_texto_breve_pt || '',
      estrutura_texto_longo_pt: row.estrutura_texto_longo_pt || '',
      estrutura_texto_breve_en: row.estrutura_texto_breve_en || '',
      estrutura_texto_longo_en: row.estrutura_texto_longo_en || '',
      observacao: row.observacao || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <PageHeader title="Cadastro de PDM Manual" subtitle="Mantenha Id Padrão, Nome Válido e estruturas opcionais de geração." />
      <form onSubmit={submit} className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.keys(initial).map((field) => (
            <label key={field} className="text-sm font-bold text-slate-700">
              {labels[field]}
              <textarea required={['id_padrao','nome_valido'].includes(field)} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className="mt-1 h-16 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-md bg-sap-blue px-4 py-2 font-bold text-white">{editingId ? 'Atualizar PDM' : 'Salvar PDM'}</button>
          <button type="button" onClick={() => { setForm(initial); setEditingId(null); }} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700">Limpar</button>
        </div>
      </form>
      <div className="mb-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar PDM" className="w-full rounded-md border border-slate-300 px-3 py-2" />
        <button onClick={load} className="rounded-md border border-slate-300 bg-white px-4 py-2 font-bold">Buscar</button>
      </div>
      <div className="table-wrap">
        <table className="min-w-full">
          <thead><tr><th>Id Padrão</th><th>Nome Válido</th><th>Qtd. atributos</th><th>Atributos técnicos</th><th>Ações</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-bold text-sap-blue">{row.id_padrao || row.id_pdm}</td>
                <td>{row.nome_valido || row.nome_pdm}</td>
                <td>{row.attribute_count || 0}</td>
                <td>{(row.attributes || []).map((attr) => attr.attribute_name).join('; ')}</td>
                <td><button onClick={() => edit(row)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Editar</button></td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan="5" className="py-10 text-center text-sm font-semibold text-slate-500">Nenhum PDM encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
