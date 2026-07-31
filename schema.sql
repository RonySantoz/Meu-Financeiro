-- ============================================================
--  Financas Pessoais - Schema Supabase
--  Rode este arquivo no SQL Editor do seu projeto Supabase.
--  (Dashboard Supabase > SQL Editor > New query > cole tudo > Run)
-- ============================================================

-- ---------- CATEGORIAS ----------
create table if not exists public.categorias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nome        text not null,
  tipo        text not null default 'despesa' check (tipo in ('despesa','receita')),
  cor         text default '#6366f1',
  created_at  timestamptz not null default now()
);

-- ---------- TRANSACOES (contas, faturas, lancamentos manuais) ----------
create table if not exists public.transacoes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  data         date not null,
  descricao    text not null,            -- "nome" do lancamento
  valor        numeric(14,2) not null,   -- positivo = receita, negativo = despesa
  tipo         text not null default 'despesa' check (tipo in ('despesa','receita')),
  categoria_id uuid references public.categorias(id) on delete set null,
  origem       text default 'manual',    -- manual | pdf | fatura
  fonte        text,                      -- ex: "Cartao Nubank", "Conta Itau"
  created_at   timestamptz not null default now()
);
create index if not exists idx_transacoes_user_data on public.transacoes(user_id, data);

-- ---------- INVESTIMENTOS (posicoes por corretora) ----------
create table if not exists public.investimentos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  corretora    text not null,            -- XP, AUVP, Mercado Pago...
  ativo        text not null,            -- ex: "CDB Banco X", "PETR4", "Tesouro Selic"
  classe       text default 'Renda Fixa',-- Renda Fixa | Acoes | FIIs | Cripto | Fundos | Outros
  ticker       text,                      -- p/ cotacao automatica: PETR4, HGLG11, bitcoin
  quantidade   numeric(20,8),             -- qtd de cotas/ativos (para calcular valor atual)
  valor_aplicado numeric(14,2) not null default 0,
  valor_atual  numeric(14,2) not null default 0,
  data_ref     date not null default current_date,
  observacao   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_investimentos_user on public.investimentos(user_id);

-- ============================================================
--  ROW LEVEL SECURITY: cada usuario so ve/edita os proprios dados
-- ============================================================
alter table public.categorias    enable row level security;
alter table public.transacoes    enable row level security;
alter table public.investimentos enable row level security;

-- CATEGORIAS
drop policy if exists "cat_select" on public.categorias;
drop policy if exists "cat_ins"    on public.categorias;
drop policy if exists "cat_upd"    on public.categorias;
drop policy if exists "cat_del"    on public.categorias;
create policy "cat_select" on public.categorias for select using (auth.uid() = user_id);
create policy "cat_ins"    on public.categorias for insert with check (auth.uid() = user_id);
create policy "cat_upd"    on public.categorias for update using (auth.uid() = user_id);
create policy "cat_del"    on public.categorias for delete using (auth.uid() = user_id);

-- TRANSACOES
drop policy if exists "tx_select" on public.transacoes;
drop policy if exists "tx_ins"    on public.transacoes;
drop policy if exists "tx_upd"    on public.transacoes;
drop policy if exists "tx_del"    on public.transacoes;
create policy "tx_select" on public.transacoes for select using (auth.uid() = user_id);
create policy "tx_ins"    on public.transacoes for insert with check (auth.uid() = user_id);
create policy "tx_upd"    on public.transacoes for update using (auth.uid() = user_id);
create policy "tx_del"    on public.transacoes for delete using (auth.uid() = user_id);

-- INVESTIMENTOS
drop policy if exists "inv_select" on public.investimentos;
drop policy if exists "inv_ins"    on public.investimentos;
drop policy if exists "inv_upd"    on public.investimentos;
drop policy if exists "inv_del"    on public.investimentos;
create policy "inv_select" on public.investimentos for select using (auth.uid() = user_id);
create policy "inv_ins"    on public.investimentos for insert with check (auth.uid() = user_id);
create policy "inv_upd"    on public.investimentos for update using (auth.uid() = user_id);
create policy "inv_del"    on public.investimentos for delete using (auth.uid() = user_id);

-- ============================================================
--  CATEGORIAS PADRAO ao criar um novo usuario (opcional)
-- ============================================================
create or replace function public.seed_categorias()
returns trigger language plpgsql security definer as $$
begin
  insert into public.categorias (user_id, nome, tipo, cor) values
    (new.id, 'Alimentacao',   'despesa', '#ef4444'),
    (new.id, 'Moradia',       'despesa', '#f59e0b'),
    (new.id, 'Transporte',    'despesa', '#3b82f6'),
    (new.id, 'Lazer',         'despesa', '#8b5cf6'),
    (new.id, 'Saude',         'despesa', '#10b981'),
    (new.id, 'Educacao',      'despesa', '#06b6d4'),
    (new.id, 'Assinaturas',   'despesa', '#ec4899'),
    (new.id, 'Outros',        'despesa', '#64748b'),
    (new.id, 'Salario',       'receita', '#22c55e'),
    (new.id, 'Rendimentos',   'receita', '#84cc16');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.seed_categorias();
