import React, { useState } from 'react';
import { Button, Card, FormInput, Icon, useToast } from './ui';

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
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden px-4">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px]" />
      </div>

      <Card
        variant="glass-elevated"
        padding="lg"
        className="w-full max-w-md shadow-glass-xl relative z-base animate-fade-in-up"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Icon name="smart_toy" size="xl" className="text-primary" filled />
          </div>
          <h1 className="text-display-sm text-primary uppercase">Boti Platform</h1>
          <p className="text-body text-on-surface-variant mt-2">Acceso administrativo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {inlineError && (
            <div
              role="alert"
              className="p-3 bg-error-container border border-error/20 rounded-xl text-body-sm text-on-error-container flex items-center gap-2"
            >
              <Icon name="error" size="sm" />
              <span>{inlineError}</span>
            </div>
          )}

          <FormInput
            label="Email corporativo"
            floatingLabel
            type="email"
            autoComplete="email"
            required
            status={inlineError ? 'error' : 'default'}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <FormInput
            label="Contraseña"
            floatingLabel
            type="password"
            autoComplete="current-password"
            required
            status={inlineError ? 'error' : 'default'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            {loading ? 'Autenticando…' : 'Entrar al panel'}
          </Button>
        </form>

        <p className="text-center text-overline text-on-surface-variant uppercase mt-8 opacity-60">
          Powered by DeepMind Agents · v2.0.0
        </p>
      </Card>
    </div>
  );
};

export default Login;
