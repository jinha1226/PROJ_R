import { writeFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/** `npm run dev` only: the `?demo=tune` page saves the figure settings straight into the repo (src/data/figureTune.json). */
const tuneSave = (): Plugin => ({
  name: 'figure-tune-save',
  configureServer(server) {
    server.middlewares.use('/__tune', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      let body = '';
      req.on('data', (c: Buffer) => { body += c.toString(); });
      req.on('end', () => {
        try {
          const v = JSON.parse(body) as { weapons?: unknown; offhand?: unknown; classes?: unknown };
          if (!v.weapons || !v.offhand || !v.classes) throw new Error('shape');
          writeFileSync('src/data/figureTune.json', `${JSON.stringify(v, null, 2)}\n`);
          res.end('ok');
        } catch { res.statusCode = 400; res.end('bad'); }
      });
    });
  },
});

export default defineConfig({ base: '/PROJ_R/', build: { target: 'es2022', chunkSizeWarningLimit: 1500 }, plugins: [tuneSave()] });
