require('esbuild').build({
  entryPoints: ['app.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: 'dist/app.js',
  target: 'node18',
  platform: 'node'
}).catch((e) => console.log(e) && process.exit(1));
