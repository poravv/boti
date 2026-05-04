import React, { useState } from 'react';
import { Button, FormInput, Icon, useToast } from './ui';
import {
  isFirebaseEnabled,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  resetPassword,
  getIdToken,
  firebaseSignOut,
} from '../lib/firebase';
import { apiFetchJson } from '../lib/apiClient';
import { cn } from './ui/cn';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-12 flex items-center justify-center gap-3 rounded-2xl border border-border bg-white text-sm font-bold text-foreground shadow-premium hover:bg-gray-50 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0 transition-transform group-hover:scale-110">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continuar con Google
    </button>
  );
}

type View = 'login' | 'register' | 'reset';

export default function Login({ onLogin }: LoginProps) {
  const toast = useToast();
  const [view, setView] = useState<View>('login');

  const [email, setEmail] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const legacyMode = !isFirebaseEnabled;

  const resolveFirebaseSession = async () => {
    const idToken = await getIdToken();
    if (!idToken) throw new Error('No se pudo obtener el token de Firebase.');
    return apiFetchJson<{ token: string; user: any }>('/api/auth/firebase-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      const { token, user } = await resolveFirebaseSession();
      onLogin(token, user);
    } catch (err: any) {
      toast.show(err.message ?? 'Error al iniciar sesión con Google.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isEmail = loginIdentifier.includes('@');
      if (!isEmail) {
        const data = await apiFetchJson<{ token: string; user: any }>('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: loginIdentifier, password }),
        });
        onLogin(data.token, data.user);
      } else {
        try {
          const data = await apiFetchJson<{ token: string; user: any }>('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: loginIdentifier, password }),
          });
          onLogin(data.token, data.user);
          return;
        } catch { }

        if (legacyMode) throw new Error('Email o contraseña incorrectos.');

        await signInWithEmail(loginIdentifier, password);
        const { token, user } = await resolveFirebaseSession();
        onLogin(token, user);
      }
    } catch (err: any) {
      toast.show(err.message ?? 'Error al iniciar sesión.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans overflow-hidden">
      {/* Left Pane - Content & Form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-24 lg:px-32 xl:px-48 relative z-10">
        <div className="max-w-md w-full mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          {/* Logo */}
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-premium">
                <Icon name="smart_toy" size="md" />
             </div>
             <span className="text-2xl font-black tracking-tighter text-foreground">BOTI</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-black text-foreground tracking-tight">
              {view === 'login' ? 'Bienvenido de nuevo' : 'Empieza ahora'}
            </h1>
            <p className="text-muted-foreground font-medium">
              {view === 'login' 
                ? 'Gestiona tus conversaciones con IA de forma profesional.' 
                : 'Crea tu cuenta en minutos y escala tu atención al cliente.'}
            </p>
          </div>

          <div className="space-y-6">
            <GoogleButton onClick={handleGoogleSignIn} disabled={loading} />

            <div className="flex items-center gap-4">
               <div className="flex-1 h-px bg-border/50" />
               <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">O usa tu email</span>
               <div className="flex-1 h-px bg-border/50" />
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-5">
              <FormInput
                label="EMAIL O USUARIO"
                type="text"
                value={loginIdentifier}
                onChange={e => setLoginIdentifier(e.target.value)}
                placeholder="tu@email.com"
                required
                className="rounded-2xl border-border/60 focus:ring-primary/10"
              />
              <div className="space-y-1">
                <FormInput
                  label="CONTRASEÑA"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="rounded-2xl border-border/60 focus:ring-primary/10"
                />
                {view === 'login' && (
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setView('reset')} className="text-[10px] font-bold text-primary hover:underline">¿OLVIDASTE TU CONTRASEÑA?</button>
                  </div>
                )}
              </div>

              <Button type="submit" variant="primary" size="lg" className="w-full h-12 rounded-2xl font-black tracking-widest text-xs shadow-premium group" disabled={loading}>
                {loading ? 'PROCESANDO...' : (view === 'login' ? 'INGRESAR AL PANEL' : 'CREAR CUENTA')}
                <Icon name="arrow_forward" size="xs" className="ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </form>
          </div>

          <p className="text-center text-xs font-bold text-muted-foreground">
            {view === 'login' ? (
              <>¿NO TIENES CUENTA? <button onClick={() => setView('register')} className="text-primary hover:underline ml-1 uppercase">REGÍSTRATE GRATIS</button></>
            ) : (
              <>¿YA TIENES CUENTA? <button onClick={() => setView('login')} className="text-primary hover:underline ml-1 uppercase">INICIAR SESIÓN</button></>
            )}
          </p>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
           <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.3em]">© 2026 BOTI SAAS ENTERPRISE · POWERED BY AI</p>
        </div>
      </div>

      {/* Right Pane - Visual Overlay */}
      <div className="hidden lg:flex flex-1 bg-primary relative overflow-hidden items-center justify-center p-24">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary-variant via-primary to-primary-variant animate-pulse-slow" />
        <div className="absolute top-0 right-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        
        {/* Floating Decorative Elements */}
        <div className="relative z-20 space-y-12 text-white">
           <div className="space-y-4">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-3xl rounded-3xl flex items-center justify-center shadow-glass border border-white/20 animate-bounce-slow">
                 <Icon name="auto_awesome" size="xl" className="text-white" />
              </div>
              <h2 className="text-6xl font-black tracking-tighter leading-[0.9]">Atención al cliente reinventada con IA.</h2>
              <p className="text-xl font-medium text-white/70 max-w-lg">Únete a más de 500 empresas que automatizan sus ventas por WhatsApp con Boti.</p>
           </div>

           <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                 <p className="text-4xl font-black text-white">99%</p>
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Satisfacción</p>
              </div>
              <div className="space-y-1">
                 <p className="text-4xl font-black text-white">24/7</p>
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Operación</p>
              </div>
           </div>
        </div>

        {/* Glassmorphism card decoration */}
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-white/5 backdrop-blur-3xl rounded-full border border-white/10" />
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary-variant/30 backdrop-blur-2xl rounded-full" />
      </div>
    </div>
  );
}
