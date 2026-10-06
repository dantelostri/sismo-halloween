import { createClient } from '@supabase/supabase-js';

export const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Un pedido pendiente reserva cupo durante este tiempo (igual a la expiración del link de pago).
export const HOLD_MINUTES = 30;

export async function getSettings() {
  const { data, error } = await db.from('settings').select('*').eq('id', 1).single();
  if (error) throw error;
  return data;
}

export async function getProducts() {
  const { data, error } = await db.from('products').select('*').eq('active', true).order('sort');
  if (error) throw error;
  return data;
}

// Cupo usado = pedidos aprobados + pendientes que todavía están dentro de la ventana de pago.
export async function getUsage() {
  const since = new Date(Date.now() - HOLD_MINUTES * 60_000).toISOString();
  const { data, error } = await db
    .from('orders')
    .select('general_persons, vip_boxes')
    .or(`status.eq.approved,and(status.eq.pending,created_at.gt.${since})`);
  if (error) throw error;
  return data.reduce(
    (acc, o) => ({ general: acc.general + o.general_persons, vip: acc.vip + o.vip_boxes }),
    { general: 0, vip: 0 },
  );
}

export function remaining(settings, usage) {
  return {
    general: settings.max_general == null ? Infinity : settings.max_general - usage.general,
    vip: settings.max_vip_boxes == null ? Infinity : settings.max_vip_boxes - usage.vip,
  };
}

export function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}
