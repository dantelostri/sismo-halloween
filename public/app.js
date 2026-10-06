// ====== Datos editables de la página ======
const EVENT = {
  start: '2026-10-31T01:00:00-03:00', // viernes 30, abren puertas 01:00
  venue: 'FRERE',
  address: 'Buenos Aires',
  mapsUrl: 'https://maps.app.goo.gl/PdKQrBdsQQBZA3KM9',
  lat: -34.5649182,
  lng: -58.4383053,
  instagram: 'https://www.instagram.com/',
};

// Fotos de ediciones anteriores (public/assets/fotos/). Con la lista vacía, la galería no se muestra.
const GALLERY = [
  '/assets/fotos/disfraz-01.jpg',
  '/assets/fotos/disfraz-02.jpg',
  '/assets/fotos/disfraz-03.jpg',
  ...Array.from({ length: 15 }, (_, i) => `/assets/fotos/foto-${String(i + 1).padStart(2, '0')}.jpg`),
];

const MARQUEE = ['Barra libre', 'Disfraz obligatorio', 'Premio al mejor disfraz', '+21', 'Vie 30.10', 'Ingreso de 01 a 03 hs'];

// Catálogo de respaldo: se usa solo si /api/config no responde (por ejemplo, en una vista previa local).
// El catálogo real y los precios que se cobran salen de la base de datos.
const FALLBACK = {
  salesOpen: true,
  feePct: 12,
  offline: true,
  products: [
    { id: 'general-1', name: 'Entrada general', description: 'Acceso + barra libre', kind: 'general', persons: 1, unitPrice: 28000, tanda: 'Tanda 1', available: true },
    { id: 'pack-2', name: 'Pack x2', description: '2 entradas generales + barra libre', kind: 'general', persons: 2, unitPrice: 26000, tanda: 'Tanda 1', available: true },
    { id: 'pack-3', name: 'Pack x3', description: '3 entradas generales + barra libre', kind: 'general', persons: 3, unitPrice: 25000, tanda: 'Tanda 1', available: true },
    { id: 'pack-4', name: 'Pack x4', description: '4 entradas generales + barra libre', kind: 'general', persons: 4, unitPrice: 24000, tanda: 'Tanda 1', available: true },
    { id: 'pack-6', name: 'Pack x6', description: '6 entradas generales + barra libre', kind: 'general', persons: 6, unitPrice: 23000, tanda: 'Tanda 1', available: true },
    { id: 'vip-10', name: 'Box VIP · 10 personas', description: 'Sector propio, tragos premium, ingreso sin fila y prioridad en la barra', kind: 'vip', persons: 10, unitPrice: 40000, tanda: 'Tanda 1', available: true },  ],
};
const VIP_PERKS = ['Sector propio', 'Tragos premium', 'Ingreso sin fila', 'Prioridad en la barra'];

// ====== Utilidades ======
const $ = (s, el = document) => el.querySelector(s);
const money = (n) => '$' + Math.round(n).toLocaleString('es-AR');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let catalog = FALLBACK;
let cart = store.get('sismo-cart', {}); // { productId: qty }
let buyer = store.get('sismo-buyer', { name: '', email: '', dni: '' });
const picks = {}; // cantidad elegida en cada tarjeta antes de agregar

const product = (id) => catalog.products.find((p) => p.id === id);
const priceOf = (p) => p.unitPrice * p.persons;
const baseUnit = () => (catalog.products.find((p) => p.kind === 'general' && p.persons === 1) || {}).unitPrice;

// ====== Render de entradas ======
function renderTickets() {
  const tandas = [...new Set(catalog.products.map((p) => p.tanda).filter(Boolean))];
  $('#tandaBar').innerHTML = tandas.map((t) => `<span class="tanda on">${esc(t)} · Activa</span>`).join('') +
    (catalog.salesOpen ? '' : '<span class="tanda">Venta cerrada</span>');

  const base = baseUnit();
  $('#tickets').innerHTML = catalog.products.map((p) => {
    const q = picks[p.id] ?? 1;
    const save = base && p.kind === 'general' && p.unitPrice < base ? Math.round((1 - p.unitPrice / base) * 100) : 0;
    const vip = p.kind === 'vip';
    return `
    <article class="ticket ${vip ? 'vip' : ''} ${p.available ? '' : 'soldout'}" data-id="${p.id}">
      ${p.available ? '' : '<span class="soldout-stamp">AGOTADO</span>'}
      ${vip ? `<svg class="card-web" viewBox="0 0 200 200" aria-hidden="true">${webSVG()}</svg>` : ''}
      <div class="ticket-tag"><span>${vip ? 'VIP' : p.persons === 1 ? 'Individual' : p.persons + ' personas'}</span>${save ? `<span class="save">−${save}% c/u</span>` : ''}</div>
      <h3>${esc(p.name.replace(' · ', ' '))}</h3>
      ${vip ? `<ul>${VIP_PERKS.map((x) => `<li>${x}</li>`).join('')}</ul>` : `<p class="desc">${esc(p.description || '')}</p>`}
      <div class="perf"></div>
      <div class="price"><b>${money(p.unitPrice)}</b><small>por persona</small></div>
      <p class="price-total">${p.persons > 1 ? `Total ${vip ? 'del box' : 'del pack'}: <b>${money(priceOf(p))}</b>` : '&nbsp;'}</p>
      <div class="ticket-actions">
        <div class="stepper" aria-label="Cantidad">
          <button type="button" data-step="-1" aria-label="Menos">−</button>
          <output>${q}</output>
          <button type="button" data-step="1" aria-label="Más">+</button>
        </div>
        <button class="btn btn-orange add-btn" type="button" ${p.available ? '' : 'disabled'}>Agregar</button>
      </div>
    </article>`;
  }).join('');

  $('#feeNote').textContent = catalog.feePct ? ` Al finalizar la compra se suman los aranceles de Mercado Pago (${String(catalog.feePct).replace('.', ',')} %).` : '';

  const min = Math.min(...catalog.products.filter((p) => p.available).map((p) => p.unitPrice));
  $('#mobileBarPrice').textContent = isFinite(min) ? money(min) : 'Agotado';
}

$('#tickets').addEventListener('click', (e) => {
  const card = e.target.closest('.ticket');
  if (!card) return;
  const id = card.dataset.id;
  const step = e.target.closest('[data-step]');
  if (step) {
    picks[id] = Math.min(10, Math.max(1, (picks[id] ?? 1) + Number(step.dataset.step)));
    $('output', card).textContent = picks[id];
    return;
  }
  if (e.target.closest('.add-btn')) {
    const q = picks[id] ?? 1;
    cart[id] = Math.min(10, (cart[id] ?? 0) + q);
    saveCart();
    picks[id] = 1;
    $('output', card).textContent = 1;
    toast(`${q} × ${product(id).name} al carrito`);
    const btn = $('#cartBtn');
    btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
  }
});

// ====== Carrito ======
function cartLines() {
  return Object.entries(cart)
    .map(([id, qty]) => ({ p: product(id), qty }))
    .filter((l) => l.p && l.qty > 0);
}
function saveCart() {
  for (const id of Object.keys(cart)) if (!product(id) || cart[id] <= 0) delete cart[id];
  store.set('sismo-cart', cart);
  renderCart();
}
function totals() {
  const lines = cartLines();
  const subtotal = lines.reduce((n, l) => n + priceOf(l.p) * l.qty, 0);
  const fee = Math.round((subtotal * (catalog.feePct || 0)) / 100);
  const persons = lines.reduce((n, l) => n + l.p.persons * l.qty, 0);
  return { lines, subtotal, fee, total: subtotal + fee, persons };
}

function renderCart() {
  const { lines, subtotal, fee, total, persons } = totals();
  const count = lines.reduce((n, l) => n + l.qty, 0);
  $('#cartCount').textContent = count;
  $('#cartCount').dataset.n = count;
  $('#mobileBarLabel').textContent = count ? `${persons} ${persons === 1 ? 'persona' : 'personas'}` : 'Desde';
  if (count) $('#mobileBarPrice').textContent = money(total);
  $('#mobileBarBtn').textContent = count ? 'Ver carrito' : 'Comprar';

  if (!lines.length) {
    $('#drawerBody').innerHTML = `<div class="cart-empty"><svg viewBox="0 0 64 64"><use href="#i-pumpkin"/></svg><b>Tu carrito está vacío</b>Elegí tu entrada y armá la noche.</div>`;
    $('#drawerFoot').hidden = true;
    return;
  }
  $('#drawerFoot').hidden = false;
  $('#drawerBody').innerHTML = `
    ${lines.map(({ p, qty }) => `
      <div class="line" data-id="${p.id}">
        <span class="line-name">${esc(p.name)}</span>
        <span class="line-price">${money(priceOf(p) * qty)}</span>
        <span class="line-sub">${p.persons > 1 ? `${p.persons} personas × ${money(p.unitPrice)}` : money(p.unitPrice)}${qty > 1 ? ` · ${qty} unidades` : ''}</span>
        <div class="line-controls">
          <div class="stepper"><button type="button" data-step="-1" aria-label="Menos">−</button><output>${qty}</output><button type="button" data-step="1" aria-label="Más">+</button></div>
          <button type="button" class="link-btn" data-remove>Quitar</button>
        </div>
      </div>`).join('')}
    <div class="totals">
      <div><span>${persons} ${persons === 1 ? 'entrada' : 'entradas'} (QR por persona)</span><span>${money(subtotal)}</span></div>
      ${fee ? `<div><span>Aranceles de Mercado Pago (${String(catalog.feePct).replace('.', ',')} %)</span><span>${money(fee)}</span></div>` : ''}
      <div class="grand"><span>Total</span><span>${money(total)}</span></div>
    </div>
    <form class="form" id="checkoutForm" novalidate>
      <h3>Datos del titular</h3>
      <div class="field"><label for="fName">Nombre y apellido</label><input id="fName" name="name" autocomplete="name" required value="${esc(buyer.name)}"></div>
      <div class="field"><label for="fEmail">Email (ahí te llegan los QR)</label><input id="fEmail" name="email" type="email" autocomplete="email" inputmode="email" required value="${esc(buyer.email)}"></div>
      <div class="field"><label for="fDni">DNI</label><input id="fDni" name="dni" inputmode="numeric" pattern="[0-9]*" maxlength="10" required value="${esc(buyer.dni)}"></div>
      <label class="check"><input type="checkbox" id="fAdult" required> Confirmo que todos los asistentes son mayores de 21 años y van disfrazados.</label>
    </form>`;
}

$('#drawerBody').addEventListener('click', (e) => {
  const line = e.target.closest('.line');
  if (!line) return;
  const id = line.dataset.id;
  const step = e.target.closest('[data-step]');
  if (step) { cart[id] = Math.min(10, (cart[id] ?? 0) + Number(step.dataset.step)); saveCart(); }
  if (e.target.closest('[data-remove]')) { delete cart[id]; saveCart(); }
});
$('#drawerBody').addEventListener('input', (e) => {
  if (!e.target.name) return;
  if (e.target.name === 'dni') e.target.value = e.target.value.replace(/\D/g, '');
  buyer[e.target.name] = e.target.value;
  store.set('sismo-buyer', buyer);
  $('#formError').textContent = '';
});

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'checkoutForm') return;
  e.preventDefault();
  const err = $('#formError');
  const name = buyer.name.trim(), email = buyer.email.trim(), dni = buyer.dni.trim();
  if (name.length < 3) return (err.textContent = 'Completá tu nombre y apellido.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return (err.textContent = 'Revisá el email: ahí te llegan las entradas.');
  if (dni.length < 7 || dni.length > 8) return (err.textContent = 'El DNI tiene que tener 7 u 8 números.');
  if (!$('#fAdult').checked) return (err.textContent = 'Tenés que confirmar la edad y el disfraz.');
  if (catalog.offline) return (err.textContent = 'Vista previa: el pago se activa cuando el sitio está publicado en Vercel.');

  const btn = $('#payBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Conectando con Mercado Pago';
  try {
    const r = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cartLines().map((l) => ({ id: l.p.id, qty: l.qty })), buyer: { name, email, dni }, adult: true }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.url) throw new Error(data.error || 'No pudimos iniciar el pago.');
    window.location.href = data.url;
  } catch (ex) {
    err.textContent = ex.message;
    btn.disabled = false;
    btn.textContent = 'Pagar con Mercado Pago';
    loadCatalog(); // por si algo se agotó mientras tanto
  }
});

// ====== Drawer ======
function openCart() {
  $('#toast').classList.remove('show');
  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  $('#scrim').classList.remove('open');
  document.body.style.overflow = '';
}
$('#cartBtn').addEventListener('click', openCart);
$('#closeCart').addEventListener('click', closeCart);
$('#scrim').addEventListener('click', closeCart);
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeCart());
$('#mobileBarBtn').addEventListener('click', () => (cartLines().length ? openCart() : $('#entradas').scrollIntoView()));

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ====== Catálogo ======
async function loadCatalog() {
  try {
    const r = await fetch('/api/config', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error();
    catalog = await r.json();
  } catch {
    catalog = FALLBACK;
  }
  renderTickets();
  saveCart();
}

// ====== Decoración de Halloween ======
// Telaraña que nace en la esquina superior izquierda (0,0) de un viewBox de 200×200.
function webSVG() {
  const angles = [0, 14, 29, 45, 61, 76, 90].map((a) => (a * Math.PI) / 180);
  const pt = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  let d = angles.map((a) => { const [x, y] = pt(200, a); return `M0 0L${x.toFixed(1)} ${y.toFixed(1)}`; }).join('');
  for (const r of [34, 66, 100, 136, 174]) {
    for (let i = 0; i < angles.length - 1; i++) {
      const [x1, y1] = pt(r, angles[i]);
      const [x2, y2] = pt(r, angles[i + 1]);
      const [cx, cy] = pt(r * 0.86, (angles[i] + angles[i + 1]) / 2); // hilo vencido hacia el centro
      d += `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
  }
  return `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.1"/>`;
}

// Borde inferior con gotas que chorrean (viewBox 1200×46).
function slimePath() {
  const drips = [[60, 18], [150, 34], [235, 14], [330, 40], [420, 22], [520, 30], [600, 12], [690, 42], [790, 20], [880, 32], [965, 16], [1060, 38], [1140, 24]];
  let d = 'M0 0H1200V6';
  for (const [x, len] of [...drips].reverse()) {
    const w = 9 + (len % 5);
    d += `L${x + w + 8} 6C${x + w} 6 ${x + w} ${len - w} ${x} ${len}C${x - w} ${len - w} ${x - w} 6 ${x - w - 8} 6`;
  }
  return d + 'L0 6Z';
}

// ====== Resto de la página ======
function initStatic() {
  const items = [...MARQUEE, ...MARQUEE].map((t) => `<span>${t}</span><i><svg viewBox="0 0 64 26"><use href="#i-bat"/></svg></i>`).join('');
  $('#marquee').innerHTML = items + items;

  $('#venueName').textContent = EVENT.venue;
  $('#venueAddress').textContent = EVENT.address;
  $('#mapsLink').href = EVENT.mapsUrl;
  $('#mapFrame').src = `https://maps.google.com/maps?q=${EVENT.lat},${EVENT.lng}&z=16&output=embed`;
  $('#igLink').href = EVENT.instagram;

  if (GALLERY.length) {
    $('#galeria').hidden = false;
    $('#gallery').innerHTML = GALLERY.map((src) => `<figure><img src="${src}" alt="Fiesta SISMO" loading="lazy"></figure>`).join('');
  }

  // Telarañas
  document.querySelectorAll('[data-web]').forEach((el) => (el.innerHTML = webSVG()));

  // Baba naranja que chorrea debajo de la cinta
  $('#slime path').setAttribute('d', slimePath());

  // Linterna sobre las manos del hero (sigue al cursor; en celular se mueve sola)
  const hero = $('#hero');
  let pointer = false;
  hero.addEventListener('pointermove', (e) => {
    pointer = true;
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--x', `${e.clientX - r.left}px`);
    hero.style.setProperty('--y', `${e.clientY - r.top}px`);
  });
  const wander = (t) => {
    if (!pointer) {
      hero.style.setProperty('--x', `${50 + Math.sin(t / 2300) * 32}%`);
      hero.style.setProperty('--y', `${45 + Math.sin(t / 1700) * 22}%`);
    }
    requestAnimationFrame(wander);
  };
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(wander);

  // La araña baja cuando aparece la sección de entradas
  const spider = $('#spider');
  new IntersectionObserver(([en]) => spider.style.setProperty('--drop', en.isIntersecting ? '230px' : '40px'), { threshold: 0.15 })
    .observe($('#entradas'));

  if (new URLSearchParams(location.search).get('pago') === 'error') {
    setTimeout(() => { openCart(); $('#formError').textContent = 'El pago no se completó. Podés intentarlo de nuevo.'; }, 300);
  }

  // Cuenta regresiva
  const target = new Date(EVENT.start).getTime();
  const tick = () => {
    const d = Math.max(0, target - Date.now());
    const vals = { d: Math.floor(d / 864e5), h: Math.floor(d / 36e5) % 24, m: Math.floor(d / 6e4) % 60, s: Math.floor(d / 1e3) % 60 };
    for (const [k, v] of Object.entries(vals)) $(`[data-u="${k}"]`).textContent = String(v).padStart(2, '0');
  };
  tick();
  setInterval(tick, 1000);

  // Nav y barra móvil
  const onScroll = () => {
    $('#nav').classList.toggle('scrolled', scrollY > 30);
    const tickets = $('#entradas').getBoundingClientRect();
    const inTickets = tickets.top < innerHeight * 0.6 && tickets.bottom > innerHeight * 0.4;
    $('#mobileBar').classList.toggle('show', scrollY > innerHeight * 0.6 && (!inTickets || cartLines().length > 0));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Animación de entrada
  const io = new IntersectionObserver((entries) => entries.forEach((en) => en.isIntersecting && (en.target.classList.add('in'), io.unobserve(en.target))), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

initStatic();
renderTickets();
renderCart();
loadCatalog();
