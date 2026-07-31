-- ============================================================
--  Migration v2 — cotações automáticas
--  Rode SOMENTE se você já tinha criado as tabelas com a versão
--  anterior do schema.sql. Se for uma instalação nova, o schema.sql
--  já inclui estas colunas e você NÃO precisa rodar este arquivo.
-- ============================================================
alter table public.investimentos add column if not exists ticker text;
alter table public.investimentos add column if not exists quantidade numeric(20,8);
