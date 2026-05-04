import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  price: string;
  badge?: string;
  highlighted?: boolean;
  features: string[];
  cta: string;
  ctaVariant: 'primary' | 'outline';
}

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
  const conv = p.maxConversationsPerMonth === -1
    ? 'Conversaciones ilimitadas'
    : `${p.maxConversationsPerMonth.toLocaleString('es-PY')} conversaciones/mes`;
  const features: string[] = [lines, 'IA conversacional avanzada', users, conv];
  if (p.slug !== 'trial') features.push('Pagos PagoPar', 'Facturación electrónica');

  const badges: Record<string, string> = { trial: `${p.trialDays} días gratis`, basico: 'Más popular' };
  const ctas: Record<string, string> = { trial: 'Empezar gratis', basico: 'Elegir Básico', pro: 'Elegir Pro' };

  return {
    id: p.id,
    name: p.name,
    price: p.trialDays > 0 ? `Gratis · ${p.trialDays} días` : formatPrice(p.price),
    badge: badges[p.slug],
    highlighted: p.slug === 'basico',
    features,
    cta: ctas[p.slug] ?? `Elegir ${p.name}`,
    ctaVariant: p.slug === 'basico' ? 'primary' : 'outline',
  };
}

const STATIC_PLANS: Plan[] = [
  {
    id: 'trial',
    name: 'Trial',
    price: 'Gratis · 15 días',
    badge: '15 días gratis',
    features: [
      '1 línea WhatsApp',
      'IA conversacional avanzada',
      'Hasta 2 usuarios',
      '100 conversaciones/mes',
    ],
    cta: 'Empezar gratis',
    ctaVariant: 'outline',
  },
  {
    id: 'basico',
    name: 'Básico',
    price: 'Gs. 150.000/mes',
    badge: 'Más popular',
    highlighted: true,
    features: [
      '1 línea WhatsApp',
      'IA conversacional avanzada',
      'Hasta 5 usuarios',
      '500 conversaciones/mes',
      'Pagos PagoPar',
      'Facturación electrónica',
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
      'IA conversacional avanzada',
      'Hasta 10 usuarios',
      'Conversaciones ilimitadas',
      'Pagos PagoPar',
      'Facturación electrónica',
    ],
    cta: 'Elegir Pro',
    ctaVariant: 'outline',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

function useIsAuthenticated() {
  return !!localStorage.getItem('token');
}

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transition = 'opacity 500ms cubic-bezier(0.22,1,0.36,1), transform 500ms cubic-bezier(0.22,1,0.36,1)';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return ref;
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav
// ─────────────────────────────────────────────────────────────────────────────

function Nav() {
  const isAuthenticated = useIsAuthenticated();
  const scrolled = useScrolled();
  return (
    <nav
      aria-label="Navegación principal"
      className={`fixed top-0 left-0 right-0 z-sticky transition-all duration-300 ease-premium ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-glass border-b border-outline-variant/30'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-action flex-shrink-0 flex items-center justify-center shadow-action-glow-sm">
            <img src="/logo.png" alt="Boti" className="w-6 h-6 object-contain brightness-0 invert" />
          </div>
          <span className={`font-bold text-xl tracking-tight transition-colors duration-300 ${scrolled ? 'text-on-surface' : 'text-white'}`}>
            Boti
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a href="#pricing" className={`hidden sm:block text-sm font-medium transition-colors duration-200 ${scrolled ? 'text-on-surface/70 hover:text-action' : 'text-white/70 hover:text-white'}`}>
            Precios
          </a>
          <Link to={isAuthenticated ? '/dashboard' : '/login'}>
            <Button variant="primary" size="sm" trailingIcon={isAuthenticated ? 'arrow_forward' : undefined}>
              {isAuthenticated ? 'Ir al dashboard' : 'Iniciar sesión'}
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Mockup
// ─────────────────────────────────────────────────────────────────────────────

function ProductMockup() {
  return (
    <div className="relative animate-float" style={{ animationDelay: '200ms' }}>
      {/* Glow behind */}
      <div aria-hidden className="absolute inset-0 -m-8 rounded-3xl bg-action/20 blur-3xl" />

      <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-glass-xl bg-[#0F1923]" style={{ minHeight: '360px' }}>
        {/* Browser chrome */}
        <div className="h-10 bg-[#151E2A] flex items-center gap-2 px-4 border-b border-white/5">
          <span className="w-3 h-3 rounded-full bg-red-400/80" />
          <span className="w-3 h-3 rounded-full bg-yellow-400/80" />
          <span className="w-3 h-3 rounded-full bg-green-400/80" />
          <div className="flex-1 bg-white/5 rounded-full px-3 py-1 text-[11px] text-white/30 mx-3 truncate">
            app.mindtechpy.net/messages
          </div>
        </div>

        {/* App content */}
        <div className="flex" style={{ height: '320px' }}>
          {/* Contact list */}
          <div className="w-44 border-r border-white/5 p-3 space-y-1.5 flex-shrink-0 overflow-hidden bg-[#111924]">
            {[
              { name: 'Ana García', msg: '¿Tienen stock?', active: true, time: '10:32' },
              { name: 'Carlos M.', msg: 'Perfecto, gracias', active: false, time: '10:28' },
              { name: 'María P.', msg: 'Quiero el plan Pro', active: false, time: '09:55' },
            ].map((c) => (
              <div
                key={c.name}
                className={`flex items-center gap-2 rounded-xl px-2 py-2 cursor-pointer ${c.active ? 'bg-action/20' : 'hover:bg-white/5'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${c.active ? 'bg-action text-white' : 'bg-white/10 text-white/60'}`}>
                  {c.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center">
                    <p className="text-[11px] font-semibold text-white/80 truncate">{c.name}</p>
                    <span className="text-[9px] text-white/30">{c.time}</span>
                  </div>
                  <p className="text-[10px] text-white/40 truncate">{c.msg}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col bg-[#0F1923]">
            {/* Chat header */}
            <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2.5 bg-[#111924]">
              <div className="w-7 h-7 rounded-full bg-action flex items-center justify-center text-[11px] font-bold text-white">A</div>
              <div>
                <p className="text-[12px] font-semibold text-white/90">Ana García</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-soft" />
                  <p className="text-[10px] text-green-400/80">IA activa</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-3 space-y-2.5 overflow-hidden">
              <div className="flex justify-start">
                <div className="bg-white/8 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[75%] border border-white/5">
                  <p className="text-[11px] text-white/80">¿Tienen stock del iPhone 15 Pro?</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="relative bg-action rounded-2xl rounded-tr-sm px-3 py-2 max-w-[75%] shadow-action-glow-sm">
                  <p className="text-[11px] text-white leading-relaxed">¡Hola Ana! Sí, tenemos disponibilidad en todas las capacidades. ¿Te enviamos el catálogo completo con precios?</p>
                  <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-green-400 border-2 border-[#0F1923] animate-pulse-soft" aria-label="IA respondiendo" />
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white/8 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[75%] border border-white/5">
                  <p className="text-[11px] text-white/80">Sí, y también el link de pago</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-action rounded-2xl rounded-tr-sm px-3 py-2 max-w-[75%] shadow-action-glow-sm">
                  <p className="text-[11px] text-white leading-relaxed">Perfecto! Te comparto el catálogo y el link de pago seguro de PagoPar. ¡Muy fácil!</p>
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/5">
              <div className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/25 bg-white/5">
                Escribí un mensaje...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function HeroSection() {
  const isAuthenticated = useIsAuthenticated();
  return (
    <section className="relative overflow-hidden bg-hero-gradient min-h-[90vh] flex items-center pt-20 pb-16">
      {/* Background orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-action/10 blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full bg-blue-500/8 blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-px bg-gradient-to-r from-transparent via-action/20 to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center w-full">
        {/* Left: copy */}
        <div className="lg:col-span-6 animate-fade-in-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-action/15 border border-action/30 text-action text-caption font-semibold mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-action animate-pulse-soft" aria-hidden />
            Automatización inteligente para PYMES
          </div>

          <h1 className="text-display-md lg:text-display-lg text-white leading-none mb-6">
            Automatizá tu{' '}
            <span className="relative">
              <span className="text-action">WhatsApp</span>
            </span>
            <br />
            con{' '}
            <span className="text-action">Inteligencia</span>
            <br />
            <span className="text-action">Artificial</span>
          </h1>

          <p className="text-body-lg text-white/65 max-w-lg mb-10 leading-relaxed">
            Conectá múltiples líneas, respondé con IA las 24&nbsp;hs y gestioná
            todo tu equipo desde un solo panel. La solución que tu negocio necesita.
          </p>

          <div className="flex flex-wrap gap-3 mb-8">
            <Link to={isAuthenticated ? '/dashboard' : '/login'}>
              <button className="inline-flex items-center gap-2 h-14 px-8 rounded-xl bg-action text-white font-semibold text-base shadow-action-glow transition-all duration-250 ease-premium hover:bg-action/90 hover:shadow-action-glow hover:-translate-y-0.5 active:translate-y-0">
                {isAuthenticated ? 'Ir al dashboard' : 'Empezar gratis'}
                <Icon name="arrow_forward" size="md" />
              </button>
            </Link>
            {!isAuthenticated && (
              <a href="#pricing">
                <button className="inline-flex items-center gap-2 h-14 px-8 rounded-xl border-2 border-white/20 text-white font-semibold text-base transition-all duration-250 ease-premium hover:border-white/40 hover:bg-white/5 hover:-translate-y-0.5 active:translate-y-0">
                  Ver planes
                </button>
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {['14 días gratis', 'Sin tarjeta de crédito', 'Cancelá cuando quieras'].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-caption text-white/50">
                <Icon name="check_circle" size="xs" className="text-action/80" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right: mockup */}
        <div className="lg:col-span-6" style={{ animationDelay: '150ms' }}>
          <ProductMockup />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats bar
// ─────────────────────────────────────────────────────────────────────────────

function StatsBar() {
  const stats = [
    { value: '500+', label: 'Empresas activas' },
    { value: '2M+', label: 'Mensajes por mes' },
    { value: '98%', label: 'Satisfacción' },
    { value: '<2 min', label: 'Tiempo de respuesta' },
  ];
  return (
    <section className="bg-[#0D2D2A] border-y border-action/20">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x lg:divide-action/15">
          {stats.map((s) => (
            <div key={s.label} className="text-center lg:px-8">
              <div className="text-display-sm text-action font-bold mb-1">{s.value}</div>
              <div className="text-caption text-white/50 uppercase tracking-wider font-semibold">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Features bento
// ─────────────────────────────────────────────────────────────────────────────

function FeaturesSection() {
  const ref = useReveal();
  const cardBase =
    'group bg-white border border-outline-variant/50 shadow-glass rounded-2xl p-6 transition-all duration-250 ease-premium hover:-translate-y-1 hover:shadow-glass-lg hover:border-action/20';

  const features = [
    {
      icon: 'psychology',
      title: 'IA que entiende tu negocio',
      desc: 'Configurá el contexto de tu empresa y la IA responde como un asesor experto. Compatible con GPT-4 y Claude.',
      size: 'lg:col-span-7',
      extra: (
        <div className="mt-5 rounded-xl bg-surface-container-low border border-outline-variant/40 p-4 space-y-2">
          <div className="flex justify-start">
            <div className="bg-action/10 border border-action/15 rounded-2xl rounded-tl-sm px-3 py-2 text-body-sm text-on-surface max-w-xs">
              ¿Tienen stock del producto?
            </div>
          </div>
          <div className="flex justify-end">
            <div className="bg-action rounded-2xl rounded-tr-sm px-3 py-2 text-body-sm text-white max-w-xs shadow-action-glow-sm">
              ¡Hola! Sí, tenemos disponibilidad inmediata. ¿Te enviamos el catálogo?
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: 'smartphone',
      title: 'Múltiples líneas WhatsApp',
      desc: 'Conectá todas las líneas que necesitás. Un panel unificado para todo tu equipo.',
      size: 'lg:col-span-5',
    },
    {
      icon: 'group',
      title: 'Handoff a operadores',
      desc: 'La IA atiende y, si el cliente lo necesita, transfiere a un agente humano con un solo clic.',
      size: 'lg:col-span-4',
    },
    {
      icon: 'payments',
      title: 'Pagos por WhatsApp',
      desc: 'Enviá links de pago PagoPar directo en la conversación. Confirmación automática al instante.',
      size: 'lg:col-span-4',
    },
    {
      icon: 'receipt_long',
      title: 'Facturación electrónica',
      desc: 'Generá facturas SIFEN automáticamente al confirmar cada pago. Cero esfuerzo manual.',
      size: 'lg:col-span-4',
    },
  ];

  return (
    <section className="py-24 bg-surface-container-low/40">
      <div ref={ref} className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-action/8 text-action text-caption font-semibold mb-4 border border-action/15">
            Funcionalidades
          </div>
          <h2 className="text-heading-lg text-on-surface mb-3">
            Todo lo que necesitás en un solo lugar
          </h2>
          <p className="text-body-lg text-on-surface/60 max-w-xl mx-auto">
            Sin configuraciones complicadas. Sin múltiples herramientas. Sin sorpresas.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {features.map((f) => (
            <div key={f.title} className={`col-span-12 ${f.size} ${cardBase}`}>
              <div className="w-11 h-11 rounded-xl bg-action/10 border border-action/15 flex items-center justify-center mb-4 group-hover:bg-action/15 transition-colors duration-250">
                <Icon name={f.icon} size="md" className="text-action" />
              </div>
              <h3 className="text-heading-sm text-on-surface mb-2">{f.title}</h3>
              <p className="text-body text-on-surface/60">{f.desc}</p>
              {f.extra}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// How it works
// ─────────────────────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const ref = useReveal();
  const steps = [
    {
      number: '01',
      icon: 'qr_code_scanner',
      title: 'Conectá tu WhatsApp',
      desc: 'Escaneá el QR desde la app de WhatsApp y tu línea queda activa en menos de 2 minutos.',
    },
    {
      number: '02',
      icon: 'model_training',
      title: 'Configurá la IA',
      desc: 'Contale a Boti de qué trata tu negocio: productos, precios, horarios, preguntas frecuentes y más.',
    },
    {
      number: '03',
      icon: 'bolt',
      title: 'Automatizá y vendé',
      desc: 'La IA atiende las 24 hs, clasifica leads y cierra ventas. Vos te enfocás en lo que importa.',
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div ref={ref} className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-action/8 text-action text-caption font-semibold mb-4 border border-action/15">
            Así funciona
          </div>
          <h2 className="text-heading-lg text-on-surface mb-3">
            En 3 pasos estás listo para crecer
          </h2>
          <p className="text-body-lg text-on-surface/60">
            Configuración simple. Resultados desde el primer día.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
          {/* Connector line (desktop) */}
          <div aria-hidden className="hidden lg:block absolute top-10 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px bg-gradient-to-r from-action/30 via-action/60 to-action/30" />

          {steps.map((step, i) => (
            <div
              key={step.number}
              className="relative text-center"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {/* Number circle */}
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 rounded-full bg-action/8 border-2 border-action/20 flex items-center justify-center mx-auto shadow-action-glow-sm">
                  <Icon name={step.icon} size="xl" className="text-action" />
                </div>
                <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-action text-white text-caption font-bold flex items-center justify-center shadow-action-glow-sm">
                  {i + 1}
                </span>
              </div>

              <h3 className="text-heading-sm text-on-surface mb-3">{step.title}</h3>
              <p className="text-body text-on-surface/60 max-w-xs mx-auto">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Testimonials
// ─────────────────────────────────────────────────────────────────────────────

function TestimonialsSection() {
  const ref = useReveal();
  const testimonials = [
    {
      name: 'Laura Méndez',
      role: 'Dueña · FashionPY',
      avatar: 'L',
      quote:
        'Boti transformó nuestra tienda. Antes perdíamos clientes por responder tarde; ahora la IA atiende de noche y los pedidos llegan solos.',
      rating: 5,
    },
    {
      name: 'Rodrigo Sánchez',
      role: 'Gerente Comercial · DistribuidoraSUR',
      avatar: 'R',
      quote:
        'Los pagos integrados en WhatsApp cambiaron todo. El cliente recibe el link y paga en 2 minutos. Cerrar ventas nunca fue tan fácil.',
      rating: 5,
    },
    {
      name: 'Carla Ortiz',
      role: 'CEO · ServiciosTech',
      avatar: 'C',
      quote:
        'La configuración fue rapidísima. En un día teníamos la IA respondiendo con el tono exacto de nuestra empresa. Súper recomendado.',
      rating: 5,
    },
  ];

  return (
    <section className="py-24 bg-surface-container-low/40">
      <div ref={ref} className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-action/8 text-action text-caption font-semibold mb-4 border border-action/15">
            Testimonios
          </div>
          <h2 className="text-heading-lg text-on-surface mb-3">
            Empresas que ya crecen con Boti
          </h2>
          <p className="text-body-lg text-on-surface/60">
            Más de 500 empresas en Paraguay y Latam ya confían en nosotros.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className="bg-white rounded-2xl border border-outline-variant/50 p-6 shadow-glass hover:shadow-glass-lg hover:-translate-y-1 transition-all duration-250 ease-premium"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Icon key={j} name="star" size="xs" className="text-warning" />
                ))}
              </div>

              <blockquote className="text-body text-on-surface/80 leading-relaxed mb-5">
                "{t.quote}"
              </blockquote>

              <div className="flex items-center gap-3 pt-4 border-t border-outline-variant/40">
                <div className="w-10 h-10 rounded-full bg-action/15 border border-action/20 flex items-center justify-center text-action font-bold text-body-sm flex-shrink-0">
                  {t.avatar}
                </div>
                <div>
                  <div className="text-body-sm font-semibold text-on-surface">{t.name}</div>
                  <div className="text-caption text-on-surface/50">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing
// ─────────────────────────────────────────────────────────────────────────────

function PricingSection() {
  const ref = useReveal();
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
      } catch { /* static fallback */ }
    })();
    return () => controller.abort();
  }, []);

  return (
    <section id="pricing" className="py-24 bg-white">
      <div ref={ref} className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-action/8 text-action text-caption font-semibold mb-4 border border-action/15">
            Precios
          </div>
          <h2 className="text-heading-lg text-on-surface mb-3">
            Planes simples y transparentes
          </h2>
          <p className="text-body-lg text-on-surface/60">
            Empezá gratis. Escalá cuando lo necesitás. Sin contratos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => (
            <div
              key={plan.id}
              className={[
                'relative rounded-2xl p-7 flex flex-col gap-5 transition-all duration-250 ease-premium',
                plan.highlighted
                  ? 'border-2 border-action shadow-glass-lg md:scale-105 bg-white'
                  : 'border border-outline-variant/50 shadow-glass bg-white hover:shadow-glass-lg',
              ].join(' ')}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-action text-white text-caption font-semibold shadow-action-glow-sm">
                    <Icon name="star" size="xs" />
                    {plan.badge}
                  </div>
                </div>
              )}

              {!plan.highlighted && plan.badge && (
                <div className="inline-flex self-start px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface/60 text-caption font-semibold border border-outline-variant/40">
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 className="text-heading-sm text-on-surface">{plan.name}</h3>
                <p className="text-display-sm text-on-surface mt-1.5 font-bold">{plan.price}</p>
              </div>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-body text-on-surface/75">
                    <Icon name="check_circle" size="xs" className="text-action flex-shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>

              <Link to={isAuthenticated ? '/dashboard' : '/login'}>
                <Button variant={plan.highlighted ? 'primary' : 'outline'} size="md" fullWidth>
                  {isAuthenticated ? 'Ir al dashboard' : plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center mt-10 text-body text-on-surface/60">
          ¿Necesitás algo personalizado?{' '}
          <a
            href="https://wa.me/595981586823"
            target="_blank"
            rel="noopener noreferrer"
            className="text-action font-semibold hover:underline underline-offset-2"
          >
            Hablemos por WhatsApp →
          </a>
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: '¿Necesito ser técnico para configurar Boti?',
    a: 'No. La configuración es guiada y visual. En menos de 15 minutos tenés la IA respondiendo mensajes de tu negocio.',
  },
  {
    q: '¿Cómo funciona el período de prueba?',
    a: 'Los primeros 14 días son completamente gratis, sin tarjeta de crédito. Accedés a todas las funciones del plan Trial.',
  },
  {
    q: '¿Mis conversaciones son privadas?',
    a: 'Sí. Todos los datos se almacenan de forma cifrada y nunca son compartidos con terceros.',
  },
  {
    q: '¿Puedo cancelar en cualquier momento?',
    a: 'Sí, podés cancelar tu plan cuando quieras desde el panel de configuración, sin penalizaciones.',
  },
];

function FaqSection() {
  const ref = useReveal();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-24 bg-surface-container-low/40">
      <div ref={ref} className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-heading-lg text-on-surface mb-3">Preguntas frecuentes</h2>
          <p className="text-body-lg text-on-surface/60">Todo lo que necesitás saber antes de empezar.</p>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className={`rounded-2xl border transition-all duration-250 ease-premium overflow-hidden ${
                open === i
                  ? 'border-action/40 shadow-glass-lg bg-white'
                  : 'border-outline-variant/50 bg-white hover:border-action/20'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 cursor-pointer"
                aria-expanded={open === i}
              >
                <span className="text-body-sm font-semibold text-on-surface">{faq.q}</span>
                <Icon
                  name="expand_more"
                  size="sm"
                  className={`text-on-surface/40 flex-shrink-0 transition-transform duration-250 ${open === i ? 'rotate-180 text-action' : ''}`}
                />
              </button>
              <div
                className={`px-6 transition-all duration-250 ease-premium overflow-hidden ${open === i ? 'pb-5 max-h-40' : 'max-h-0'}`}
              >
                <p className="text-body text-on-surface/65 leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA band
// ─────────────────────────────────────────────────────────────────────────────

function CtaBand() {
  const isAuthenticated = useIsAuthenticated();
  return (
    <section className="relative overflow-hidden bg-dark-gradient py-24 text-center">
      {/* Orbs */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-action/15 blur-[60px] rounded-full" />
      </div>

      <div className="relative max-w-2xl mx-auto px-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-action/15 border border-action/30 text-action text-caption font-semibold mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-action animate-pulse-soft" aria-hidden />
          Empezá hoy mismo
        </div>

        <h2 className="text-display-sm text-white mb-5 leading-tight">
          Tu negocio merece responder{' '}
          <span className="text-action">más rápido</span>{' '}
          y vender{' '}
          <span className="text-action">más</span>
        </h2>

        <p className="text-body-lg text-white/60 mb-10 leading-relaxed">
          Únite a más de 500 empresas que ya automatizan su WhatsApp con IA.
          14 días gratis, sin tarjeta de crédito.
        </p>

        <Link to={isAuthenticated ? '/dashboard' : '/login'}>
          <button className="inline-flex items-center gap-2.5 h-14 px-10 rounded-xl bg-action text-white font-semibold text-body-lg shadow-action-glow transition-all duration-250 ease-premium hover:bg-action/90 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-action-glow">
            {isAuthenticated ? 'Ir al dashboard' : 'Crear cuenta gratis'}
            <Icon name="arrow_forward" size="md" />
          </button>
        </Link>

        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {['14 días gratis', 'Sin tarjeta de crédito', 'Soporte incluido'].map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-caption text-white/40">
              <Icon name="check" size="xs" className="text-action/70" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-[#0B1628] text-white">
      <div className="max-w-7xl mx-auto px-6 pt-14 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-action flex-shrink-0 flex items-center justify-center">
                <img src="/logo.png" alt="Boti" className="w-6 h-6 object-contain brightness-0 invert" />
              </div>
              <span className="font-bold text-lg text-white">Boti</span>
            </div>
            <p className="text-body-sm text-white/50 leading-relaxed max-w-xs">
              Automatización de WhatsApp con IA para empresas de Paraguay y Latinoamérica.
            </p>
          </div>

          {/* Producto */}
          <div>
            <h4 className="text-caption font-semibold text-white/40 uppercase tracking-wider mb-5">
              Producto
            </h4>
            <ul className="space-y-3">
              {[
                { label: 'Características', href: '#' },
                { label: 'Precios', href: '#pricing' },
                { label: 'Demo', href: '/login' },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-body-sm text-white/55 hover:text-white transition-colors duration-200">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="text-caption font-semibold text-white/40 uppercase tracking-wider mb-5">
              Empresa
            </h4>
            <ul className="space-y-3">
              {['Contacto', 'Términos', 'Privacidad'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-body-sm text-white/55 hover:text-white transition-colors duration-200">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-caption font-semibold text-white/40 uppercase tracking-wider mb-5">
              Contacto
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://wa.me/595981586823"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-body-sm text-white/55 hover:text-white transition-colors duration-200 flex items-center gap-2"
                >
                  <Icon name="chat_bubble" size="xs" className="text-action/60" />
                  +595 981 586 823
                </a>
              </li>
              <li>
                <a
                  href="mailto:hola@mindtechpy.net"
                  className="text-body-sm text-white/55 hover:text-white transition-colors duration-200 flex items-center gap-2"
                >
                  <Icon name="mail" size="xs" className="text-action/60" />
                  hola@mindtechpy.net
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-caption text-white/30">
            © 2026 Boti · MindTech Paraguay. Todos los derechos reservados.
          </p>
          <p className="text-caption text-white/20">
            Hecho con IA en Paraguay 🇵🇾
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Nav />
      <main>
        <HeroSection />
        <StatsBar />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <PricingSection />
        <FaqSection />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
