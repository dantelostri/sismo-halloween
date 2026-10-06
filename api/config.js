import { getProducts, getSettings, getUsage, remaining, send } from '../lib/db.js';

// Catálogo público con disponibilidad. La página lo pide al cargar.
export default async function handler(req, res) {
  try {
    const [products, settings, usage] = await Promise.all([getProducts(), getSettings(), getUsage()]);
    const left = remaining(settings, usage);
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    send(res, 200, {
      salesOpen: settings.sales_open,
      feePct: Number(settings.service_fee_pct) || 0,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        kind: p.kind,
        persons: p.persons,
        unitPrice: p.unit_price,
        tanda: p.tanda,
        available: settings.sales_open && (p.kind === 'vip' ? left.vip >= 1 : left.general >= p.persons),
      })),
    });
  } catch (err) {
    console.error('config', err);
    send(res, 500, { error: 'No se pudo cargar el catálogo' });
  }
}
