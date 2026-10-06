# SISMO Halloween · Landing + venta de entradas

Landing con carrito, pago con Mercado Pago, mail con un QR por persona y control de puerta con escaneo.

```
public/          → la página (index), /gracias y /puerta (escáner para el staff)
api/config       → catálogo y disponibilidad (precios desde la base)
api/checkout     → crea el pedido y el link de pago de Mercado Pago
api/webhook      → Mercado Pago avisa el pago → se generan los QR y se manda el mail
api/checkin      → valida un QR en la puerta (cada código entra una sola vez)
supabase/        → esquema de la base de datos
```

## Cómo funciona una compra

1. La persona arma el carrito y completa nombre, email y DNI.
2. `api/checkout` recalcula el total con los precios de la base (nunca con los del navegador), revisa el cupo y la manda a pagar a Mercado Pago.
3. Cuando se aprueba el pago, Mercado Pago avisa a `api/webhook`. El webhook vuelve a consultar el pago con tu token, crea un ticket por persona y manda el mail con los QR.
4. En la puerta, el staff entra a `/puerta` con el PIN y escanea. Verde = pasa, naranja = ya usada, rojo = no válida.

Un pedido pendiente reserva cupo 30 minutos, que es lo que dura el link de pago. No se acepta efectivo (Rapipago/Pago Fácil) porque esos pagos quedan pendientes días.

## Puesta en marcha (una sola vez)

### 1. Base de datos: Supabase (gratis)
1. Crear un proyecto en https://supabase.com.
2. SQL Editor → pegar todo `supabase/schema.sql` → Run.
3. Project Settings → API: copiar **Project URL** y **service_role key**.

### 2. Mercado Pago
Tus integraciones → Crear aplicación (Checkout Pro) → **Credenciales de producción** → copiar el **Access Token**.
Para probar sin plata real, usar primero las credenciales de prueba y las tarjetas de prueba de Mercado Pago.

### 3. Gmail para mandar las entradas
Con la cuenta de Gmail de SISMO: activar la verificación en 2 pasos y crear una **contraseña de aplicación** en https://myaccount.google.com/apppasswords.
Gmail permite unos 500 mails por día, y se manda un mail por compra.

### 4. Publicar en Vercel
1. Subir esta carpeta a un repo de GitHub (o usar `npx vercel` desde la carpeta).
2. En Vercel: Add New → Project → importar el repo. Framework: **Other**.
3. Settings → Environment Variables: cargar las variables de `.env.example`.
   `SITE_URL` es la URL que te da Vercel (por ejemplo `https://sismo-halloween.vercel.app`).
4. Redeploy.

## Operación diaria (desde Supabase → Table Editor)

| Quiero… | Dónde |
|---|---|
| Cambiar precios o pasar a Tanda 2 | `products` → editar `unit_price` y `tanda` |
| Ocultar un producto | `products` → `active` = false |
| Poner tope de entradas | `settings` → `max_general` (personas) y `max_vip_boxes` |
| Cerrar la venta | `settings` → `sales_open` = false |
| Cambiar el % de aranceles de Mercado Pago que paga el comprador | `settings` → `service_fee_pct` (viene en 12; 0 = sin recargo) |
| Ver compradores | `orders` (filtrar `status` = approved) |
| Ver quién entró | `tickets` → `checked_in_at` |

Los cambios se ven en la página en menos de un minuto, sin volver a publicar.

## Reenviar un mail
En `orders`, borrar el valor de `email_sent_at` del pedido. El mail se vuelve a mandar con el próximo aviso de Mercado Pago. Para forzarlo, en Mercado Pago → Tus integraciones → Webhooks → reenviar la notificación del pago.

## Vista previa local
`npm run preview` sirve solo la página (sin pagos) en http://localhost:4173.
Para probar todo junto: `npm i -g vercel`, crear `.env.local` con las variables y correr `vercel dev`.
