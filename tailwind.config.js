/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			backgroundImage: {
				"gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
				"gradient-conic":
					"conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
			},
			gridTemplateColumns: {
				defaultLayout:
					"[full-start] minmax(60px,1fr) [center-start] repeat(8,[col-start] minmax(min-content,140px) [col-end]) [center-end] minmax(60px,1fr) [full-end]",
				smallLayout:
					"[full-start] minmax(30px,1fr)  [center-start] repeat(8,[col-start] minmax(min-content,140px) [col-end]) [center-end] minmax(30px,1fr) [full-end]",
				mobileLayout:
					"[full-start] minmax(15px,1fr)  [center-start] repeat(8,[col-start] minmax(min-content,140px) [col-end]) [center-end] minmax(15px,1fr) [full-end]",
			},
			colors: {
				light: {
					bg: {
						primary: "#f9fafb",
						secondary: "#fff",
					},
					text: {
						primary: "#111827",
						secondary: "#6b7280",
					},
				},
				dark: {},
			},
		},
	},
	plugins: [],
};
