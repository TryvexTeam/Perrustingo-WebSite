import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* Raíz explícita: hay otro package-lock.json en el home del usuario
     y Turbopack infiere mal el workspace sin esto. */
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
