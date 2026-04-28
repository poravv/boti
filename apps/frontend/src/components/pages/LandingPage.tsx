import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface Plan {
  id: string;
  name: string;
  price: string;
  badge?: string;
  highlighted?: boolean;
  features: string[];
  cta: string;
  ctaVariant: 'primary' | 'secondary';
}

// ------------------------------------------------------------------
// DB plan → display plan mapping
// ------------------------------------------------------------------
interface DbPlan {
  id: string; name: string; slug: string; price: number;
  maxLines: number; maxUsers: number; maxConversationsPerMonth: number; trialDays: number;
}

function formatPrice(p: number): string {
  if (p === 0) return 'Gratis';
  return `Gs. ${p.toLocaleString('es-PY')}/mes`;
}

function dbPlanToDisplay(p: DbPlan): Plan {
  const lines = p.maxLines === -1 ? 'Líneas ilimitadas' : `${p.maxLines} línea${p.maxLines > 1 ? 's' : ''} WhatsApp`;
  const users = p.maxUsers === -1 ? 'Usuarios ilimitados' : `Hasta ${p.maxUsers} usuarios`;
  const conv = p.maxConversationsPerMonth === -1 ? 'Conversaciones ilimitadas' : `${p.maxConversationsPerMonth.toLocaleString('es-PY')} conversaciones/mes`;
  const features: string[] = [lines, 'IA con inteligencia artificial', users, conv];
  if (p.slug !== 'trial') features.push('Pagos PagoPar', 'APIs externas');

  const badges: Record<string, string> = { trial: `${p.trialDays} días gratis`, basico: '⭐ Más popular' };
  const ctas: Record<string, string> = { trial: 'Empezar gratis', basico: 'Elegir Básico', pro: 'Elegir Pro' };

  return {
    id: p.id,
    name: p.name,
    price: p.trialDays > 0 ? `Gratis · ${p.trialDays} días` : formatPrice(p.price),
    badge: badges[p.slug],
    highlighted: p.slug === 'basico',
    features,
    cta: ctas[p.slug] ?? `Elegir ${p.name}`,
    ctaVariant: p.slug === 'basico' ? 'primary' : 'secondary',
  };
}

// ------------------------------------------------------------------
// Static plan fallback (mirrors DB seed — shown while fetch is pending)
// ------------------------------------------------------------------
const STATIC_PLANS: Plan[] = [
  {
    id: 'trial',
    name: 'Trial',
    price: 'Gratis · 15 días',
    badge: '15 días gratis',
    features: [
      '1 línea WhatsApp',
      'IA con inteligencia artificial',
      'Hasta 2 usuarios',
      '100 conversaciones/mes',
    ],
    cta: 'Empezar gratis',
    ctaVariant: 'secondary',
  },
  {
    id: 'basico',
    name: 'Básico',
    price: 'Gs. 150.000/mes',
    badge: '⭐ Más popular',
    highlighted: true,
    features: [
      '1 línea WhatsApp',
      'IA con inteligencia artificial',
      'Hasta 5 usuarios',
      '500 conversaciones/mes',
      'Pagos PagoPar',
      'APIs externas',
    ],
    cta: 'Elegir Básico',
    ctaVariant: 'primary',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'Gs. 350.000/mes',
    features: [
      '3 líneas WhatsApp',
      'IA con inteligencia artificial',
      'Hasta 10 usuarios',
      'Conversaciones ilimitadas',
      'Pagos PagoPar',
      'APIs externas',
    ],
    cta: 'Elegir Pro',
    ctaVariant: 'secondary',
  },
];

// ------------------------------------------------------------------
// Sticky Nav
// ------------------------------------------------------------------
function useIsAuthenticated() {
  return !!localStorage.getItem('token');
}

function Nav() {
  const isAuthenticated = useIsAuthenticated();
  return (
    <nav
      className="sticky top-0 z-sticky backdrop-blur-xl bg-white/70 border-b border-outline-variant/20"
      aria-label="Navegación principal"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full overflow-hidden bg-white flex-shrink-0">
            <img src="/logo.png" alt="Boti" className="w-full h-full object-cover" />
          </span>
          <span className="font-bold text-xl text-primary tracking-tight">Boti</span>
        </div>
        <Link to={isAuthenticated ? '/dashboard' : '/login'}>
          <Button variant="secondary" size="sm" trailingIcon={isAuthenticated ? 'arrow_forward' : undefined}>
            {isAuthenticated ? 'Ir al dashboard' : 'Iniciar sesión'}
          </Button>
        </Link>
      </div>
    </nav>
  );
}

// ------------------------------------------------------------------
// Browser Mockup (Hero visual)
// ------------------------------------------------------------------
function BrowserMockup() {
  return (
    <div className="rounded-2xl shadow-glass-xl border border-outline-variant/30 overflow-hidden animate-fade-in-up" style={{ animationDelay: '150ms' }}>
      {/* Browser chrome */}
      <div className="h-10 bg-surface-container-high/80 flex items-center gap-2 px-4 border-b border-outline-variant/20">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-yellow-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        <div className="flex-1 bg-white/60 rounded-full px-3 py-1 text-caption text-on-surface/50 mx-2 truncate">
          mindtechpy.net/messages
        </div>
      </div>

      {/* App content */}
      <div className="bg-surface flex" style={{ height: '320px' }}>
        {/* Contact sidebar */}
        <div className="w-44 border-r border-outline-variant/20 p-3 space-y-1 flex-shrink-0 overflow-hidden">
          {[
            { name: 'Ana García', msg: '¿Tienen stock?' },
            { name: 'Carlos M.', msg: 'Perfecto, gracias' },
            { name: 'María P.', msg: 'Quiero el plan Pro' },
          ].map((contact, i) => (
            <div
              key={contact.name}
              className={`flex items-center gap-2 rounded-xl px-2 py-2 cursor-pointer transition-all duration-250 ease-premium ${i === 0 ? 'bg-primary/10' : 'hover:bg-surface-container-low'}`}
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-caption font-semibold text-primary">{contact.name[0]}</span>
              </div>
              <div className="min-w-0">
                <p className="text-caption font-semibold text-on-surface truncate">{contact.name}</p>
                <p className="text-caption text-on-surface/50 truncate">{contact.msg}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-3 space-y-2 overflow-hidden">
            {/* Incoming */}
            <div className="flex justify-start">
              <div className="bg-primary/10 rounded-2xl rounded-tl-sm px-3 py-2 max-w-xs">
                <p className="text-caption text-on-surface">¿Tienen stock del producto?</p>
              </div>
            </div>
            {/* AI response */}
            <div className="flex justify-end">
              <div className="relative bg-primary rounded-2xl rounded-tr-sm px-3 py-2 max-w-xs">
                <p className="text-caption text-white">¡Hola! Sí, tenemos disponibilidad inmediata. ¿Te envío el catálogo?</p>
                <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-green-400 animate-pulse-soft border-2 border-white" aria-label="IA procesando" />
              </div>
            </div>
            {/* Incoming */}
            <div className="flex justify-start">
              <div className="bg-primary/10 rounded-2xl rounded-tl-sm px-3 py-2 max-w-xs">
                <p className="text-caption text-on-surface">Sí por favor</p>
              </div>
            </div>
            {/* AI response */}
            <div className="flex justify-end">
              <div className="bg-primary rounded-2xl rounded-tr-sm px-3 py-2 max-w-xs">
                <p className="text-caption text-white">Perfecto, te comparto el link de pago también. ¡Es muy fácil!</p>
              </div>
            </div>
          </div>

          {/* Input bar */}
          <div className="p-3 border-t border-outline-variant/20">
            <div className="rounded-xl border border-outline-variant/40 px-4 py-2 text-body-sm text-on-surface/40 bg-surface-container-lowest">
              Escribí un mensaje...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Hero Section
// ------------------------------------------------------------------
function HeroSection() {
  const isAuthenticated = useIsAuthenticated();
  return (
    <section className="relative overflow-hidden py-16 lg:py-24">
      {/* Decorative blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-72 h-72 rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Text column */}
        <div className="lg:col-span-6 animate-fade-in-up">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-caption font-semibold mb-6">
            <span aria-hidden>✦</span>
            Automatización inteligente
          </div>

          <h1 className="text-display-md lg:text-display-lg font-bold text-on-surface">
            Automatizá tu WhatsApp
            <br />
            <span className="text-primary">con Inteligencia Artificial</span>
          </h1>

          <p className="text-body-lg text-on-surface/70 max-w-xl mt-4">
            Conectá múltiples líneas, respondé con IA y gestioná tu equipo
            desde un solo panel.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={isAuthenticated ? '/dashboard' : '/login'}>
              <Button variant="primary" size="lg" trailingIcon="arrow_forward">
                {isAuthenticated ? 'Ir al dashboard' : 'Empezar gratis'}
              </Button>
            </Link>
            {!isAuthenticated && (
              <a href="#pricing">
                <Button variant="secondary" size="lg">Ver planes</Button>
              </a>
            )}
          </div>

          <p className="mt-6 text-caption text-on-surface/50">
            ✓ 14 días gratis &nbsp;·&nbsp; ✓ Sin tarjeta de crédito &nbsp;·&nbsp; ✓ Cancelá cuando quieras
          </p>
        </div>

        {/* Visual column */}
        <div className="lg:col-span-6">
          <BrowserMockup />
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Social Proof Bar
// ------------------------------------------------------------------
function SocialProofBar() {
  const companies = ['RetailPY', 'LogísticaUY', 'ServiciosBR', 'ComercialAR', 'TechCO'];
  return (
    <section className="py-8 border-y border-outline-variant/20 bg-surface-container-low/50">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <p className="text-caption text-on-surface/50 mb-6 font-semibold tracking-wider uppercase">
          Empresas en Paraguay y Latam ya confían en Boti
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8">
          {companies.map((name) => (
            <span key={name} className="text-body-sm font-semibold text-on-surface/30">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Features Bento Grid
// ------------------------------------------------------------------
function FeaturesSection() {
  const cardBase =
    'bg-white/70 backdrop-blur-xl border border-outline-variant/20 shadow-glass rounded-2xl p-6 transition-all duration-250 ease-premium hover:-translate-y-1 hover:shadow-glass-lg';

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-heading-lg text-center text-on-surface">
          Todo lo que necesitás en un solo lugar
        </h2>
        <p className="text-center text-body text-on-surface/60 mt-3 mb-12">
          Sin configuraciones complicadas. Sin múltiples herramientas.
        </p>

        <div className="grid grid-cols-12 gap-4">
          {/* Card 1 — Large: IA Conversacional */}
          <div className={`col-span-12 lg:col-span-7 ${cardBase}`}>
            <span className="material-symbols-rounded text-primary mb-4 block" style={{ fontSize: '32px', fontVariationSettings: "'FILL' 0" }}>
              psychology
            </span>
            <h3 className="text-heading-sm text-on-surface mb-2">IA que entiende tu negocio</h3>
            <p className="text-body text-on-surface/60 mb-6">
              Configurá el contexto de tu empresa y la IA responde como un asesor
              experto. Compatible con OpenAI y Claude.
            </p>
            {/* Mini chat visual */}
            <div className="bg-surface rounded-xl p-4 space-y-2 border border-outline-variant/20">
              <div className="flex justify-start">
                <div className="bg-primary/10 rounded-2xl rounded-tl-sm px-3 py-2 text-body-sm text-on-surface max-w-xs">
                  ¿Tienen stock del producto?
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-primary rounded-2xl rounded-tr-sm px-3 py-2 text-body-sm text-white max-w-xs">
                  ¡Hola! Sí, tenemos disponibilidad. ¿Te enviamos el catálogo ahora?
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 — Multi-línea */}
          <div className={`col-span-12 lg:col-span-5 ${cardBase}`}>
            <span className="material-symbols-rounded text-primary mb-4 block" style={{ fontSize: '32px', fontVariationSettings: "'FILL' 0" }}>
              smartphone
            </span>
            <h3 className="text-heading-sm text-on-surface mb-2">Múltiples líneas WhatsApp</h3>
            <p className="text-body text-on-surface/60">
              Conectá tantas líneas como necesitás y gestioná todas las
              conversaciones desde un panel unificado.
            </p>
          </div>

          {/* Card 3 — Equipo */}
          <div className={`col-span-12 lg:col-span-4 ${cardBase}`}>
            <span className="material-symbols-rounded text-primary mb-4 block" style={{ fontSize: '32px', fontVariationSettings: "'FILL' 0" }}>
              group
            </span>
            <h3 className="text-heading-sm text-on-surface mb-2">Handoff a operadores</h3>
            <p className="text-body text-on-surface/60">
              La IA atiende, y si es necesario transfiere a un humano con un clic.
            </p>
          </div>

          {/* Card 4 — Pagos */}
          <div className={`col-span-12 lg:col-span-4 ${cardBase}`}>
            <span className="material-symbols-rounded text-primary mb-4 block" style={{ fontSize: '32px', fontVariationSettings: "'FILL' 0" }}>
              payments
            </span>
            <h3 className="text-heading-sm text-on-surface mb-2">Pagos por WhatsApp</h3>
            <p className="text-body text-on-surface/60">
              Enviá links de pago de PagoPar directo en la conversación.
              Confirmación automática.
            </p>
          </div>

          {/* Card 5 — Facturación */}
          <div className={`col-span-12 lg:col-span-4 ${cardBase}`}>
            <span className="material-symbols-rounded text-primary mb-4 block" style={{ fontSize: '32px', fontVariationSettings: "'FILL' 0" }}>
              receipt_long
            </span>
            <h3 className="text-heading-sm text-on-surface mb-2">Facturación electrónica</h3>
            <p className="text-body text-on-surface/60">
              Generá facturas automáticamente al confirmar un pago. Sin esfuerzo
              manual.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// How It Works
// ------------------------------------------------------------------
function HowItWorksSection() {
  const steps = [
    {
      number: '1',
      title: 'Conectá tu WhatsApp',
      desc: 'Escaneá el QR y tu línea queda activa en minutos.',
    },
    {
      number: '2',
      title: 'Configurá la IA',
      desc: 'Contale a Boti de qué se trata tu negocio. Subí contexto, preguntas frecuentes y más.',
    },
    {
      number: '3',
      title: 'Automatizá',
      desc: 'La IA atiende, clasifica y responde. Vos te enfocás en cerrar ventas.',
    },
  ];

  return (
    <section className="py-24 bg-surface-container-low/30">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-heading-lg text-center text-on-surface mb-16">
          En 3 pasos estás listo
        </h2>

        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8 lg:gap-0">
          {steps.map((step, index) => (
            <div key={step.number} className="flex lg:flex-col lg:flex-1 items-start lg:items-center gap-4 lg:text-center lg:px-8">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-body-lg">
                {step.number}
              </div>

              {/* Dashed connector (desktop only) */}
              {index < steps.length - 1 && (
                <div
                  aria-hidden
                  className="hidden lg:block absolute"
                  style={{
                    /* connector drawn via the parent's border trick below */
                  }}
                />
              )}

              <div>
                <h3 className="text-heading-sm text-on-surface mb-1">{step.title}</h3>
                <p className="text-body text-on-surface/60">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop dashed connectors overlay */}
        <div aria-hidden className="hidden lg:flex justify-center mt-[-6rem] mb-[6rem] pointer-events-none">
          {/* The step circles above handle visual; the line below sits between them */}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Pricing Section
// ------------------------------------------------------------------
function PricingSection() {
  const isAuthenticated = useIsAuthenticated();
  const [plans, setPlans] = useState<Plan[]>(STATIC_PLANS);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/plans', { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json() as { plans?: DbPlan[] };
        if (Array.isArray(data?.plans) && data.plans.length > 0) {
          setPlans(data.plans.map(dbPlanToDisplay));
        }
      } catch {
        // Network error or aborted — static fallback already in state
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <section id="pricing" className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-heading-lg text-center text-on-surface mb-3">
          Planes simples y transparentes
        </h2>
        <p className="text-center text-body text-on-surface/60 mb-12">
          Empezá gratis. Escalá cuando lo necesitás.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={[
                'rounded-2xl border p-6 flex flex-col gap-4 transition-all duration-250 ease-premium',
                plan.highlighted
                  ? 'border-2 border-primary shadow-glass-lg md:scale-105 bg-white'
                  : 'border-outline-variant/30 shadow-glass bg-white/70 backdrop-blur-xl',
              ].join(' ')}
            >
              {plan.badge && (
                <div className={`inline-flex self-start px-3 py-1 rounded-full text-caption font-semibold ${plan.highlighted ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface/60'}`}>
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 className="text-heading-sm text-on-surface">{plan.name}</h3>
                <p className="text-display-sm text-on-surface mt-1">{plan.price}</p>
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-body text-on-surface/70">
                    <span className="material-symbols-rounded text-primary flex-shrink-0 mt-px" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    {feat}
                  </li>
                ))}
              </ul>

              <Link to={isAuthenticated ? '/dashboard' : '/login'}>
                <Button variant={plan.ctaVariant} size="md" fullWidth>
                  {isAuthenticated ? 'Ir al dashboard' : plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center mt-8 text-body text-on-surface/60">
          ¿Necesitás algo personalizado?{' '}
          <a
            href="https://wa.me/595981586823"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-semibold hover:underline"
          >
            Escribinos por WhatsApp →
          </a>
        </p>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Final CTA Band
// ------------------------------------------------------------------
function CtaBand() {
  const isAuthenticated = useIsAuthenticated();
  return (
    <section className="py-20 bg-primary text-center">
      <div className="max-w-2xl mx-auto px-6">
        <h2 className="text-display-sm text-white mb-4">
          Empezá a automatizar hoy
        </h2>
        <p className="text-body-lg text-white/80 mb-8">
          14 días gratis. Sin tarjeta de crédito. Cancelá cuando quieras.
        </p>
        <Link to={isAuthenticated ? '/dashboard' : '/login'}>
          <button className="inline-flex items-center gap-2 h-14 px-8 rounded-xl bg-white text-primary font-semibold text-body-lg shadow-glass transition-all duration-250 ease-premium hover:bg-surface hover:-translate-y-0.5 hover:shadow-glass-lg active:translate-y-0">
            {isAuthenticated ? 'Ir al dashboard' : 'Crear cuenta gratis'}
            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>arrow_forward</span>
          </button>
        </Link>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Footer
// ------------------------------------------------------------------
function Footer() {
  return (
    <footer className="bg-on-surface text-inverse-on-surface py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full overflow-hidden bg-white flex-shrink-0">
                <img src="/logo.png" alt="Boti" className="w-full h-full object-cover" />
              </span>
              <span className="font-bold text-lg text-white">Boti</span>
            </div>
            <p className="text-body text-inverse-on-surface/60">
              Automatización de WhatsApp con IA para empresas.
            </p>
          </div>

          {/* Producto */}
          <div>
            <h4 className="text-caption font-semibold text-inverse-on-surface/50 uppercase tracking-wider mb-4">
              Producto
            </h4>
            <ul className="space-y-2">
              {['Características', 'Precios', 'Demo'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-body text-inverse-on-surface/70 hover:text-white transition-colors duration-250">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="text-caption font-semibold text-inverse-on-surface/50 uppercase tracking-wider mb-4">
              Empresa
            </h4>
            <ul className="space-y-2">
              {['Contacto', 'Términos', 'Privacidad'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-body text-inverse-on-surface/70 hover:text-white transition-colors duration-250">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-caption font-semibold text-inverse-on-surface/50 uppercase tracking-wider mb-4">
              Contacto
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://wa.me/595981586823"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-body text-inverse-on-surface/70 hover:text-white transition-colors duration-250 flex items-center gap-1.5"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>chat</span>
                  +595 981 586823
                </a>
              </li>
              <li>
                <a
                  href="mailto:hola@mindtechpy.net"
                  className="text-body text-inverse-on-surface/70 hover:text-white transition-colors duration-250 flex items-center gap-1.5"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>mail</span>
                  hola@mindtechpy.net
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 text-caption text-inverse-on-surface/40 text-center">
          © 2026 Boti. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}

// ------------------------------------------------------------------
// Scroll-reveal hook (lightweight, no deps)
// ------------------------------------------------------------------
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('animate-fade-in-up');
          el.style.opacity = '1';
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    el.style.opacity = '0';
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

// ------------------------------------------------------------------
// Root export
// ------------------------------------------------------------------
export function LandingPage() {
  const featuresRef = useReveal();
  const howRef = useReveal();
  const pricingRef = useReveal();

  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      <main>
        <HeroSection />
        <SocialProofBar />
        <div ref={featuresRef}>
          <FeaturesSection />
        </div>
        <div ref={howRef}>
          <HowItWorksSection />
        </div>
        <div ref={pricingRef}>
          <PricingSection />
        </div>
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
