# Oral Valle

Aplicação estática de HTML, CSS e JavaScript. Abra [index.html](index.html) no navegador. Não é necessário instalar Node, pacotes ou executar comandos.

## Organização

- **assets/css/**: estilos originais, na mesma ordem para preservar o visual.
- **assets/js/state.js**: estado e constantes da aplicação.
- **assets/js/utils.js** e **calculations.js**: formatação, validações e cálculos.
- **assets/js/storage.js**: carregamento, compatibilidade de dados, salvamento e indicação de gravação.
- **assets/js/auth.js** e **permissions.js**: acesso local e permissões de interface.
- **assets/js/features/**: telas e ações de pacientes, agenda, tratamentos, pagamentos, documentos e cadastros.
- **assets/js/app.js**: renderização e inicialização, carregado por último.
- **assets/vendor/**: jsPDF 2.5.2 e licença, disponíveis sem CDN.

Os scripts clássicos compartilham o estado original e são carregados com `defer`, na ordem definida no HTML. Não misture versões antigas ou carregue o mesmo script duas vezes. Não há geração de código, módulos virtuais ou dependência do HTML monolítico.

## Supabase e acesso

O modo Supabase está ativado em [assets/js/supabase/config.js](assets/js/supabase/config.js), com a URL e a publishable key públicas fornecidas. Execute as migrations na ordem indicada em [supabase/README.md](supabase/README.md). A segunda provisiona a clínica **Oral Valle** e vincula **Ricardo Silva — oralvalle.odontologia@gmail.com** como administrador quando a conta Auth estiver criada e o e-mail confirmado.

Novos usuários se cadastram em [index.html#cadastro](index.html#cadastro), confirmam o e-mail e aguardam aprovação em **Configurações → Acessos**. Ricardo pode aprovar/rejeitar as solicitações e ajustar as permissões. Cadastrar uma conta não concede acesso automático à clínica.

As coleções são separadas em tabelas com relacionamentos, atributos flexíveis JSONB e políticas por clínica/permissão. A aplicação grava diferenças por transação e avisa sobre falhas/conflitos sem sobrescrever o trabalho de outro aparelho. Anexos ficam em registros privados no banco; Supabase Storage não está implementado nesta versão.

Para usar o comportamento local anterior, defina `enabled: false` explicitamente na configuração. Nunca há troca automática para o modo local em caso de erro de conexão.

Em caso de timeout depois de autenticar, a tela oferece nova tentativa de leitura sem abrir dados parciais. A [migration de otimizacao](supabase/migrations/202610200001_optimize_clinic_load.sql) reduz verificacoes repetidas de permissao, mas ainda carrega os anexos integralmente. Antes de aplica-la a uma instalacao existente, siga o [diagnostico, validacao e rollback](supabase/README.md#timeout-no-carregamento-da-clinica). Publicar na Vercel nao executa migrations no Supabase.

## Modo local

Dados e contas continuam no navegador, em `localStorage` e `sessionStorage`. Faça backups pela aplicação. O login local controla a interface: não é autenticação de servidor e não oferece compartilhamento entre aparelhos.

O comportamento do armazenamento ao abrir arquivos locais depende do navegador. Prefira um endereço HTTPS estável para uso contínuo. Mudar o endereço, navegador ou aparelho não transfere os dados: exporte o backup antes e importe no destino. Não publique backups nem dados reais de pacientes no GitHub.

A fonte Figtree é carregada do Google Fonts, como no original. Sem conexão, o navegador usa as fontes alternativas já definidas. Notificações nativas, área de transferência e impressão dependem das permissões e dos recursos do navegador. Não há service worker nem promessa de instalação/offline PWA.

## GitHub Pages

1. Envie o projeto ao repositório.
2. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
3. Em **Actions → Publicar página estática → Run workflow**, publique a versão desejada.

O fluxo publica somente `index.html` e `assets/`, sem instalação, build ou testes. Os caminhos relativos funcionam também no subdiretório do repositório. As mesmas pastas podem ser servidas por qualquer hospedagem estática.

## Arquivos de integração

- **assets/js/supabase/config.js**: configuração pública e seleção explícita do modo.
- **client.js**: HTTP, autenticação, sessão e recuperação por e-mail.
- **data.js**: separação/recomposição dos dados e diferenças relacionais.
- **integration.js**: ligação das telas, gravações pendentes e permissões.
- **supabase/migrations/**: criação do banco e das funções protegidas.

Nunca coloque chaves secretas ou `service_role` no navegador. A chave secreta exposta na conversa deve ser revogada/substituída no painel Supabase; ela não foi usada no código.