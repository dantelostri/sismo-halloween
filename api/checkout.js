import { MercadoPagoConfig, Preference } from 'mercadopago';
import { db, getProducts, getSettings, getUsage, remaining, send, HOLD_MINUTES } from '../lib/db.js';

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const MAX_QTY_PER_LINE = 10;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });

  const { items, buyer, adult } = req.body ?? {};
  const name = String(buyer?.name ?? '').trim().slice(0, 80);
  const email = String(buyer?.email ?? '').trim().toLowerCase().slice(0, 120);
  const dni = String(buyer?.dni ?? '').replace(/\D/g, '');

  if (name.length < 3) return send(res, 400, { error: 'Ingresá tu nombre y apellido' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'El email no es válido' });
  if (dni.length < 7 || dni.length > 8) return send(res, 400, { error: 'El DNI tiene que tener 7 u 8 números' });
  if (adult !== true) return send(res, 400, { error: `Tenés que confirmar que sos mayor de 21` });
  if (!Array.isArray(items) || !items.length) return send(res, 400, { error: 'El carrito está vacío' });

  try {
    const [products, settings, usage] = await Promise.all([getProducts(), getSettings(), getUsage()]);
    if (!settings.sales_open) return send(res, 409, { error: 'La venta está cerrada' });

    // Los precios salen siempre de la base, nunca del navegador.
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = [];
    for (const it of items) {
      const p = byId.get(it?.id);
      const qty = Math.floor(Number(it?.qty));
      if (!p || !(qty >= 1 && qty <= MAX_QTY_PER_LINE)) return send(res, 400, { error: 'Hay un producto inválido en el carrito' });
      lines.push({ id: p.id, name: p.name, kind: p.kind, persons: p.persons, qty, price: p.unit_price * p.persons });
    }

    const generalPersons = lines.filter((l) => l.kind === 'general').reduce((n, l) => n + l.persons * l.qty, 0);
    const vipBoxes = lines.filter((l) => l.kind === 'vip').reduce((n, l) => n + l.qty, 0);
    const left = remaining(settings, usage);
    if (generalPersons > left.general) return send(res, 409, { error: 'No quedan suficientes entradas generales' });
    if (vipBoxes > left.vip) return send(res, 409, { error: 'No quedan boxes VIP disponibles' });

    const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0);
    const fee = Math.round((subtotal * (Number(settings.service_fee_pct) || 0)) / 100);

    const { data: order, error } = await db
      .from('orders')
      .insert({
        buyer_name: name,
        buyer_email: email,
        buyer_dni: dni,
        items: lines,
        general_persons: generalPersons,
        vip_boxes: vipBoxes,
        subtotal,
        fee,
        total: subtotal + fee,
      })
      .select('*')
      .single();
    if (error) throw error;

    const site = process.env.SITE_URL;
    const mpItems = lines.map((l) => ({
      id: l.id,
      title: `SISMO Halloween · ${l.name}`,
      quantity: l.qty,
      unit_price: l.price,
      currency_id: 'ARS',
    }));
    if (fee) mpItems.push({ id: 'fee', title: 'Aranceles de Mercado Pago', quantity: 1, unit_price: fee, currency_id: 'ARS' });

    const pref = await new Preference(mp).create({
      body: {
        items: mpItems,
        payer: { name, email, identification: { type: 'DNI', number: dni } },
        external_reference: order.id,
        notification_url: `${site}/api/webhook`,
        back_urls: {
          success: `${site}/gracias`,
          pending: `${site}/gracias`,
          failure: `${site}/?pago=error#entradas`,
        },
        auto_return: 'approved',
        statement_descriptor: 'SISMO',
        expires: true,
        expiration_date_to: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(),
        // Sin efectivo (Rapipago/Pago Fácil): quedan pendientes días y bloquearían cupo.
        payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
      },
    });

    await db.from('orders').update({ mp_preference_id: pref.id }).eq('id', order.id);
    send(res, 200, { url: pref.init_point });
  } catch (err) {
    console.error('checkout', err);
    send(res, 500, { error: 'No pudimos iniciar el pago. Probá de nuevo en un minuto.' });
  }
}
