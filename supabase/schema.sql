-- SISMO Halloween · esquema de base de datos (Supabase / Postgres)
-- Pegar completo en Supabase → SQL Editor → Run.

create extension if not exists pgcrypto;

-- Catálogo de entradas. Los precios se editan desde Supabase → Table Editor → products.
-- unit_price = precio por persona. El total de cada producto = unit_price × persons.
create table if not exists products (
  id          text primary key,
  name        text not null,
  description text,
  kind        text not null check (kind in ('general', 'vip')),
  persons     int  not null check (persons > 0),
  unit_price  int  not null check (unit_price > 0),
  tanda       text,
  active      boolean not null default true,
  sort        int  not null default 0
);

-- Ajustes del evento (una sola fila). Editables en vivo desde el Table Editor.
create table if not exists settings (
  id               int primary key default 1 check (id = 1),
  sales_open       boolean not null default true,
  max_general      int,              -- tope de personas con entrada general (null = sin tope)
  max_vip_boxes    int,              -- tope de boxes VIP (null = sin tope)
  service_fee_pct  numeric not null default 12 -- aranceles de Mercado Pago que paga el comprador, en % (0 = sin recargo)
);

create table if not exists orders (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  buyer_name       text not null,
  buyer_email      text not null,
  buyer_dni        text not null,
  items            jsonb not null,
  general_persons  int not null default 0,
  vip_boxes        int not null default 0,
  subtotal         int not null,
  fee              int not null default 0,
  total            int not null,
  mp_preference_id text,
  mp_payment_id    text,
  approved_at      timestamptz,
  email_sent_at    timestamptz
);
create index if not exists orders_status_created_idx on orders (status, created_at);

create table if not exists tickets (
  code           text primary key,
  order_id       uuid not null references orders(id) on delete cascade,
  product_id     text not null,
  product_name   text not null,
  kind           text not null,
  holder_name    text not null,
  seq            int  not null,
  of_total       int  not null,
  created_at     timestamptz not null default now(),
  checked_in_at  timestamptz
);
create index if not exists tickets_order_idx on tickets (order_id);

-- Sin políticas públicas: solo el backend (service role) lee y escribe.
alter table products enable row level security;
alter table settings enable row level security;
alter table orders   enable row level security;
alter table tickets  enable row level security;

-- Datos iniciales (Tanda 1, planilla "SISMO HALLOWEEN").
insert into settings (id) values (1) on conflict (id) do nothing;

insert into products (id, name, description, kind, persons, unit_price, tanda, sort) values
  ('general-1', 'Entrada general',  'Acceso + barra libre',                               'general', 1,  28000, 'Tanda 1', 10),
  ('pack-2',    'Pack x2',          '2 entradas generales + barra libre',                 'general', 2,  26000, 'Tanda 1', 20),
  ('pack-3',    'Pack x3',          '3 entradas generales + barra libre',                 'general', 3,  25000, 'Tanda 1', 30),
  ('pack-4',    'Pack x4',          '4 entradas generales + barra libre',                 'general', 4,  24000, 'Tanda 1', 40),
  ('pack-6',    'Pack x6',          '6 entradas generales + barra libre',                 'general', 6,  23000, 'Tanda 1', 50),
  ('vip-10',    'Box VIP · 10 personas', 'Sector propio, tragos premium, ingreso sin fila y prioridad en la barra', 'vip', 10, 40000, 'Tanda 1', 60)
on conflict (id) do nothing;
