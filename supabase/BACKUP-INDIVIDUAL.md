# Backup individual por clínica — Nexodent

O workflow `.github/workflows/backup-clinicas.yml` gera um arquivo JSON criptografado separado por `clinic_id`, diariamente e também sob execução manual no GitHub Actions. Ele usa os secrets já existentes `SUPABASE_DB_URL` e `BACKUP_AGE_RECIPIENT`. O artifact do GitHub contém somente arquivos `.json.age` e fica retido por 30 dias.

## Escopo desta primeira etapa

- Inclui a linha da clínica em `public.clinics`.
- Inclui linhas de tabelas de `public` e `private` que tenham uma coluna `clinic_id`, exceto `private.main_clinic`, que é configuração global.
- Não altera o banco de dados.
- Não imprime dados dos pacientes nos logs.
- Criptografa cada snapshot antes de publicá-lo como artifact.

## Limitações importantes

Esta é a **etapa de exportação**, não a recuperação. Não restaure o JSON diretamente no banco de produção. O mecanismo de recuperação individual precisa ser desenvolvido e testado separadamente, com validação de dependências, conflitos, chaves estrangeiras e auditoria.

O esquema atual não fornece vínculo de clínica confiável para todos os objetos do Supabase Storage; por isso, esta etapa não inclui arquivos binários nem promete recuperá-los. Também não exporta contas/credenciais globais do Supabase Auth, nem tabelas globais sem `clinic_id`. Catálogos globais e configuração principal não são dados de uma clínica individual.

Antes de ativar em produção, teste manualmente o workflow em ambiente de teste e valide o arquivo criptografado com a chave privada de recuperação. A chave privada `age` nunca deve ser colocada no GitHub Actions; mantenha-a fora do repositório e dos artifacts.

## Recuperação local experimental (novo)

O script `scripts/restore_clinic_local.py` implementa uma **restauração apenas em banco local de teste vazio**, não uma recuperação de produção. Exige Python 3 e `psycopg` (`pip install 'psycopg[binary]'`).

1. Crie uma base local **nova** chamada `nexodent_recuperacao`, com o esquema já instalado, mas sem registros da clínica a restaurar. Não use a base onde já fez a recuperação manual.
2. Restaure previamente os usuários correspondentes em `auth.users` por procedimento separado. O JSON individual não contém contas Auth.
3. Descriptografe o arquivo `.json.age` em ambiente seguro.
4. Execute `python scripts/restore_clinic_local.py --file CAMINHO_DO_BACKUP.json` para validar metadados sem gravar.
5. Após revisão, execute `python scripts/restore_clinic_local.py --file CAMINHO_DO_BACKUP.json --apply`. A senha do PostgreSQL pode ser informada por `PGPASSWORD` ou prompt/libpq, conforme configuração.

Proteções: conexão restrita a `127.0.0.1:5433`, banco chamado `nexodent_recuperacao`, rejeita clínica já existente, exige usuários Auth presentes, importa em transação e recria chaves estrangeiras para validar dados. Não executa operações remotas nem inclui interface web para restauração.

**Não usar em produção:** não restaura Storage, Auth, tabelas globais nem reconcilia dados de outras clínicas; não foi testado automaticamente com um banco local completo. A importação com `OVERRIDING SYSTEM VALUE` exige verificar/atualizar sequências de identidade antes de novas gravações. Faça sempre backup antes de qualquer tentativa de recuperação.
