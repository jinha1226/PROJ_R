import { parentPort } from 'node:worker_threads';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
const { runDelveBot } = await server.ssrLoadModule('/tests/bot/delveBotRun.ts');
parentPort.on('message', ({ id, seed, comp }) => {
  try { parentPort.postMessage({ id, result: runDelveBot(seed, comp) }); }
  catch (error) { parentPort.postMessage({ id, error: String(error?.stack ?? error) }); }
});
