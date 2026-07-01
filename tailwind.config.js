/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          subtle: 'var(--accent-subtle)',
          border: 'var(--accent-border)',
          yellow: 'var(--yellow)',
          ink: '#080808',
        },
        canvas: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        raised: 'var(--bg-raised)',
        overlay: 'var(--bg-overlay)',
        line: {
          DEFAULT: 'var(--border)',
          md: 'var(--border-md)',
          lg: 'var(--border-lg)',
        },
        content: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          disabled: 'var(--text-disabled)',
        },
        info: { DEFAULT: 'var(--info)', subtle: 'var(--info-subtle)' },
        success: { DEFAULT: 'var(--success)', subtle: 'var(--success-subtle)' },
        warning: { DEFAULT: 'var(--warning)', subtle: 'var(--warning-subtle)' },
        danger: { DEFAULT: 'var(--danger)', subtle: 'var(--danger-subtle)' },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      keyframes: {
        'load-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
      },
      animation: {
        'load-bar': 'load-bar 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
