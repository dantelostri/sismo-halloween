import crypto from 'node:crypto';
import { db } from './db.js';

// Sin 0/O/1/I para que el código se pueda dictar o tipear en la puerta.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function newCode() {
  const bytes = crypto.randomBytes(10);
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `SISMO-${s.slice(0, 5)}-${s.slice(5)}`;
}

// Crea un ticket por persona. Es idempotente: si el pedido ya tiene tickets, los devuelve.
export async function ensureTickets(order) {
  const { data: existing, error } = await db.from('tickets').select('*').eq('order_id', order.id).order('seq');
  if (error) throw error;
  if (existing.length) return existing;

  const totalPersons = order.items.reduce((n, it) => n + it.persons * it.qty, 0);
  const rows = [];
  let seq = 0;
  for (const it of order.items) {
    for (let unit = 0; unit < it.qty; unit++) {
      for (let p = 0; p < it.persons; p++) {
        seq++;
        rows.push({
          code: newCode(),
          order_id: order.id,
          product_id: it.id,
          product_name: it.name,
          kind: it.kind,
          holder_name: order.buyer_name,
          seq,
          of_total: totalPersons,
        });
      }
    }
  }
  const { data, error: insErr } = await db.from('tickets').insert(rows).select('*');
  if (insErr) throw insErr;
  return data.sort((a, b) => a.seq - b.seq);
}
