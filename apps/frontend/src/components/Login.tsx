import React, { useState } from 'react';
import { Button, FormInput, Icon, useToast } from './ui';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const toast = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setInlineError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      onLogin(data.token, data.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setInlineError(message);
      toast.show(message, { variant: 'error', title: 'Error de autenticación' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 flex-col justify-between bg-primary p-10 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#0d3b4c_0%,_#002532_50%,_#001a22_100%)]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/20 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-container/30 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <span className="material-symbols-rounded text-white text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">Boti</span>
          </div>

          {/* Hero text */}
          <div className="space-y-4">
            <h1 className="text-white text-4xl font-bold leading-tight">
              Automatiza tu<br />atención al cliente<br />con IA
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-sm">
              Plataforma WhatsApp Business con inteligencia artificial para gestionar conversaciones y escalar tu negocio.
            </p>
          </div>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-3">
          {[
            { icon: 'bolt', text: 'Respuestas automáticas con IA' },
            { icon: 'group', text: 'Gestión multiagente en tiempo real' },
            { icon: 'api', text: 'Integración con APIs externas' },
          ].map(f => (
            <div key={f.icon} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-rounded text-white/80 text-[16px]">{f.icon}</span>
              </div>
              <span className="text-white/70 text-sm">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-surface-container-lowest">
        <div className="w-full max-w-sm space-y-8 animate-fade-in-up">
          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-glass">
              <span className="material-symbols-rounded text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div>
              <div className="font-bold text-on-surface text-xl tracking-tight">Boti Platform</div>
              <div className="text-on-surface-variant text-sm">Acceso administrativo</div>
            </div>
          </div>

          {/* Form card */}
          <div>
            <div className="hidden lg:block mb-8">
              <h2 className="text-on-surface text-heading-md font-bold">Bienvenido de nuevo</h2>
              <p className="text-on-surface-variant text-body mt-1">Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {inlineError && (
                <div role="alert" className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-body-sm">
                  <Icon name="error" size="sm" className="flex-shrink-0" />
                  {inlineError}
                </div>
              )}

              <FormInput
                label="Correo electrónico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                floatingLabel
                autoComplete="email"
                status={inlineError ? 'error' : 'default'}
                required
              />

              <FormInput
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                floatingLabel
                autoComplete="current-password"
                status={inlineError ? 'error' : 'default'}
                required
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                loading={loading}
                className="mt-2"
              >
                {loading ? 'Ingresando...' : 'Ingresar al panel'}
              </Button>
            </form>
          </div>

          <p className="text-center text-on-surface-variant/50 text-caption">
            Boti Platform · Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
