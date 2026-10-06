import { db, send } from '../lib/db.js';

// Control de puerta: valida un código y lo marca como usado (una sola vez).
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  const { code, pin } = req.body ?? {};
  if (!process.env.DOOR_PIN || pin !== process.env.DOOR_PIN) return send(res, 401, { error: 'PIN incorrecto' });

  try {
    const stats = await countStats();
    if (!code) return send(res, 200, { stats });

    const clean = String(code).trim().toUpperCase();
    const { data: ticket } = await db
      .from('tickets')
      .select('*, orders!inner(status, buyer_dni)')
      .eq('code', clean)
      .maybeSingle();

    if (!ticket || ticket.orders.status !== 'approved') return send(res, 200, { result: 'invalid', stats });

    const info = {
      code: ticket.code,
      kind: ticket.kind,
      product: ticket.product_name,
      holder: ticket.holder_name,
      dni: ticket.orders.buyer_dni,
      seq: ticket.seq,
      of: ticket.of_total,
    };
    if (ticket.checked_in_at) return send(res, 200, { result: 'used', at: ticket.checked_in_at, ticket: info, stats });

    const { data: updated } = await db
      .from('tickets')
      .update({ checked_in_at: new Date().toISOString() })
      .eq('code', clean)
      .is('checked_in_at', null)
      .select('code');
    if (!updated?.length) return send(res, 200, { result: 'used', ticket: info, stats });

    send(res, 200, { result: 'ok', ticket: info, stats: { ...stats, inside: stats.inside + 1 } });
  } catch (err) {
    console.error('checkin', err);
    send(res, 500, { error: 'Error del servidor' });
  }
}

async function countStats() {
  const total = await db.from('tickets').select('code', { count: 'exact', head: true });
  const inside = await db.from('tickets').select('code', { count: 'exact', head: true }).not('checked_in_at', 'is', null);
  return { total: total.count ?? 0, inside: inside.count ?? 0 };
}
