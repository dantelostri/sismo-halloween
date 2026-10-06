// Adaptador para Netlify Functions: recibe /api/<nombre> y lo pasa al handler de api/<nombre>.js,
// que están escritos con la forma (req, res) de Vercel/Express.
import configHandler from '../../api/config.js';
import checkoutHandler from '../../api/checkout.js';
import webhookHandler from '../../api/webhook.js';
import checkinHandler from '../../api/checkin.js';

const routes = {
  config: configHandler,
  checkout: checkoutHandler,
  webhook: webhookHandler,
  checkin: checkinHandler,
};

export default async (request) => {
  const url = new URL(request.url);
  const name = url.pathname.replace(/^\/api\/?/, '').split('/')[0];
  const handler = routes[name];
  if (!handler) return new Response(JSON.stringify({ error: 'No encontrado' }), { status: 404 });

  const text = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }

  const req = {
    method: request.method,
    query: Object.fromEntries(url.searchParams),
    body,
    headers: Object.fromEntries(request.headers),
  };

  return new Promise((resolve) => {
    let status = 200;
    const headers = new Headers();
    const res = {
      status(code) { status = code; return res; },
      setHeader(key, value) { headers.set(key, value); return res; },
      send(payload) { resolve(new Response(payload, { status, headers })); return res; },
    };
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error(`api/${name}`, err);
      resolve(new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 }));
    });
  });
};

export const config = { path: '/api/*' };
