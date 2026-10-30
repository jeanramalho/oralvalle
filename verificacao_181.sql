-- Verificação somente leitura após instalar a atualização 181.
SELECT n.nspname AS esquema, c.relname AS tabela, t.tgname AS gatilho,
       t.tgenabled AS estado, p.proname AS funcao
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND c.relname IN ('sales', 'commission_payments')
  AND t.tgname = 'nexodent_commercial_clinic_immutable'
  AND NOT t.tgisinternal
ORDER BY tabela;
