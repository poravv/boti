/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Base UI tokens (shadcn-compatible) ───────────────────────
        border: '#E2E8F0',
        input: '#F1F5F9',
        ring: '#0D9488',
        background: '#F8FAFC',
        foreground: '#0F172A',

        // ─── Brand palette ────────────────────────────────────────────
        primary: {
          DEFAULT: '#0D9488',
          foreground: '#FFFFFF',
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        secondary: {
          DEFAULT: '#1E293B',
          foreground: '#FFFFFF',
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#64748B',
        },
        accent: {
          DEFAULT: '#F8FAFC',
          foreground: '#0F172A',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        info: '#3B82F6',

        // ─── M3 / Deep Tech Narrative semantic tokens ─────────────────
        action: {
          DEFAULT: '#0D9488',
          foreground: '#FFFFFF',
        },
        'on-surface': '#0F172A',
        'on-surface-variant': '#64748B',
        surface: '#FFFFFF',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#F8FAFC',
        'surface-container': '#F1F5F9',
        'surface-container-high': '#E2E8F0',
        'surface-container-highest': '#CBD5E1',
        'inverse-on-surface': '#F1F5F9',
        'outline-variant': '#E2E8F0',
      },

      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '4px',
      },

      spacing: {
        'sidebar-width': '260px',
        'sidebar-collapsed': '72px',
      },

      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },

      fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1.08', letterSpacing: '-0.028em', fontWeight: '800' }],
        'display-md': ['2.75rem', { lineHeight: '1.12', letterSpacing: '-0.022em', fontWeight: '700' }],
        'display-sm': ['2.25rem', { lineHeight: '1.18', letterSpacing: '-0.016em', fontWeight: '700' }],
        'heading-lg': ['1.75rem', { lineHeight: '1.28', letterSpacing: '-0.012em', fontWeight: '600' }],
        'heading-md': ['1.375rem', { lineHeight: '1.35', letterSpacing: '-0.008em', fontWeight: '600' }],
        'heading-sm': ['1.125rem', { lineHeight: '1.45', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.65' }],
        body: ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.55' }],
        caption: ['0.75rem', { lineHeight: '1.4' }],
        overline: ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.08em', fontWeight: '600' }],
      },

      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glass-lg': '0 20px 40px 0 rgba(31, 38, 135, 0.10), 0 8px 16px 0 rgba(31, 38, 135, 0.06)',
        'glass-xl': '0 32px 64px 0 rgba(31, 38, 135, 0.14), 0 12px 24px 0 rgba(31, 38, 135, 0.08)',
        premium: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'action-glow': '0 0 28px 0 rgba(13, 148, 136, 0.30)',
        'action-glow-sm': '0 0 16px 0 rgba(13, 148, 136, 0.20)',
      },

      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
        'hero-gradient': 'linear-gradient(135deg, #0B1628 0%, #0C1F38 50%, #0B2A28 100%)',
        'action-gradient': 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)',
        'dark-gradient': 'linear-gradient(135deg, #0B1628 0%, #0F2040 40%, #0D3030 100%)',
        'card-shine': 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%)',
      },

      transitionDuration: {
        250: '250ms',
      },

      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },

      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },

      animation: {
        'fade-in-up': 'fade-in-up 400ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 350ms ease-out both',
        'scale-in': 'scale-in 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        float: 'float 3.5s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 400ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },

      zIndex: {
        base: '0',
        dropdown: '40',
        sticky: '50',
        overlay: '60',
        modal: '70',
        popover: '80',
        toast: '90',
        tooltip: '100',
      },
    },
  },
  plugins: [],
}
