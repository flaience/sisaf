import { neon } from '@neondatabase/serverless';

// Busque a sua String de Conexão (Connection String) diretamente no painel do Neon
// Ela começa com postgresql://...
const connectionString = import.meta.env.VITE_NEON_DATABASE_URL || 'SUA_STRING_DE_CONEXAO_DO_NEON';

// Inicializa o cliente HTTP ultra-rápido do Neon
export const sql = neon(connectionString);
