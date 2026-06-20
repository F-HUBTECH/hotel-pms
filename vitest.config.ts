import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
        env: {
            NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        },
    },
})
