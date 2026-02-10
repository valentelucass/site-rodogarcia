# Site Rodogarcia Transportes

Site institucional estatico da Rodogarcia Transportes.

Objetivos principais:
- gerar contatos via WhatsApp
- receber solicitacoes de cotacao
- reforcar autoridade da marca
- manter boa base tecnica de SEO, performance e seguranca

## Stack
- HTML5
- CSS3 (arquitetura por camadas: base, layout, components, pages)
- JavaScript ES Modules (carrossel, componentes e mapa)
- Node.js (servidor local simples para desenvolvimento)
- Vercel (deploy, rewrites, headers e cache)

## Estrutura do projeto
```text
site-rodogarcia/
|-- public/
|-- src/
|   |-- components/
|   |-- css/
|   |   |-- base/
|   |   |-- components/
|   |   |-- layout/
|   |   `-- pages/
|   |-- script/
|   |   `-- mapas/
|   |-- index.html
|   |-- servicos.html
|   |-- sobre.html
|   |-- cotacao.html
|   `-- trabalhe-conosco.html
|-- robots.txt
|-- sitemap.xml
|-- vercel.json
|-- server.js
`-- package.json
```

## Como rodar localmente

Nao existe build step. O projeto e estatico.

### Opcao 1: Node.js
```bash
npm start
```
ou
```bash
node server.js
```

Acesse:
- `http://localhost:3000/src/index.html`

Observacao: esse servidor local e simples e nao aplica rewrites do `vercel.json`.

### Opcao 2: Vercel Dev (simula melhor producao)
```bash
npx vercel dev
```

Acesse:
- `http://localhost:3000/` (ou a porta exibida no terminal)

## Rotas publicas (producao)
- `/`
- `/servicos.html`
- `/sobre.html`
- `/cotacao.html`
- `/trabalhe-conosco.html`

## SEO tecnico aplicado
- `title` e `meta description` por pagina
- `canonical` por pagina
- `meta robots` por pagina
- Open Graph e Twitter Cards
- JSON-LD (Organization, LocalBusiness, Service, Breadcrumb e FAQ quando aplicavel)
- `robots.txt` na raiz
- `sitemap.xml` na raiz
- hierarquia de heading ajustada para evitar conflito de H1

## Performance aplicada
- atributos de imagem para reduzir CLS (`width`, `height`, `loading`, `decoding`, `fetchpriority`)
- `preconnect` para origens criticas
- script de icones com `defer`
- politica de cache para assets em `vercel.json`

## Seguranca aplicada (Vercel)
Headers configurados em `vercel.json`:
- `Strict-Transport-Security`
- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`

## Mapa interativo
Modulo em `src/script/mapas/`.

Arquivos principais:
- `config.js`
- `filiais.js`
- `mapeamento.js`
- `interacoes.js`
- `carregamento.js`
- `mapa.js`

Estados destacados atualmente:
- `SP`, `PE`, `PR`, `RJ`, `RS`

Documentacao especifica:
- `src/script/mapas/README.md`

## Deploy
Deploy recomendado: Vercel.

Arquivos importantes:
- `vercel.json`
- `robots.txt`
- `sitemap.xml`

Sem build, sem bundler e sem pipeline de compilacao.

## Licenca
Uso interno do projeto Rodogarcia Transportes.
