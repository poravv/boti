import React, { useState } from 'react';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('admin@boti.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      onLogin(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md p-8 glass-card rounded-[2rem] shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <span className="material-symbols-outlined text-5xl text-primary">robot_2</span>
          </div>
          <h1 className="text-4xl font-black text-primary tracking-tighter uppercase">Boti Platform</h1>
          <p className="text-on-surface-variant font-medium mt-2">Acceso administrativo de IA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              {error}
            </div>
          )}

          <div>
            <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-2 px-1">Email Corporativo</label>
            <input 
              type="email" 
              required
              className="w-full px-5 py-4 rounded-2xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-4 ring-primary/10 outline-none transition-all font-medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-2 px-1">Contraseña</label>
            <input 
              type="password" 
              required
              className="w-full px-5 py-4 rounded-2xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-4 ring-primary/10 outline-none transition-all font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-on-primary rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'AUTENTICANDO...' : 'ENTRAR AL PANEL'}
          </button>
        </form>

        <p className="text-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest mt-10 opacity-40">
          Powered by DeepMind Agents &bull; v2.0.0
        </p>
      </div>
    </div>
  );
};

export default Login;
