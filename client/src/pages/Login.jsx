import { LockKeyhole, UserPlus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

const emptyForm = { name: '', email: '', password: '', confirmPassword: '' };

function localLoginPreview(name = '') {
  const words = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  return `${words[0]}${words.length > 1 ? words[words.length - 1] : ''}`;
}

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: 'admin', email: '', password: '123456', confirmPassword: '' });
  const [generatedLogin, setGeneratedLogin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [slowLogin, setSlowLogin] = useState(false);

  useEffect(() => {
    if (mode !== 'register' || !form.name.trim()) {
      setGeneratedLogin('');
      return;
    }

    setGeneratedLogin(localLoginPreview(form.name));
    const handle = window.setTimeout(async () => {
      try {
        const { data } = await api.get('/auth/suggest-login', { params: { name: form.name.trim() } });
        setGeneratedLogin(data.username || localLoginPreview(form.name));
      } catch {
        setGeneratedLogin(localLoginPreview(form.name));
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [form.name, mode]);

  function setField(field, value) {
    const numericValue = field.toLowerCase().includes('password') ? value.replace(/\D/g, '').slice(0, 6) : value;
    setForm((current) => ({ ...current, [field]: numericValue }));
  }

  function validatePassword() {
    if (!/^\d{6}$/.test(form.password)) {
      setError('A senha deve conter exatamente 6 numeros.');
      return false;
    }
    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError('A confirmacao da senha nao confere.');
      return false;
    }
    return true;
  }

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError('');
    setSuccess('');
    setSlowLogin(false);
    if (!form.name.trim()) {
      setError(mode === 'login' ? 'Informe o login.' : 'Informe o nome completo.');
      return;
    }
    if (mode === 'register') {
      if (!form.email.trim()) {
        setError('Informe o e-mail.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        setError('Informe um e-mail valido.');
        return;
      }
    }
    if (!validatePassword()) return;

    let slowTimer = null;
    try {
      setLoading(true);
      slowTimer = window.setTimeout(() => setSlowLogin(true), 1800);
      if (mode === 'login') {
        const startedAt = performance.now();
        const { data } = await api.post('/auth/login', { username: form.name.trim(), password: form.password });
        console.info(`[login] autenticado em ${Math.round(performance.now() - startedAt)}ms`);
        window.clearTimeout(slowTimer);
        onLogin(data.user);
        return;
      }
      const { data } = await api.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword
      });
      setSuccess(`Cadastro criado. Use o login ${data.user.username} para entrar.`);
      setMode('login');
      setForm({ name: data.user.username, email: '', password: '', confirmPassword: '' });
      window.clearTimeout(slowTimer);
    } catch (err) {
      setError(err.response?.data?.message || 'Nao foi possivel concluir a operacao.');
    } finally {
      if (slowTimer) window.clearTimeout(slowTimer);
      setLoading(false);
      setSlowLogin(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setLoading(false);
    setSlowLogin(false);
    setError('');
    setSuccess('');
    setGeneratedLogin('');
    setForm(nextMode === 'login' ? { name: 'admin', email: '', password: '123456', confirmPassword: '' } : emptyForm);
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-slate-100 via-slate-50 to-white">
      <section className="flex flex-1 items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] ring-1 ring-slate-200 md:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-sap-dark p-8 text-white md:p-10">
          <div className="mb-10 text-sm font-bold uppercase tracking-wide text-blue-200">SAP MM • PDM • Padronizacao</div>
          <h1 className="max-w-md text-4xl font-bold leading-tight">Controle Inteligente de PDM SAP</h1>
          <p className="mt-4 max-w-lg text-base text-slate-200">
            Importe a base padrao PDM uma vez, processe materiais reais por planilha e gere descricoes finais para SAP.
          </p>
          <div className="mt-10 grid gap-3 rounded-lg border border-white/15 bg-white/5 p-4 text-sm text-slate-200">
            <span className="font-bold text-white">Acesso inicial</span>
            <span>Admin: admin / 123456</span>
            <span>Novos usuarios entram com login gerado automaticamente e perfil Consultor.</span>
          </div>
        </div>
        <form onSubmit={submit} className="p-8 md:p-10">
          <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => switchMode('login')} className={`rounded-md px-4 py-2 text-sm font-bold ${mode === 'login' ? 'bg-white text-sap-blue shadow-sm' : 'text-slate-600'}`}>
              Entrar
            </button>
            <button type="button" onClick={() => switchMode('register')} className={`rounded-md px-4 py-2 text-sm font-bold ${mode === 'register' ? 'bg-white text-sap-blue shadow-sm' : 'text-slate-600'}`}>
              Cadastrar
            </button>
          </div>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-sap-soft text-sap-blue">
            {mode === 'login' ? <LockKeyhole size={24} /> : <UserPlus size={24} />}
          </div>
          <h2 className="text-2xl font-bold text-sap-dark">{mode === 'login' ? 'Entrar no sistema' : 'Cadastrar usuario'}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'login' ? 'Use seu login e a senha numerica de 6 digitos.' : 'Informe o nome completo. O sistema gera o login automaticamente.'}
          </p>
          <label className="mt-6 block text-sm font-bold text-slate-700">{mode === 'login' ? 'Login' : 'Nome completo'}</label>
          <input value={form.name} onChange={(e) => setField('name', e.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" />
          {mode === 'register' && (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="font-bold text-slate-700">Login gerado: </span>
              <span className="font-mono text-sap-blue">{generatedLogin || 'preencha o nome completo'}</span>
            </div>
          )}
          {mode === 'register' && (
            <>
              <label className="mt-4 block text-sm font-bold text-slate-700">E-mail</label>
              <input value={form.email} onChange={(e) => setField('email', e.target.value)} type="email" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" />
            </>
          )}
          <label className="mt-4 block text-sm font-bold text-slate-700">Senha numerica</label>
          <input value={form.password} onChange={(e) => setField('password', e.target.value)} inputMode="numeric" pattern="\d{6}" type="password" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" />
          {mode === 'register' && (
            <>
              <label className="mt-4 block text-sm font-bold text-slate-700">Confirmar senha</label>
              <input value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} inputMode="numeric" pattern="\d{6}" type="password" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" />
            </>
          )}
          {slowLogin && mode === 'login' && (
            <p className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-sap-blue">
              Acordando servidor, aguarde alguns segundos...
            </p>
          )}
          {error && <p className="mt-3 text-sm font-bold text-rose-700">{error}</p>}
          {success && <p className="mt-3 text-sm font-bold text-sap-green">{success}</p>}
          <button disabled={loading} className="mt-6 w-full rounded-md bg-sap-blue px-4 py-2.5 font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? (mode === 'login' ? 'Entrando...' : 'Criando cadastro...') : (mode === 'login' ? 'Acessar dashboard' : 'Criar cadastro')}
          </button>
        </form>
      </div>
      </section>
      <footer className="w-full bg-sap-dark px-4 py-4 text-center text-sm text-slate-200">
        Criado por{' '}
        <a className="font-bold text-white underline-offset-4 hover:underline" href="https://www.linkedin.com/in/luizpaulopavaoalvim/" target="_blank" rel="noopener noreferrer">
          Luiz Paulo Pavao Alvim
        </a>
      </footer>
    </main>
  );
}
