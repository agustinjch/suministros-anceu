import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Config propia de Vitest, separada de `vite.config.ts` a propósito.
 *
 * `vite.config.ts` carga el plugin `cloudflare()`, que exige que exista el
 * Worker y arranca el runtime de workerd. Los tests no lo necesitan: el
 * handler se invoca como una función normal (`worker.fetch(req, env, ctx)`).
 * Si Vitest cargase esa config, cualquier test fallaría con un error de
 * arranque del plugin en vez de con el fallo que se está probando.
 */
export default defineConfig({
  plugins: [react()],
})
