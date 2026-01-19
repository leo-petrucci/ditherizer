import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'

import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig(({ mode }) => {
  const isTest = mode === 'test' || process.env.VITEST === 'true'

  return {
    plugins: [
      ...(isTest
        ? []
        : [
            devtools(),
            nitro({
              awsLambda: { streaming: true },
              preset: 'aws-lambda',
            }),
          ]),
      // this is the plugin that enables path aliases
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      ...(isTest ? [] : [tanstackStart()]),
      viteReact(),
    ],
    test: {
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      globals: true,
      deps: {
        inline: ['react', 'react-dom', 'react/jsx-runtime'],
      },
    },
  }
})

export default config
