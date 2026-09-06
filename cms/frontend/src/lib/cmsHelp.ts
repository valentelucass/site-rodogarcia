/**
 * Fonte única das ajudas exibidas no CMS.
 *
 * Ao criar ou alterar um controle do CMS, revise a entrada correspondente em
 * `CMS_HELP_TEMPLATES`. Cada ajuda importante explica função, origem, destino,
 * efeito do salvamento e, quando houver, o contrato técnico que a protege.
 * Campos e seções sem entrada recebem uma ficha padrão para que nenhum
 * controle fique sem contexto enquanto a tela evolui.
 */

import { cmsHref } from "@/lib/routes";

export type CmsHelpKind = "page" | "section" | "field" | "metric" | "accordion";

export interface CmsHelpDetail {
  label: string;
  value: string;
  technical?: boolean;
}

export interface CmsHelpContent {
  title: string;
  summary: string;
  example: string;
  details: CmsHelpDetail[];
}

interface CmsHelpTemplate {
  title?: string;
  summary?: string;
  example?: string;
  details: CmsHelpDetail[];
}

const CMS_PAGE_NAMES: Record<string, string> = {
  "/developer": "Painel do CMS",
  "/developer/analytics": "Analytics",
  "/developer/cotacao": "Cotação",
  "/developer/coletas": "Coletas",
  "/developer/fale-conosco": "Fale Conosco",
  "/developer/footer-links": "Footer Links",
  "/developer/navegacao": "Navegação",
  "/developer/home": "Home",
  "/developer/home-dna": "Home — DNA",
  "/developer/home-hero": "Home — Hero",
  "/developer/imagens": "Imagens",
  "/developer/leads": "Leads",
  "/developer/landing-pages": "Landing Pages",
  "/developer/melhorias": "Melhoria Contínua",
  "/developer/lgpd-cookies": "LGPD e Cookies",
  "/developer/monitoramento-cookies": "Monitoramento de Cookies",
  "/developer/para-empresas": "Para Empresas",
  "/developer/popup-exit": "Popup de saída",
  "/developer/rastreamento": "Rastreamento",
  "/developer/seo": "SEO",
  "/developer/servicos": "Serviços",
  "/developer/servicos-feedbacks": "Home — Prova social",
  "/developer/sobre": "Sobre",
  "/developer/sobre-hero": "Sobre — Hero",
  "/developer/trabalhe-conosco": "Trabalhe Conosco",
  "/developer/unidades": "Unidades",
  "/developer/usuarios": "Usuários",
  "/developer/setores": "Setores e acessos",
  "/developer/vagas": "Vagas",
};

const CMS_PUBLIC_DESTINATIONS: Record<string, string> = {
  "/developer/cotacao": "/cotacao",
  "/developer/coletas": "/coletas",
  "/developer/melhorias": "/melhoria-continua e a lista interna de sugestões",
  "/developer/fale-conosco": "/fale-conosco",
  "/developer/footer-links": "o rodapé e as páginas institucionais",
  "/developer/navegacao": "o menu lateral aberto pelo cabeçalho do site",
  "/developer/home": "/",
  "/developer/home-dna": "/",
  "/developer/home-hero": "/",
  "/developer/lgpd-cookies": "o banner de cookies exibido no site",
  "/developer/para-empresas": "/para-empresas",
  "/developer/popup-exit": "o popup de saída do site",
  "/developer/servicos": "/servicos",
  "/developer/sobre": "/sobre",
  "/developer/trabalhe-conosco": "/trabalhe-conosco",
  "/developer/unidades": "as unidades exibidas no site",
  "/developer/vagas": "/trabalhe-conosco",
};

interface CmsHelpContext {
  destination: string;
  action: string;
  example: string;
}

const CMS_HELP_CONTEXTS: Record<string, CmsHelpContext> = {
  "/developer": { destination: "o painel inicial do CMS", action: "acompanha o conteúdo, acessos e indicadores do site", example: "Veja quantos itens são editáveis antes de entrar no módulo que deseja alterar." },
  "/developer/analytics": { destination: "os relatórios de Analytics, sem alterar a página pública", action: "consulta visualizações, eventos e integrações de medição", example: "Filtre por /servicos para saber quantas visitas essa página recebeu." },
  "/developer/cotacao": { destination: "/cotacao", action: "edita os textos, canais e chamadas da página de cotação", example: "Troque o texto “Solicitar cotação” pelo CTA que sua equipe utiliza." },
  "/developer/coletas": { destination: "/coletas", action: "edita os botões do hero da página de coleta", example: "Use “Solicitar coleta” com o link “#formulario-coleta” para levar o visitante ao formulário na própria página." },
  "/developer/fale-conosco": { destination: "/fale-conosco", action: "edita os canais e chamadas de contato", example: "Atualize o telefone ou o botão de WhatsApp que o visitante verá." },
  "/developer/footer-links": { destination: "o rodapé e as páginas institucionais", action: "edita links, textos institucionais e redes sociais", example: "Altere o link de Privacidade para levar o visitante à política correta." },
  "/developer/navegacao": { destination: "o menu lateral aberto pelo cabeçalho do site", action: "organiza os links, ícones e destaques que o visitante encontra na navegação", example: "Use o destaque “Novo” em verde para dar visibilidade a uma página recém-publicada." },
  "/developer/home": { destination: "a página inicial /", action: "edita os blocos principais da Home", example: "Troque uma imagem do hero para atualizar a primeira área vista pelo visitante." },
  "/developer/home-dna": { destination: "a seção de DNA da página inicial /", action: "edita o conteúdo institucional da Home", example: "Atualize um valor da empresa para ele aparecer na seção institucional da Home." },
  "/developer/home-hero": { destination: "o hero da página inicial /", action: "edita os slides e botões de abertura da Home", example: "Escolha uma nova imagem para o primeiro slide do site." },
  "/developer/imagens": { destination: "a Biblioteca de mídia e os slots de imagem do site", action: "faz upload, organiza mídia e vincula arquivos a áreas do site; a lista mostra tamanho, resolução, proporção e, em vídeos, a duração lida do arquivo", example: "Compare a proporção 4:5 de uma foto com o espaço visual do bloco antes de usá-la, sem alterar as outras mídias da Biblioteca." },
  "/developer/leads": { destination: "a lista interna de contatos recebidos, sem alterar o site", action: "consulta e filtra leads enviados por formulários", example: "Pesquise um e-mail para localizar o contato enviado pelo formulário." },
  "/developer/landing-pages": { destination: "as rotas de campanhas, como /nome-da-campanha", action: "cria, edita, pré-visualiza e publica landing pages independentes", example: "Salve uma campanha como rascunho, revise o Hero e publique quando a rota estiver pronta para divulgação." },
  "/developer/melhorias": { destination: "/melhoria-continua e a lista interna de sugestões", action: "registra sugestões internas como colaborador e acompanha os envios de visitantes e colaboradores, incluindo os anexos privados", example: "Abra Sugestão interna, escolha um nome ou e-mail sugerido de um usuário do CMS e registre área, tipo, contexto e impacto. Ela entra em Pendentes; uma concluída segue para Arquivadas após 60 dias." },
  "/developer/lgpd-cookies": { destination: "o banner de cookies mostrado ao visitante", action: "edita os textos e as regras de consentimento", example: "Aumente a versão ao mudar a mensagem que o visitante precisa aceitar." },
  "/developer/monitoramento-cookies": { destination: "os registros internos de consentimento, sem alterar o site", action: "consulta as escolhas de cookies registradas", example: "Filtre por categoria Analytics para conferir os consentimentos relacionados." },
  "/developer/para-empresas": { destination: "/para-empresas", action: "edita a página voltada a clientes empresariais", example: "Atualize o CTA que leva empresas ao formulário de cotação." },
  "/developer/popup-exit": { destination: "o popup exibido quando o visitante tenta sair do site", action: "edita a mensagem, imagem e regras do popup", example: "Defina 24 horas de intervalo para não mostrar o popup repetidamente." },
  "/developer/rastreamento": { destination: "os registros internos de rastreamento, sem alterar o site", action: "consulta eventos e auditorias do CMS", example: "Filtre por /fale-conosco para ver eventos daquela página." },
  "/developer/seo": { destination: "os resultados de busca e compartilhamentos das páginas públicas", action: "edita títulos, descrições e metadados de busca", example: "Use “Serviços | Rodogarcia” como título da página /servicos no Google." },
  "/developer/servicos": { destination: "/servicos", action: "edita os cards e chamadas dos serviços", example: "Troque a foto do módulo de distribuição para atualizar somente esse card." },
  "/developer/servicos-feedbacks": { destination: "a seção Prova Social da página inicial /", action: "leva ao editor dos depoimentos exibidos na Home", example: "Atualize um depoimento para que ele apareça no carrossel da página inicial, sem alterar os cards de Serviços." },
  "/developer/sobre": { destination: "/sobre", action: "edita a apresentação institucional e cada item do carrossel de certificados", example: "Adicione ou reorganize um certificado para alterar a sequência exibida na área de Governança." },
  "/developer/sobre-hero": { destination: "o hero da página /sobre", action: "edita a abertura da página Sobre", example: "Troque o título do hero para atualizar a primeira mensagem da página." },
  "/developer/trabalhe-conosco": { destination: "/trabalhe-conosco", action: "edita cultura, vagas e chamadas de carreira", example: "Atualize a foto de cultura para ela aparecer na página de carreiras." },
  "/developer/unidades": { destination: "as unidades exibidas no site", action: "edita endereço, contatos e dados de cada unidade", example: "Atualize o telefone de Campinas para o visitante ver o novo contato." },
  "/developer/usuarios": { destination: "as contas internas do CMS, sem alterar o site", action: "permite ao usuário supremo criar e administrar acessos ao painel", example: "O usuário supremo pode criar uma conta para operacao@rodo... e escolher o perfil permitido." },
  "/developer/setores": { destination: "as permissões internas do CMS, sem alterar o site", action: "permite ao usuário supremo criar setores e definir as áreas liberadas a cada perfil", example: "O usuário supremo pode criar o setor Recursos Humanos e liberar somente Página Carreiras e Imagens." },
  "/developer/vagas": { destination: "as vagas de /trabalhe-conosco", action: "edita oportunidades de trabalho", example: "Crie a vaga “Motorista Carreteiro” para ela aparecer na página de carreiras." },
};

const CMS_HELP_TEMPLATES: Record<string, CmsHelpTemplate> = {
  "popup-exit.field.image": {
    title: "Imagem do popup de saída",
    summary: "Escolha uma imagem da Biblioteca para aparecer no popup de saída. Depois da seleção, a prévia mostra o botão Enquadrar sobre a própria foto para você definir qual parte o visitante verá, sem alterar o arquivo original.",
    example: "Use uma imagem vertical da operação e clique em Enquadrar sobre a prévia para manter a área mais importante visível no popup.",
    details: [
      { label: "Onde aparece", value: "No popup de saída do site. A imagem padrão é usada quando não houver uma versão específica para desktop ou celular." },
      { label: "Biblioteca", value: "Aceita somente imagens internas validadas no CMS; links externos não são permitidos." },
      { label: "Enquadramento", value: "O ajuste grava apenas a posição desta imagem neste popup. Ele não recorta nem substitui o arquivo da Biblioteca.", technical: true },
    ],
  },
  "global.field.media-placement": {
    title: "Enquadramento no quadro",
    summary: "Use o botão Enquadrar foto ou Enquadrar vídeo ao lado da mídia para abrir o ajuste em uma janela. Escolha ali qual parte continua visível quando o site precisa cortar a mídia; salvar muda somente este uso, sem alterar o arquivo original da Biblioteca.",
    example: "Se a carreta está no começo da imagem, arraste o alvo até ela ou escolha o atalho do lado correspondente.",
    details: [
      { label: "Onde aparece", value: "No quadro visual que está sendo editado em {publicDestination}." },
      { label: "Desktop e celular", value: "O celular herda o enquadramento do desktop até você marcar a opção para ajustá-lo separadamente." },
      { label: "Arquivo original", value: "O CMS grava apenas o ponto de enquadramento deste local; não corta, substitui nem modifica o arquivo da Biblioteca.", technical: true },
    ],
  },
  "home.field.video-range": {
    title: "Trecho do vídeo",
    summary: "Escolha de qual segundo o vídeo começa e quanto tempo ele roda neste quadro da Home. O arquivo original continua inteiro na Biblioteca; somente este uso passa a mostrar o trecho escolhido.",
    example: "Em um vídeo de 40 segundos, escolha início 8s e duração 10s para mostrar apenas a chegada da carreta no Hero.",
    details: [{ label: "Onde aparece", value: "Na área da Home que está sendo editada, como Hero, Operações ou card de serviço." }, { label: "Até o fim", value: "Use esta opção quando o vídeo deve seguir do segundo inicial escolhido até o fim do arquivo." }, { label: "Limite", value: "A duração carregada do arquivo limita o início e o fim disponíveis. O CMS não altera nem recorta o vídeo enviado.", technical: true }],
  },
  "landing-pages.field.section-visibility": {
    title: "Visibilidade da seção",
    summary: "Escolha se este trecho do template aparece na landing publicada. Ao desmarcar, o conteúdo continua salvo no CMS e pode ser exibido novamente depois.",
    example: "Oculte o depoimento enquanto aguarda autorização do cliente; ele não aparecerá em /lp1 até ser ativado novamente.",
    details: [{ label: "Onde aparece", value: "Na seção correspondente da rota pública da campanha, como /lp1." }, { label: "Após salvar", value: "A seção deixa de ser renderizada ou volta a aparecer na landing e na prévia privada." }, { label: "Conteúdo", value: "Desativar a seção não apaga textos, mídia, perguntas ou botões já preenchidos." }],
  },
  "landing-pages.field.coverage-title": {
    title: "Título da cobertura",
    summary: "Explique a abrangência que a campanha oferece. Este título aparece ao lado do mapa do Brasil logo após o Hero da landing.",
    example: "Use “Conectamos os maiores polos industriais do Brasil” para uma campanha de logística nacional.",
    details: [{ label: "Onde aparece", value: "Na seção Cobertura e formulário B2B da rota publicada, como /lp1." }, { label: "Limite", value: "Use até 180 caracteres para preservar a leitura em Desktop, Tablet e Mobile.", technical: true }],
  },
  "landing-pages.field.coverage-description": {
    title: "Descrição da cobertura",
    summary: "Resuma como a operação atende o território e quais necessidades ela resolve. O visitante lê este texto abaixo do mapa do Brasil.",
    example: "Cite distribuição, operação dedicada ou armazenagem apenas quando forem serviços realmente oferecidos.",
    details: [{ label: "Onde aparece", value: "Abaixo do título de cobertura, ao lado do formulário B2B da landing publicada." }, { label: "Limite", value: "Aceita até 900 caracteres; prefira uma explicação curta para a seção continuar direta.", technical: true }],
  },
  "landing-pages.field.map-base-color": {
    title: "Estados sem filial",
    summary: "Escolha a cor usada nos estados onde a Rodogarcia não possui filial. A escolha muda a base do mapa da seção Cobertura B2B, logo após o Hero.",
    example: "Mantenha um tom claro para que SP, PR, RJ, RS e PE continuem em evidência.",
    details: [{ label: "Onde aparece", value: "No mapa do Brasil da seção Cobertura B2B, publicada na rota da campanha, como /lp1." }, { label: "Formato", value: "O seletor grava uma cor hexadecimal de seis dígitos, como #A9D4EF.", technical: true }],
  },
  "landing-pages.field.map-branch-color": {
    title: "Estados com filial",
    summary: "Escolha a cor de destaque das filiais confirmadas: SP, PR, RJ, RS e PE. Ela também identifica esses estados na legenda logo abaixo do mapa.",
    example: "Use um tom escuro com contraste suficiente sobre a base clara do mapa.",
    details: [{ label: "Onde aparece", value: "Nos cinco estados atendidos e na legenda da Cobertura B2B da campanha publicada." }, { label: "Regra", value: "A cor não altera quais estados são exibidos como filiais; essa lista continua vinculada às Unidades canônicas da Rodogarcia.", technical: true }],
  },
  "landing-pages.field.map-border-color": {
    title: "Contornos do mapa",
    summary: "Defina a cor das divisões entre os estados para manter a leitura do mapa clara em qualquer paleta escolhida.",
    example: "Use branco ou outro tom de alto contraste quando a base do mapa for azul ou escura.",
    details: [{ label: "Onde aparece", value: "Entre todos os estados do mapa da seção Cobertura B2B." }, { label: "Formato", value: "O seletor grava uma cor hexadecimal de seis dígitos, como #FFFFFF.", technical: true }],
  },
  "landing-pages.field.b2b-form-title": {
    title: "Título do formulário",
    summary: "Defina a chamada que convida a pessoa a pedir atendimento. Ela aparece no painel escuro de contato B2B logo após o Hero.",
    example: "Use “Fale com um especialista em logística B2B” para deixar claro quem atenderá a demanda.",
    details: [{ label: "Onde aparece", value: "No topo do formulário de captação da campanha publicada." }, { label: "Dados recebidos", value: "O formulário padrão coleta nome, e-mail corporativo, telefone, CNPJ, locais da operação e observações para a base de Leads do CMS." }],
  },
  "landing-pages.field.b2b-form-description": {
    title: "Descrição do formulário",
    summary: "Explique o que acontecerá depois do envio para reduzir insegurança antes da pessoa compartilhar os dados comerciais.",
    example: "Informe que a equipe analisará a demanda e retornará pelo canal de contato informado.",
    details: [{ label: "Onde aparece", value: "Logo abaixo do título do formulário B2B na landing publicada." }, { label: "Privacidade", value: "A pessoa precisa aceitar a Política de Privacidade antes de enviar; essa regra não pode ser removida pelo CMS." }],
  },
  "landing-pages.field.b2b-form-submit": {
    title: "Texto do botão",
    summary: "Escolha o texto da ação que envia a demanda comercial. O botão grava um lead com a rota da campanha na base central do CMS.",
    example: "Use “Receber solução personalizada” quando o retorno depender da análise da operação.",
    details: [{ label: "Onde aparece", value: "No fim do formulário B2B logo após o Hero da landing publicada." }, { label: "Após o envio", value: "A pessoa vê uma confirmação; dados válidos ficam na área Leads do CMS com origem landing-b2b-form." }],
  },
  "landing-pages.field.metric-description": {
    title: "Descrição do número",
    summary: "Explique por que este indicador reforça a capacidade da empresa. O visitante lê o texto abaixo do número na seção Serviços e indicadores da campanha.",
    example: "Use uma frase curta sobre infraestrutura, cobertura ou experiência, sempre com uma informação que possa ser comprovada.",
    details: [{ label: "Onde aparece", value: "Abaixo da legenda de cada número, logo após os cards de serviços da rota publicada, como /lp1." }, { label: "Limite", value: "Aceita até 320 caracteres; prefira uma explicação direta para manter a comparação entre os indicadores clara.", technical: true }],
  },
  "landing-pages.field.feedback-description": {
    title: "Texto de contexto dos feedbacks",
    summary: "Explique brevemente por que as avaliações aparecem na campanha. O visitante lê este texto entre o título da seção e os cards de feedbacks.",
    example: "Use uma mensagem institucional curta e só publique avaliações de pessoas ou empresas que autorizaram a divulgação.",
    details: [{ label: "Onde aparece", value: "Na seção Feedbacks, depois de Imagem e texto da rota publicada, como /lp1." }, { label: "Limite", value: "Aceita até 900 caracteres; prefira poucas linhas para não afastar os cards das avaliações.", technical: true }],
  },
  "landing-pages.field.feedback-message": {
    title: "Feedback do cliente",
    summary: "Registre uma avaliação real e autorizada para aparecer em um card da landing. O texto ajuda quem visita a entender a experiência de outros clientes.",
    example: "Use a fala aprovada pelo cliente, sem dados pessoais desnecessários, números de pedido ou informações internas da operação.",
    details: [{ label: "Onde aparece", value: "Dentro de um card da seção Feedbacks da campanha publicada." }, { label: "Limite", value: "Aceita até 900 caracteres; priorize uma avaliação curta e compreensível em Mobile.", technical: true }],
  },
  "landing-pages.field.story-image": {
    title: "Imagem ou vídeo da seção",
    summary: "Escolha uma imagem ou vídeo enviado para esta campanha para ficar na coluna esquerda de “Imagem e conteúdo”. O visitante verá a mídia ao lado do texto; vídeos têm controles de reprodução e podem usar uma capa antes de iniciar.",
    example: "Envie um vídeo curto da operação, escreva a descrição alternativa na Biblioteca e escolha uma imagem como poster se quiser definir a capa.",
    details: [{ label: "Onde aparece", value: "Na coluna esquerda da seção “Imagem e conteúdo” da rota pública da campanha." }, { label: "Biblioteca", value: "A lista mostra imagens e vídeos validados e enviados para o Landing Builder; links externos não são aceitos." }, { label: "Acessibilidade", value: "A descrição alternativa é exibida para leitores de tela. Para vídeo, a capa é opcional e os controles permanecem disponíveis ao visitante." }, { label: "Sem mídia", value: "O painel de conteúdo continua visível com uma área neutra à esquerda até uma mídia ser escolhida." }],
  },
  "landing-pages.field.showcase-background": {
    title: "Foto de fundo das soluções",
    summary: "Escolha uma imagem da biblioteca desta campanha para ficar ao fundo da seção de soluções, antes de “Imagem e conteúdo”. O texto e os cards continuam legíveis com uma camada de contraste automática.",
    example: "Use uma foto horizontal do armazém, da frota ou da operação, com espaço visual para o título e os cards.",
    details: [{ label: "Onde aparece", value: "No fundo da seção “Soluções com foto de fundo” da rota pública, antes dos Feedbacks." }, { label: "Biblioteca", value: "A lista aceita somente imagens internas validadas no Landing Builder." }, { label: "Sem imagem", value: "A seção mantém o fundo sólido da paleta da landing e todos os cards permanecem disponíveis." }],
  },
  "landing-pages.field.final-cta-image": {
    title: "Imagem de fundo do CTA final",
    summary: "Escolha uma imagem desta campanha para aparecer atrás da chamada final antes do rodapé. Sem seleção, o CTA continua com um fundo sólido e legível.",
    example: "Use uma foto horizontal da operação ou da frota, com espaço visual para o título e o botão no lado esquerdo.",
    details: [{ label: "Onde aparece", value: "No último CTA da landing, logo depois das Perguntas frequentes e antes do rodapé." }, { label: "Biblioteca", value: "Aceita somente uma imagem enviada e validada para esta campanha; links externos não aparecem na lista." }, { label: "Contraste", value: "A imagem recebe uma camada escura para manter título, descrição e botão legíveis." }],
  },
  "landing-pages.field.responsive-preview": {
    title: "Referências de tela",
    summary: "Escolha Desktop, Tablet ou Mobile para editar a referência visual do template. Os lápis abrem só os campos daquele ponto; depois de salvar, use “Abrir prévia real” para conferir o renderizador público que o visitante receberá.",
    example: "Na Cobertura B2B, use o lápis do título para ajustar a mensagem, o do mapa para trocar as cores e o do card escuro para alterar apenas o formulário; salve e abra a prévia real antes de publicar.",
    details: [{ label: "Onde aparece", value: "No canvas de edição de /admin/developer/landing-pages." }, { label: "Navegação e edição", value: "Desktop, Tablet e Mobile mostram do Hero ao rodapé em uma área rolável. Os atalhos rolam somente esse canvas, sem mover a página do CMS. Cada lápis abre uma ficha curta do elemento visual em que ele aparece." }, { label: "Prévia real", value: "A prévia real só usa conteúdo salvo e abre a rota privada renderizada pelo Landing Builder. Ela expira em sete dias, permanece noindex e é renovada ao abrir novamente." }, { label: "Comparar", value: "Mostra as três larguras de referência ao mesmo tempo; a confirmação final de responsividade deve ser feita na prévia real salva." }],
  },
  "landing-pages.field.theme": {
    title: "Cores da landing",
    summary: "Escolha uma paleta pronta ou personalize as quatro cores da sua campanha. A prévia mostra a alteração na hora, e a escolha passa a valer na landing depois de salvar.",
    example: "Comece pela paleta Marinho e troque apenas a Cor dos detalhes pelo tom usado na chamada principal da campanha.",
    details: [{ label: "Cor dos detalhes", value: "Define botões, links e elementos que precisam chamar atenção." }, { label: "Cor de apoio", value: "Complementa os detalhes em elementos secundários da campanha." }, { label: "Fundo e texto", value: "Controlam as áreas claras e a leitura principal. Escolha cores com contraste suficiente para o visitante conseguir ler todo o conteúdo." }, { label: "Paletas prontas", value: "Aplicam as quatro cores de uma vez; depois, qualquer amostra pode ser personalizada individualmente." }],
  },
  "landing-pages.field.nome": {
    title: "Nome da landing page",
    summary: "Dê um nome interno para reconhecer esta campanha no painel. Esse nome organiza a lista de Landing Pages e não muda sozinho o endereço público.",
    example: "Use “Campanha distribuição Sudeste” para localizar a landing antes de publicar.",
    details: [{ label: "Onde aparece", value: "Na lista interna de Landing Pages do CMS." }, { label: "Após salvar", value: "A campanha fica identificada no painel; o visitante verá os títulos configurados no Hero." }],
  },
  "landing-pages.field.rota": {
    title: "Rota da landing page",
    summary: "Escolha a parte final do endereço da campanha. Depois de publicar, o visitante acessará esta landing pelo domínio institucional seguido desse nome.",
    example: "Use campanha-distribuicao para publicar em /campanha-distribuicao.",
    details: [{ label: "Formato", value: "Use letras minúsculas, números e hífens, sem espaços ou barras." }, { label: "Validação", value: "A rota precisa ser única e não pode usar páginas, aliases, APIs ou áreas administrativas já reservadas pelo site.", technical: true }, { label: "Após publicar", value: "O proxy do site encaminha a rota para o frontend do Landing Builder." }],
  },
  "landing-pages.field.ga4": {
    title: "Measurement ID GA4",
    summary: "Informe o código do Google Analytics exclusivo desta campanha. Ele mede somente a landing publicada nesta rota, depois que a pessoa aceitar cookies de analytics.",
    example: "Cole um código no formato G-ABC123DEF4 criado para esta campanha.",
    details: [{ label: "Onde aparece", value: "Não é visível ao visitante; é usado apenas pelo Google Analytics desta campanha." }, { label: "Validação", value: "O CMS aceita apenas códigos no formato G- seguido por letras e números.", technical: true }, { label: "Consentimento", value: "O script só é carregado após a escolha positiva de analytics. GTM, Meta Pixel e Google Ads não são configurados neste template enquanto não houver renderizador sujeito a consentimento." }],
  },
  "landing-pages.field.seo-title": {
    title: "Título SEO da campanha",
    summary: "Escreva o título que buscadores e compartilhamentos usarão para esta campanha. Se você deixar vazio, a landing usa o título principal do Hero.",
    example: "Use “Distribuição para o Sudeste | Rodogarcia” para uma campanha regional.",
    details: [{ label: "Onde aparece", value: "Nos resultados de busca e na aba do navegador da landing publicada." }, { label: "Limite", value: "Use de 20 a 70 caracteres para concluir a publicação e manter o título objetivo.", technical: true }, { label: "Prévia", value: "A prévia privada permanece fora de resultados, mesmo que esta campanha esteja configurada para indexação." }],
  },
  "landing-pages.field.seo-description": {
    title: "Descrição SEO da campanha",
    summary: "Resuma em poucas palavras o que a campanha oferece. Essa descrição ajuda a explicar a landing nos resultados de busca e compartilhamentos.",
    example: "Use “Soluções de distribuição com acompanhamento e cobertura para operações no Sudeste.”",
    details: [{ label: "Onde aparece", value: "Abaixo do título em resultados de busca e em compartilhamentos compatíveis." }, { label: "Limite", value: "Use de 50 a 160 caracteres para concluir a publicação, sem dados sensíveis ou promessas que não estejam na campanha.", technical: true }, { label: "Após salvar", value: "A descrição passa a ser usada quando a landing publicada for consultada por buscadores." }],
  },
  "landing-pages.field.seo-index": {
    title: "Indexação da campanha",
    summary: "Escolha se buscadores podem incluir esta campanha publicada nos resultados. Desmarque durante testes, campanhas internas ou páginas temporárias.",
    example: "Mantenha desmarcado até revisar a campanha; marque apenas quando ela estiver pronta para divulgação pública.",
    details: [{ label: "Onde aparece", value: "Na instrução de indexação da landing publicada; não altera o conteúdo visível ao visitante." }, { label: "Prévia privada", value: "Prévia de rascunho nunca é indexada, independentemente desta escolha.", technical: true }, { label: "Sitemap", value: "Somente campanhas publicadas e indexáveis podem entrar no sitemap da aplicação." }],
  },
  "landing-pages.section.hero": {
    title: "Hero da landing page",
    summary: "Os lápis da prévia editam separadamente os contatos, logo, foto, mensagem com botão e cartões do topo da campanha. Cada popup muda somente o bloco que você escolheu.",
    example: "Use uma foto interna de caminhão como fundo e destaque quatro diferenciais operacionais nos cartões inferiores.",
    details: [{ label: "Onde aparece", value: "No topo da rota publicada ou na prévia privada da landing page." }, { label: "Mídia", value: "Logo e foto de fundo são escolhidos na biblioteca própria do Landing Builder. Envie apenas imagens internas validadas; links externos, data URLs e caminhos manuais não são aceitos." }, { label: "Prévia", value: "Depois de salvar o rascunho, use Abrir prévia para revisar a campanha sem publicá-la. A URL privada não é indexada." }, { label: "Edição visual", value: "Use o lápis de cada bloco na prévia. Ele abre uma janela pequena sem rolar a página e sem mostrar campos de outras áreas." }],
  },
  "home.field.visibilidade-do-atalho": {
    title: "Visibilidade do atalho",
    summary: "Aqui você decide se este atalho aparece abaixo do hero da página inicial. Ao ocultar o botão de Taxas, os demais atalhos são centralizados automaticamente para a faixa continuar equilibrada.",
    example: "Desative Taxas quando o PDF não estiver disponível; os atalhos de rastreamento e coleta permanecem visíveis e centralizados.",
    details: [
      { label: "Onde aparece", value: "Na faixa de busca e atalhos logo abaixo do hero da página inicial (/)." },
      { label: "Taxas ocultas", value: "Quando o atalho identificado como Taxas é desativado e restam duas ações principais, o site mantém a largura dos botões e centraliza o conjunto no desktop." },
      { label: "Após salvar", value: "O atalho fica oculto ou volta a aparecer imediatamente na página inicial; seu texto e link permanecem guardados no CMS." },
    ],
  },
  "coletas.section.hero": {
    title: "Botões do hero de Coletas",
    summary: "Aqui você configura os dois botões no topo de /coletas. Um pode levar ao formulário desta página e o outro à cotação, para que o visitante escolha o próximo passo sem procurar no menu.",
    example: "Use “Solicitar coleta” com “#formulario-coleta” e “Solicitar cotação” com “/cotacao”.",
    details: [
      { label: "Onde aparece", value: "No hero, no topo da rota /coletas." },
      { label: "Primeiro botão", value: "Use a âncora #formulario-coleta para rolar até o formulário de coleta desta página." },
      { label: "Segundo botão", value: "Pode apontar para /cotacao ou outra rota interna, URL externa, telefone ou e-mail válido." },
      { label: "Validação", value: "Cada botão exige texto e link válido; o CMS sanitiza o endereço antes de publicar.", technical: true },
      { label: "Após salvar", value: "Os dois CTAs do hero de /coletas são atualizados sem alterar os campos do formulário." },
    ],
    },
    "coletas.section.orientacoes-em-acordeao": {
      title: "Orientações em acordeão de Coletas",
      summary: "Aqui você ajusta o cabeçalho e as três orientações mostradas após o formulário de /coletas. Cada pergunta ajuda a pessoa a concluir a solicitação com os dados certos.",
      example: "Mantenha uma pergunta objetiva, como “Quando recebo a confirmação?”, seguida de uma resposta direta.",
      details: [
        { label: "Onde aparece", value: "Depois do formulário, no final da rota /coletas." },
        { label: "Estrutura", value: "O bloco mantém uma chamada curta, título, descrição e exatamente 3 itens de pergunta e resposta." },
        { label: "Após salvar", value: "O acordeão público de /coletas passa a exibir os textos atualizados, sem alterar os dados do formulário." },
      ],
    },
  "cotacao.section.hero": {
    title: "Botões do hero de Cotação",
    summary: "Aqui você configura os dois botões no topo de /cotacao. Um pode levar ao formulário desta página e o outro à coleta, para orientar o visitante ao fluxo certo.",
    example: "Use “Solicitar cotação” com “#formulario-cotacao” e “Solicitar coleta” com “/coletas”.",
    details: [
      { label: "Onde aparece", value: "No hero, no topo da rota /cotacao." },
      { label: "Primeiro botão", value: "Use a âncora #formulario-cotacao para rolar até o formulário de cotação desta página." },
      { label: "Segundo botão", value: "Pode apontar para /coletas ou outro destino válido." },
      { label: "Após salvar", value: "Os CTAs exibidos no hero de /cotacao passam a usar os valores salvos aqui." },
    ],
    },
    "cotacao.section.orientacoes-em-acordeao": {
      title: "Orientações em acordeão de Cotação",
      summary: "Aqui você ajusta o cabeçalho e as três orientações mostradas antes do rodapé de /cotacao. Elas explicam como a pessoa deve seguir com a operação.",
      example: "Use perguntas curtas, como “Qual tipo de carga devo selecionar?”, com uma resposta clara e prática.",
      details: [
        { label: "Onde aparece", value: "Depois dos canais de atendimento, no final da rota /cotacao." },
        { label: "Estrutura", value: "O bloco mantém uma chamada curta, título, descrição e exatamente 3 itens de pergunta e resposta." },
        { label: "Após salvar", value: "O acordeão público de /cotacao passa a exibir os textos atualizados, sem mudar o cálculo ou os canais de atendimento." },
      ],
    },
  "usuarios.section.criar-usuario": {
    title: "Criar usuário",
    summary: "Aqui você cria um acesso ao CMS e define uma senha temporária. A pessoa precisará criar a própria senha no primeiro login antes de acessar o painel.",
    details: [
      { label: "Quem pode criar", value: "Somente o usuário supremo pode criar contas com senha temporária e atribuir um perfil de acesso." },
      { label: "Setor de acesso", value: "Ao criar um administrador, o usuário supremo escolhe um setor. O setor determina as telas que essa pessoa poderá visualizar e alterar; somente o usuário supremo pode criar ou ajustar setores em /admin/developer/setores." },
      { label: "Onde aparece", value: "O acesso é usado na tela /admin/auth/entrar e, após a troca de senha, no painel /admin/developer." },
      { label: "Senha temporária", value: "A senha definida aqui serve apenas para o primeiro login. O painel bloqueia o uso até que a pessoa informe uma nova senha forte.", technical: true },
      { label: "Redefinição solicitada", value: "Quando uma pessoa pedir ajuda pelo link em /admin/auth/entrar, o usuário supremo verá o aviso no card dela em /admin/developer/usuarios. Ao definir uma nova senha temporária, o aviso é concluído e a pessoa precisará trocá-la no próximo acesso." },
      { label: "Após salvar", value: "A nova conta fica ativa e passa a exigir a troca da senha no próximo login." },
    ],
  },
  "usuarios.section.permissoes-de-usuarios": {
    title: "Permissões de usuários",
    summary: "Aqui o administrador supremo escolhe o que cada administrador comum pode fazer com outras contas. A alteração vale no painel assim que for salva.",
    details: [
      { label: "Onde ajustar", value: "Use os três pontos no card de cada administrador em /admin/developer/usuarios." },
      { label: "Criar usuários", value: "Permite cadastrar novas contas com senha temporária; a pessoa criada ainda precisa trocar essa senha no primeiro acesso." },
      { label: "Excluir usuários", value: "Permite excluir contas que não sejam a conta suprema. A própria pessoa também não pode excluir a si mesma." },
      { label: "Proteção", value: "Somente o usuário supremo pode conceder, remover ou editar essas permissões; administradores com uma permissão não conseguem distribuir permissões para outras pessoas.", technical: true },
    ],
  },
  "setores.section.criar-setor": {
    title: "Criar setor",
    summary: "Aqui você cria um perfil de acesso e escolhe quais áreas do CMS as pessoas vinculadas a ele poderão usar.",
    example: "Crie o setor Recursos Humanos e libere somente Página Carreiras e Imagens.",
    details: [
      { label: "Onde é usado", value: "O setor pode ser atribuído às contas em /admin/developer/usuarios." },
      { label: "Acesso", value: "Somente as áreas marcadas ficam disponíveis para os usuários vinculados; a conta suprema continua protegida por sua regra própria." },
      { label: "Setor inativo", value: "Ao desativar o setor, usuários já vinculados perdem todas as permissões herdadas dele; somente exceções individuais concedidas explicitamente continuam válidas.", technical: true },
      { label: "Após salvar", value: "As permissões passam a valer nas próximas requisições autenticadas do CMS." },
    ],
  },
  "setores.section.atualizar-setor": {
    title: "Atualizar setor",
    summary: "Aqui você ajusta as áreas liberadas e o status do setor. A mudança afeta as contas vinculadas assim que for salva.",
    example: "Desmarque Analytics para retirar essa área de todos os usuários vinculados a este setor.",
    details: [
      { label: "Onde é usado", value: "O setor controla as contas associadas a ele em /admin/developer/usuarios." },
      { label: "Setor inativo", value: "Um setor inativo não concede permissões. As contas vinculadas conservam apenas exceções individuais permitidas explicitamente.", technical: true },
      { label: "Exclusão", value: "Excluir o setor também não libera acesso padrão ou total; atribua outro setor ativo às contas que ainda estiverem vinculadas." },
      { label: "Após salvar", value: "As permissões passam a valer nas próximas requisições autenticadas do CMS." },
    ],
  },
  "setores.field.status-do-setor": {
    title: "Status do setor",
    summary: "Escolha se este setor concede acesso às contas vinculadas e pode ser selecionado para novos usuários.",
    example: "Desative um setor que não deve mais liberar áreas do painel, mesmo antes de reassociar seus usuários.",
    details: [
      { label: "Ativo", value: "O setor pode ser atribuído e concede somente os privilégios marcados." },
      { label: "Inativo", value: "O setor deixa de conceder sua lista de permissões. Somente exceções individuais concedidas explicitamente continuam válidas." },
      { label: "Proteção", value: "Um setor ausente, inativo ou excluído nunca faz a conta receber acesso padrão ou acesso total.", technical: true },
    ],
  },
  "setores.section.perfis-disponiveis": {
    title: "Perfis disponíveis",
    summary: "Aqui você consulta, edita ou exclui os setores cadastrados e confere quantas áreas cada um libera.",
    example: "Revise o setor Recursos Humanos antes de mudar seus privilégios ou removê-lo.",
    details: [
      { label: "Edição", value: "Alterar os privilégios muda o acesso de todas as contas vinculadas nas próximas requisições." },
      { label: "Exclusão", value: "As contas vinculadas perdem as permissões herdadas do setor; somente exceções individuais explícitas continuam válidas até a atribuição de outro setor ativo." },
      { label: "Proteção", value: "Excluir ou desativar um setor nunca concede permissões adicionais.", technical: true },
    ],
  },
  "dashboard.metric.itens-editaveis": {
    title: "Itens editáveis",
    details: [
      { label: "O que mostra", value: "A quantidade de blocos públicos que podem ser alterados pelo CMS." },
      { label: "Origem", value: "O painel soma os blocos carregados de conteúdo, páginas institucionais, footer e unidades." },
      { label: "Uso", value: "Serve para acompanhar a cobertura do CMS e identificar rapidamente as áreas administráveis." },
      { label: "Impacto", value: "É somente um indicador. Consultá-lo não grava nem altera nenhum conteúdo do site." },
    ],
  },
  "dashboard.metric.page-views": {
    title: "Page views",
    summary: "Resumo: mostra as visualizações consolidadas do site no período atual. Se sua conta não puder ler Analytics, o painel exibe um traço em vez de tratar a ausência de acesso como zero.",
    details: [
      { label: "Origem", value: "Dos eventos de Analytics registrados pelo site no período selecionado." },
      { label: "Acesso", value: "Exige a permissão Analytics; sem ela, apenas este indicador fica indisponível." },
      { label: "Impacto", value: "A consulta não grava nem altera dados públicos ou de Analytics." },
    ],
  },
  "dashboard.metric.conversao-do-popup": {
    title: "Conversão do popup",
    summary: "Resumo: compara quantas vezes o popup foi exibido e enviado. Quando esse indicador não estiver disponível para sua conta, o painel mostra um traço sem impedir o uso dos demais módulos.",
    details: [
      { label: "Origem", value: "Dos eventos internos do popup de saída." },
      { label: "Cálculo", value: "Divide os envios registrados pelas exibições registradas no período atual.", technical: true },
      { label: "Impacto", value: "A consulta não grava nem altera o popup ou os leads." },
    ],
  },
  "dashboard.metric.leads-capturados": {
    title: "Leads capturados",
    summary: "Resumo: mostra quantos contatos foram recebidos pelo popup de saída. Sem acesso a Leads, o painel mantém o restante da visão executiva e sinaliza este total como indisponível.",
    details: [
      { label: "Origem", value: "Da lista interna de contatos recebidos pelo popup de saída." },
      { label: "Acesso", value: "Exige a permissão Leads; os dados pessoais não são exibidos neste indicador." },
      { label: "Impacto", value: "A consulta não grava nem altera os contatos recebidos." },
    ],
  },
  "global.field.titulo": {
    details: [
      { label: "O que controla", value: "O título principal deste bloco." },
      { label: "De onde vem", value: "Do texto que você escreve neste campo." },
      { label: "Onde aparece", value: "No bloco que está sendo editado em {publicDestination}." },
      { label: "Após salvar", value: "O título visível nesse bloco de {publicDestination} é substituído." },
    ],
  },
  "global.field.descricao": {
    details: [
      { label: "O que controla", value: "O texto de apoio deste bloco." },
      { label: "De onde vem", value: "Do texto que você escreve neste campo." },
      { label: "Onde aparece", value: "Abaixo ou ao lado do conteúdo principal do bloco em {publicDestination}." },
      { label: "Após salvar", value: "A descrição visível nesse bloco de {publicDestination} é substituída." },
    ],
  },
  "global.field.texto": {
    details: [
      { label: "O que controla", value: "O texto visível desta ação ou bloco." },
      { label: "De onde vem", value: "Do texto que você escreve neste campo." },
      { label: "Onde aparece", value: "No rótulo ou conteúdo do bloco que está aberto em {publicDestination}." },
      { label: "Após salvar", value: "Muda somente esse texto em {publicDestination}; os demais campos do bloco permanecem iguais." },
    ],
  },
  "global.field.link": {
    details: [
      { label: "O que controla", value: "O destino acionado por este botão ou link." },
      { label: "De onde vem", value: "Do endereço que você informa neste campo." },
      { label: "Onde aparece", value: "No botão ou link do bloco aberto em {publicDestination}." },
      { label: "Após salvar", value: "O clique desse botão em {publicDestination} passa a abrir a rota, URL, telefone ou e-mail informado." },
      { label: "Formato aceito", value: "Rota interna, URL externa, mailto: ou tel:.", technical: true },
    ],
  },
  "global.field.url": {
    details: [
      { label: "O que é", value: "O endereço que o navegador deve abrir ou consultar para este item." },
      { label: "Onde é usado", value: "No botão, link, imagem, arquivo ou integração deste bloco em {publicDestination}." },
      { label: "O que o visitante vê", value: "A URL não aparece sozinha na página; ela define para onde o clique vai ou de onde o navegador carrega o recurso." },
      { label: "Após salvar", value: "Somente este item de {publicDestination} passa a usar o novo endereço." },
    ],
  },
  "global.field.imagem": {
    summary: "Escolha a imagem deste bloco na Biblioteca. Depois de salvar, o site usa automaticamente o tamanho adequado à tela sem mudar o enquadramento definido para essa imagem.",
    details: [
      { label: "O que controla", value: "A imagem exibida neste bloco." },
      { label: "Origem", value: "O arquivo é escolhido na Biblioteca de mídia interna." },
      { label: "Onde aparece", value: "No bloco visual que está sendo editado em {publicDestination}." },
      { label: "Após salvar", value: "A mídia selecionada substitui a imagem anterior somente nesse bloco." },
      { label: "Entrega responsiva", value: "Quando a Biblioteca possui versões média e grande, o navegador escolhe a mais adequada à largura da tela. Conteúdo antigo continua usando normalmente o arquivo principal.", technical: true },
      { label: "Proteção", value: "Somente referências internas de mídia validadas podem ser salvas.", technical: true },
    ],
  },
  "global.field.arquivo": {
    summary: "Escolha o arquivo visual deste bloco. Imagens são entregues no tamanho adequado à tela e vídeos automáticos aguardam sua área se aproximar da tela.",
    details: [
      { label: "O que controla", value: "O arquivo de imagem ou vídeo usado por este bloco." },
      { label: "De onde vem", value: "Da Biblioteca de mídia do CMS ou de um upload validado. Imagens enviadas em PNG, JPG, AVIF ou WebP são gravadas como WebP otimizado; vídeos permanecem no formato de vídeo." },
      { label: "Onde aparece", value: "Na área visual do bloco que está aberto em {publicDestination}." },
      { label: "Após salvar", value: "A mídia anterior é substituída somente nessa área de {publicDestination}." },
      { label: "Carregamento", value: "As versões responsivas de imagem e o poster do vídeo são preservados. Vídeos visuais automáticos permanecem silenciosos, recebem o arquivo apenas perto da tela e só reproduzem quando ficam visíveis.", technical: true },
    ],
  },
  "global.field.arquivo-selecionado": {
    summary: "Confira ou troque o arquivo deste bloco. O site mantém o conteúdo legado compatível e aproveita automaticamente as versões responsivas disponíveis na Biblioteca.",
    details: [
      { label: "O que controla", value: "O arquivo de imagem ou vídeo já escolhido para este bloco." },
      { label: "De onde vem", value: "Da Biblioteca de mídia interna ou de um upload feito pelo CMS. Imagens novas são convertidas para WebP otimizado antes de entrarem na Biblioteca." },
      { label: "Onde aparece", value: "No espaço visual ligado a este formulário em {publicDestination}." },
      { label: "Após salvar", value: "Troca somente a mídia deste bloco de {publicDestination}; os demais blocos continuam iguais." },
      { label: "Entrega responsiva", value: "O arquivo principal continua sendo o fallback; versões média e grande validadas são usadas apenas quando ajudam o navegador a baixar menos dados.", technical: true },
      { label: "Proteção", value: "O CMS aceita apenas referências internas de mídia que passaram pela validação.", technical: true },
    ],
  },
  "global.field.texto-alternativo": {
    summary: "Aqui você explica, em poucas palavras, o que há na imagem. Essa descrição ajuda pessoas que usam leitor de tela e pode aparecer se a imagem não carregar.",
    example: "Em uma foto de caminhão: “Caminhão Rodogarcia carregando mercadorias no pátio”.",
    details: [
      { label: "O que é", value: "Uma descrição curta e objetiva da imagem." },
      { label: "Para quem serve", value: "Leitores de tela leem esse texto para pessoas que não conseguem enxergar a imagem." },
      { label: "Se a imagem falhar", value: "O navegador pode mostrar este texto no lugar da imagem enquanto o arquivo não é carregado." },
      { label: "Como preencher", value: "Descreva o que é importante na imagem; não repita palavras decorativas nem use o nome do arquivo." },
      { label: "Após salvar", value: "A descrição passa a acompanhar a imagem deste bloco na página pública." },
    ],
  },
  "global.field.texto-alternativo-da-imagem": {
    title: "Texto alternativo",
    summary: "Aqui você descreve a imagem para quem não consegue vê-la. O texto acompanha a foto e pode aparecer se o arquivo não carregar.",
    example: "Para uma foto institucional: “Motorista Rodogarcia ao lado do caminhão de transporte”.",
    details: [
      { label: "O que é", value: "Uma descrição curta e objetiva da imagem selecionada neste bloco." },
      { label: "Para quem serve", value: "Leitores de tela usam esse texto para explicar a imagem a pessoas com deficiência visual." },
      { label: "Se a imagem falhar", value: "O navegador pode usar esta descrição no lugar da imagem enquanto o arquivo não é carregado." },
      { label: "Como preencher", value: "Explique o conteúdo importante da imagem, como “Caminhão Rodogarcia em operação”, sem citar o nome do arquivo." },
      { label: "Após salvar", value: "Atualiza a descrição acessível da imagem; não troca o arquivo nem muda o layout." },
    ],
  },
  "global.field.enquadramento-da-imagem": {
    details: [
      { label: "O que controla", value: "A parte da imagem que permanece visível quando o card precisa recortar o arquivo." },
      { label: "Onde aparece", value: "No card ou bloco visual que usa esta imagem em {publicDestination}." },
      { label: "Como escolher", value: "Escolha Topo, Base, Esquerda ou Direita quando o assunto principal estiver fora do centro." },
      { label: "Após salvar", value: "Muda apenas o corte visual; o arquivo original não é alterado." },
    ],
  },
  "global.field.ativo": {
    details: [
      { label: "O que controla", value: "A disponibilidade deste item no site." },
      { label: "Origem", value: "O estado é definido por esta chave no CMS." },
      { label: "Destino", value: "A listagem ou bloco público que usa este item." },
      { label: "Após salvar", value: "O item aparece quando está ativo e fica oculto quando desativado." },
    ],
  },
  "global.section.configuracoes": {
    details: [
      { label: "O que reúne", value: "Os campos que editam uma mesma parte da tela atual." },
      { label: "De onde vêm", value: "Dos valores preenchidos ou selecionados dentro desta seção." },
      { label: "Onde aparecem", value: "Na parte do site ou do painel explicada pelo título desta seção." },
      { label: "Após salvar", value: "As mudanças afetam somente essa parte; elas não alteram as demais seções." },
    ],
  },
  "analytics.field.eventos-internos-ativos": {
    title: "Eventos internos ativos",
    summary: "Liga ou desliga a coleta de eventos feita pelo próprio site. Quando desligado, o site para de registrar as ações de navegação nesta área.",
    details: [
      { label: "O que registra", value: "Interações como páginas visitadas, cliques, tempo de navegação e marcos de rolagem." },
      { label: "Quando desligar", value: "Use somente se quiser pausar a coleta interna de métricas. Os registros já existentes não são apagados." },
      { label: "Após salvar", value: "A próxima navegação deixa de gerar eventos internos enquanto esta opção estiver desativada." },
    ],
  },
  "analytics.field.marcos-de-scroll": {
    title: "Marcos de scroll (%)",
    summary: "Define em quais pontos da rolagem da página o site registra que o visitante chegou.",
    details: [
      { label: "Como preencher", value: "Informe porcentagens separadas por vírgula, como 25,50,75,100." },
      { label: "O que significa", value: "Com 25,50,75,100, o site registra quando a pessoa alcança 25%, 50%, 75% e 100% da página." },
      { label: "Limite", value: "São aceitos somente números maiores que 0 e até 100; valores repetidos são mantidos uma única vez.", technical: true },
      { label: "Após salvar", value: "Os próximos eventos de rolagem usam os novos pontos definidos." },
    ],
  },
  "analytics.field.ga4": {
    title: "GA4",
    summary: "Ativa o envio das métricas do site para o Google Analytics 4.",
    details: [
      { label: "O que faz", value: "Compartilha os eventos e métricas coletados com a propriedade configurada no Google Analytics." },
      { label: "Para funcionar", value: "Informe um Measurement ID válido antes de ativar esta opção." },
      { label: "Após salvar", value: "O provedor passa a carregar somente quando houver o consentimento de Analytics permitido pelo visitante." },
    ],
  },
  "analytics.field.measurement-id": {
    title: "Measurement ID",
    summary: "É o código da sua propriedade do Google Analytics 4; ele diz para qual conta as métricas devem ser enviadas.",
    details: [
      { label: "Formato", value: "Use o identificador exibido no Google Analytics, por exemplo G-ABC123XYZ.", technical: true },
      { label: "Onde encontrar", value: "No fluxo de dados da propriedade GA4 que receberá as métricas do site." },
      { label: "Validação", value: "O CMS só permite ativar o GA4 com um identificador no formato aceito pelo Google.", technical: true },
    ],
  },
  "analytics.field.clarity": {
    title: "Clarity",
    summary: "Ativa o envio de dados para o Microsoft Clarity, usado para entender como os visitantes navegam pelo site.",
    details: [
      { label: "O que permite analisar", value: "Mapas de calor, cliques e gravações de sessões disponibilizados pelo Microsoft Clarity." },
      { label: "Para funcionar", value: "Informe o Project ID do projeto criado no Microsoft Clarity antes de ativar esta opção." },
      { label: "Após salvar", value: "O Clarity passa a carregar somente quando houver o consentimento de Analytics permitido pelo visitante." },
    ],
  },
  "analytics.field.project-id": {
    title: "Project ID",
    summary: "É o código que identifica o seu projeto no Microsoft Clarity e recebe os dados de navegação do site.",
    details: [
      { label: "Onde encontrar", value: "Nas configurações do projeto criado no painel do Microsoft Clarity." },
      { label: "Formato", value: "Use somente letras e números, com 6 a 80 caracteres.", technical: true },
      { label: "Validação", value: "O CMS não permite ativar o Clarity com um código fora desse formato.", technical: true },
    ],
  },
  "analytics.field.salvar-configuracao": {
    title: "Salvar configuração",
    summary: "Grava as alterações feitas nos eventos internos, GA4 e Clarity.",
    details: [
      { label: "O que salva", value: "Os estados de ativação, os marcos de scroll e os códigos dos provedores externos." },
      { label: "Antes de salvar", value: "Se GA4 ou Clarity estiverem ativos, informe os respectivos identificadores em um formato válido." },
      { label: "Resultado", value: "As novas configurações passam a valer para as próximas visitas e eventos do site." },
    ],
  },
  "analytics.field.atualizar-metricas": {
    title: "Atualizar métricas",
    summary: "Busca novamente os dados de Analytics para atualizar os números exibidos nesta tela.",
    details: [
      { label: "O que atualiza", value: "Estatísticas, eventos, páginas mais acessadas, conversões e dados de heatmap do período selecionado." },
      { label: "O que não faz", value: "Não altera as configurações nem apaga registros; apenas recarrega os números mostrados." },
    ],
  },
  "analytics.section.top-paginas-do-periodo": {
    title: "Top páginas do período",
    summary: "Mostra quais páginas receberam mais visitas durante o período selecionado. Quanto maior o número, mais acessada foi a página.",
    details: [
      { label: "Como ler", value: "A rota / é a página inicial; /servicos é a página de serviços; /sobre é a página institucional." },
      { label: "Período", value: "Use o seletor de dias no topo da tela e Atualizar para consultar outro intervalo." },
    ],
  },
  "analytics.section.contagem-por-tipo": {
    title: "Contagem por tipo",
    summary: "Mostra quantas vezes cada tipo de ação aconteceu no site durante o período selecionado.",
    details: [
      { label: "page_view", value: "Uma página foi aberta." },
      { label: "time_on_page", value: "O tempo de permanência em uma página foi registrado." },
      { label: "session_end", value: "Uma visita terminou." },
      { label: "scroll", value: "A pessoa chegou a algum marco de rolagem configurado." },
      { label: "click", value: "Houve um clique monitorado." },
    ],
  },
  "analytics.section.eventos-recentes": {
    title: "Eventos recentes",
    summary: "Mostra os últimos eventos que o site recebeu dos visitantes.",
    details: [
      { label: "O que você vê", value: "O que aconteceu, em qual página, quando e a visita anônima associada ao evento." },
      { label: "Exemplos", value: "page_view abre uma página; click registra um clique; scroll registra rolagem; time_on_page registra tempo; session_end marca o fim da visita." },
    ],
  },
  "analytics.field.filtrar-tipo": {
    title: "Filtrar tipo",
    summary: "Mostra somente os eventos do tipo informado.",
    details: [
      { label: "Como usar", value: "Digite, por exemplo, page_view para ver páginas abertas ou click para ver cliques." },
      { label: "Resultado", value: "A tabela é filtrada na hora; apagar o texto volta a mostrar todos os tipos." },
    ],
  },
  "analytics.field.filtrar-pagina": {
    title: "Filtrar página",
    summary: "Mostra somente os eventos ocorridos na página informada.",
    details: [
      { label: "Como usar", value: "Digite uma rota como /servicos para consultar apenas os eventos dessa página." },
      { label: "Resultado", value: "A tabela é filtrada na hora; apagar o texto volta a mostrar todas as páginas." },
    ],
  },
  "analytics.field.evento": {
    title: "Evento",
    summary: "Mostra o que aconteceu durante a navegação do visitante.",
    details: [
      { label: "Tipos comuns", value: "page_view significa abertura de página; click, um clique; scroll, uma rolagem; time_on_page, tempo na página; session_end, fim da visita." },
    ],
  },
  "analytics.field.pagina": {
    title: "Página",
    summary: "Mostra em qual página do site o evento aconteceu.",
    details: [
      { label: "Formato", value: "É a rota do site, como /, /servicos ou /sobre." },
    ],
  },
  "analytics.field.data": {
    title: "Data",
    summary: "Mostra quando o evento foi registrado pelo site.",
    details: [
      { label: "Formato", value: "A tabela exibe dia, mês, ano, hora e minuto no horário local." },
    ],
  },
  "analytics.field.sessao": {
    title: "Sessão",
    summary: "Identifica uma visita anônima durante a navegação; não identifica a pessoa visitante.",
    details: [
      { label: "Para que serve", value: "Agrupa os eventos feitos na mesma visita para ajudar a entender a sequência de navegação." },
    ],
  },
  "analytics.section.resumo-de-resultados": {
    title: "Resumo de resultados",
    summary: "Mostra as ações importantes concluídas pelos visitantes no período selecionado.",
    details: [
      { label: "Formulários concluídos", value: "Quantidade de formulários enviados." },
      { label: "Downloads", value: "Quantidade de arquivos baixados." },
      { label: "Leads", value: "Quantidade de contatos que se tornaram possíveis clientes." },
      { label: "Envios do popup", value: "Quantidade de formulários enviados pelo popup." },
      { label: "Total", value: "Soma de todas as conversões mostradas nesta área." },
    ],
  },
  "fale-conosco.section.botao-whatsapp": {
    title: "Botão WhatsApp do hero",
    summary: "Aqui você configura o botão de WhatsApp que fica no topo da página Fale Conosco. Você escolhe o texto e o destino do clique; depois de salvar, esse botão é atualizado no site.",
    example: "Texto “Falar com a Rodogarcia no WhatsApp” e link “https://wa.me/5511999999999”.",
    details: [
      { label: "O que controla", value: "A chamada principal de WhatsApp exibida no hero da página Fale Conosco." },
      { label: "Origem", value: "O CMS salva estes dados no campo técnico contactPage.heroWhatsappButton.", technical: true },
      { label: "Onde aparece", value: "No topo de /fale-conosco, antes dos canais de atendimento." },
      { label: "Texto", value: "É o rótulo visível do botão. Mantenha uma ação clara e curta para caber no hero." },
      { label: "Link", value: "É o destino aberto quando o visitante seleciona o botão; pode apontar para uma rota, telefone, e-mail ou URL do WhatsApp." },
      { label: "Validação", value: "O salvamento exige texto e endereço válidos; o serviço sanitiza a URL antes de publicar.", technical: true },
      { label: "Após salvar", value: "Substitui somente este CTA do hero, sem alterar os demais canais ou o CTA final." },
    ],
  },
  "fale-conosco.field.hero-whatsapp-texto": {
    title: "Texto do botão WhatsApp",
    summary: "Aqui você escreve o texto que o visitante verá no botão de WhatsApp no topo da página Fale Conosco. Isso muda somente o nome do botão, não o destino do clique.",
    example: "Use “Falar com a Rodogarcia no WhatsApp” para deixar clara a ação do botão.",
    details: [
      { label: "O que controla", value: "O rótulo mostrado no botão do hero de Fale Conosco." },
      { label: "Onde aparece", value: "No CTA principal acima dos canais de atendimento da rota /fale-conosco." },
      { label: "Limite", value: "Até 40 caracteres para preservar a leitura em telas menores.", technical: true },
      { label: "Após salvar", value: "Altera apenas o texto do botão; o destino do clique é configurado separadamente no Link." },
    ],
  },
  "fale-conosco.field.hero-whatsapp-link": {
    title: "Link do botão WhatsApp",
    summary: "Aqui você informa para onde o botão de WhatsApp deve levar o visitante. Depois de salvar, somente o clique desse botão passa a abrir o novo endereço.",
    example: "Para abrir uma conversa, use “https://wa.me/5511999999999”.",
    details: [
      { label: "O que controla", value: "O destino do clique no botão WhatsApp do hero." },
      { label: "Onde aparece", value: "No CTA principal da rota /fale-conosco." },
      { label: "Formato aceito", value: "Rota interna, URL externa, mailto: ou tel:. Para WhatsApp, use uma URL válida do serviço.", technical: true },
      { label: "Validação", value: "O CMS rejeita valores sem endereço válido antes de gravar o conteúdo.", technical: true },
      { label: "Após salvar", value: "Altera apenas o destino deste CTA; não muda texto, canais ou botões do CTA final." },
    ],
  },
  "cotacao.field.aprovacao-whatsapp": {
    title: "WhatsApp para aprovar cotação",
    summary: "Aqui você escolhe o WhatsApp que receberá o pedido quando uma pessoa aprovar uma cotação no popup da rota /cotacao. O valor, a referência e a rota da cotação seguem preenchidos na mensagem.",
    example: "Use “https://wa.me/5514991053696” para direcionar a aprovação ao atendimento responsável.",
    details: [
      { label: "Onde aparece", value: "No botão “Aprovar cotação” do popup exibido após uma cotação fracionada na rota /cotacao." },
      { label: "Formato aceito", value: "Somente links oficiais do WhatsApp, iniciados por https://wa.me/ ou https://api.whatsapp.com/.", technical: true },
      { label: "Mensagem", value: "O site inclui automaticamente a referência, o valor, a origem e o destino; não é necessário editar esses dados aqui." },
      { label: "Após salvar", value: "Altera apenas esse destino de aprovação, sem mudar o WhatsApp comercial geral ou os demais canais da página." },
    ],
  },
  "cotacao.field.regiao-nao-atendida-titulo": {
    title: "Título do popup de região não atendida",
    summary: "Aqui você escreve o título que o visitante vê no popup de /cotacao e /coletas quando a cidade de origem não é atendida. Depois de salvar, os dois avisos são atualizados.",
    example: "Use “Ainda não atendemos esta origem” para explicar a situação logo no início.",
    details: [
      { label: "Onde aparece", value: "No popup aberto após uma tentativa de cotação ou de solicitação de coleta com origem fora da área atendida, nas rotas /cotacao e /coletas." },
      { label: "Limite", value: "Até 120 caracteres para manter o título legível em celular e desktop.", technical: true },
      { label: "Após salvar", value: "O título antigo do popup é substituído; a regra de atendimento e o formulário não são alterados." },
    ],
  },
  "cotacao.field.regiao-nao-atendida-mensagem": {
    title: "Mensagem do popup de região não atendida",
    summary: "Aqui você explica o que aconteceu e orienta a pessoa a falar com o comercial quando a origem informada não é atendida em /cotacao ou /coletas.",
    example: "Escreva “A cidade de origem informada ainda não faz parte da nossa área de atendimento. Fale com nosso comercial para avaliar a operação.”",
    details: [
      { label: "Onde aparece", value: "Abaixo do título, no popup de indisponibilidade das rotas /cotacao e /coletas." },
      { label: "Limite", value: "Até 320 caracteres para preservar a leitura no popup.", technical: true },
      { label: "Após salvar", value: "A nova orientação é mostrada nas próximas tentativas com uma origem não atendida." },
    ],
  },
  "cotacao.field.regiao-nao-atendida-botao-texto": {
    title: "Texto do botão comercial",
    summary: "Aqui você define o texto do botão que a pessoa usa no popup de /cotacao e /coletas para continuar o atendimento comercial após uma origem não atendida.",
    example: "Use “Falar com o comercial”.",
    details: [
      { label: "Onde aparece", value: "No botão principal do popup de região não atendida das rotas /cotacao e /coletas." },
      { label: "Limite", value: "Até 40 caracteres para o botão não perder legibilidade.", technical: true },
      { label: "Após salvar", value: "Muda apenas o texto do botão; o destino é configurado no campo Link." },
    ],
  },
  "cotacao.field.regiao-nao-atendida-botao-link": {
    title: "Link do botão comercial",
    summary: "Aqui você informa para onde o botão do popup de /cotacao e /coletas deve levar a pessoa para falar com o comercial.",
    example: "Use “https://wa.me/5511993139536” para abrir o WhatsApp comercial.",
    details: [
      { label: "Onde aparece", value: "No botão principal do popup de região não atendida das rotas /cotacao e /coletas." },
      { label: "Formato aceito", value: "Use uma rota interna, URL externa, e-mail ou telefone válido. Para WhatsApp, use uma URL oficial como https://wa.me/.", technical: true },
      { label: "Após salvar", value: "Muda somente o destino do botão do popup, sem alterar o texto ou a validação de regiões." },
    ],
  },
  "servicos.field.arquivo-selecionado": {
    title: "Imagem do módulo de Serviços",
    summary: "Aqui você escolhe a foto que será mostrada no card do serviço aberto. Depois de salvar, só esse card em /servicos recebe a nova imagem.",
    example: "No serviço de distribuição, escolha uma foto de caminhão em operação na Biblioteca de mídia.",
    details: [
      { label: "O que controla", value: "A imagem principal do módulo de serviço que está aberto neste editor." },
      { label: "De onde vem", value: "Da Biblioteca de mídia interna ou de um upload validado pelo CMS." },
      { label: "Onde aparece", value: "No card visual do módulo correspondente na página pública /servicos." },
      { label: "Após salvar", value: "Troca a imagem apenas desse módulo; os outros cards de serviços não são alterados." },
      { label: "Proteção", value: "Links externos e arquivos inexistentes não podem ser gravados nesse campo.", technical: true },
    ],
  },
  "servicos.field.texto-alternativo-da-imagem": {
    title: "Texto alternativo da imagem do serviço",
    summary: "Aqui você conta o que aparece na foto do serviço. Essa frase ajuda leitores de tela e pode ser exibida se a imagem não carregar; ela não troca a foto nem muda o card.",
    example: "Para a foto de entrega, escreva “Caminhão Rodogarcia saindo para distribuição”.",
    details: [
      { label: "O que é", value: "A descrição acessível da imagem principal do módulo de serviço aberto." },
      { label: "Para quem serve", value: "Leitores de tela informam essa descrição a visitantes que não conseguem ver a imagem." },
      { label: "Se a imagem falhar", value: "O navegador pode apresentar esse texto no lugar da imagem enquanto ela não carregar." },
      { label: "Onde aparece", value: "Associado à imagem do card correspondente na página pública /servicos." },
      { label: "Como escrever", value: "Descreva a cena ou informação relevante da imagem. Exemplo: “Caminhão em rota de distribuição”." },
      { label: "Após salvar", value: "Atualiza somente a descrição acessível da imagem; não altera a foto, o recorte ou o texto do serviço." },
    ],
  },
  "servicos.field.enquadramento-da-imagem": {
    title: "Enquadramento da imagem do serviço",
    summary: "Aqui você escolhe qual parte da foto deve continuar aparecendo quando o card recorta a imagem. Isso muda o corte mostrado no site, sem alterar o arquivo original.",
    example: "Se o caminhão estiver no alto da foto, escolha “Topo” para ele não ser cortado.",
    details: [
      { label: "O que controla", value: "O ponto da foto que o card de serviço prioriza quando precisa fazer um recorte." },
      { label: "Onde aparece", value: "Na imagem do módulo aberto da página pública /servicos." },
      { label: "Como escolher", value: "Use Topo, Base, Esquerda ou Direita quando o caminhão, pessoa ou objeto principal não estiver no centro." },
      { label: "Após salvar", value: "Muda o recorte mostrado no card, mas não edita nem substitui o arquivo original." },
    ],
  },
};

function normalizeHelpSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getPageName(pathname: string) {
  return CMS_PAGE_NAMES[pathname] ?? "esta área do CMS";
}

function getPublicDestination(pathname: string) {
  return CMS_PUBLIC_DESTINATIONS[pathname] ?? CMS_HELP_CONTEXTS[pathname]?.destination ?? "esta área do CMS";
}

function getHelpContext(pathname: string): CmsHelpContext {
  return CMS_HELP_CONTEXTS[pathname] ?? {
    destination: "esta área do CMS",
    action: "edita as informações disponíveis nesta tela",
    example: "Escolha um campo desta tela e confira o resultado indicado ao lado dele.",
  };
}

function resolveTemplateDetails(details: CmsHelpDetail[], publicDestination: string) {
  return details.map((detail) => ({
    ...detail,
    value: detail.value.replaceAll("{publicDestination}", publicDestination),
  }));
}

function resolveTemplateSummary(summary: string | undefined, label: string, publicDestination: string) {
  if (summary) return summary.replaceAll("{publicDestination}", publicDestination);
  return `Aqui você ajusta “${label}” do bloco que está editando. Depois de salvar, essa informação será usada nesse bloco de ${publicDestination}.`;
}

function getDefaultExample(label: string, publicDestination: string) {
  const normalizedLabel = normalizeHelpSegment(label);

  if (normalizedLabel.includes("titulo")) {
    return "Exemplo: use “Logística que acompanha o seu negócio” como título de uma seção.";
  }
  if (normalizedLabel.includes("descricao") || normalizedLabel.includes("texto")) {
    return "Exemplo: escreva “Fale com nosso time para encontrar a melhor solução para sua operação”.";
  }
  if (normalizedLabel.includes("link") || normalizedLabel.includes("url")) {
    return "Exemplo: para abrir a página de contato, use “/fale-conosco”; para WhatsApp, use uma URL no formato “https://wa.me/5511999999999”.";
  }
  if (normalizedLabel.includes("arquivo") || normalizedLabel.includes("imagem") || normalizedLabel.includes("midia")) {
    return "Exemplo: escolha na Biblioteca uma foto de caminhão ou operação que represente este bloco.";
  }
  if (normalizedLabel.includes("ativo") || normalizedLabel.includes("visibilidade")) {
    return "Exemplo: deixe ativo para mostrar o item no site; desative para ocultá-lo sem apagá-lo.";
  }

  return `Exemplo: preencha “${label}” com a informação real que sua equipe usa e confira o resultado em ${publicDestination}.`;
}

function resolveTemplateExample(example: string | undefined, label: string, publicDestination: string) {
  return example?.replaceAll("{publicDestination}", publicDestination) ?? getDefaultExample(label, publicDestination);
}

function getFieldFallback(label: string, context: CmsHelpContext): Omit<CmsHelpContent, "title"> {
  const normalizedLabel = normalizeHelpSegment(label);
  const baseDetails: CmsHelpDetail[] = [
    { label: "Tela", value: context.destination },
    { label: "De onde vem", value: "Do valor que você preenche ou escolhe neste campo." },
  ];

  if (normalizedLabel.includes("titulo") || normalizedLabel.includes("eyebrow") || normalizedLabel.includes("badge")) {
    return {
      summary: `Aqui você escreve o título ou pequeno destaque que o visitante lê em ${context.destination}. Depois de salvar, só esse texto é atualizado.`,
      example: "Exemplo: use “Logística que acompanha o seu negócio” como título de uma seção.",
      details: [...baseDetails, { label: "Onde aparece", value: `No cabeçalho ou destaque do bloco editado em ${context.destination}.` }, { label: "Após salvar", value: "O texto antigo desse cabeçalho é substituído." }],
    };
  }
  if (normalizedLabel.includes("descricao") || normalizedLabel.includes("texto") || normalizedLabel.includes("depoimento") || normalizedLabel.includes("resposta") || normalizedLabel.includes("pergunta")) {
    return {
      summary: `Aqui você escreve o texto que o visitante vai ler em ${context.destination}. Salvar troca somente essa frase, descrição ou resposta.`,
      example: "Exemplo: escreva “Fale com nosso time para encontrar a melhor solução para sua operação”.",
      details: [...baseDetails, { label: "Onde aparece", value: `No texto do bloco que está aberto em ${context.destination}.` }, { label: "Após salvar", value: "O texto anterior desse bloco é substituído." }],
    };
  }
  if (normalizedLabel.includes("contexto-da-operacao")) {
    return {
      summary: "Aqui você descreve o tipo de operação do relato, sem identificar a empresa cliente. Esse texto aparece abaixo da foto na Prova Social da Home e ajuda o visitante e a busca a entender o cenário atendido.",
      example: "Exemplo: escreva “Distribuição nacional” ou “Logística industrial”, sem citar marca, empresa ou dado confidencial.",
      details: [...baseDetails, { label: "Onde aparece", value: "Abaixo da foto ou das iniciais da pessoa, no card de Prova Social da Home (/)." }, { label: "Após salvar", value: "O contexto substitui somente essa identificação operacional; empresas não são exibidas nessa seção." }],
    };
  }
  if (normalizedLabel.includes("foto-da-pessoa")) {
    return {
      summary: "Aqui você pode escolher uma foto autorizada da pessoa que deu o relato. Ela aparece no card da Prova Social da Home; se ficar vazio, o site mostra as iniciais do nome.",
      example: "Exemplo: envie um retrato profissional autorizado da pessoa, sem logo de empresa e sem dados sensíveis visíveis.",
      details: [...baseDetails, { label: "Onde aparece", value: "No topo do card de Prova Social da Home (/)." }, { label: "Após salvar", value: "A imagem escolhida substitui as iniciais somente nesse relato." }],
    };
  }
  if (normalizedLabel.includes("link") || normalizedLabel.includes("url") || normalizedLabel.includes("canonical")) {
    return {
      summary: `Aqui você define para onde o visitante será levado ao clicar ou qual endereço o navegador deve usar em ${context.destination}.`,
      example: "Exemplo: use “/fale-conosco” para levar ao contato ou “https://wa.me/5511999999999” para abrir o WhatsApp.",
      details: [...baseDetails, { label: "Onde é usado", value: `No botão, link ou referência ligada a este campo em ${context.destination}.` }, { label: "Após salvar", value: "Somente esse destino passa a usar o novo endereço." }],
    };
  }
  if (normalizedLabel.includes("arquivo") || normalizedLabel.includes("imagem") || normalizedLabel.includes("midia") || normalizedLabel.includes("video") || normalizedLabel.includes("poster")) {
    return {
      summary: `Aqui você escolhe a mídia mostrada em ${context.destination}. Salvar troca a imagem ou vídeo apenas no bloco que está aberto.`,
      example: "Exemplo: escolha uma foto de caminhão em operação na Biblioteca de mídia para representar este bloco.",
      details: [...baseDetails, { label: "Onde aparece", value: `Na área visual ligada a este campo em ${context.destination}.` }, { label: "Após salvar", value: "A mídia anterior desse bloco é substituída; as demais não mudam." }],
    };
  }
  if (normalizedLabel.includes("cor")) {
    return {
      summary: `Aqui você escolhe a cor usada por este elemento em ${context.destination}. Isso muda só o visual, não o texto nem o destino do botão.`,
      example: "Exemplo: use “#1D4ED8” para aplicar o azul institucional da Rodogarcia.",
      details: [...baseDetails, { label: "Onde aparece", value: `No botão, selo ou elemento visual ligado a este campo em ${context.destination}.` }, { label: "Após salvar", value: "A cor desse elemento é atualizada." }],
    };
  }
  if (normalizedLabel.includes("ativo") || normalizedLabel.includes("status") || normalizedLabel.includes("visibilidade") || normalizedLabel.includes("banner")) {
    return {
      summary: `Aqui você decide se este item fica visível ou disponível em ${context.destination}. Desativar esconde o item, mas não apaga os dados preenchidos.`,
      example: "Exemplo: deixe ativo para mostrar o card no site; desative para ocultá-lo temporariamente.",
      details: [...baseDetails, { label: "Onde aparece", value: `Na lista ou bloco ligado a este item em ${context.destination}.` }, { label: "Após salvar", value: "O item aparece quando ativo e fica oculto quando desativado." }],
    };
  }
  if (normalizedLabel.includes("email adicional")) {
    return {
      summary: "Informe o segundo e-mail obrigatório da unidade. Ele aparece logo abaixo do primeiro e-mail no mapa da Página Inicial (/), para o visitante escolher o canal de atendimento adequado.",
      example: "Exemplo: comercial.agu@rodogarcia.com.br.",
      details: [...baseDetails, { label: "Onde aparece", value: "No cartão da unidade selecionada, dentro do mapa da Página Inicial (/)." }, { label: "Formato aceito", value: "Use um e-mail válido. O salvamento é bloqueado se este campo ficar vazio.", technical: true }],
    };
  }
  if (normalizedLabel.includes("email") || normalizedLabel.includes("telefone") || normalizedLabel.includes("endereco") || normalizedLabel.includes("cidade") || normalizedLabel.includes("uf") || normalizedLabel.includes("contato")) {
    return {
      summary: `Aqui você informa o dado de contato ou localização que o visitante poderá usar em ${context.destination}.`,
      example: "Exemplo: telefone “(11) 99999-9999” ou e-mail “contato@rodo...”.",
      details: [...baseDetails, { label: "Onde aparece", value: `Na área de contato, unidade ou canal correspondente em ${context.destination}.` }, { label: "Após salvar", value: "O dado antigo desse contato é substituído." }],
    };
  }
  if (normalizedLabel.includes("delay") || normalizedLabel.includes("cooldown") || normalizedLabel.includes("exibicoes") || normalizedLabel.includes("marcos")) {
    return {
      summary: `Aqui você ajusta uma regra de tempo, frequência ou medição desta área. Ela controla quando ou quantas vezes o comportamento acontece.`,
      example: "Exemplo: defina 24 horas de intervalo para não mostrar o popup novamente ao mesmo visitante.",
      details: [...baseDetails, { label: "Onde é usado", value: `Na regra configurada nesta tela para ${context.destination}.` }, { label: "Após salvar", value: "A nova regra passa a valer nas próximas interações." }],
    };
  }

  return {
    summary: `Aqui você preenche “${label}”, uma informação usada nesta tela para ${context.action}.`,
    example: context.example,
    details: [...baseDetails, { label: "Onde é usado", value: `Na parte de ${context.destination} relacionada a “${label}”.` }, { label: "Após salvar", value: "A informação deste campo é atualizada sem alterar os demais campos." }],
  };
}

function getSectionFallback(label: string, context: CmsHelpContext): Omit<CmsHelpContent, "title"> {
  const normalizedLabel = normalizeHelpSegment(label);
  const isButton = normalizedLabel.includes("botao") || normalizedLabel.includes("cta");
  const isMedia = normalizedLabel.includes("imagem") || normalizedLabel.includes("midia") || normalizedLabel.includes("video");
  const isFaq = normalizedLabel.includes("faq") || normalizedLabel.includes("pergunta");
  const summary = isButton
    ? `Aqui você configura o texto e o destino de um botão usado em ${context.destination}.`
    : isMedia
      ? `Aqui você escolhe e ajusta a mídia que será mostrada em ${context.destination}.`
      : isFaq
        ? `Aqui você edita as perguntas e respostas que o visitante pode ler em ${context.destination}.`
        : `Aqui você edita “${label}”, uma parte de ${context.destination}.`;

  return {
    summary: `${summary} Depois de salvar, apenas esta seção é atualizada.`,
    example: isButton
      ? "Exemplo: escreva “Solicitar cotação” e use “/cotacao” como destino do botão."
      : isMedia
        ? "Exemplo: selecione uma foto de caminhão em operação na Biblioteca de mídia."
        : isFaq
          ? "Exemplo: pergunta “Como solicito uma cotação?” e resposta “Preencha o formulário e nosso time retorna”."
          : context.example,
    details: [
      { label: "Tela", value: context.destination },
      { label: "O que reúne", value: `Os campos necessários para editar “${label}”.` },
      { label: "Após salvar", value: `A mudança aparece apenas nessa parte de ${context.destination}.` },
    ],
  };
}

export function getCmsHelp(
  pathname: string,
  label: string,
  kind: CmsHelpKind = "field",
  templateKey?: string,
): CmsHelpContent {
  const normalizedLabel = normalizeHelpSegment(label);
  const routeKey = pathname.replace(/^\/developer\/?/, "").replace(/\//g, ".") || "dashboard";
  const template =
    (templateKey ? CMS_HELP_TEMPLATES[`${routeKey}.${kind}.${templateKey}`] : undefined) ??
    CMS_HELP_TEMPLATES[`${routeKey}.${kind}.${normalizedLabel}`] ??
    CMS_HELP_TEMPLATES[`global.${kind}.${normalizedLabel}`];
  const pageName = getPageName(pathname);
  const publicDestination = getPublicDestination(pathname);
  const context = getHelpContext(pathname);

  if (template) {
    return {
      title: template.title ?? label,
      summary: resolveTemplateSummary(template.summary, label, publicDestination),
      example: resolveTemplateExample(template.example, label, publicDestination),
      details: [
        { label: "Tela", value: `${pageName} (${cmsHref(pathname)})`, technical: true },
        ...resolveTemplateDetails(template.details, publicDestination),
      ],
    };
  }

  if (kind === "page") {
    return {
      title: pageName,
      summary: `Nesta tela você ${context.action}. Depois de salvar, a mudança aparece em ${context.destination} quando esta tela controla conteúdo público.`,
      example: context.example,
      details: [
        { label: "O que reúne", value: `Os controles usados para ${context.action}.` },
        { label: "Onde aparece", value: context.destination },
        { label: "Após salvar", value: "A alteração fica disponível depois do salvamento." },
      ],
    };
  }

  if (kind === "section" || kind === "accordion") {
    const fallback = getSectionFallback(label, context);
    return {
      title: label,
      ...fallback,
    };
  }

  const fallback = getFieldFallback(label, context);
  return {
    title: label,
    ...fallback,
  };
}
