import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db, send } from '../lib/db.js';
import { ensureTickets } from '../lib/tickets.js';
import { sendTicketsEmail } from '../lib/mail.js';

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// Mercado Pago avisa acá cada cambio de un pago. No confiamos en el aviso:
// volvemos a consultar el pago con nuestro token antes de emitir entradas.
export default async function handler(req, res) {
  const type = req.query.type ?? req.query.topic ?? req.body?.type;
  const paymentId = req.query['data.id'] ?? req.body?.data?.id ?? (req.query.topic === 'payment' ? req.query.id : null);
  if (type !== 'payment' || !paymentId) return send(res, 200, { ignored: true });

  try {
    const payment = await new Payment(mp).get({ id: paymentId });
    const orderId = payment.external_reference;
    if (!orderId) return send(res, 200, { ignored: true });

    const { data: order, error } = await db.from('orders').select('*').eq('id', orderId).single();
    if (error || !order) return send(res, 200, { ignored: true });

    if (payment.status === 'approved') {
      if (Number(payment.transaction_amount) < order.total) {
        console.error('webhook: monto menor al del pedido', orderId, payment.transaction_amount, order.total);
        return send(res, 200, { ignored: true });
      }
      if (order.status !== 'approved') {
        await db
          .from('orders')
          .update({ status: 'approved', mp_payment_id: String(payment.id), approved_at: new Date().toISOString() })
          .eq('id', orderId);
      }
      const tickets = await ensureTickets(order);
      if (!order.email_sent_at) {
        await sendTicketsEmail(order, tickets);
        await db.from('orders').update({ email_sent_at: new Date().toISOString() }).eq('id', orderId);
      }
    } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(payment.status) && order.status === 'pending') {
      await db
        .from('orders')
        .update({ status: payment.status === 'rejected' ? 'rejected' : 'cancelled', mp_payment_id: String(payment.id) })
        .eq('id', orderId);
    }

    send(res, 200, { ok: true });
  } catch (err) {
    // 500 → Mercado Pago reintenta el aviso más tarde (por ejemplo si falló el mail).
    console.error('webhook', err);
    send(res, 500, { error: 'retry' });
  }
}
