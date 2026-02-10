// Servidor HTTP simples para desenvolvimento local.
// Execute com: node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT_DIR = __dirname;

const routeMap = new Map([
    ['/', '/src/index.html'],
    ['/index.html', '/src/index.html'],
    ['/servicos.html', '/src/servicos.html'],
    ['/sobre.html', '/src/sobre.html'],
    ['/cotacao.html', '/src/cotacao.html'],
    ['/trabalhe-conosco.html', '/src/trabalhe-conosco.html']
]);

const mimeTypes = {
    '.avif': 'image/avif',
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml; charset=utf-8'
};

function resolveFilePath(requestUrl) {
    const parsedUrl = new URL(requestUrl, `http://localhost:${PORT}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    if (routeMap.has(pathname)) {
        pathname = routeMap.get(pathname);
    }

    const filePath = path.normalize(path.join(ROOT_DIR, pathname));

    // Bloqueia path traversal.
    if (!filePath.startsWith(ROOT_DIR)) {
        return null;
    }

    return filePath;
}

const server = http.createServer((req, res) => {
    const filePath = resolveFilePath(req.url);

    if (!filePath) {
        res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>403 - Acesso negado</h1>');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 - Arquivo nao encontrado</h1>');
                return;
            }

            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<h1>500 - Erro no servidor (${error.code})</h1>`);
            return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Servindo arquivos de: ${ROOT_DIR}`);
});
