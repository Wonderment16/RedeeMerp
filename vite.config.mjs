import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import basicSsl from '@vitejs/plugin-basic-ssl'


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const certDir = path.resolve(__dirname, "certs");
const certPaths = {
  key: path.join(certDir, "localhost+192.168.18.2-key.pem"),
  cert: path.join(certDir, "localhost+192.168.18.2.pem"),
};

const httpsConfig = fs.existsSync(certPaths.key) && fs.existsSync(certPaths.cert)
  ? {
      key: fs.readFileSync(certPaths.key),
      cert: fs.readFileSync(certPaths.cert),
    }
  : undefined;

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    host: "0.0.0.0",
    port: 5177,
    allowedHosts: "all",
    https: true,
  },
});
