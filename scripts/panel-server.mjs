import http from 'node:http';

// Local presentation entry point. Both windows use the same application/database.
const host = '127.0.0.1';
const port = 5174;
const upstreamPort = 5173;
const allowedHosts = new Set([`${host}:${port}`, `localhost:${port}`]);
const validRequest = request => allowedHosts.has(request.headers.host)
  && request.url?.startsWith('/') && !request.url.startsWith('//');

const server = http.createServer((request, response) => {
  if (!validRequest(request)) {
    response.writeHead(400).end('Endereço local inválido.');
    return;
  }
  if (request.url === '/' && ['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(302, { Location: '/area-do-cliente#manage', 'Cache-Control': 'no-store' }).end();
    return;
  }
  // Preserve Host and Origin together so the application's same-origin checks remain intact.
  const upstream = http.request({ hostname: host, port: upstreamPort, method: request.method,
    path: request.url, headers: request.headers }, result => {
    response.writeHead(result.statusCode ?? 502, result.headers);
    result.pipe(response);
  });
  upstream.on('error', () => {
    if (response.headersSent) { response.destroy(); return; }
    response.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('<!doctype html><html lang="pt-BR"><title>Aperte Play · Painel local</title><body style="font:18px system-ui;max-width:640px;margin:80px auto;padding:24px"><h1>Inicie o site para abrir o painel.</h1><p>O painel compartilha os dados com o site local. Inicie o site na porta 5173 e atualize esta página.</p><a href="http://127.0.0.1:5173/">Abrir site de vendas</a></body></html>');
  });
  request.on('aborted', () => upstream.destroy());
  response.on('close', () => { if (!response.writableEnded) upstream.destroy(); });
  request.pipe(upstream);
});

// Forward Vite's live-reload connection without starting a second database runtime.
server.on('upgrade', (request, socket, head) => {
  if (!validRequest(request) || (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`)) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    return;
  }
  const upstream = http.request({ hostname: host, port: upstreamPort, method: request.method,
    path: request.url, headers: request.headers });
  upstream.on('upgrade', (result, upstreamSocket, upstreamHead) => {
    socket.write(`HTTP/1.1 ${result.statusCode} ${result.statusMessage}\r\n`);
    for (let i = 0; i < result.rawHeaders.length; i += 2) socket.write(`${result.rawHeaders[i]}: ${result.rawHeaders[i + 1]}\r\n`);
    socket.write('\r\n');
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) upstreamSocket.write(head);
    socket.on('error', () => upstreamSocket.destroy());
    upstreamSocket.on('error', () => socket.destroy());
    socket.on('close', () => upstreamSocket.destroy());
    upstreamSocket.on('close', () => socket.destroy());
    socket.pipe(upstreamSocket).pipe(socket);
  });
  upstream.on('response', result => { result.resume(); socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n'); });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  upstream.end();
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'A porta 5174 já está ocupada. Confira se o painel já está aberto.' : error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`Aperte Play · Painel local: http://${host}:${port}/\nSite de vendas: http://${host}:${upstreamPort}/\nOs dois endereços compartilham os dados da demonstração.`));
