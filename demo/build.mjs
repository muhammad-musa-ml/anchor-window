import { build } from 'esbuild';

await build({
  entryPoints: ['demo/main.js'],
  bundle: true,
  format: 'esm',
  outfile: 'demo/dist/main.js',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});
