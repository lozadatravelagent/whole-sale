import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				display: ['var(--font-display)', 'Georgia', 'serif'],
				sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
				utility: ['var(--font-utility)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					glow: 'hsl(var(--primary-glow))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				aurora: {
					violet: 'hsl(var(--aurora-violet))',
					blue: 'hsl(var(--aurora-blue))',
					coral: 'hsl(var(--aurora-coral))',
					pink: 'hsl(var(--aurora-pink))',
					mint: 'hsl(var(--aurora-mint))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			backgroundImage: {
				'gradient-hero': 'var(--gradient-hero)',
				'gradient-success': 'var(--gradient-success)',
				'gradient-card': 'var(--gradient-card)',
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-cta': 'var(--gradient-cta)',
				'gradient-text': 'var(--gradient-text)'
			},
			boxShadow: {
				'xs': 'var(--shadow-xs)',
				'sm': 'var(--shadow-sm)',
				'md': 'var(--shadow-md)',
				'lg': 'var(--shadow-lg)',
				'xl': 'var(--shadow-xl)',
				'cta': 'var(--shadow-cta)',
				'glow': 'var(--shadow-glow)',
				'inset-glass': 'var(--shadow-inset-glass)',
				'primary': 'var(--shadow-primary)',
				'success': 'var(--shadow-success)',
				'accent': 'var(--shadow-accent)',
				'card': 'var(--shadow-card)'
			},
			transitionTimingFunction: {
				'smooth': 'var(--transition-smooth)',
				'spring': 'var(--ease-spring)',
				'out-expo': 'var(--ease-out-expo)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				'2xl': '1.5rem',
				'3xl': '1.75rem'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'aurora-drift': {
					'0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
					'33%': { transform: 'translate3d(40px,-30px,0) scale(1.08)' },
					'66%': { transform: 'translate3d(-30px,40px,0) scale(0.94)' }
				},
				'aurora-drift-slow': {
					'0%, 100%': { transform: 'translate3d(0,0,0) scale(1)', opacity: '0.55' },
					'50%': { transform: 'translate3d(-40px,30px,0) scale(1.1)', opacity: '0.7' }
				},
				'shimmer': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(200%)' }
				},
				'pulse-ring': {
					'0%': { transform: 'scale(0.95)', opacity: '0.6' },
					'100%': { transform: 'scale(1.6)', opacity: '0' }
				},
				'orbit-spin': {
					from: { transform: 'rotate(0deg)' },
					to: { transform: 'rotate(360deg)' }
				},
				'glow-pulse': {
					'0%, 100%': { opacity: '0.6', filter: 'blur(40px)' },
					'50%': { opacity: '1', filter: 'blur(55px)' }
				},
				'fade-up': {
					from: { opacity: '0', transform: 'translateY(20px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				},
				'float-node': {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-6px)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'aurora-drift': 'aurora-drift 22s ease-in-out infinite',
				'aurora-drift-slow': 'aurora-drift-slow 28s ease-in-out infinite',
				'shimmer': 'shimmer 2.5s ease-in-out infinite',
				'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite',
				'orbit-spin': 'orbit-spin 22s linear infinite',
				'orbit-spin-slow': 'orbit-spin 32s linear infinite',
				'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
				'fade-up': 'fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
				'float-node': 'float-node 3s ease-in-out infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate"), require("@tailwindcss/container-queries")],
} satisfies Config;
