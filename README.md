# 💰 Minhas Finanças

App web (PWA) para controlar **contas, faturas de cartão e investimentos**, com gráficos diários, mensais e comparativo entre períodos. Roda 100% no navegador, hospedado de graça no **GitHub Pages**, com dados salvos no seu próprio **Supabase** (nuvem + login).

- ✅ Instala como app no celular e no computador (PWA)
- ✅ Login por e-mail/senha, dados privados por usuário (RLS)
- ✅ Lançamentos manuais por **categoria** e **nome**
- ✅ Importação de **PDF, CSV e OFX** (com revisão antes de salvar)
- ✅ Investimentos por corretora (XP, AUVP, Mercado Pago, etc.)
- ✅ **Cotações automáticas** de ações, FIIs e cripto (atualiza o valor de mercado)
- ✅ Gráficos: gasto diário, evolução mensal, por categoria e comparativo entre meses
- ✅ Sem servidor próprio, sem custo (planos gratuitos)

---

## Arquivos do projeto

```
index.html            # estrutura do app
style.css             # visual (tema escuro)
app.js                # toda a lógica
config.js             # <- VOCÊ edita: URL/chave do Supabase e token brapi (opcional)
manifest.webmanifest  # metadados do PWA
sw.js                 # service worker (offline/instalação)
schema.sql            # <- VOCÊ roda no Supabase (cria as tabelas)
migration_v2.sql      # rode só se já tinha criado as tabelas antes (cotações)
icons/                # ícones do app
```

---

## Passo 1 — Criar o projeto no Supabase (grátis)

1. Acesse https://supabase.com e crie uma conta.
2. **New project** → escolha um nome e uma senha de banco → aguarde criar.
3. No menu lateral, abra **SQL Editor** → **New query**.
4. Cole **todo** o conteúdo de `schema.sql` e clique em **Run**. Isso cria as tabelas (`transacoes`, `categorias`, `investimentos`), ativa a segurança por usuário (RLS) e cadastra categorias padrão automaticamente.
5. Vá em **Project Settings → API** e copie:
   - **Project URL** (ex: `https://abcxyz.supabase.co`)
   - Chave **anon public**
6. (Opcional) Em **Authentication → Providers → Email**, você pode desligar "Confirm email" para logar direto sem confirmar o e-mail.

## Passo 2 — Preencher o `config.js`

Abra `config.js` e substitua pelos seus valores:

```js
window.SUPABASE_URL = "https://abcxyz.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGci...sua_chave_anon...";
```

> A chave **anon** é pública por design — a proteção dos dados vem das políticas RLS do `schema.sql`. **Nunca** coloque aqui a chave `service_role`.

## Passo 3 — Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex: `minhas-financas`). Pode ser público ou privado.
2. Suba **todos os arquivos** desta pasta na raiz do repositório (incluindo a pasta `icons/`).
   - Pela web: **Add file → Upload files** → arraste tudo → **Commit**.
   - Ou por git:
     ```bash
     git init && git add . && git commit -m "app financas"
     git branch -M main
     git remote add origin https://github.com/SEU_USUARIO/minhas-financas.git
     git push -u origin main
     ```
3. No repositório: **Settings → Pages**.
4. Em **Source**, escolha **Deploy from a branch** → branch **main** → pasta **/ (root)** → **Save**.
5. Aguarde ~1 minuto. O endereço aparece no topo, algo como:
   `https://SEU_USUARIO.github.io/minhas-financas/`

## Passo 4 — Instalar como app

Abra o link do GitHub Pages e:

- **Celular (Android/Chrome):** menu ⋮ → **Instalar app** / **Adicionar à tela inicial**.
- **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.
- **Computador (Chrome/Edge):** ícone de instalar na barra de endereço.

Crie sua conta na primeira tela (**Criar conta**) e comece a usar.

---

## Como usar

- **Lançamentos:** adicione gastos/receitas com data, nome, valor, categoria e fonte. Filtre por nome, categoria ou tipo.
- **Importar:** selecione um **PDF** (fatura), **CSV** ou **OFX** (extrato), informe a fonte, clique **Processar**. O app extrai as transações; **revise/edite** a lista e clique **Salvar selecionadas**.
  - CSV: reconhece colunas de data, descrição e valor (com ou sem cabeçalho; separador `;` ou `,`; valores no formato `1.234,56` ou `1234.56`).
  - OFX/QFX: lê os blocos `STMTTRN` padrão dos bancos.
- **Investimentos:** cadastre cada posição por corretora com valor aplicado e valor atual. A rentabilidade e a alocação são calculadas automaticamente.
- **Cotações automáticas:** preencha **Ticker** e **Quantidade** na posição e clique **↻ Atualizar cotações**. O valor atual vira `quantidade × preço de mercado`.
  - Ações/FIIs: use o código da B3 (`PETR4`, `HGLG11`). Fonte: brapi.dev.
  - Cripto: escolha a classe **Cripto** e use o id da moeda (`bitcoin`, `ethereum`) ou a sigla (`btc`, `eth`). Fonte: CoinGecko, em BRL.
  - Renda fixa/CDB continua manual (não há cotação de mercado pública).
- **Painel:** KPIs do período + gráficos diário, mensal (12 meses), por categoria e comparativo entre dois meses.
- **Config:** gerencie categorias e exporte um backup em JSON.

---

## Notas importantes

- **PDF escaneado (imagem)** não funciona — o app lê apenas PDFs com texto selecionável. Cada banco tem um layout diferente, então sempre confira os valores na tela de revisão antes de salvar. Se algum banco não for bem reconhecido, me avise o layout que eu ajusto a heurística.
- **Posições dos investimentos são cadastradas por você:** XP, AUVP e Mercado Pago não oferecem API pública pessoal confiável para puxar posições automaticamente. Mas o **valor de mercado** de ações, FIIs e cripto é atualizado sozinho pelo botão de cotações.
- **brapi.dev:** o plano gratuito pode exigir um token (grátis) para ações/FIIs. Se as cotações da bolsa não vierem, crie o token em https://brapi.dev/dashboard e cole em `window.BRAPI_TOKEN` no `config.js`. Cripto (CoinGecko) não precisa de token.
- **Segurança:** cada usuário só enxerga os próprios dados graças ao RLS. Mesmo com o repositório público, ninguém acessa seus dados sem sua senha.

## Evoluções possíveis (é só pedir)

- Metas de gasto por categoria e alertas.
- Contas recorrentes / faturas parceladas.
- Atualização de cotações agendada (automática) em vez de manual.
