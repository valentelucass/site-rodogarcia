# Site Rodogarcia Transportes 🚚

Site institucional moderno da Rodogarcia Transportes, com design inspirado em empresas de logística como Loggi.

## 🚀 Como Rodar Localmente

### Opção 1: Servidor Node.js (Recomendado)

```bash
# Inicie o servidor
node server.js

# Ou use o npm
npm start
```

Depois abra no navegador: `http://localhost:3000`

### Opção 2: Live Server (VS Code)

1. Instale a extensão "Live Server" no VS Code
2. Clique com botão direito no `index.html`
3. Selecione "Open with Live Server"

### ⚠️ Importante: Não abra o HTML diretamente

Não abra o arquivo `index.html` diretamente no navegador (file://), pois isso causa erro de CORS ao carregar o mapa SVG.

## 📁 Estrutura do Projeto

```
site-rodogarcia/
├── index.html              # Página principal
├── server.js               # Servidor HTTP simples
├── package.json            # Configurações do projeto
├── public/                 # Imagens e assets públicos
│   ├── certificados/       # Certificações e licenças
│   └── *.png              # Logos e fotos
└── src/
    ├── css/               # Estilos CSS
    │   ├── main.css       # CSS principal (importa todos)
    │   ├── base.css       # Reset e estilos base
    │   ├── variables.css  # Variáveis CSS
    │   ├── mapa.css       # Estilos do mapa interativo
    │   ├── responsive.css # Media queries e responsividade
    │   ├── components/    # Componentes reutilizáveis
    │   │   └── buttons.css
    │   ├── layout/        # Header e Footer
    │   │   ├── header.css
    │   │   └── footer.css
    │   └── sections/      # Seções da página
    │       ├── hero.css
    │       ├── certificados.css
    │       ├── diferenciais.css
    │       ├── dna.css
    │       ├── servicos.css
    │       ├── filiais.css
    │       └── rastreio.css
    └── script/            # JavaScript
        ├── main.js        # Script principal
        └── mapas/         # Mapa interativo (estrutura modular)
            ├── mapa.js    # Arquivo principal
            ├── config.js  # Configurações (cores, estados)
            ├── filiais.js # Dados das filiais
            ├── mapeamento.js # Mapeamento índices/estados
            ├── destaques.js  # Funções de destaque visual
            ├── interacoes.js # Cliques, hover, select
            ├── carregamento.js # Carregamento do SVG
            ├── map.svg    # Mapa do Brasil (SVG)
            └── README.md  # Documentação do mapa
```

## 🗺️ Mapa Interativo

O mapa do Brasil destaca os estados onde a Rodogarcia tem filiais:
- **SP** - São Paulo
- **PE** - Pernambuco
- **PR** - Paraná
- **RJ** - Rio de Janeiro
- **RS** - Rio Grande do Sul

### Estrutura Modular

O mapa foi refatorado em módulos para facilitar manutenção:

- **`config.js`** - Configurações gerais (cores, estados, caminho SVG)
- **`filiais.js`** - Dados completos de todas as filiais
- **`mapeamento.js`** - Mapeamento de índices para estados (necessário pois os IDs no SVG estão errados)
- **`destaques.js`** - Funções de destaque visual dos estados
- **`interacoes.js`** - Interações (cliques, hover, integração com select)
- **`carregamento.js`** - Carregamento e inserção do SVG no DOM
- **`mapa.js`** - Arquivo principal que inicializa tudo

### Como alterar estados destacados

Edite o array em `src/script/mapas/config.js`:

```javascript
export const ESTADOS_COM_FILIAIS = ['sp', 'pe', 'pr', 'rj', 'rs'];
```

### Funcionalidades do Mapa

- ✅ Destaque visual dos estados com filiais
- ✅ Hover padronizado em todos os estados
- ✅ Clique nos estados para ver filiais
- ✅ Integração com select de filiais
- ✅ Totalmente responsivo
- ✅ Animações suaves

## 📱 Responsividade

O site é totalmente responsivo com breakpoints otimizados:

- **Desktop**: Layout completo com grid de 2 colunas
- **Tablet** (até 968px): Grid em coluna única, elementos ajustados
- **Mobile** (até 768px): Layout vertical, fontes reduzidas
- **Mobile Pequeno** (até 480px): Espaçamentos mínimos, otimizado para telas pequenas

## 🎨 Tecnologias

- **HTML5** - Estrutura semântica
- **CSS3** - Estilos modernos com variáveis CSS e media queries
- **JavaScript ES6+** - Módulos ES6, código modular e organizado
- **SVG** - Mapa vetorial do Brasil interativo
- **Phosphor Icons** - Ícones modernos

## 📦 Deploy

### Deploy no Vercel (Recomendado)

O projeto está configurado para deploy no Vercel. Veja o arquivo `README-DEPLOY.md` para instruções detalhadas.

**Arquivos de configuração:**
- `vercel.json` - Configuração do Vercel
- `.vercelignore` - Arquivos ignorados no deploy
- `.gitignore` - Arquivos ignorados no Git

**Comandos rápidos:**
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy em produção
vercel --prod
```

### Outras Plataformas

- **Netlify**: Arraste a pasta no site
- **GitHub Pages**: Configure nas settings do repositório

**Arquivos necessários para deploy:**
- `src/` (pasta completa)
- `public/` (pasta completa)
- `vercel.json` (para Vercel)

**Não é necessário:**
- `server.js` (apenas para desenvolvimento local)
- Arquivos de desenvolvimento em `src/mapa/sources/` (já processados)

## 🔧 Desenvolvimento

### Adicionar Nova Filial

1. Edite `src/script/mapas/filiais.js`
2. Adicione o objeto da filial no objeto `filiais`
3. Se for em um estado novo, adicione o estado em `ESTADOS_COM_FILIAIS` em `config.js`
4. Adicione o mapeamento do índice em `mapeamento.js` se necessário

### Adicionar Nova Seção

1. Crie o arquivo CSS em `src/css/sections/nova-secao.css`
2. Importe em `src/css/main.css`
3. Adicione media queries em `src/css/responsive.css` se necessário

## 👨‍💻 Desenvolvedor

Desenvolvido com ❤️ por [Lucas Andrade](https://www.linkedin.com/in/dev-lucasandrade/)

## 📄 Licença

© 2025 Rodogarcia Transportes. Todos os direitos reservados.
