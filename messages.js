const https = require('https');

const MODEL = 'gemini-2.0-flash';

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

function httpsPost(options, bodyBuf) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end(); return;
  }
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed'); return;
  }

  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) {
    res.status(500).json({ error: 'GOOGLE_API_KEY 환경변수가 설정되지 않았습니다.' }); return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;

  let converted;
  try { converted = toGeminiBody(body); }
  catch (e) { res.status(400).json({ error: '요청 변환 실패: ' + e.message }); return; }

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

  try {
    const { status, body: respBody } = await httpsPost(options, bodyBuf);
    const gResp = JSON.parse(respBody);
    const text = gResp.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 받지 못했습니다.';
    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
