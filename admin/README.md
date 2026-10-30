# Nexodent Admin — etapa 1 (somente leitura)

1. Faça backup do banco antes de aplicar migrações.
2. Execute `supabase/migrations/202610290001_nexodent_admin_foundation.sql` no SQL Editor do projeto Supabase.
3. Identifique no Supabase Authentication o UUID exato da conta proprietária.
4. No SQL Editor, execute: `insert into public.nexodent_platform_admins(user_id) values ('UUID-DO-PROPRIETARIO');` substituindo o UUID.
5. Publique a pasta `admin/` junto com `assets/` e acesse `/admin/` em HTTPS.

**Segurança:** Não adicione chave service_role no navegador. O servidor valida o administrador em toda chamada RPC. Nenhum dado clínico é exposto pela RPC.

**Ainda NÃO implementado:** cadastro automático, período de teste, planos, assinaturas, cobranças, bloqueio por vencimento e domínio/subdomínio. O dashboard exibe apenas clínicas e vínculos existentes. A migração não altera registros da OralValle.
