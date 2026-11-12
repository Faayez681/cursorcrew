import { defineConfig } from 'vite';
export default defineConfig(({ mode }) => mode === 'lib'
  ? { build: { outDir: 'dist-lib', lib: { entry: 'src/index.ts', name: 'SwarmRebuild', fileName: 'swarm-rebuild' } } }
  : {});
