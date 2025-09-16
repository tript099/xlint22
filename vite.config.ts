import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: mode === 'development',
    minify: mode === 'production' ? 'terser' : false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-tabs', '@radix-ui/react-select', '@radix-ui/react-dropdown-menu'],
          supabase: ['@supabase/supabase-js'],
          charts: ['html2canvas', 'jspdf'],
          query: ['@tanstack/react-query'],
          utils: ['clsx', 'class-variance-authority', 'date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
  },
}));
