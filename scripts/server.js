/**
 * @file server.js
 * @description Máy chủ HTTP tĩnh phục vụ Frontend & Resources cho Bloxorz.
 * Chạy thuần bằng các module lõi có sẵn của Node.js (http, fs, path, url), không phụ thuộc npm package ngoài.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
    // 1. Cho phép CORS toàn cục
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const reqHost = req.headers.host || `${HOST}:${PORT}`;
    // noinspection HttpUrlsUsage
    const parsedUrl = new URL(req.url, `http://${reqHost}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // 2. Health check endpoint cho start.ps1 kiểm tra trạng thái
    if (pathname === '/health' || pathname === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'online', service: 'Bloxorz Frontend', port: PORT }));
        return;
    }

    // 3. Định tuyến trang chủ về frontend/index.html
    if (pathname === '/' || pathname === '') {
        pathname = '/frontend/index.html';
    }

    // 4. Phân giải đường dẫn tệp thực tế
    let filePath;
    if (pathname.startsWith('/resources/') || pathname.startsWith('/frontend/')) {
        filePath = path.join(ROOT_DIR, pathname);
    } else {
        // Tìm trong frontend trước, nếu không có thì tìm ở root
        const candidateInFrontend = path.join(FRONTEND_DIR, pathname);
        if (fs.existsSync(candidateInFrontend) && !fs.statSync(candidateInFrontend).isDirectory()) {
            filePath = candidateInFrontend;
        } else {
            filePath = path.join(ROOT_DIR, pathname);
        }
    }

    // Bảo mật: Ngăn chặn Directory Traversal tấn công ra ngoài ROOT_DIR
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(ROOT_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden');
        return;
    }

    // Nếu là thư mục, thử tìm index.html bên trong
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
        const candidateIndex = path.join(resolvedPath, 'index.html');
        if (fs.existsSync(candidateIndex)) {
            filePath = candidateIndex;
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found (Directory)');
            return;
        }
    }

    // 5. Đọc và truyền tải nội dung tệp
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`404 Not Found: ${pathname}`);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, HOST, () => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    // noinspection HttpUrlsUsage
    console.log(`[${timeStr}] [NodeJS] Bloxorz Frontend Server dang chay tai http://${HOST}:${PORT}`);
    // noinspection HttpUrlsUsage
    console.log(`[${timeStr}] [NodeJS] Duong dan game: http://${HOST}:${PORT}/frontend/index.html`);
});

// Xử lý tín hiệu tắt an toàn
process.on('SIGINT', () => {
    server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
});
