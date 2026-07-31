import type { NextConfig } from "next";

// Identificador único desta build/deploy. Na Vercel usamos o SHA do commit;
// localmente, um timestamp. O auto-atualizador (UpdateChecker + /api/version)
// compara a versão carregada no navegador com a versão publicada no servidor
// para detectar quando saiu uma versão nova e recarregar sozinho.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || `dev-${Date.now()}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
};

export default nextConfig;
