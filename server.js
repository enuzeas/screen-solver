const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const HTML_FILE = path.join(__dirname, 'screen_solver.html');
const MODEL = 'gemini-2.0-flash';

// .env 파일 로드 (dotenv 없이 직접 파싱)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

const API_KEY = (process.env.GOOGLE_API_KEY || '').trim();

if (!API_KEY) {
  console.error('\n  ❌ API 키가 없습니다!');
  console.error('  .env 파일에 아래 내용을 추가하세요:\n');
  console.error('  GOOGLE_API_KEY=AIza...\n');
  console.error('  발급: https://aistudio.google.com/apikey\n');
  process.exit(1);
}

// Anthropic 형식 → Gemini 형식 변환
function toGeminiBody(anthropicBody) {
  const parsed = JSON.parse(anthropicBody);
  const contents = parsed.messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: Array.isArray(msg.content)
      ? msg.content.map(c => {
          if (c.type === 'text') return { text: c.text };
          if (c.type === 'image') return {
            inlineData: { mimeType: c.source.media_type, data: c.source.data }
          };
          return { text: '' };
        })
      : [{ text: msg.content }]
  }));
  return JSON.stringify({
    contents,
    generationConfig: { maxOutputTokens: parsed.max_tokens || 1000 }
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  const pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;

  // HTML 파일 서빙
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    fs.readFile(HTML_FILE, (err, data) => {
      if (err) { res.writeHead(404); res.end('screen_solver.html 파일을 찾을 수 없습니다.'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // Google AI Studio API 프록시
  if (req.method === 'POST' && pathname === '/api/messages') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let converted;
      try { converted = toGeminiBody(body); }
      catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: '요청 변환 실패: ' + e.message })); return; }

      const bodyBuf = Buffer.from(converted, 'utf8');
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': bodyBuf.length
        }
      };

      const proxyReq = https.request(options, proxyRes => {
        let respBody = '';
        proxyRes.on('data', chunk => respBody += chunk);
        proxyRes.on('end', () => {
          try {
            const gResp = JSON.parse(respBody);
            const text = gResp.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 받지 못했습니다.';
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ content: [{ type: 'text', text }] }));
          } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: '응답 변환 실패', raw: respBody }));
          }
        });
      });

      proxyReq.on('error', err => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      });

      proxyReq.write(bodyBuf);
      proxyReq.end();
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log(`  ✅ Screen Solver 시작! (Google AI Studio / ${MODEL})`);
  console.log(`  👉 http://localhost:${PORT}`);
  console.log('  종료: Ctrl+C');
  console.log('');
});
