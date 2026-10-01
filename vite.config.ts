import { defineConfig } from 'vite';
export default defineConfig({ base: '/PROJ_R/', build: { target: 'es2022', chunkSizeWarningLimit: 1500 } });
