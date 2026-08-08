import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src/client", import.meta.url)),
			"@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
		},
	},
	build: {
		outDir: "dist/client",
		emptyOutDir: true,
		sourcemap: false,
		rollupOptions: {
			output: {
				manualChunks: {
					// Leaflet is only needed on stats pages — keep it out of the
					// landing-page bundle so the home route stays light.
					map: ["leaflet", "react-leaflet"],
					qr: ["qrcode"],
				},
			},
		},
	},
	server: {
		proxy: {
			"/api": "http://127.0.0.1:8787",
		},
	},
});
