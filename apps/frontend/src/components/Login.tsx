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
  resendVerificationEmail,
} from '../lib/firebase';
import { apiFetchJson } from '../lib/apiClient';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">o continuá con</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full h-10 flex items-center justify-center gap-3 rounded-xl border border-border bg-white text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continuar con Google
      </button>
    </div>
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
        // Username → always goes directly to backend
        const data = await apiFetchJson<{ token: string; user: any }>('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: loginIdentifier, password }),
        });
        onLogin(data.token, data.user);
      } else if (legacyMode) {
        // Email in legacy mode (no Firebase)
        const data = await apiFetchJson<{ token: string; user: any }>('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginIdentifier, password }),
        });
        onLogin(data.token, data.user);
      } else {
        // Email with Firebase
        const firebaseUser = await signInWithEmail(loginIdentifier, password);
        if (!firebaseUser.emailVerified) {
          await resendVerificationEmail(firebaseUser).catch(() => {});
          await firebaseSignOut();
          throw new Error(`Email no verificado. Te reenviamos el link a ${firebaseUser.email}. Revisá tu bandeja (y spam).`);
        }
        const { token, user } = await resolveFirebaseSession();
        onLogin(token, user);
      }
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found'
        ? 'Email o contraseña incorrectos.'
        : err.message ?? 'Error al iniciar sesión.';
      toast.show(msg, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.show('Las contraseñas no coinciden.', { variant: 'error' });
      return;
    }
    if (password.length < 8) {
      toast.show('La contraseña debe tener al menos 8 caracteres.', { variant: 'error' });
      return;
    }
    setLoading(true);
    try {
      if (legacyMode) {
        const data = await apiFetchJson<{ token: string; user: any }>('/api/auth/register-org', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgName: name, ownerName: name, ownerEmail: email, ownerPassword: password }),
        });
        onLogin(data.token, data.user);
      } else {
        await registerWithEmail(email, password);
        // Sign out immediately — session is blocked until email is verified
        await firebaseSignOut();
        toast.show('Te enviamos un email de verificación. Confirmá tu cuenta e ingresá.', { variant: 'success' });
        switchView('login');
      }
    } catch (err: any) {
      const msg = err.code === 'auth/email-already-in-use'
        ? 'Ese email ya está registrado.'
        : err.message ?? 'Error al registrarse.';
      toast.show(msg, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.show('Ingresá tu email primero.', { variant: 'error' }); return; }
    setLoading(true);
    try {
      await resetPassword(email);
      toast.show('Email de recuperación enviado.', { variant: 'success' });
      setView('login');
    } catch {
      toast.show('Error al enviar email de recuperación.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const switchView = (v: View) => {
    setView(v);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">

      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto shadow-sm">
            <img src="/logo.png" alt="Boti" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Boti</h1>
          <p className="text-sm text-muted-foreground">
            {view === 'login' && 'Ingresá a tu cuenta'}
            {view === 'register' && 'Creá tu cuenta gratis · 15 días de prueba'}
            {view === 'reset' && 'Recuperar contraseña'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">

          {/* ── RESET PASSWORD ── */}
          {view === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Te enviamos un link para restablecer tu contraseña.
              </p>
              <FormInput
                label="Email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
              />
              <Button type="submit" variant="primary" size="md" className="w-full" disabled={loading}>
                {loading ? 'Enviando…' : 'Enviar link'}
              </Button>
              <button
                type="button"
                onClick={() => switchView('login')}
                className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
              >
                Volver al inicio
              </button>
            </form>
          )}

          {/* ── LOGIN / REGISTER ── */}
          {view !== 'reset' && (
            <>
              {/* ── REGISTER FORM ── */}
              {view === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <FormInput
                    label="Nombre"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Tu nombre o empresa"
                    required
                  />
                  <FormInput
                    label="Email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                  />
                  <FormInput
                    label="Contraseña"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                  <FormInput
                    label="Confirmar contraseña"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <Button type="submit" variant="primary" size="md" className="w-full" disabled={loading}>
                    {loading ? 'Creando cuenta…' : 'Crear cuenta gratis'}
                  </Button>
                  <GoogleButton onClick={handleGoogleSignIn} disabled={loading} />
                </form>
              )}

              {/* ── LOGIN EMAIL FORM ── */}
              {view === 'login' && (
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <FormInput
                    label="Email o nombre de usuario"
                    type="text"
                    value={loginIdentifier}
                    onChange={e => setLoginIdentifier(e.target.value)}
                    placeholder="tu@email.com o tu.usuario"
                    required
                  />
                  <FormInput
                    label="Contraseña"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  {isFirebaseEnabled && (
                    <button
                      type="button"
                      onClick={() => switchView('reset')}
                      className="text-xs text-primary hover:underline w-full text-right"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                  <Button type="submit" variant="primary" size="md" className="w-full" disabled={loading}>
                    {loading ? 'Ingresando…' : 'Ingresar'}
                  </Button>
                  <GoogleButton onClick={handleGoogleSignIn} disabled={loading} />
                </form>
              )}

              {/* Toggle login / register */}
              <div className="text-center text-xs text-muted-foreground pt-1">
                {view === 'login' ? (
                  <>
                    ¿No tenés cuenta?{' '}
                    <button
                      onClick={() => switchView('register')}
                      className="text-primary hover:underline font-medium"
                    >
                      Registrarse gratis
                    </button>
                  </>
                ) : (
                  <>
                    ¿Ya tenés cuenta?{' '}
                    <button
                      onClick={() => switchView('login')}
                      className="text-primary hover:underline font-medium"
                    >
                      Ingresar
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
