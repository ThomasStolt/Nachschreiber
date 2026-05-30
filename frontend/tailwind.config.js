/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'sans-serif'],
        sans:    ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        bg:       'rgb(var(--nb-bg)       / <alpha-value>)',
        surface:  'rgb(var(--nb-surface)  / <alpha-value>)',
        elevated: 'rgb(var(--nb-elevated) / <alpha-value>)',
        border:   'rgb(var(--nb-border)   / <alpha-value>)',
        accent:   'rgb(var(--nb-accent)   / <alpha-value>)',
        t1:       'rgb(var(--nb-t1)       / <alpha-value>)',
        t2:       'rgb(var(--nb-t2)       / <alpha-value>)',
        t3:       'rgb(var(--nb-t3)       / <alpha-value>)',
      },
      boxShadow: {
        glow: '0 0 0 2px rgb(var(--nb-accent) / 0.35), 0 0 24px rgb(var(--nb-accent) / 0.15)',
      },
    },
  },
  plugins: [],
}
