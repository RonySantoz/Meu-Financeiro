/* ================================================================
   Minhas Finanças — app.js (vanilla JS, sem build)
   Requer: config.js, supabase-js, chart.js, pdf.js (carregados no index.html)
================================================================ */
"use strict";

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n) => (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthISO = (d = new Date()) => d.toISOString().slice(0, 7);

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.add("hidden"), 2600);
}

/* ---------------- Estado ---------------- */
let sb = null;
let USER = null;
let CATS = [];      // categorias
let TXS = [];       // transacoes
let INVS = [];      // investimentos
const charts = {};  // instancias Chart.js

/* ---------------- Init ---------------- */
function initSupabase() {
  if (!window.SUPABASE_URL || window.SUPABASE_URL.includes("SEU-PROJETO")) {
    $("#auth-msg").textContent = "Configure o arquivo config.js com sua URL e chave anon do Supabase.";
    return false;
  }
  sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  return true;
}

document.addEventListener("DOMContentLoaded", async () => {
  wireUI();
  $("#auth-view").classList.remove("hidden");
  if (!initSupabase()) return;
  const { data } = await sb.auth.getSession();
  if (data.session) { USER = data.session.user; await enterApp(); }
  sb.auth.onAuthStateChange((_e, session) => {
    if (session && !USER) { USER = session.user; enterApp(); }
    if (!session && USER) { USER = null; location.reload(); }
  });
});

/* ---------------- Auth (só e-mail, sem senha) ----------------
   A senha é derivada do e-mail no navegador (SHA-256 + APP_SECRET).
   O usuário só digita o e-mail. Requer "Confirm email" DESLIGADO no Supabase. */
async function derivarSenha(email) {
  const base = (window.APP_SECRET || "financas-app") + "|" + email.trim().toLowerCase();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return "Aa1!" + hex.slice(0, 28); // prefixo garante complexidade mínima
}
async function entrarComEmail() {
  const email = $("#auth-email").value.trim();
  if (!email || !email.includes("@")) { $("#auth-msg").style.color = "var(--neg)"; $("#auth-msg").textContent = "Digite um e-mail válido."; return; }
  const btn = $("#btn-entrar"); btn.disabled = true; btn.textContent = "Entrando...";
  $("#auth-msg").style.color = "var(--muted)"; $("#auth-msg").textContent = "";
  try {
    const password = await derivarSenha(email);
    // 1) tenta entrar
    let { error } = await sb.auth.signInWithPassword({ email, password });
    if (!error) return; // sucesso -> onAuthStateChange abre o app
    // 2) primeiro acesso: cria a conta
    if (/invalid login/i.test(error.message)) {
      const { data: su, error: e2 } = await sb.auth.signUp({ email, password });
      if (e2) { $("#auth-msg").style.color = "var(--neg)"; $("#auth-msg").textContent = traduzErro(e2.message); return; }
      if (su && su.session) return; // já logou (confirmação desligada)
      // 3) sem sessão -> tenta login logo após criar
      const { error: e3 } = await sb.auth.signInWithPassword({ email, password });
      if (e3) { $("#auth-msg").style.color = "var(--neg)"; $("#auth-msg").textContent = traduzErro(e3.message); return; }
      return;
    }
    $("#auth-msg").style.color = "var(--neg)"; $("#auth-msg").textContent = traduzErro(error.message);
  } finally {
    btn.disabled = false; btn.textContent = "Entrar";
  }
}
function traduzErro(m = "") {
  if (/email not confirmed|confirm/i.test(m))
    return "Desative 'Confirm email' no Supabase (Authentication > Sign In/Providers > Email) para entrar só com o e-mail.";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas. Aguarde alguns minutos.";
  if (/signups not allowed/i.test(m)) return "Cadastro desativado no Supabase. Ative em Authentication > Providers > Email.";
  return m;
}

async function enterApp() {
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#user-email").textContent = USER.email;
  // datas padrao
  $("#tx-data").value = todayISO();
  $("#inv-data").value = todayISO();
  const first = new Date(); first.setDate(1);
  $("#dash-de").value = first.toISOString().slice(0, 10);
  $("#dash-ate").value = todayISO();
  const prev = new Date(); prev.setMonth(prev.getMonth() - 1);
  $("#cmp-a").value = monthISO(prev);
  $("#cmp-b").value = monthISO();
  await loadAll();
}

async function loadAll() {
  await loadCategorias();
  await loadTransacoes();
  await loadInvestimentos();
  renderDashboard();
}

/* ---------------- Categorias ---------------- */
async function loadCategorias() {
  const { data, error } = await sb.from("categorias").select("*").order("nome");
  if (error) return toast("Erro ao carregar categorias");
  CATS = data || [];
  const opts = (sel, blank) =>
    (blank ? `<option value="">${blank}</option>` : "") +
    CATS.map((c) => `<option value="${c.id}">${c.nome}</option>`).join("");
  $("#tx-cat").innerHTML = opts("", "Sem categoria");
  $("#tx-filtro-cat").innerHTML = opts("", "Todas as categorias");
  // chips
  $("#cat-list").innerHTML = CATS.map((c) =>
    `<span class="chip"><span class="dot" style="background:${c.cor}"></span>${c.nome}
       <span class="muted small">(${c.tipo})</span>
       <button class="link-btn danger" data-delcat="${c.id}" title="Excluir">✕</button></span>`
  ).join("") || `<span class="muted small">Nenhuma categoria.</span>`;
}
function catById(id) { return CATS.find((c) => c.id === id); }

async function addCategoria(e) {
  e.preventDefault();
  const nome = $("#cat-nome").value.trim();
  if (!nome) return;
  const { error } = await sb.from("categorias").insert({
    user_id: USER.id, nome, tipo: $("#cat-tipo").value, cor: $("#cat-cor").value,
  });
  if (error) return toast("Erro ao salvar categoria");
  $("#cat-nome").value = "";
  await loadCategorias(); toast("Categoria adicionada");
}
async function delCategoria(id) {
  if (!confirm("Excluir categoria? Os lançamentos ficam sem categoria.")) return;
  await sb.from("categorias").delete().eq("id", id);
  await loadCategorias(); await loadTransacoes(); renderDashboard();
}

/* ---------------- Transações ---------------- */
async function loadTransacoes() {
  const { data, error } = await sb.from("transacoes").select("*").order("data", { ascending: false });
  if (error) return toast("Erro ao carregar lançamentos");
  TXS = data || [];
  renderTxTable();
}
function renderTxTable() {
  const q = ($("#tx-busca").value || "").toLowerCase();
  const fc = $("#tx-filtro-cat").value;
  const ft = $("#tx-filtro-tipo").value;
  const fm = $("#tx-filtro-metodo").value;
  const rows = TXS.filter((t) =>
    (!q || t.descricao.toLowerCase().includes(q)) &&
    (!fc || t.categoria_id === fc) &&
    (!fm || (t.metodo || "") === fm) &&
    (!ft || t.tipo === ft)
  );
  $("#tx-table tbody").innerHTML = rows.map((t) => {
    const c = catById(t.categoria_id);
    const cor = c ? c.cor : "#64748b";
    const cls = t.tipo === "receita" ? "pos" : "neg";
    return `<tr>
      <td>${fmtData(t.data)}</td>
      <td>${esc(t.descricao)}</td>
      <td><span class="badge" style="background:${cor}">${c ? esc(c.nome) : "—"}</span></td>
      <td class="muted small">${esc(t.metodo || "")}</td>
      <td class="muted">${esc(t.fonte || "")}</td>
      <td class="right ${cls}">${brl(t.tipo === "receita" ? Math.abs(t.valor) : -Math.abs(t.valor))}</td>
      <td class="right">
        <button class="link-btn" data-edittx="${t.id}">✎</button>
        <button class="link-btn danger" data-deltx="${t.id}">✕</button>
      </td></tr>`;
  }).join("") || `<tr><td colspan="7" class="muted">Nenhum lançamento.</td></tr>`;
}
async function saveTx(e) {
  e.preventDefault();
  const id = $("#tx-id").value;
  const tipo = $("#tx-tipo").value;
  const valorAbs = Math.abs(parseFloat($("#tx-valor").value));
  const rec = {
    user_id: USER.id,
    data: $("#tx-data").value,
    descricao: $("#tx-desc").value.trim(),
    tipo,
    valor: tipo === "receita" ? valorAbs : -valorAbs,
    categoria_id: $("#tx-cat").value || null,
    metodo: $("#tx-metodo").value,
    fonte: $("#tx-fonte").value.trim() || null,
    origem: "manual",
  };
  const res = id
    ? await sb.from("transacoes").update(rec).eq("id", id)
    : await sb.from("transacoes").insert(rec);
  if (res.error) return toast("Erro ao salvar");
  $("#form-tx").reset(); $("#tx-id").value = ""; $("#tx-data").value = todayISO();
  await loadTransacoes(); renderDashboard(); toast("Lançamento salvo");
}
function editTx(id) {
  const t = TXS.find((x) => x.id === id); if (!t) return;
  $("#tx-id").value = t.id; $("#tx-data").value = t.data;
  $("#tx-desc").value = t.descricao; $("#tx-valor").value = Math.abs(t.valor);
  $("#tx-tipo").value = t.tipo; $("#tx-cat").value = t.categoria_id || "";
  $("#tx-metodo").value = t.metodo || "Cartão";
  $("#tx-fonte").value = t.fonte || "";
  $("#tab-transacoes").scrollIntoView({ behavior: "smooth" });
}
async function delTx(id) {
  if (!confirm("Excluir lançamento?")) return;
  await sb.from("transacoes").delete().eq("id", id);
  await loadTransacoes(); renderDashboard();
}

/* ---------------- Importar (PDF / CSV / OFX) ---------------- */
let PDF_ITENS = [];
async function processarArquivo() {
  const file = $("#pdf-file").files[0];
  if (!file) return toast("Selecione um arquivo");
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  $("#pdf-status").textContent = "Lendo arquivo...";
  try {
    if (ext === "pdf") {
      PDF_ITENS = await lerPDF(file);
    } else if (ext === "csv") {
      PDF_ITENS = extrairCSV(await file.text());
    } else if (ext === "ofx" || ext === "qfx") {
      PDF_ITENS = extrairOFX(await file.text());
    } else {
      return ($("#pdf-status").textContent = "Formato não suportado. Use PDF, CSV ou OFX.");
    }
    renderPDFReview();
    if (PDF_ITENS.length)
      $("#pdf-status").textContent = `${PDF_ITENS.length} transações encontradas. Revise abaixo.`;
    else
      $("#pdf-status").textContent = "Nenhuma transação reconhecida. Confira o formato do arquivo ou use o lançamento manual.";
  } catch (err) {
    console.error(err);
    $("#pdf-status").textContent = "Falha ao ler o arquivo.";
  }
}

async function lerPDF(file) {
  if (!window.pdfjsLib) { toast("Biblioteca PDF não carregou (verifique a internet)"); return []; }
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let linhas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const porY = {};
    tc.items.forEach((it) => {
      const y = Math.round(it.transform[5]);
      (porY[y] = porY[y] || []).push(it.str);
    });
    Object.keys(porY).sort((a, b) => b - a).forEach((y) => linhas.push(porY[y].join(" ")));
  }
  const texto = linhas.join("\n");
  // extrato de conta (Bradesco) x fatura de cartão
  if (/PIX (RECEBIDO|ENVIADO)|Saldo \(R\$\)|Hist[oó]rico de Lan/i.test(texto) && /PIX|D[eé]bito/i.test(texto)) {
    const ex = extrairExtratoBradesco(linhas);
    if (ex.length) return ex;
  }
  return extrairTransacoes(linhas, $("#pdf-ano").value);
}

/* ---- Extrato Bradesco (conta): débito/crédito pela variação de saldo ----
   Exclui: créditos, auto-transferências (Ronierison), GASTOS CARTAO (já na fatura)
   e movimentações de investimento (RENTAB/aplicação). */
function extrairExtratoBradesco(linhas) {
  const RE_MONEY = /\d{1,3}(?:\.\d{3})*,\d{2}/g;
  const RE_DOC = /\b\d{6,7}\b/;
  const temLetras = (s) => /[A-Za-zÁÉÍÓÚÂÊÔÃÕÇ]{3,}/.test(s);
  const money = (s) => (s.match(RE_MONEY) || []);
  const isMoneyLine = (s) => RE_MONEY.test(s) && RE_DOC.test(s);
  const out = [];
  let prevSaldo = null, curDate = null;
  for (let i = 0; i < linhas.length; i++) {
    const ln = linhas[i];
    if (/[ÚU]ltimos\s+Lan/i.test(ln)) break; // recap final -> encerra
    const md = ln.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (md && (ln.trim().startsWith(md[1]) || isMoneyLine(ln))) curDate = md[1];
    if (!isMoneyLine(ln)) continue;
    const vals = money(ln);
    const saldo = parseValorBR(vals[vals.length - 1]);
    const amount = vals.length >= 2 ? parseValorBR(vals[vals.length - 2]) : 0;
    if (prevSaldo === null) { prevSaldo = saldo; continue; }
    const delta = Math.round((saldo - prevSaldo) * 100) / 100;
    prevSaldo = saldo;
    if (delta >= 0) continue;               // crédito -> ignora (foco em custos)
    const val = Math.abs(delta);
    if (!val) continue;
    // rótulo: texto próprio antes do docto, senão linha anterior
    const doc = ln.match(RE_DOC);
    let proprio = doc ? ln.slice(0, ln.indexOf(doc[0])).replace(/^\s*\d{2}\/\d{2}\/\d{4}/, "").trim() : "";
    let label = temLetras(proprio) ? proprio : "";
    if (!label) for (const j of [i - 1, i - 2])
      if (j >= 0 && temLetras(linhas[j]) && !isMoneyLine(linhas[j]) && !/DES:|REM:/.test(linhas[j])) { label = linhas[j].trim(); break; }
    // nome: DES:/REM: abaixo, senão linha de descrição abaixo
    let nome = "";
    for (const j of [i + 1, i + 2]) {
      if (j >= linhas.length) break;
      const m = linhas[j].match(/(?:DES|REM):\s*(.+?)\s*(?:\d{2}\/\d{2})?\s*$/);
      if (m) { nome = m[1].trim(); break; }
      if (!nome && temLetras(linhas[j]) && !isMoneyLine(linhas[j]) && !/Saldo/.test(linhas[j]))
        nome = linhas[j].replace(/\s*\d{2}\/\d{2}\s*$/, "").trim();
    }
    const labUp = (label || "").toUpperCase();
    if (labUp.includes("GASTOS CARTAO")) continue;                 // pagamento de fatura
    if (/RENTAB|INVEST|APLICAC|RESGATE|FACILCRED/.test(labUp)) continue; // investimento
    if (/ronierison de jesus/i.test(nome + " " + label)) continue; // auto-transferência
    const metodo = labUp.includes("PIX") ? "Pix" : "Outros";
    let desc = (nome || label).replace(/\s*\d{2}\/\d{2}$/, "").trim();
    if (!desc) desc = label;
    const [dd, mm, yy] = (curDate || "01/01/2026").split("/");
    out.push({
      data: `${yy}-${mm}-${dd}`, descricao: desc.slice(0, 120) || "Lançamento",
      valor: val, tipo: "despesa", categoria_id: sugerirCategoria(desc),
      metodo, fonte: "Bradesco Conta", incluir: true,
    });
  }
  return out;
}

/* ---- CSV ---- */
function splitCSVLine(line, sep) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === sep && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
function parseValorBR(s) {
  if (s == null) return NaN;
  s = String(s).replace(/\s|R\$/g, "");
  const neg = s.startsWith("-") || /\)$/.test(s);
  s = s.replace(/[()]/g, "").replace("-", "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? NaN : neg ? -n : n;
}
function parseDataBR(s) {
  if (!s) return null;
  s = s.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);           // ISO
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{2,4})/); // dd/mm/aaaa
  if (m) { let y = m[3]; if (y.length === 2) y = "20" + y; return `${y}-${m[2]}-${m[1]}`; }
  return null;
}
function extrairCSV(texto) {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ";" : ",";
  let header = splitCSVLine(linhas[0], sep).map((h) => h.toLowerCase());
  const temHeader = header.some((h) => /data|date|valor|amount|hist|descri|memo|lan|title/.test(h));
  const idx = (re, def) => { const i = header.findIndex((h) => re.test(h)); return i >= 0 ? i : def; };
  let iData = temHeader ? idx(/data|date/, 0) : 0;
  let iDesc = temHeader ? idx(/descri|hist|memo|lan|title|estabele/, 1) : 1;
  let iVal = temHeader ? idx(/valor|amount|montante|value/, 2) : 2;
  const out = [];
  for (let r = temHeader ? 1 : 0; r < linhas.length; r++) {
    const cols = splitCSVLine(linhas[r], sep);
    const data = parseDataBR(cols[iData]);
    const valor = parseValorBR(cols[iVal]);
    if (!data || !isFinite(valor) || valor === 0) continue;
    const desc = (cols[iDesc] || "Transação").slice(0, 120);
    // colunas opcionais: Tipo, Categoria, Metodo, Fonte
    const iTipo = header.findIndex((h) => /^tipo/.test(h));
    const iCat  = header.findIndex((h) => /categoria/.test(h));
    const iMet  = header.findIndex((h) => /m[eé]todo|metodo/.test(h));
    const iFon  = header.findIndex((h) => /fonte|cart[aã]o|conta/.test(h));
    let tipo = valor >= 0 ? "receita" : "despesa";
    if (iTipo >= 0 && cols[iTipo]) tipo = /rec/i.test(cols[iTipo]) ? "receita" : "despesa";
    const catNome = iCat >= 0 && cols[iCat] ? cols[iCat].trim() : "";
    const catId = catNome ? catIdPorNome(catNome) : sugerirCategoria(desc);
    const metodo = iMet >= 0 && cols[iMet] ? cols[iMet].trim() : sugerirMetodo(desc);
    const fonte = iFon >= 0 && cols[iFon] ? cols[iFon].trim() : null;
    out.push({ data, descricao: desc, valor: Math.abs(valor), tipo,
      categoria_id: catId, categoriaNome: catNome, metodo, fonte, incluir: tipo === "despesa" });
  }
  return out;
}

/* ---- OFX ---- */
function extrairOFX(texto) {
  const out = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const tag = (b, t) => { const m = b.match(new RegExp(`<${t}>([^<\\r\\n]+)`, "i")); return m ? m[1].trim() : ""; };
  for (const b of blocos) {
    const dtRaw = tag(b, "DTPOSTED").slice(0, 8); // AAAAMMDD
    if (dtRaw.length < 8) continue;
    const data = `${dtRaw.slice(0, 4)}-${dtRaw.slice(4, 6)}-${dtRaw.slice(6, 8)}`;
    const valor = parseFloat(tag(b, "TRNAMT"));
    if (!isFinite(valor) || valor === 0) continue;
    const desc = (tag(b, "MEMO") || tag(b, "NAME") || "Transação").slice(0, 120);
    const tipo = valor >= 0 ? "receita" : "despesa";
    const trntype = tag(b, "TRNTYPE").toUpperCase();
    let metodo = sugerirMetodo(desc);
    if (/XFER|DEP|DIRECTDEP|PAYMENT/.test(trntype)) metodo = "Transferencia";
    out.push({ data, descricao: desc, valor: Math.abs(valor), tipo,
      categoria_id: sugerirCategoria(desc), metodo, incluir: tipo === "despesa" });
  }
  return out;
}

// Heurística: procura linhas com data (dd/mm ou dd/mm/aaaa) e um valor monetário.
function extrairTransacoes(linhas, anoFallback) {
  const ano = anoFallback || new Date().getFullYear();
  const reData = /(\d{2})[\/\.\-](\d{2})(?:[\/\.\-](\d{2,4}))?/;
  // valor tipo 1.234,56 ou 1234.56, opcional sinal e "R$"
  const reValor = /(-?\s*R?\$?\s*\d{1,3}(?:[.\s]\d{3})*,\d{2}|-?\s*R?\$?\s*\d+\.\d{2})\s*(-)?$/;
  const out = [];
  for (const raw of linhas) {
    const linha = raw.replace(/\s+/g, " ").trim();
    const md = linha.match(reData);
    const mv = linha.match(reValor);
    if (!md || !mv) continue;
    let dd = md[1], mm = md[2], yy = md[3] || String(ano);
    if (yy.length === 2) yy = "20" + yy;
    const data = `${yy}-${mm}-${dd}`;
    if (isNaN(new Date(data).getTime())) continue;
    let valStr = mv[1].replace(/R\$|\s/g, "");
    let negTrail = mv[2] === "-";
    let neg = valStr.trim().startsWith("-") || negTrail;
    valStr = valStr.replace("-", "");
    // normaliza para float
    if (valStr.includes(",")) valStr = valStr.replace(/\./g, "").replace(",", ".");
    const valor = parseFloat(valStr);
    if (!isFinite(valor) || valor === 0) continue;
    // descrição = linha sem a data e sem o valor
    let desc = linha.replace(md[0], "").replace(mv[0], "").replace(/R\$/g, "").trim();
    desc = desc.replace(/\s{2,}/g, " ").replace(/[|•]/g, "").trim();
    if (desc.length < 2) desc = "Transação";
    // pagamentos/estornos com "-" viram receita; senão despesa (fatura de cartão)
    const tipo = neg ? "receita" : "despesa";
    // objetivo do app = custos: créditos entram desmarcados por padrão
    out.push({ data, descricao: desc.slice(0, 120), valor, tipo,
      categoria_id: sugerirCategoria(desc), metodo: sugerirMetodo(desc), incluir: tipo === "despesa" });
  }
  return out;
}
function sugerirMetodo(desc) {
  const d = (desc || "").toLowerCase();
  if (/pix|ted|doc |transfer/.test(d)) return "Pix";
  if (/saque|anuidade|tarifa|iof|juros|encargo|mora|multa|seguro|tribut|boleto/.test(d)) return "Outros";
  return "Cartão";
}
function catIdPorNome(nome) {
  if (!nome) return "";
  const n = nome.trim().toLowerCase();
  const c = CATS.find((x) => x.nome.toLowerCase() === n);
  return c ? c.id : "";
}
// Auto-categorização alinhada às categorias do usuário. Ordem = prioridade.
const REGRAS_CATEGORIA = [
  ["Agua",        /sabesp|\bagua\b|á?gua|aegea|sanepar|copasa|cedae|embasa|caesb|sabes/],
  ["Energia",     /neoenergia|elektro|\benel\b|cpfl|cemig|\blight\b|energia|eletropaulo|equatorial|celesc|coelba|energis|edp/],
  ["Internet",    /claro|vivo|\btim\b|\boi\b|\bnet\b|internet|fibra|telecom|vero|desktop|brisanet|algar/],
  ["Barbeiro",    /barbe|cabele|sal[aã]o|corte de cabelo|barber/],
  ["Mercado",     /mercado|super|atacad|carrefour|assa[ií]|rold[aã]o|federzoni|\bdia\b|hortifruti|nagumo|tenda|sonda|\bextra\b|nosso ?v|mesquita|santajulia|trevomix/],
  ["Alimentacao", /ifood|rappi|ze ?delivery|restaur|lanch|pizza|burger|hamburg| food|a[cç]a[ií]|padar|cafeteria|doceria|nutri ?bem|marmit/],
  ["Transporte",  /uber|\b99\b|posto|combust|gasolina|ipiranga|shell|petrobras|estacion|metr[oô]|[oô]nibus|passagem|bilhete|ipva|detran|licenc|pneu/],
  ["Saude",       /farm|drogaria|drogasil|pacheco|\braia\b|hospital|clinic|\bpet\b|pets|\bvet\b|odont|laborat|sa[uú]de|nutri/],
  ["Educacao",    /escola|col[eé]gio|faculdade|universidade|\bcurso\b|udemy|alura|apostila|livraria|educa|ensino/],
  ["Lazer",       /cinema|netflix|spotify|disney|\bhbo\b|prime video|youtube|\bshow\b|ingresso|viagem|hotel|\bgame\b|steam|xbox|playstation|lazer/],
  ["Compras",     /amazon|mercado ?livre|shopee|magalu|magazine|aliexpress|americanas|renner|riachuelo|shein|natura|boticario|\bloja\b|casas bahia|centauro|enjoei|esplanada ?movei/],
  ["Moradia",     /aluguel|condominio|imobili|im[oó]vei|latorre|iptu|reforma|constru|moradia/],
];
function sugerirCategoria(desc) {
  const d = (desc || "").toLowerCase();
  for (const [nome, re] of REGRAS_CATEGORIA) {
    if (re.test(d)) { const c = CATS.find((x) => x.nome.toLowerCase() === nome.toLowerCase()); if (c) return c.id; }
  }
  const outros = CATS.find((x) => x.nome.toLowerCase() === "outros");
  return outros ? outros.id : "";
}
function renderPDFReview() {
  $("#pdf-review").classList.toggle("hidden", !PDF_ITENS.length);
  const optCat = (sel) => `<option value="">—</option>` +
    CATS.map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${c.nome}</option>`).join("");
  const optMet = (sel) => ["Cartão", "Pix", "VA", "Outros"]
    .map((m) => `<option ${m === sel ? "selected" : ""}>${m}</option>`).join("");
  $("#pdf-table tbody").innerHTML = PDF_ITENS.map((t, i) => `
    <tr>
      <td><input type="checkbox" data-pdfchk="${i}" ${t.incluir ? "checked" : ""}></td>
      <td><input type="date" value="${t.data}" data-pdfdata="${i}" style="width:140px"></td>
      <td><input type="text" value="${esc(t.descricao)}" data-pdfdesc="${i}" style="width:100%"></td>
      <td><select data-pdfcat="${i}">${optCat(t.categoria_id)}</select></td>
      <td><select data-pdfmet="${i}">${optMet(t.metodo || "Cartao de credito")}</select></td>
      <td class="right ${t.tipo === "receita" ? "pos" : "neg"}">
        <input type="number" step="0.01" value="${t.valor}" data-pdfval="${i}" style="width:110px;text-align:right">
        <span class="muted small">${t.tipo === "receita" ? "crédito" : ""}</span>
      </td>
    </tr>`).join("");
}
async function salvarPDF() {
  const fonteInput = $("#pdf-fonte").value.trim() || null;
  // cria categorias que vieram no arquivo mas ainda não existem (ex.: "Mercado")
  const faltantes = [...new Set(PDF_ITENS
    .filter((t) => t.incluir && t.categoriaNome && !catIdPorNome(t.categoriaNome))
    .map((t) => t.categoriaNome))];
  if (faltantes.length) {
    const paleta = ["#6366f1","#22d3ee","#f59e0b","#ef4444","#10b981","#8b5cf6","#ec4899","#84cc16"];
    await sb.from("categorias").insert(faltantes.map((nome, i) => ({
      user_id: USER.id, nome, tipo: "despesa", cor: paleta[i % paleta.length],
    })));
    await loadCategorias();
  }
  // resolve categoria_id pelos nomes (agora que as categorias existem)
  PDF_ITENS.forEach((t) => { if (t.categoriaNome && !t.categoria_id) t.categoria_id = catIdPorNome(t.categoriaNome); });
  const registros = PDF_ITENS.filter((t) => t.incluir).map((t) => ({
    user_id: USER.id, data: t.data, descricao: t.descricao, tipo: t.tipo,
    valor: t.tipo === "receita" ? Math.abs(t.valor) : -Math.abs(t.valor),
    categoria_id: t.categoria_id || null, metodo: t.metodo || "Cartão",
    origem: "import", fonte: t.fonte || fonteInput,
  }));
  if (!registros.length) return toast("Nenhuma transação selecionada");
  const { error } = await sb.from("transacoes").insert(registros);
  if (error) return toast("Erro ao salvar");
  PDF_ITENS = []; $("#pdf-review").classList.add("hidden");
  $("#pdf-status").textContent = `${registros.length} lançamentos importados.`;
  await loadTransacoes(); renderDashboard(); toast("Importado!");
}

/* ---------------- Investimentos ---------------- */
async function loadInvestimentos() {
  const { data, error } = await sb.from("investimentos").select("*").order("corretora");
  if (error) return toast("Erro ao carregar investimentos");
  INVS = data || [];
  renderInvTable(); renderInvCharts();
}
function renderInvTable() {
  let ap = 0, at = 0;
  $("#inv-table tbody").innerHTML = INVS.map((v) => {
    ap += Number(v.valor_aplicado); at += Number(v.valor_atual);
    const r = v.valor_aplicado ? ((v.valor_atual - v.valor_aplicado) / v.valor_aplicado) * 100 : 0;
    const tk = v.ticker ? ` <span class="muted small">${esc(v.ticker)}${v.quantidade ? " ×" + v.quantidade : ""}</span>` : "";
    return `<tr>
      <td>${esc(v.corretora)}</td><td>${esc(v.ativo)}${tk}</td><td class="muted">${esc(v.classe)}</td>
      <td class="right">${brl(v.valor_aplicado)}</td><td class="right">${brl(v.valor_atual)}</td>
      <td class="right ${r >= 0 ? "pos" : "neg"}">${pct(r)}</td>
      <td class="right">
        <button class="link-btn" data-editinv="${v.id}">✎</button>
        <button class="link-btn danger" data-delinv="${v.id}">✕</button>
      </td></tr>`;
  }).join("") || `<tr><td colspan="7" class="muted">Nenhum investimento.</td></tr>`;
  const rent = ap ? ((at - ap) / ap) * 100 : 0;
  $("#inv-kpi-aplicado").textContent = brl(ap);
  $("#inv-kpi-atual").textContent = brl(at);
  $("#inv-kpi-rent").textContent = pct(rent);
  $("#inv-kpi-rent").className = "kval " + (rent >= 0 ? "pos" : "neg");
  $("#kpi-invest").textContent = brl(at);
}
async function saveInv(e) {
  e.preventDefault();
  const id = $("#inv-id").value;
  const rec = {
    user_id: USER.id,
    corretora: $("#inv-corretora").value.trim(),
    ativo: $("#inv-ativo").value.trim(),
    classe: $("#inv-classe").value,
    ticker: $("#inv-ticker").value.trim() || null,
    quantidade: parseFloat($("#inv-qtd").value) || null,
    valor_aplicado: parseFloat($("#inv-aplicado").value) || 0,
    valor_atual: parseFloat($("#inv-atual").value) || 0,
    data_ref: $("#inv-data").value || todayISO(),
    updated_at: new Date().toISOString(),
  };
  const res = id
    ? await sb.from("investimentos").update(rec).eq("id", id)
    : await sb.from("investimentos").insert(rec);
  if (res.error) return toast("Erro ao salvar");
  $("#form-inv").reset(); $("#inv-id").value = ""; $("#inv-data").value = todayISO();
  await loadInvestimentos(); renderDashboard(); toast("Investimento salvo");
}
function editInv(id) {
  const v = INVS.find((x) => x.id === id); if (!v) return;
  $("#inv-id").value = v.id; $("#inv-corretora").value = v.corretora;
  $("#inv-ativo").value = v.ativo; $("#inv-classe").value = v.classe;
  $("#inv-ticker").value = v.ticker || ""; $("#inv-qtd").value = v.quantidade || "";
  $("#inv-aplicado").value = v.valor_aplicado; $("#inv-atual").value = v.valor_atual;
  $("#inv-data").value = v.data_ref;
  $("#tab-investimentos").scrollIntoView({ behavior: "smooth" });
}
async function delInv(id) {
  if (!confirm("Excluir investimento?")) return;
  await sb.from("investimentos").delete().eq("id", id);
  await loadInvestimentos(); renderDashboard();
}

/* ---------------- Cotações automáticas ---------------- */
const CRIPTO_ALIAS = { btc: "bitcoin", eth: "ethereum", sol: "solana", ada: "cardano",
  bnb: "binancecoin", xrp: "ripple", doge: "dogecoin", usdt: "tether", usdc: "usd-coin", ltc: "litecoin" };

async function atualizarCotacoes() {
  const alvos = INVS.filter((v) => v.ticker && v.quantidade);
  if (!alvos.length) return toast("Nenhum ativo com ticker + quantidade");
  const btn = $("#inv-cotacoes"); btn.disabled = true; btn.textContent = "Atualizando...";
  const precos = {}; // ticker(lower) -> preço em R$
  try {
    const cripto = alvos.filter((v) => v.classe === "Cripto");
    const bolsa = alvos.filter((v) => v.classe !== "Cripto");

    // Ações / FIIs via brapi.dev
    if (bolsa.length) {
      const tks = [...new Set(bolsa.map((v) => v.ticker.toUpperCase()))].join(",");
      const tk = window.BRAPI_TOKEN ? `?token=${encodeURIComponent(window.BRAPI_TOKEN)}` : "";
      const r = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(tks)}${tk}`);
      const j = await r.json();
      (j.results || []).forEach((it) => {
        if (it.symbol && it.regularMarketPrice != null) precos[it.symbol.toLowerCase()] = it.regularMarketPrice;
      });
    }
    // Cripto via CoinGecko (em BRL)
    if (cripto.length) {
      const ids = [...new Set(cripto.map((v) => {
        const t = v.ticker.toLowerCase(); return CRIPTO_ALIAS[t] || t;
      }))].join(",");
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=brl`);
      const j = await r.json();
      Object.keys(j).forEach((id) => { if (j[id].brl != null) precos[id] = j[id].brl; });
    }

    let ok = 0;
    for (const v of alvos) {
      const key = v.classe === "Cripto"
        ? (CRIPTO_ALIAS[v.ticker.toLowerCase()] || v.ticker.toLowerCase())
        : v.ticker.toLowerCase();
      const preco = precos[key];
      if (preco == null) continue;
      const novo = +(preco * v.quantidade).toFixed(2);
      const { error } = await sb.from("investimentos")
        .update({ valor_atual: novo, updated_at: new Date().toISOString() }).eq("id", v.id);
      if (!error) ok++;
    }
    await loadInvestimentos(); renderDashboard();
    toast(ok ? `${ok} de ${alvos.length} cotações atualizadas` : "Não foi possível obter cotações (verifique tickers/token)");
  } catch (err) {
    console.error(err);
    toast("Erro ao buscar cotações. Se for ação/FII, configure o token brapi no config.js.");
  } finally {
    btn.disabled = false; btn.textContent = "↻ Atualizar cotações";
  }
}

/* ---------------- Gráficos ---------------- */
const PALETA = ["#6366f1","#22d3ee","#f59e0b","#ef4444","#10b981","#8b5cf6","#ec4899","#84cc16","#3b82f6","#64748b"];
function mkChart(id, cfg) {
  if (charts[id]) charts[id].destroy();
  const el = document.getElementById(id); if (!el) return;
  Chart.defaults.color = "#94a3b8"; Chart.defaults.borderColor = "#26324a";
  charts[id] = new Chart(el, cfg);
}
function txNoPeriodo(de, ate) {
  return TXS.filter((t) => t.data >= de && t.data <= ate);
}

function renderDashboard() {
  const de = $("#dash-de").value || "2000-01-01";
  const ate = $("#dash-ate").value || todayISO();
  const periodo = txNoPeriodo(de, ate);
  const receita = periodo.filter((t) => t.tipo === "receita").reduce((s, t) => s + Math.abs(t.valor), 0);
  const despesa = periodo.filter((t) => t.tipo === "despesa").reduce((s, t) => s + Math.abs(t.valor), 0);
  $("#kpi-receita").textContent = brl(receita);
  $("#kpi-despesa").textContent = brl(despesa);
  $("#kpi-saldo").textContent = brl(receita - despesa);
  $("#kpi-saldo").className = "kval " + (receita - despesa >= 0 ? "pos" : "neg");

  // ---- Diário (despesas por dia no período) ----
  const porDia = {};
  periodo.filter((t) => t.tipo === "despesa").forEach((t) => {
    porDia[t.data] = (porDia[t.data] || 0) + Math.abs(t.valor);
  });
  const dias = Object.keys(porDia).sort();
  mkChart("chart-diario", {
    type: "bar",
    data: { labels: dias.map(fmtData), datasets: [{ label: "Despesa", data: dias.map((d) => porDia[d]), backgroundColor: "#6366f1" }] },
    options: baseOpts(),
  });

  // ---- Mensal (12 meses: receita x despesa) ----
  const meses = ultimosMeses(12);
  const rec = meses.map((m) => TXS.filter((t) => t.data.startsWith(m) && t.tipo === "receita").reduce((s, t) => s + Math.abs(t.valor), 0));
  const desp = meses.map((m) => TXS.filter((t) => t.data.startsWith(m) && t.tipo === "despesa").reduce((s, t) => s + Math.abs(t.valor), 0));
  mkChart("chart-mensal", {
    type: "line",
    data: { labels: meses.map(fmtMes), datasets: [
      { label: "Receitas", data: rec, borderColor: "#22c55e", backgroundColor: "#22c55e33", tension: .3, fill: true },
      { label: "Despesas", data: desp, borderColor: "#ef4444", backgroundColor: "#ef444433", tension: .3, fill: true },
    ] }, options: baseOpts(true),
  });

  // ---- Por categoria (pizza) ----
  const porCat = {};
  periodo.filter((t) => t.tipo === "despesa").forEach((t) => {
    const c = catById(t.categoria_id); const nome = c ? c.nome : "Sem categoria";
    porCat[nome] = (porCat[nome] || 0) + Math.abs(t.valor);
  });
  const catNomes = Object.keys(porCat);
  mkChart("chart-categoria", {
    type: "doughnut",
    data: { labels: catNomes, datasets: [{ data: catNomes.map((n) => porCat[n]),
      backgroundColor: catNomes.map((n, i) => { const c = CATS.find((x) => x.nome === n); return c ? c.cor : PALETA[i % PALETA.length]; }) }] },
    options: { plugins: { legend: { position: "right" } } },
  });

  // ---- Por método de pagamento ----
  const porMet = {};
  periodo.filter((t) => t.tipo === "despesa").forEach((t) => {
    const m = t.metodo || "Outros";
    porMet[m] = (porMet[m] || 0) + Math.abs(t.valor);
  });
  const metNomes = Object.keys(porMet);
  mkChart("chart-metodo", {
    type: "doughnut",
    data: { labels: metNomes, datasets: [{ data: metNomes.map((m) => porMet[m]),
      backgroundColor: metNomes.map((_, i) => PALETA[i % PALETA.length]) }] },
    options: { plugins: { legend: { position: "right" } } },
  });

  renderComparativo();
}
function renderComparativo() {
  const a = $("#cmp-a").value, b = $("#cmp-b").value;
  if (!a || !b) return;
  const somaCatMes = (m) => {
    const o = {};
    TXS.filter((t) => t.data.startsWith(m) && t.tipo === "despesa").forEach((t) => {
      const c = catById(t.categoria_id); const nome = c ? c.nome : "Sem categoria";
      o[nome] = (o[nome] || 0) + Math.abs(t.valor);
    });
    return o;
  };
  const oa = somaCatMes(a), ob = somaCatMes(b);
  const cats = [...new Set([...Object.keys(oa), ...Object.keys(ob)])];
  mkChart("chart-comparativo", {
    type: "bar",
    data: { labels: cats, datasets: [
      { label: fmtMes(a), data: cats.map((c) => oa[c] || 0), backgroundColor: "#6366f1" },
      { label: fmtMes(b), data: cats.map((c) => ob[c] || 0), backgroundColor: "#22d3ee" },
    ] }, options: baseOpts(true),
  });
}
function renderInvCharts() {
  const porClasse = {}, porCorr = {};
  INVS.forEach((v) => {
    porClasse[v.classe] = (porClasse[v.classe] || 0) + Number(v.valor_atual);
    porCorr[v.corretora] = (porCorr[v.corretora] || 0) + Number(v.valor_atual);
  });
  const ck = Object.keys(porClasse);
  mkChart("chart-alocacao", {
    type: "doughnut",
    data: { labels: ck, datasets: [{ data: ck.map((k) => porClasse[k]), backgroundColor: ck.map((_, i) => PALETA[i % PALETA.length]) }] },
    options: { plugins: { legend: { position: "right" } } },
  });
  const rk = Object.keys(porCorr);
  mkChart("chart-corretora", {
    type: "bar",
    data: { labels: rk, datasets: [{ label: "Valor atual", data: rk.map((k) => porCorr[k]), backgroundColor: "#8b5cf6" }] },
    options: baseOpts(),
  });
}
function baseOpts(legend = false) {
  return { plugins: { legend: { display: legend } },
    scales: { y: { ticks: { callback: (v) => "R$ " + v.toLocaleString("pt-BR") } } } };
}

/* ---------------- Helpers de data/texto ---------------- */
function ultimosMeses(n) {
  const arr = []; const d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setMonth(d.getMonth() - i); arr.push(monthISO(x)); }
  return arr;
}
function fmtData(iso) { const [y, m, d] = iso.split("-"); return `${d}/${m}`; }
function fmtMes(iso) { const [y, m] = iso.split("-"); return `${["","jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][+m]}/${y.slice(2)}`; }
function esc(s = "") { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* ---------------- Exportar ---------------- */
function exportarJSON() {
  const blob = new Blob([JSON.stringify({ transacoes: TXS, investimentos: INVS, categorias: CATS }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `financas-backup-${todayISO()}.json`; a.click();
}

/* ---------------- Wiring de eventos ---------------- */
function wireUI() {
  $("#btn-entrar").addEventListener("click", entrarComEmail);
  $("#auth-email").addEventListener("keydown", (e) => { if (e.key === "Enter") entrarComEmail(); });
  $("#btn-logout").addEventListener("click", () => sb.auth.signOut());

  // tabs
  $$(".tab").forEach((b) => b.addEventListener("click", () => {
    $$(".tab").forEach((x) => x.classList.remove("active"));
    $$(".tab-pane").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    $("#tab-" + b.dataset.tab).classList.add("active");
  }));

  // forms
  $("#form-tx").addEventListener("submit", saveTx);
  $("#form-inv").addEventListener("submit", saveInv);
  $("#form-cat").addEventListener("submit", addCategoria);

  // filtros transacoes
  ["#tx-busca", "#tx-filtro-cat", "#tx-filtro-tipo", "#tx-filtro-metodo"].forEach((s) =>
    $(s).addEventListener("input", renderTxTable));

  // dashboard
  $("#dash-aplicar").addEventListener("click", renderDashboard);
  $("#cmp-aplicar").addEventListener("click", renderComparativo);

  // pdf
  $("#pdf-processar").addEventListener("click", processarArquivo);
  $("#inv-cotacoes").addEventListener("click", atualizarCotacoes);
  $("#pdf-salvar").addEventListener("click", salvarPDF);
  $("#pdf-marcar-todos").addEventListener("click", () => {
    PDF_ITENS.forEach((t) => (t.incluir = true)); renderPDFReview();
  });
  $("#pdf-check-all").addEventListener("change", (e) => {
    PDF_ITENS.forEach((t) => (t.incluir = e.target.checked)); renderPDFReview();
  });

  $("#btn-export").addEventListener("click", exportarJSON);

  // delegação de cliques em tabelas/listas
  document.body.addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.deltx) delTx(t.dataset.deltx);
    if (t.dataset.edittx) editTx(t.dataset.edittx);
    if (t.dataset.delinv) delInv(t.dataset.delinv);
    if (t.dataset.editinv) editInv(t.dataset.editinv);
    if (t.dataset.delcat) delCategoria(t.dataset.delcat);
  });
  // edição inline da revisão de PDF
  document.body.addEventListener("input", (e) => {
    const t = e.target; const i = t.dataset;
    if (i.pdfchk !== undefined) PDF_ITENS[+i.pdfchk].incluir = t.checked;
    if (i.pdfdata !== undefined) PDF_ITENS[+i.pdfdata].data = t.value;
    if (i.pdfdesc !== undefined) PDF_ITENS[+i.pdfdesc].descricao = t.value;
    if (i.pdfcat !== undefined) PDF_ITENS[+i.pdfcat].categoria_id = t.value;
    if (i.pdfmet !== undefined) PDF_ITENS[+i.pdfmet].metodo = t.value;
    if (i.pdfval !== undefined) { PDF_ITENS[+i.pdfval].valor = parseFloat(t.value) || 0; }
  });
}
