# Supabase relacional — scripts clássicos

O HTML já carrega a configuração pública, o transporte REST, o adaptador de dados e a integração de login/gravação. Não usa SDK, framework, build, chave secreta nem tabela com um snapshot completo da clínica. O modo Supabase está ativado; tabelas e vínculos administrativos precisam ser provisionados pelos passos abaixo.

## Instalação

1. Configure Authentication com login por e-mail, URLs de retorno e confirmação de e-mail. A conta local anterior não é uma conta Supabase; senhas, salts e hashes locais não são importados.
2. Execute [202610140001_relational_clinics.sql](migrations/202610140001_relational_clinics.sql) **somente se ainda não foi aplicada**. Depois execute [202610140002_main_clinic_access.sql](migrations/202610140002_main_clinic_access.sql) e [202610200001_optimize_clinic_load.sql](migrations/202610200001_optimize_clinic_load.sql). Requer PostgreSQL 15+. A primeira migration cria a estrutura e não deve ser reaplicada; a segunda cria/reutiliza a clínica principal sem apagar dados; a terceira otimiza a leitura sem mudar o formato do retorno. Para uma instalação existente com timeout, siga primeiro o procedimento de diagnóstico abaixo. O schema `private` **não deve ser exposto** na Data API.
3. Crie a conta **Ricardo Silva — oralvalle.odontologia@gmail.com** na tela de cadastro ou pelo painel Authentication e confirme o e-mail. A segunda migration vincula essa conta à **Oral Valle** como administrador, usando o UUID verdadeiro de `auth.users`. Se já existe e está confirmada, o vínculo é criado ao executar a migration. Se for criada depois, o trigger fará o vínculo quando o e-mail for confirmado. Não há senha criada por SQL ou confirmação artificial de e-mail.
4. O frontend recebe somente a URL pública e a chave **publishable** do projeto. Nunca publique `service_role`, chave secret, senha de banco ou tokens de outras pessoas. O transportador existente deve enviar o access token do usuário autenticado, não usar a chave publishable como identidade.
5. Abra a aplicação e entre com o **e-mail e senha do Supabase**, não com o antigo usuário local. Com um único vínculo, a clínica é selecionada automaticamente. Se houver vários, preencha `clinicId` em [config.js](../assets/js/supabase/config.js). Todos os RPCs conferem o vínculo ativo do usuário JWT.
6. Para dados locais antigos, faça backup no modo local antes de mudar de origem. Depois, entre como administrador no modo Supabase e use **Backup → Restaurar backup**: essa operação substitui os dados autorizados da clínica, exige confirmação e deve ser feita somente após backup do banco atual. Não importa contas/senhas/sessões. A interface informa gravação pendente e somente confirma sucesso após resposta remota.

Use GitHub Pages/HTTPS para produção e configure **Authentication → URL Configuration → Site URL e Redirect URLs** com o endereço exato do site, incluindo o subdiretório. Para convites/recuperação use o template padrão com `ConfirmationURL`; configure SMTP para entrega confiável. Links abrem a entrada da aplicação, que processa a sessão e pede nova senha. Recuperação por e-mail exige HTTP(S), não `file://`.

## Aprovação de usuários

1. O usuário cria sua conta em `#cadastro` e confirma o e-mail.
2. A conta aparece em **Configurações → Acessos → Solicitações de acesso**. Ricardo pode usar **Atualizar** para ler cadastros recentes.
3. **Aprovar** cria o vínculo ativo, não administrativo, com visualização de Agenda, lista de Pacientes e Lembretes. As abas clínicas e outras áreas começam ocultas; ajuste os níveis abaixo conforme a função da pessoa.
4. **Rejeitar** encerra a solicitação sem conceder acesso. **Remover usuário** revoga o vínculo existente, sem apagar a conta Auth. Rejeitados e membros revogados não são automaticamente reenfileirados/reativados.

Somente administradores ativos e com e-mail confirmado da clínica principal podem listar ou decidir solicitações. Cadastros comuns não recebem administração por nome, metadata ou parâmetros do navegador. Nenhum acesso é concedido enquanto a solicitação aguarda aprovação.

A migration reserva exclusivamente o e-mail informado para o administrador inicial e grava o nome **Ricardo Silva** em `clinic_members`. Os nomes dos demais são dados de apresentação fornecidos no cadastro. Uma mudança do e-mail do administrador para outro endereço desativa o vínculo reservado; planeje mudanças desse endereço com o responsável pelo banco.

Se houver mais de uma clínica já chamada Oral Valle, a migration interrompe com `MAIN_CLINIC_AMBIGUOUS`, sem escolher ou excluir dados. Identifique a clínica correta no SQL Editor e renomeie as duplicatas antes de reaplicar. [SETUP.sql.example](SETUP.sql.example) agora contém apenas consultas de diagnóstico, não cria outra clínica.

Para voltar explicitamente ao modo local, altere `enabled: false` no arquivo de configuração. Uma falha remota nunca ativa o modo local automaticamente. Dados locais não são enviados automaticamente.

**Segurança:** a chave secreta compartilhada na conversa deve ser revogada/substituída no painel. Não foi utilizada ou incluída nos arquivos. A publishable key pública permanece a fornecida.

## Contrato do transportador e do adaptador

`window.OralCloud` precisa ter `enabled: true`, `clinicId` UUID e `request(path, {method, body})`. `body` é um objeto JSON (o transportador serializa). `request` retorna JSON já interpretado e rejeita qualquer resposta HTTP não bem-sucedida, preservando `code`, `message`, `details` e `hint` do PostgREST. Cabeçalhos: `apikey: <publishable>`, `Authorization: Bearer <access token do usuário>`, `Content-Type: application/json`. Renovação do token, logout, seleção da clínica e política de retry pertencem à integração principal.

API global `window.OralCloudData`:

- `await load()` → **apenas o objeto legado `db`**, sem envelope e sem chave de revisão no banco legado. Não executa `migrate`, não troca o `db` global e não grava dados. A revisão e o baseline ficam privados no adaptador.
- `await save(snapshot)` → revisão como **string decimal**. Captura uma cópia JSON no momento da chamada, separa entidades, calcula inclusões/alterações e apaga somente linhas presentes no baseline visível. Nunca interpreta linhas ocultas como exclusões. `load` precisa ter sido chamado nessa clínica antes. Sucesso atualiza o baseline; falha não o atualiza. Não faz overwrite/retry automático em conflito.
- `await members()` → array com `id`/`user_id`, `nome`, `login`, `admin`, `perms`, `active`. Administradores veem todos os vínculos daquela clínica, os demais veem somente o próprio.
- `await updateMember(userId, patch)` → o mesmo formato de `members()`. `patch` admite somente `perms` e `active`; `perms` substitui o mapa completo, não faz merge. Exige administrador, rejeita edição do próprio vínculo e não aceita promoção, nome, login, senha ou UUID de clínica no patch. Não permite desativar o último administrador ativo. Invalida o baseline: chame `load` novamente.
- `await pendingUsers()` → solicitações com UUID, nome e e-mail, somente para administrador da clínica principal.
- `await decideUser(userId, approve)` → aprova ou rejeita uma solicitação pendente, sem promoção administrativa. Invalida o baseline; a integração recarrega membros e dados após a resposta.

`load` e `save` são serializados dentro do adaptador. A integração faz **um novo load após login e mudança de permissões**, limpa dados sensíveis ao sair e chama `prepareDefaults(db)` depois de `migrate`/primeira renderização. Essa função reconhece somente os defaults iniciais de áreas não editáveis: não concede escrita nem descarta edições posteriores. Defaults em áreas editáveis seguem como mudanças reais. Não chame `prepareDefaults` em resposta a uma falha para esconder alterações não autorizadas.

## RPCs / endpoints exatos

Todos usam `POST /rest/v1/rpc/<nome>` e somente o papel `authenticated` pode executá-los.

| Assinatura SQL | Corpo JSON | Retorno JSON |
| --- | --- | --- |
| `clinic_list()` | `{}` | Array de vínculos ativos: `clinic_id`, `nome` da clínica, `user_id`, `member_nome`, `login`, `admin`, `perms`, `active` |
| `clinic_load(p_clinic uuid)` | `{p_clinic}` | `{revision: string, tables: {nome: [linhas]}, access: {nome: {read, admin, write: {slot: boolean}}}}` |
| `clinic_apply(p_clinic uuid, p_revision bigint, p_changes jsonb)` | `{p_clinic, p_revision: string, p_changes: [...]}` | `{revision: string}` |
| `clinic_members_list(p_clinic uuid)` | `{p_clinic}` | Array de membros descrito acima |
| `clinic_update_member(p_clinic uuid, p_user_id uuid, p_patch jsonb)` | `{p_clinic, p_user_id, p_patch}` | Array de membros descrito acima |
| `clinic_pending_users(p_clinic uuid)` | `{p_clinic}` | Array `{id, nome, email, created_at}` com solicitações pendentes confirmadas |
| `clinic_decide_user(p_clinic uuid, p_user_id uuid, p_approve boolean)` | `{p_clinic, p_user_id, p_approve}` | Array atualizado de membros; exige administrador confirmado |

Cada mudança de `clinic_apply` é `{table, id, row: {parent_id, slot, position, kind, dados}}` ou `{table, id, delete: true}`. Nenhuma outra coluna/chave é aceita; `clinic_id`, referências e colunas geradas são calculados no servidor. As tabelas vêm de um catálogo privado fixo, nunca de SQL enviado pelo cliente. Há limite de 50.000 mudanças por transação. Revisões são strings para não perder precisão de `bigint` em JavaScript.

## Mapeamento e conservação dos dados

| Estrutura legada | Tabelas |
| --- | --- |
| `p` | `patients` (cadastro/core) |
| `p[].anam`, `anam.c` | `patient_anamneses`, `patient_conditions` (uma condição por linha) |
| `p[].odo`, `olog`, `evol`, `dplan` | `patient_odontograms`, `odontogram_history`, `patient_evolutions`, `dental_plans` |
| `p[].orcs[].itens` | `budgets`, `budget_items` |
| `p[].trat[].mats` | `treatments`, `treatment_materials` |
| `p[].arquivos`, `sign`/`signDate`/`signTermo`, `evolSign`/`evolSignDate` | `patient_files`, com autorização distinta por slot |
| `ag`, `dt`, `mt`, `lem`, `cp` | `appointments`, `dentists`, `materials`, `reminders`, `commission_payments` |
| `pr[].mats` | `procedures`, `procedure_materials` |
| `vd[].pg`, `vd[].plano` | `sales`, `receipts`, `installments` |
| `rxm` | `document_models` (uma entrada por modelo) |
| `cl`, `hc`, `meta`, `avs` e outras chaves de topo | `clinic_settings` (uma linha por chave) |

`dados` conserva os atributos restantes, incluindo campos desconhecidos, strings numéricas, números, booleanos, nulls, datas legadas, IDs e snapshots de custo/material/comissão. Não recalcula finanças nem divide strings de dentes. Colunas geradas `legacy_id`, `nome`, `status` e `amount` facilitam consultas; `amount` é texto de propósito, pois o legado admite números, texto e vazio. Os mapas do odontograma permanecem um JSONB apropriado; as condições e os modelos são entradas separadas. Campos/arrays desconhecidos restantes ficam no `dados` da entidade, sem serem descartados; novas coleções conhecidas exigem atualizar conjuntamente catálogo, permissões e descritores.

IDs relacionais são TEXT determinístico contendo contexto pai/slot e o ID legado, nunca conversão para UUID. O ID original continua em `dados.id` e retorna com seu tipo original. Itens sem ID (como `olog`) usam posição; reordená-los causa updates, não perde o histórico. IDs repetidos na mesma coleção são rejeitados pelo adaptador; não são deduplicados silenciosamente. A posição explícita conserva a ordem das coleções e dos mapas. Uma linha-marker com `position=-1` representa array/map presente, mesmo vazio: campo ausente, vazio e null não são confundidos. Não há marcador contendo itens de um snapshot.

As FKs usam `(clinic_id, id)`, são deferidas e não fazem cascade de coleções. Inserções precedem exclusões dentro da mesma transação; constraints deferidas admitem ligações cíclicas e mudanças de ordem. Excluir um pai deixando filhos inacessíveis falha, em vez de apagá-los implicitamente. Excluir paciente exige administrador. Referências históricas (`pid`, `dt`, `vid`, `tid`, `oid`, `oiid`, `ag`, `mid`, `pgid`) são nullable e resolvidas para entidades existentes no mesmo tenant, e no mesmo paciente/venda quando aplicável; referências ausentes/ambíguas permanecem somente no `dados`, sem bloquear importação. Ao remover um alvo histórico, somente a referência relacional fica null; o texto legado não é reescrito.

## Autorização e concorrência

Tabelas públicas têm RLS, mas **nenhum SELECT/INSERT/UPDATE/DELETE é concedido a `anon` ou `authenticated`**. O acesso passa exclusivamente pelos RPCs `SECURITY DEFINER`, com `search_path=pg_catalog`, SQL parametrizado, catálogo privado e verificação explícita de vínculo/permissão em todas as rotas. As funções privadas e o execute público padrão são revogados. Assim não há API direta que contorne a revisão ou altere `clinic_id`, `admin` ou vínculos.

Defaults correspondem a `permOf`: administrador = edit; `perms` SQL null = antigo acesso completo de módulos; com mapa, chave de módulo ausente = none e chave `pac.*` ausente = edit. Permissões novas provisionadas começam com Agenda/Pacientes/Lembretes view. Invalidar/desativar um vínculo nega todos os dados. `bk` não concede acesso geral a módulos ocultos.

Decisões de módulo/tab no servidor:

- Cadastro completo: `min(pac, pac.dados)`; agenda, vendas ou proposta sem essa permissão recebem somente `id` e `nome` dos pacientes para identificação. Esse shell não concede edição. Criar/editar cadastro exige `pac` e `pac.dados` edit.
- Anamnese/condições/assinatura inicial: `min(pac, pac.anam)`; odontograma/histórico/evolução/plano/assinatura de evolução: `min(pac, pac.odo)`; tratamentos/material utilizado: `min(pac, pac.trat)`.
- Orçamentos/itens: `max(pf, min(pac, pac.orc))`, reproduzindo a via Proposta Financeira.
- Vendas/recebimentos/parcelas: `max(vd, min(pac, pac.pag))`; agenda: `max(ag, min(pac, pac.agd))`.
- Arquivos e modelos de documentos: `min(pac, pac.arquivos)`.
- Dentistas/procedimentos/materiais/comissões/lembretes: `dt`/`pr`/`mt`/`cm`/`lem` respectivamente; receitas de materiais seguem `pr`.
- `hc` segue `hc`; `meta` segue `bk`; `cl` e `avs` são legíveis por membros ativos e editáveis somente pelo administrador. Outras configurações são exclusivas do administrador.

Operações que cruzam módulos precisam de **todas** as permissões correspondentes: dar baixa também pode criar venda, evolução e atualizar orçamento/agenda. Não há exceção de escrita implícita só porque a tela permite um botão. Comissões, precificação e outras telas que usam dados de módulos dependentes precisam desses acessos também; `cm`, por exemplo, não revela automaticamente recibos protegidos por `vd`/`pac.pag`. A integração principal deve adequar o habilitamento dos botões a esses requisitos, não ampliar permissões no cliente.

`clinic_load` mantém um lock compartilhado da clínica para ler revisão e tabelas coerentes. `clinic_apply` bloqueia a mesma clínica, verifica a revisão esperada, valida todas as mudanças e efetua a transação completa. A revisão é global à clínica, inclusive para usuários com visão parcial: uma mudança oculta causa conflito, não overwrite. Até save sem mudanças verifica a revisão. Alterar permissões também incrementa a revisão. Manutenção privilegiada por SQL deve adquirir esse lock e incrementar a revisão, como indicado no exemplo; o administrador SQL não está submetido às restrições do navegador.

## Erros e recuperação

- SQLSTATE `40001`, mensagem `CLOUD_CONFLICT`: snapshot desatualizado. Apresente conflito, conserve o trabalho local e ofereça recarregar/reconciliar; **não reenviar automaticamente com revisão nova**.
- `42501`, `CLOUD_PERMISSION_DENIED` ou `LAST_ADMIN`: falta de acesso, edição própria proibida ou proteção do último admin.
- `22023`, `INVALID_CHANGES` / `INVALID_MEMBER_PATCH`: corpo, coleção ou permissão inválida.
- `P0002`, `MEMBER_NOT_FOUND`: vínculo inexistente.
- `23503` / `23505` / `23514` / `23502`: referência estrutural, identidade/posição duplicada, constraint ou campo obrigatório inválido; nada é parcialmente salvo.
- Adaptador: `CLOUD_NOT_READY`, `LOAD_REQUIRED`, `CLINIC_CHANGED`, `INVALID_SNAPSHOT`, `DUPLICATE_ID`, `INVALID_RESPONSE`, `INVALID_MEMBER_PATCH`, `CLOUD_PERMISSION_DENIED`. Erros HTTP/JWT/rede são propagados pelo transportador sem mascaramento.

## Capacidade, anexos e operação

Radiografias, PDFs e assinaturas continuam como data URLs, mas em **linhas relacionais privadas de `patient_files`**, para preservar o consumo atual da aplicação. **Não existe bucket nem migração para Supabase Storage nesta versão.** Base64 custa aproximadamente 33% além do binário, mais JSON/índices/backups. O limite atual da interface de 1,5 MB por arquivo não é uma política de capacidade do servidor. Dimensione o espaço de banco e backups do plano contratado, payloads/timeouts da Data API e memória de navegador: `load` carrega integralmente a visão autorizada, não é paginação de imagens. Não prometa quantidade ilimitada de pacientes/anexos nem um limite de plano fixo que pode mudar.

Uma próxima etapa pode mover os binários para Storage com buckets privados, autorização por tenant, URLs assinadas e migração verificável que só remove o payload após confirmar o objeto. Até lá, não substitua data URLs por links sem adaptar os consumidores. Dados pessoais e de saúde exigem administração de acessos, retenção, backups, TLS e avaliação LGPD; RLS por si só não resolve essas obrigações.

## Timeout no carregamento da clinica

O login autentica antes de carregar os dados. Se `clinic_load` falhar, o aplicativo continua bloqueado e oferece uma nova tentativa de leitura, sem exigir outra senha. Nao ha retry automatico de gravacao, troca para modo local ou abertura com banco parcial. O aviso de audio do navegador e independente do timeout SQL.

### Diagnostico antes de alterar producao

1. Garanta backup consistente do banco, incluindo anexos, e verifique a restauracao em ambiente isolado. Preserve tambem trabalho pendente em aparelhos que ainda estejam abertos.
2. Nos logs Postgres/API, confirme SQLSTATE `57014`, horario, duracao e contexto da falha. No navegador, diferencie as respostas de Auth, `clinic_list`, membros e `clinic_load`. Nunca compartilhe JWTs, senhas ou prontuarios.
3. Execute [diagnostics/clinic_load.sql](diagnostics/clinic_load.sql) no SQL Editor administrativo. O script e somente leitura e limita cada statement a 10 segundos; se abortar, encerre a transacao com `ROLLBACK` e investigue a consulta que falhou. Pode consumir recursos ao contar arquivos; prefira uma janela tranquila. Ele nao chama `clinic_load` nem retorna conteudo de pacientes. Contagens de `pg_stat_user_tables` sao estimativas; tamanho de `pg_column_size(dados)` nao e tamanho logico descomprimido nem bytes HTTP. Os totais de relacao incluem todas as clinicas, indices e TOAST.
4. O resultado `previous_clinic_load` e a definicao anterior para rollback: mantenha-o em registro administrativo privado antes da migration. Compare com a versao do repositorio, inclusive proprietario, grants e configuracoes. A configuracao da sessao do SQL Editor nao comprova o timeout efetivo da Data API; confira tambem papel, banco e funcoes.
5. Durante uma falha, `blocked_by` e eventos de espera ajudam a identificar transacao bloqueadora. Nao remova o lock compartilhado nem encerre sessoes sem avaliar o trabalho em andamento.
6. Em staging com volume representativo, compare as consultas internas com/sem os binarios e examine `EXPLAIN (ANALYZE, BUFFERS)` das consultas especificas. Um `EXPLAIN` somente da chamada da funcao pode esconder o SQL interno. Nao gere novamente o JSON integral no banco de producao como primeiro diagnostico.

### Aplicacao e rollback

1. Em ambiente isolado, aplique apenas a nova [migration de otimizacao](migrations/202610200001_optimize_clinic_load.sql) sobre a estrutura existente. Ela substitui somente `clinic_load`, mantendo assinatura, grants, dados, autorizacao, revisao e lock. Calcula acesso por slot distinto e agrega `patient_files` por ultimo para evitar copias posteriores desse grande bloco nas concatenacoes das tabelas.
2. Teste com o volume importado: administrador, usuario restrito, anexos/assinaturas, backup, PDF, edicao de paciente e conflito entre dois usuarios. Meça duracao no banco, bytes de resposta e memoria do navegador, pela Data API com usuario real, nao apenas como `postgres` no SQL Editor.
3. Depois do aceite e backup verificado, aplique a migration no SQL Editor de producao e publique `index.html` e `assets/` na Vercel. O frontend novo tambem funciona com a funcao antiga: o contrato nao mudou. As migrations nao rodam automaticamente no deploy; a chave publica nao permite DDL.
4. Para rollback SQL, execute a definicao `CREATE OR REPLACE FUNCTION` capturada antes da atualizacao, dentro de uma transacao administrativa. Nao use `DROP FUNCTION`, nao reaplique a migration inicial e nao restaure dados por cima da producao. Para rollback visual, publique a versao anterior dos assets. Nenhum formato de arquivo foi migrado nesta etapa.

Esta otimizacao nao elimina a leitura integral dos anexos e nao garante resolver um payload que exceda a capacidade do plano. Se persistir, nao apague arquivos nem aumente indiscriminadamente o timeout: a etapa seguinte e Storage privado, com metadados, binarios sob demanda e adaptacao conjunta de leitura, escrita, PDFs, assinaturas e backup/restauracao. Nao omita `patient_files` do RPC para liberar login sem adaptar o baseline de gravacao. Nao crie indices redundantes: as PKs e os indices existentes ja comecam por `clinic_id`.

## Testes locais da recuperacao

A aplicacao permanece estatica, sem build ou dependencias novas no navegador. Os testes em [tests/cloud-recovery.test.cjs](../tests/cloud-recovery.test.cjs) usam `node:test` para audio, login e preservacao de anexos no adaptador:

```sh
node --test tests/cloud-recovery.test.cjs
```

O teste SQL e explicitamente marcado como ignorado sem `PGLITE_MODULE`. Para executar tambem o PostgreSQL embarcado, instale PGlite fora do projeto e indique seu modulo (exemplo macOS):

```sh
npm install --prefix /tmp/oralvalle-sql-validation --no-audit --no-fund @electric-sql/pglite@0.5.10
PGLITE_MODULE=/tmp/oralvalle-sql-validation/node_modules/@electric-sql/pglite/dist/index.js node --test tests/cloud-recovery.test.cjs
```

O teste cria um banco efemero com Auth simulado e dados sinteticos, aplica a migration inicial e compara o JSON da funcao original com a nova em diferentes permissoes, mantendo grants e negando acesso sem vinculo. Nao acessa o Supabase remoto e nao substitui testes de concorrencia, JWT/Data API, desempenho real ou restauracao de backup.