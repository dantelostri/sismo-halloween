import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { EVENT } from './event.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function sendTicketsEmail(order, tickets) {
  const attachments = await Promise.all(
    tickets.map(async (t) => ({
      filename: `${t.code}.png`,
      content: await QRCode.toBuffer(t.code, { width: 480, margin: 2, errorCorrectionLevel: 'M' }),
      cid: t.code,
    })),
  );

  const blocks = tickets
    .map(
      (t) => `
      <tr><td style="padding:0 0 20px">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0d0c;border:1px solid #2b231d;border-radius:14px">
          <tr><td align="center" style="padding:22px 16px 6px;font:700 13px Arial,sans-serif;letter-spacing:2px;color:${t.kind === 'vip' ? '#3dff2a' : '#f46e16'}">
            ${t.kind === 'vip' ? 'VIP · ' : ''}ENTRADA ${t.seq} DE ${t.of_total}
          </td></tr>
          <tr><td align="center" style="padding:6px 16px 4px;font:400 13px Arial,sans-serif;color:#a39bb3">${esc(t.product_name)}</td></tr>
          <tr><td align="center" style="padding:12px">
            <img src="cid:${t.code}" width="240" height="240" alt="QR ${t.code}" style="display:block;border-radius:8px;background:#fff">
          </td></tr>
          <tr><td align="center" style="padding:0 16px 22px;font:700 16px 'Courier New',monospace;letter-spacing:1px;color:#f2eefa">${t.code}</td></tr>
        </table>
      </td></tr>`,
    )
    .join('');

  const html = `<!doctype html><html><body style="margin:0;background:#050505">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505"><tr><td align="center" style="padding:28px 14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
      <tr><td align="center" style="padding-bottom:8px"><img src="${process.env.SITE_URL}/assets/logo-halloween.png" width="240" alt="SISMO" style="display:block"></td></tr>
      <tr><td align="center" style="padding-bottom:12px"><img src="${process.env.SITE_URL}/assets/halloween-drip.png" width="260" alt="HALLOWEEN" style="display:block"></td></tr>
      <tr><td align="center" style="font:400 15px Arial,sans-serif;color:#f2eefa;padding-bottom:4px">${EVENT.dateLong} · Ingreso de ${EVENT.doors}</td></tr>
      <tr><td align="center" style="font:400 14px Arial,sans-serif;color:#a39bb3;padding-bottom:26px">${EVENT.venue}${EVENT.address ? ' · ' + EVENT.address : ''}</td></tr>
      <tr><td style="font:400 15px/1.5 Arial,sans-serif;color:#f2eefa;padding-bottom:22px">
        Hola ${esc(order.buyer_name.split(' ')[0])}, tu pago fue aprobado. Abajo tenés <b>un QR por persona</b>.
        Si compraste para tu grupo, reenviale a cada uno su QR. Cada código entra una sola vez.
      </td></tr>
      ${blocks}
      <tr><td style="font:400 13px/1.6 Arial,sans-serif;color:#a39bb3;padding-top:6px">
        • Evento +${EVENT.minAge}: llevá tu DNI.<br>
        • Disfraz obligatorio. Hay premio al mejor disfraz.<br>
        • Ingreso de ${EVENT.doors}. Después de las 03:00 hs no se garantiza el acceso.<br>
        • Cómo llegar: <a href="${EVENT.mapsUrl}" style="color:#f46e16">ver en Google Maps</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  await transporter.sendMail({
    from: `"SISMO" <${process.env.GMAIL_USER}>`,
    to: order.buyer_email,
    subject: `Tus entradas · SISMO Halloween ${EVENT.dateShort}`,
    html,
    attachments,
  });
}
