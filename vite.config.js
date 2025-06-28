import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate Firebase into its own chunk
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          // Separate React Router into its own chunk
          router: ["react-router-dom"],
          // Separate Lucide icons into its own chunk
          icons: ["lucide-react"],
          // Vendor chunk for other large dependencies
          vendor: ["react", "react-dom"],
        },
      },
    },
    // Increase chunk size warning limit for Firebase
    chunkSizeWarningLimit: 600,
  },
});
