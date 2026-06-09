-- Aurum Premium Pazaryeri Ürünler Tablosu
-- Bu sorguyu Supabase > SQL Editor penceresinde çalıştırabilirsiniz.

create table if not exists public.products (
  id text primary key,                   -- Ürünün Base64 formatındaki benzersiz ID'si
  service_id text not null,              -- Orijinal 1stDibs ürün ID'si (örn. f_42440792)
  title text not null,                   -- Ürün Başlığı
  description text,                      -- Ürün Açıklaması
  pdp_url text,                          -- Ürünün orijinal detay linki
  vertical text,                         -- Kategori Dikey Grubu (furniture, art, jewelry, fashion vb.)
  category_path text,                    -- Detaylı kategori yolu
  images jsonb not null default '[]'::jsonb, -- Ürün resimlerinin listesi (JSON array)
  specs jsonb not null default '{}'::jsonb,   -- Ürün özellikleri (Ebatlar, Malzemeler, Tasarımcı, Menşei vb.)
  original_price numeric,                -- Scrape edilen orijinal fiyat (USD)
  price numeric not null,                -- %15 kar marjı eklenmiş nihai satış fiyatı (USD)
  price_currency text not null default 'USD', -- Fiyat Para Birimi
  created_at timestamptz default now()   -- Eklenme tarihi
);

-- Tablonun herkes tarafından okunabilmesi için RLS (Row Level Security) politikasını ayarlıyoruz.
alter table public.products enable row level security;

-- Herkesin ürünleri sorgulayabilmesi (read) için politika ekliyoruz:
create policy "Ürünler herkese açık olarak okunabilir" on public.products
  for select using (true);

-- Scraper'ın API veya anon anahtarla veri ekleyebilmesi/güncelleyebilmesi için politikalar ekliyoruz:
create policy "Anonim/Servis rolü veri ekleyebilir" on public.products
  for insert with check (true);

create policy "Anonim/Servis rolü veri güncelleyebilir" on public.products
  for update using (true);
