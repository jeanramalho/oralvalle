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

## Dados e acesso

Dados e contas continuam no navegador, em `localStorage` e `sessionStorage`. Faça backups pela aplicação. O login local controla a interface: não é autenticação de servidor e não oferece compartilhamento entre aparelhos.

O comportamento do armazenamento ao abrir arquivos locais depende do navegador. Prefira um endereço HTTPS estável para uso contínuo. Mudar o endereço, navegador ou aparelho não transfere os dados: exporte o backup antes e importe no destino. Não publique backups nem dados reais de pacientes no GitHub.

A fonte Figtree é carregada do Google Fonts, como no original. Sem conexão, o navegador usa as fontes alternativas já definidas. Notificações nativas, área de transferência e impressão dependem das permissões e dos recursos do navegador. Não há service worker nem promessa de instalação/offline PWA.

## GitHub Pages

1. Envie o projeto ao repositório.
2. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
3. Em **Actions → Publicar página estática → Run workflow**, publique a versão desejada.

O fluxo publica somente `index.html` e `assets/`, sem instalação, build ou testes. Os caminhos relativos funcionam também no subdiretório do repositório. As mesmas pastas podem ser servidas por qualquer hospedagem estática.

## Supabase futuramente

Nenhuma conexão ou migration Supabase é necessária nesta versão. O salvamento está concentrado em `storage.js`; autenticação e permissões ficam separadas. Uma integração futura precisará adaptar esses pontos a operações assíncronas e autorização no banco, sem alterar os cálculos ou recriar as telas. Nunca coloque chaves secretas ou `service_role` no navegador.