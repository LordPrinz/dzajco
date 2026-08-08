/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/client/**/*.{js,ts,jsx,tsx}"],
	darkMode: "class",
	theme: {
		extend: {
			// The original brand ramp, unchanged.
			colors: {
				jajco: {
					50: "#fffee7",
					100: "#fffec1",
					200: "#fff886",
					300: "#ffec41",
					400: "#ffdb0d",
					500: "#fcc011",
					600: "#d19500",
					700: "#a66a02",
					800: "#89530a",
					900: "#74430f",
					950: "#442304",
				},
				// Semantic tokens resolve against CSS variables so light/dark swap
				// in one place instead of every `dark:` variant.
				canvas: "rgb(var(--canvas) / <alpha-value>)",
				surface: "rgb(var(--surface) / <alpha-value>)",
				sunken: "rgb(var(--sunken) / <alpha-value>)",
				edge: "rgb(var(--edge) / <alpha-value>)",
				ink: "rgb(var(--ink) / <alpha-value>)",
				muted: "rgb(var(--muted) / <alpha-value>)",
				faint: "rgb(var(--faint) / <alpha-value>)",
			},
			gridTemplateColumns: {
				defaultLayout:
					"[full-start] minmax(60px,1fr) [center-start] repeat(8,[col-start] minmax(min-content,140px) [col-end]) [center-end] minmax(60px,1fr) [full-end]",
				smallLayout:
					"[full-start] minmax(30px,1fr) [center-start] repeat(8,[col-start] minmax(min-content,140px) [col-end]) [center-end] minmax(30px,1fr) [full-end]",
				mobileLayout:
					"[full-start] minmax(15px,1fr) [center-start] repeat(8,[col-start] minmax(min-content,140px) [col-end]) [center-end] minmax(15px,1fr) [full-end]",
			},
			fontFamily: {
				sans: ['"Open Sans"', "Lato", "system-ui", "sans-serif"],
			},
			boxShadow: {
				pill: "0 1px 2px rgb(0 0 0 / 0.06), 0 6px 20px -8px rgb(0 0 0 / 0.12)",
				lift: "0 1px 2px rgb(0 0 0 / 0.05), 0 12px 32px -12px rgb(0 0 0 / 0.18)",
			},
			keyframes: {
				"fade-up": {
					from: { opacity: "0", transform: "translateY(6px)" },
					to: { opacity: "1", transform: "translateY(0)" },
				},
				shimmer: {
					"100%": { transform: "translateX(100%)" },
				},
			},
			animation: {
				"fade-up": "fade-up 0.25s ease-out both",
				shimmer: "shimmer 1.6s infinite",
			},
		},
	},
	plugins: [],
};
