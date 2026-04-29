import http from 'http';
import url from 'url';

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  if (parsedUrl.pathname === '/log') {
    console.log('LOG_RECEIVE_START');
    console.log(parsedUrl.query.data);
    console.log('LOG_RECEIVE_END');
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    res.end('ok');
    process.exit(0); // Exit after receiving one log
  }
  res.end('ok');
});

server.listen(9999, () => {
  console.log('Diagnostic listener on 9999');
});
