# Estado Atual do Sistema — Site Rodogarcia

## Estado confirmado em 2026-09-03

- O monorepo possui três backends canônicos em Java 21/Spring Boot 4.1.1 MVC: `site/backend`, `cms/backend` e `landing-builder/backend`.
- Os fontes, lockfiles, caches e artefatos dos backends Node/Express de site, CMS e Landing Builder foram removidos. Não há fallback Node nem seleção de runtime restante.
- O corte físico do CMS foi concluído: `cms/backend` é a origem definitiva da API administrativa. `cms/backend-spring` e `cms/backend-node` não existem mais.
- O volume canônico do site continua em `site/backend/storage`; ele não foi movido, apagado ou copiado. O volume próprio do Builder continua em `landing-builder/backend/storage` no desenvolvimento e em `LANDING_BUILDER_STORAGE_ROOT` fora do repositório na produção.

## Arquitetura e Padrões

| Área                     | Origem definitiva            | Responsabilidade                                                                                                                         |
| ------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Site público             | `site/frontend`            | Next.js, gateway same-origin e páginas institucionais.                                                                                  |
| API pública              | `site/backend`             | Spring MVC para ESL, CEP e CNPJ; escritora exclusiva do rate limit operacional.                                                          |
| CMS                       | `cms/frontend`             | Next.js com`basePath: /admin`.                                                                                                         |
| API CMS                   | `cms/backend`              | Spring MVC para sessão, ACL, conteúdo, SEO, mídia, uploads, formulários, analytics, consentimento e integração privada do Builder. |
| Landing Builder           | `landing-builder/backend`  | Spring MVC, campanhas, prévias e mídia no volume próprio.                                                                             |
| Renderizador de campanhas | `landing-builder/frontend` | Next.js para campanhas publicadas e prévias opacas.                                                                                     |

- Não há import de runtime entre `site/backend`, `cms/backend` e `landing-builder/backend`. Código realmente agnóstico pertence a `shared/`.
- Controllers traduzem HTTP, services concentram regra de negócio e repositories são os únicos responsáveis por leitura/escrita JSON atômica.
- Não há banco de dados, JPA, Hibernate, Flyway ou outra persistência além de JSON local.
- O site encaminha `/admin/*` ao CMS, rotas administrativas e `/uploads/*` à API CMS, CEP/CNPJ/ESL à API pública e assets, mídia e fallback de slug ao Builder. O navegador não recebe URLs internas ou tokens de serviço.
- No formulário público de cotação, os blocos de dados acompanham visualmente o tipo de carga selecionado: carga fracionada usa tom e ícone verdes e carga fechada tom e ícone azuis. As camadas de cor fazem crossfade suave e escalonado, respeitam redução de movimento e não alteram campos, cálculo ou envio.
- Os quatro KPIs da visão executiva do CMS usam cards compactos, descrições de uma linha sem reticências e grade de quatro colunas já a partir do desktop `lg`; telas menores preservam duas ou uma coluna conforme a área útil.
- A tela de Analytics segue a mesma densidade da visão executiva: quatro KPIs já em `lg`, grades compactas para páginas, tipos de evento e conversões, e cards/tabela/configurações com padding, barras e controles reduzidos. Eventos próprios, GA4 e Clarity usam linhas compactas que aproximam ativação e identificador; em listas de duas colunas, o último item ímpar ocupa a largura restante para não deixar uma célula vazia.
- A cobertura por módulo do painel usa duas colunas no desktop, barras finas e resumos compactos, reduzindo a altura da seção sem ocultar módulos ou percentuais.
- As páginas mais acessadas no painel seguem a mesma densidade visual: duas colunas em telas pequenas para desktop, barras finas e rota/contagem em uma linha.
- Os atalhos de módulos do CMS usam quatro colunas a partir de `lg`, botões compactos e uma descrição operacional curta; nas telas menores a grade preserva duas ou uma coluna.
- O seletor de etapas da Home é um navegador compacto de abas numeradas: duas colunas no menor espaço, quatro a partir de `sm` e oito em desktop amplo. Cada aba mostra somente número e título; a descrição aparece uma única vez no cabeçalho da etapa ativa, eliminando repetição e altura ociosa.
- As Unidades da Home usam os mesmos acordeões da coleção de cards: cada filial mantém nome, estado, ações de subir/descer/remover e uma seta para abrir seus campos. A troca de ordem preserva a filial aberta e a remoção mantém o acordeão correto, sem esconder itens em paginação ou criar um seletor que cresce horizontalmente.
- O cadastro de Unidades reúne os dados em quatro blocos compactos: identificação e localização, contato e destino, informações exibidas e publicação. Em desktop, a grade de doze colunas preenche a largura disponível para nome/tipo, UF/cidade/endereço e os três canais de contato, enquanto descrição e informação logística ficam lado a lado.
- Os avisos de acesso restrito de Setores e Usuários ficam centralizados no CMS: card, título, explicação e orientação ocupam uma largura de leitura controlada, sem deixar a mensagem ancorada à margem da tela.
- No modo escuro do CMS e da tela de login, a malha e os brilhos decorativos do fundo usam uma camada própria com desfoque de `2px`; cards, textos e controles permanecem fora dessa camada e não perdem nitidez.
- Os sinais operacionais usam três colunas a partir de `lg`, cards baixos e uma descrição breve, reduzindo seis indicadores a duas linhas no desktop.
- O editor de vagas usa acordeão compacto, campos densos em duas colunas, descrição curta de duas linhas em largura total e ações na mesma faixa do status, eliminando espaço vertical ocioso sem alterar os dados publicados.
- O cabeçalho de Orientações em acordeão usa os dois campos curtos em colunas compactas e a descrição em largura total com duas linhas. Isso remove a coluna vazia e reduz a altura sem alterar conteúdo, limites ou salvamento.
- O cabeçalho de Linhas de serviço na Home organiza Badge/Título e Texto/Link do CTA em duas colunas a partir de `md`; a descrição segue em largura total com três linhas de edição. O formulário evita empilhamento desnecessário sem alterar limites ou conteúdo publicado.
- Nos campos Título e Descrição de Linhas de serviço, contador e orientação de quantidade de linhas aparecem na mesma faixa auxiliar, evitando que os dois textos empurrem o conteúdo verticalmente.
- Em acordeões editáveis, os controles de subir, descer e remover ficam na barra do item para funcionar mesmo fechado. A barra mantém abrir/fechar e ajuda fixos no extremo direito, com as ações alinhadas logo antes; o padrão vale para vagas, certificados e canais dinâmicos.
- A aparência das ações na barra é isolada por botão: Subir e Descer usam o estilo secundário do CMS, e somente Remover usa a variante de perigo em vermelho.
- A variante de perigo usada por Remover compartilha a altura mínima, o espaçamento e o raio `rounded-xl` dos controles Subir e Descer; permanece diferenciada apenas pela cor vermelha.
- Os controles de coleção Subir, Descer, Remover e Excluir compartilham animação de interação no CMS: ícones sobem/descem de forma direcional, a exclusão responde com rotação curta e o clique reduz levemente o botão. O padrão cobre rotas, Home, rodapé e navegação e respeita `prefers-reduced-motion`.
- O painel reutilizável de edição de botões foi compactado em todas as páginas de rotas: menos padding, títulos e gaps menores, inputs baixos e contadores compactos, sem mudar os campos, limites ou ajuda contextual.
- O crédito canônico do rodapé é “Desenvolvido por Lucas Andrade” e preserva o link externo seguro para o perfil profissional informado no CMS.
- Os CTAs de contraste sobre superfícies claras usam a variante explícita `contrast`: fundo azul-escuro, texto e ícone brancos, hover visível e sem concorrer com o fundo claro da variante secundária.
- A apresentação de mídia do CMS é um dado do uso no conteúdo, nunca do arquivo da biblioteca: `shared/types/media.d.ts` define foco percentual e, para vídeo, início/duração. `presentation.desktop` é a base e `presentation.mobile`, quando existir, substitui somente o necessário no celular. Ausência de configuração mantém foco central e vídeo completo.
- `ContentMediaPresentations` aplica o schema a cada mídia da Home, Serviços, Sobre e Trabalhe Conosco; `ContentMigrationService` grava a migração atomicamente no JSON canônico na primeira leitura controlada do CMS. Ao salvar um trecho, `HomeContentAdminService` confirma a duração física de cada fonte de vídeo e recusa início/fim incompatíveis.
- A Biblioteca de mídia deriva resolução, proporção e duração do arquivo, sem alterar o arquivo original: imagens usam leitor de cabeçalho e vídeos usam `FFPROBE_PATH` com argumentos fixos, saída limitada e timeout de 5 s. Falhas, arquivos antigos ou metadados inválidos apenas omitem a informação no CMS; não retornam caminho local, saída da ferramenta ou detalhes do host.
- `MediaPlacementEditor` grava foco percentual por uso com atalhos e herança desktop/celular; em vídeo, `VideoPlaybackRangeEditor` usa a duração carregada no navegador para limitar início e trecho durante a edição. A ajuda contextual do componente explica o efeito real em cada rota. Os renderizadores públicos de `/servicos`, do Hero de `/sobre`, da foto de cultura em `/trabalhe-conosco` e do popup de saída já priorizam essa posição sobre o centro e o seletor legado de posição.
- Na foto de cultura em `/admin/developer/trabalhe-conosco`, o comando **Enquadrar** fica sobre a própria prévia da mídia e abre o editor em modal. Assim, a ação é descoberta junto da foto e não ocupa altura fixa no formulário; o botão externo de salvar continua responsável por persistir a alteração.
- O editor de mídia do Hero da Home segue o mesmo padrão: a prévia traz o comando **Enquadrar** sobre a imagem ou vídeo, enquanto tipo, arquivo, acessibilidade e substituições responsivas ficam reunidos em um único painel compacto ao lado.
- A imagem principal de cada módulo de `/servicos` segue o mesmo padrão: prévia à esquerda com **Enquadrar** sobre a própria imagem; arquivo e Biblioteca ficam juntos ao lado, e o texto alternativo usa uma linha inteira abaixo. O editor de enquadramento permanece modal e não reserva uma faixa fixa no formulário.
- O Hero de `/sobre` usa a mesma composição compacta de mídia dos módulos de Serviços: prévia alinhada à esquerda, comando **Enquadrar** sobre a foto e editor modal; arquivo/Biblioteca ficam na primeira linha da coluna de edição e o texto alternativo abaixo.
- Os certificados da etapa Governança de `/sobre` seguem a mesma organização visual de mídia, mas sem enquadramento: o site os exibe em `contain`, portanto o corte não tem efeito. A etapa CTA final não possui mídia e preserva sua grade compacta de texto e botões.
- Nos certificados de Governança, título e link ocupam a coluna esquerda em sequência, enquanto a descrição ocupa a coluna direita nas duas linhas. O card não deixa mais uma metade vazia abaixo do título.
- Em Footer Links, as páginas institucionais (Termos, Central de Ajuda e Privacidade) usam navegação paginada compacta: apenas um editor grande é exibido por vez, com seleção direta e anterior/próxima, substituindo os três acordeões empilhados.
- Os blocos de texto editáveis dos Termos de Uso e da Privacidade também usam acordeões compactos: ficam fechados por padrão e levam os comandos Subir, Descer e Remover no cabeçalho, sem perder o bloco aberto quando sua ordem muda.
- Na tela de Footer Links, colunas, links de colunas e inferiores, horários, redes sociais, ações rápidas e FAQs seguem o mesmo padrão compacto quando são coleções: o cabeçalho concentra a ordem e as ações disponíveis, e só o item aberto exibe seus campos.
- O seletor das três etapas de Footer Links usa abas baixas de uma linha, com número e título; as descrições permanecem no cabeçalho da etapa ativa para não transformar a navegação em cards altos.
- As prévias de mídia podem optar por alinhamento inicial no respectivo editor. Nos módulos de `/servicos`, a composição já inicia em duas colunas a partir de `md`, evitando centralização visual e espaço vazio em larguras intermediárias ou com zoom do navegador.
- No editor do Hero, o texto alternativo ocupa uma linha inteira e as substituições de mídia para desktop e celular recebem uma coluna larga cada, evitando que o nome do arquivo e o botão Biblioteca fiquem comprimidos.
- O modal de enquadramento usa a área útil do shell do CMS, trava a rolagem da página enquanto está aberto e mantém prévia e controles no mesmo quadro sem rolagem em desktop. Por ser portalizado dentro do shell, também herda o tema escuro do painel.
- A Biblioteca de mídia também é portalizada no shell do CMS: não pode ser recortada pelo card que a abriu, limita a altura à área útil e deixa a rolagem apenas para a grade de arquivos. O botão de fechar tem contraste explícito em ambos os temas.
- No tema escuro, as superfícies secundárias e seus hovers da Biblioteca de mídia usam azuis escuros próprios; botões de Upload, paginação e demais ações não herdam mais o fundo claro do tema padrão.
- Quando um campo de mídia pede controles empilhados, sua prévia também ocupa uma linha própria antes dos controles. Isso evita que preview, nome do arquivo e botão Biblioteca concorram pela mesma coluna estreita, como na foto opcional de depoimentos da Home.
- No editor de depoimentos da Home, a foto opcional não reserva prévia vazia: sem arquivo, exibe somente seletor, Biblioteca e status lado a lado. Depois da escolha, a prévia passa a ocupar sua linha própria, preservando os controles e evitando espaços ociosos.
- O popup guarda `imagePresentation` separadamente para sua imagem padrão, desktop e celular. `PopupService` aceita essa configuração apenas depois de validar a imagem interna correspondente e normaliza o foco no mesmo contrato seguro do conteúdo, sem receber CSS ou URL livres.
- No editor do Popup de saída, as imagens padrão, desktop e celular usam o mesmo padrão de mídia dos Heros: a prévia só ocupa espaço depois de uma seleção e traz **Enquadrar** sobre a própria foto. O modal continua gravando a apresentação específica de cada uso; não há uma barra de enquadramento separada abaixo do seletor.
- O helper público `site/frontend/src/lib/mediaPresentation.ts` converte foco validado em `object-position` centralizado como fallback e escolhe a substituição móvel quando ela existe. `PresentedImage` e `PresentedVideo` aplicam esse contrato a todo quadro de corte público; o vídeo toca somente o intervalo configurado, respeita `playsInline`, autoplay silencioso, redução de movimento e o ciclo de carrosséis.
- Campanhas usam um contrato local equivalente em `landings.json`: Hero, Story, vitrine e CTA final podem guardar foco por desktop/celular; apenas Story aceita trecho de vídeo. O Builder normaliza e publica somente esse dado mínimo, confirma a duração física quando há trecho e renderiza o enquadramento também nas prévias opacas.

## Portas e artefatos

| Ambiente   | API pública |   API CMS |      Site |       CMS | API Builder |   Builder |
| ---------- | -----------: | --------: | --------: | --------: | ----------: | --------: |
| DEV        |    `31012` | `31013` | `35180` | `35013` |   `36110` | `35112` |
| Produção |     `6050` |  `6051` |  `6060` |  `6061` |   `41110` | `41112` |

- Os três processos de API em produção usam `java -jar dist/server.jar`; os três frontends usam seus artefatos Next `dist-prod/server.js`.
- `ecosystem.config.js`, `iniciar-dev.bat`, `iniciar-prod.bat`, CI e promoção usam essa topologia fixa. Os inicializadores nunca são executados automaticamente pela IA. O orquestrador de produção usa helpers externos para validação, instalação, Maven, typecheck, staging e espera de release, sem subrotinas internas `call :rótulo`.
- Antes de encerrar processos DEV, `iniciar-dev.bat` chama um preflight Maven externo para os três backends; uma falha preserva os processos que já estavam em execução. O inicializador não depende de subrotinas por rótulo. A identificação de processos usa exclusivamente as seis portas DEV canônicas e percorre a ancestralidade para reconhecer as JVMs filhas do Maven sem atingir outro projeto.
- Cada processo Spring iniciado pelo fluxo DEV recebe explicitamente sua porta canônica por launcher isolado: site `31012`, CMS `31013` e Builder `36110`. O launcher usa atribuições `set "chave=valor"`, sem aspas/whitespace propagados para `HOST`, `PORT` ou as variáveis do Builder.
- A promoção preserva rollback completo quando existe conjunto ativo; `RODOGARCIA_INITIAL_PROD_ROLLOUT=1` continua restrito ao caso excepcional em que esse conjunto esteja ausente.
- O preflight de produção recusa os seis listeners DEV antes de executar `npm ci`, pois as instalações compartilham os `node_modules` do checkout e poderiam corromper o runtime DEV em uso. O encerramento/início do DEV permanece manual.
- A guarda de listeners DEV é chamada por um helper batch que captura explicitamente o retorno do PowerShell. Qualquer bloqueio encerra o preflight antes de instalação, build ou acesso a artefatos ativos.
- Os helpers batch de instalação, Maven, typecheck e staging normalizam qualquer retorno diferente de `0` (inclusive o `EPERM -4048` negativo do npm no Windows) para falha explícita; o orquestrador compara o status literal e não pode avançar ao Maven/typecheck após uma instalação incompleta.
- O hardening isolado cobre site e CMS com `site/backend/dist.test/server.jar`, `cms/backend/dist.test/server.jar`, `site/frontend/dist-prod.test` e `cms/frontend/dist-prod.test`. O Builder tem Maven Wrapper e suíte de contrato próprios.
- O helper de build entrega `NEXT_BUILD_DIST_DIR`, `PROD_ARTIFACT_DIR` e o marcador `RODOGARCIA_ISOLATED_PREFLIGHT` diretamente ao npm. Os preparadores Next recusam esse marcador fora de `.next.test`/`dist-prod.test`, portanto uma falha de propagação não pode remover `dist-prod` ativo.

## Contratos, Segurança e Persistência

- A API pública preserva seus contratos de ESL, CEP, CNPJ, `/health` e `/ready`, documentados em `site/backend/contracts/` e cobertos por testes HTTP/socket.
- A API CMS preserva os 95 endpoints explícitos, `/uploads`, cookies, sessão, ACL, CSRF, CORS, limites, DTOs e efeitos descritos em `cms/backend/contracts/`.
- O Builder preserva `/health`, mídia pública em `/landing-media/:id`, campanhas públicas, prévias opacas e operações internas autenticadas por `LANDING_BUILDER_SERVICE_TOKEN`. JSON, multipart, assinatura de mídia, limites, headers de segurança e DTO público mínimo são cobertos por testes de contrato.
- A prévia de uma campanha é entregue exclusivamente pelo renderizador público do Builder, após salvamento explícito no CMS. O token opaco expira em sete dias e é renovado somente em operação interna autenticada; prévia não carrega analytics e não é indexável.
- A mídia da campanha guarda `alt` e, para vídeo, `poster` apontando para imagem da própria biblioteca. Imagens são otimizadas para WebP; vídeo só é aceito na seção Story, com controles acessíveis. Nem a mídia usada pela campanha, por uma revisão ou como poster de vídeo pode ser excluída.
- Campanhas têm histórico limitado a 20 revisões, rollback, cópia, arquivamento e exclusão somente após arquivar. Publicação exige SEO mínimo, CTA completo, seção de conversão preenchida e ausência de textos de orientação; o layout público usa medidas responsivas e a própria landing respeita o consentimento antes de carregar analytics.
- Programações de publicação/despublicação são armazenadas pelo writer único do Builder e aplicadas no processamento seguro seguinte. As operações administrativas de ciclo de vida são auditadas pelo CMS.
- O único analytics de campanha é `ga4MeasurementId`. GTM, Meta Pixel e Google Ads não pertencem ao DTO, ao formulário ou ao renderizador enquanto não houver contrato de consentimento específico para eles.
- No uso isolado, o Builder lê `landing-builder/backend/.env` com a mesma precedência do dotenv histórico: as variáveis do processo prevalecem sobre o arquivo.
- Em produção, CMS e Builder exigem `FFMPEG_PATH` e `FFPROBE_PATH` absolutos, existentes e fora do repositório/`node_modules`; o CMS confere os dois no readiness e o Builder usa o segundo para registrar duração/resolução sem confiar no navegador. O Builder também exige token de serviço forte e storage externo absoluto.
- Arquivos privados, uploads, backups, logs e builds permanecem ignorados pelo Git. A raiz também ignora explicitamente os `target/` dos três backends Spring, relatórios Maven, dumps de JVM e credenciais/certificados locais, preservando wrappers e fontes versionáveis. Apenas o processo responsável por cada coleção pode escrevê-la.

## Migração Spring concluída

- [X] Backend público promovido fisicamente para `site/backend`, com Maven Wrapper, contratos e suíte Spring verificados.
- [X] Backend CMS promovido fisicamente para `cms/backend`, com manifesto de 95 endpoints, persistência JSON e suíte Spring verificados.
- [X] Landing Builder migrado para `landing-builder/backend`, com Maven Wrapper, rotas públicas/internas, prévia, mídia com assinatura real e armazenamento JSON próprios.
- [X] Configuração de ambiente, CI, scripts de promoção, PM2, documentação e runbooks padronizados para os três JARs Spring.
- [X] Fontes e dependências Node dos três backends removidos sem tocar os volumes de storage.

## Validações registradas

- `site/backend`: `mvnw.cmd -B -ntp clean verify` passou com 154 testes.
- `cms/backend`: `mvnw.cmd -B -q verify` passou após a suíte de proxy das operações de ciclo de vida e metadados de mídia do Builder.
- `landing-builder/backend`: `mvnw.cmd -B -q verify` passou com contratos de campanhas, prévias, mídia, assinatura real, limites, revisões, rollback, programação, arquivamento, exclusão protegida e retenção de poster.
- `site/frontend`, `cms/frontend` e `landing-builder/frontend`: typecheck e build isolado em `.next.test` passaram.
- Após a sinalização visual do tipo de carga na cotação, `site/frontend` passou novamente em typecheck e build isolado em `.next.test`.
- Após a base de enquadramento por uso de mídia, `cms/backend` passou em `mvnw.cmd -B clean verify` (183 testes); `site/frontend` e `cms/frontend` passaram em typecheck e build isolado em `.next.test` sem interromper os DEV ativos.
- Após os metadados da biblioteca, `cms/backend` passou em `mvnw.cmd -B clean verify` (186 testes); `cms/frontend` passou em typecheck e build isolado em `.next.test`, sem interromper o DEV ativo.
- Após o editor visual inicial, `site/frontend` e `cms/frontend` passaram em typecheck e build isolado em `.next.test`, sem interromper os DEV ativos.
- Após a integração do editor no Hero de Sobre e na foto de cultura de Carreiras, `site/frontend` e `cms/frontend` passaram novamente em typecheck.
- Após aplicar foco visual em todos os quadros de mídia da Home, `site/frontend` passou novamente em typecheck e build isolado em `.next.test`.
- Após concluir o popup de saída, `cms/backend` passou em `mvnw.cmd -B clean verify` (incluindo a normalização segura das três imagens); `site/frontend` e `cms/frontend` passaram em typecheck e build isolado em `.next.test`.
- Após concluir enquadramento e trechos de mídia: `cms/backend` passou em `mvnw.cmd -B clean verify` com 188 testes; `landing-builder/backend` passou em `mvnw.cmd -B clean verify` com 9 testes; `site/frontend`, `cms/frontend` e `landing-builder/frontend` passaram em typecheck e build isolado em `.next.test`. Nenhum processo DEV ou de produção foi iniciado, reiniciado ou encerrado.
- Após compactar os quatro KPIs da visão executiva, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após compactar a cobertura por módulo, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após compactar as páginas mais acessadas, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após reorganizar os atalhos rápidos do CMS, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após compactar os sinais operacionais, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após compactar o editor de vagas, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após levar e alinhar as ações de acordeões na barra, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após isolar a aparência das ações da barra, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após animar os controles de coleção do CMS, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após compactar o painel reutilizável de botões, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após posicionar o comando de enquadramento sobre a prévia da foto de cultura, compactar o modal na altura útil da tela e sincronizá-lo ao tema escuro, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após compactar o cabeçalho de Orientações em acordeão, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após aplicar colunas automáticas e cards mais baixos ao seletor de etapas da Home, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após substituir os cards do seletor de etapas da Home por abas compactas, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após alinhar dimensionalmente os controles Remover, Subir e Descer, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após reorganizar o editor de mídia do Hero e expor o enquadramento na prévia, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após portalizar e estabilizar o modal da Biblioteca de mídia, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após corrigir as superfícies de botões da Biblioteca no tema escuro, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após ampliar os seletores de mídia responsiva do Hero, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após redistribuir os campos de Linhas de serviço em colunas, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após alinhar contador e orientação em Linhas de serviço, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após substituir o seletor paginado de Unidades da Home por acordeões com ordem e remoção, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após empilhar prévia e controles da foto opcional de depoimentos, eliminando o corte lateral, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após compactar o editor de depoimentos sem reservar prévia vazia, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após reposicionar o enquadramento da imagem dos módulos de Serviços sobre a prévia, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após alinhar a prévia à esquerda e levar o texto alternativo abaixo dos controles de mídia em Serviços, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após padronizar a mídia do Hero de Sobre com a composição de Serviços, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após alinhar a mídia dos certificados da Governança de Sobre ao mesmo padrão compacto, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após redistribuir título, descrição e link dos certificados de Governança sem espaço ocioso, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após concluir a paginação dos editores grandes das páginas institucionais do Footer Links e remover o acordeão substituído, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após compactar os blocos dos Termos de Uso e da Privacidade em acordeões com reordenação, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após estender os acordeões e a reordenação às demais coleções de Footer Links, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após reduzir o seletor de etapas de Footer Links para abas de uma linha, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após reorganizar o cadastro de Unidades em blocos compactos e eliminar lacunas na grade, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após compactar a tela de Analytics com a mesma densidade do dashboard, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após reduzir a área de configurações de Analytics a linhas compactas de ativação e identificador, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após alinhar as três imagens do Popup de saída ao padrão de prévia com enquadramento sobreposto e eliminar a área vazia sem mídia, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após centralizar os avisos de acesso restrito em Setores e Usuários, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após aplicar desfoque à camada decorativa do fundo escuro do CMS, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após reduzir o desfoque do fundo escuro do CMS para `2px`, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- Após aplicar o mesmo desfoque de `2px` ao fundo escuro da tela de login, `cms/frontend` passou em `npm run typecheck` e no build isolado com `NEXT_BUILD_DIST_DIR=.next.test`.
- `node scripts/tests/test-production-operations.js` passou, inclusive a guarda contra retorno de `call :rótulo`, a recusa do DEV ativo e a propagação correta do `EPERM -4048` do npm no `iniciar-prod.bat`; os helpers PowerShell e a promoção de artefatos também foram validados estaticamente.
- A guarda real do `cmd` com listeners DEV ativos retornou `1` e bloqueou antes do build. A preparação isolada dos três frontends foi exercitada em fixture; no site, o build em `.next.test` e o preparo produziram `dist-prod.test` sem alterar `dist-prod`.
- O hardening isolado de site/CMS passou integralmente com JARs e storage temporários. Ele não usou portas ou artefatos de produção.

## Tarefas Pendentes

### Enquadramento e trechos de fotos e vídeos no CMS

> A implementação foi concluída. O enquadramento é específico de cada uso da mídia, preserva o arquivo original e só aparece onde a interface pública usa corte visual (`cover`); logos, certificados em `contain` e imagens de SEO permanecem sem esse controle.

- [ ] Validar visualmente, com os processos DEV já iniciados manualmente pela equipe, os previews e páginas públicas em desktop e celular para Home, Serviços, Sobre, Trabalhe Conosco, Popup e campanha.

#### Fora do escopo inicial, mas registrado para evolução posterior

- [ ] Avaliar uma ação explícita de “Criar cópia cortada” para gerar um novo arquivo permanente de imagem ou vídeo; ela não deve sobrescrever o original nem alterar automaticamente usos existentes.
