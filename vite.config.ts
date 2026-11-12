import { defineConfig } from 'vite';

export default defineConfig(({ mode }) =>
  mode === 'lib'
    ? {
        build: {
          outDir: 'dist-lib',
          emptyOutDir: true,
          lib: {
            entry: 'src/index.ts',
            name: 'CursorCrew',
            formats: ['es', 'cjs'],
            fileName: (format) =>
              format === 'es' ? 'cursorcrew.js' : 'cursorcrew.cjs',
          },
        },
      }
    : {}
);

