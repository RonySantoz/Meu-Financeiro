# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                HRFlowable, KeepTogether, ListFlowable, ListItem)

PRIMARY = colors.HexColor("#4f46e5")
DARK    = colors.HexColor("#111827")
MUTED   = colors.HexColor("#64748b")
LIGHT   = colors.HexColor("#eef2ff")
BORDER  = colors.HexColor("#d7dbe6")
CODEBG  = colors.HexColor("#f4f5f8")
GREEN   = colors.HexColor("#15803d")
AMBER   = colors.HexColor("#b45309")

OUT = "Guia-Instalacao-Minhas-Financas.pdf"

styles = getSampleStyleSheet()
def S(name, **kw):
    styles.add(ParagraphStyle(name, parent=styles["Normal"], **kw))

S("Title2", fontName="Helvetica-Bold", fontSize=24, textColor=DARK, leading=28, spaceAfter=4)
S("Sub", fontName="Helvetica", fontSize=11, textColor=MUTED, leading=15, spaceAfter=2)
S("H2", fontName="Helvetica-Bold", fontSize=14, textColor=PRIMARY, leading=18, spaceBefore=14, spaceAfter=6)
S("Body", fontName="Helvetica", fontSize=10.5, textColor=DARK, leading=15, spaceAfter=5)
S("BodyMuted", fontName="Helvetica", fontSize=9.5, textColor=MUTED, leading=13, spaceAfter=4)
S("Li", fontName="Helvetica", fontSize=10.5, textColor=DARK, leading=15)
S("Kod", fontName="Courier", fontSize=9, textColor=DARK, leading=13, backColor=CODEBG,
  borderPadding=(6,8,6,8), spaceBefore=3, spaceAfter=7)
S("StepNum", fontName="Helvetica-Bold", fontSize=13, textColor=colors.white, alignment=1, leading=16)
S("StepTitle", fontName="Helvetica-Bold", fontSize=13, textColor=DARK, leading=16)
S("Cell", fontName="Helvetica", fontSize=9.5, textColor=DARK, leading=12)
S("CellMono", fontName="Courier", fontSize=9, textColor=PRIMARY, leading=12)
S("CellHead", fontName="Helvetica-Bold", fontSize=9.5, textColor=colors.white, leading=12)
S("NoteT", fontName="Helvetica-Bold", fontSize=10, leading=13)
S("Note", fontName="Helvetica", fontSize=9.5, textColor=DARK, leading=13)

def code(txt):
    return Paragraph(txt.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
                     .replace("\n","<br/>").replace(" ","&nbsp;"), styles["Kod"])

def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(t, styles["Li"]), leftIndent=6, value="•") for t in items],
        bulletType="bullet", bulletColor=PRIMARY, leftIndent=12, spaceBefore=2, spaceAfter=6)

def step_header(n, title):
    box = Table([[Paragraph(str(n), styles["StepNum"])]], colWidths=[9*mm], rowHeights=[9*mm])
    box.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),PRIMARY),
                             ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
                             ("ROUNDEDCORNERS",[4,4,4,4])]))
    t = Table([[box, Paragraph(title, styles["StepTitle"])]], colWidths=[12*mm, 150*mm])
    t.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(0,0),0)]))
    return t

def note(kind, title, text):
    col = {"ok":GREEN, "warn":AMBER, "info":PRIMARY}[kind]
    bg  = {"ok":colors.HexColor("#e9f7ef"), "warn":colors.HexColor("#fdf3e7"), "info":LIGHT}[kind]
    inner = [Paragraph(title, ParagraphStyle("nt", parent=styles["NoteT"], textColor=col)),
             Paragraph(text, styles["Note"])]
    t = Table([[inner]], colWidths=[168*mm])
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),bg),
                           ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
                           ("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),
                           ("LINEBEFORE",(0,0),(0,-1),3,col)]))
    return t

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, A4[1]-14*mm, A4[0], 14*mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(18*mm, A4[1]-9.2*mm, "Minhas Financas  -  Guia de Instalacao")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(A4[0]-18*mm, 10*mm, "Pagina %d" % doc.page)
    canvas.drawString(18*mm, 10*mm, "App PWA + GitHub Pages + Supabase")
    canvas.restoreState()

doc = SimpleDocTemplate(OUT, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm, topMargin=20*mm, bottomMargin=16*mm)
E = []

# ---- Capa / intro ----
E.append(Spacer(1, 4))
E.append(Paragraph("Minhas Financas", styles["Title2"]))
E.append(Paragraph("Guia passo a passo: instalacao, publicacao e onde subir cada arquivo.", styles["Sub"]))
E.append(Spacer(1, 6))
E.append(HRFlowable(width="100%", thickness=1, color=BORDER))
E.append(Spacer(1, 8))
E.append(Paragraph("O que voce vai fazer", styles["H2"]))
E.append(Paragraph("Voce vai (1) criar um banco gratuito no Supabase, (2) preencher o arquivo de configuracao, "
    "(3) subir os arquivos num repositorio do GitHub e ligar o GitHub Pages, e (4) instalar a pagina como "
    "aplicativo no celular e no computador. Nao e preciso servidor proprio nem pagar nada.", styles["Body"]))
E.append(note("info", "Tempo estimado", "Cerca de 15 minutos. Voce so precisa de uma conta no GitHub e uma no Supabase (ambas gratuitas)."))

# ---- Tabela de arquivos ----
E.append(Paragraph("Os arquivos do projeto e onde cada um vai", styles["H2"]))
E.append(Paragraph("Todos os arquivos vao para a <b>raiz</b> do repositorio do GitHub, mantendo a pasta "
    "<font name='Courier'>icons/</font>. Antes de subir, voce edita apenas o <font name='Courier'>config.js</font> "
    "e roda o <font name='Courier'>schema.sql</font> dentro do Supabase.", styles["Body"]))

rows = [
    [Paragraph("Arquivo", styles["CellHead"]), Paragraph("Para onde vai / o que fazer", styles["CellHead"])],
    [Paragraph("index.html", styles["CellMono"]), Paragraph("Raiz do repositorio (pagina principal do app).", styles["Cell"])],
    [Paragraph("style.css", styles["CellMono"]), Paragraph("Raiz do repositorio (visual).", styles["Cell"])],
    [Paragraph("app.js", styles["CellMono"]), Paragraph("Raiz do repositorio (toda a logica).", styles["Cell"])],
    [Paragraph("config.js", styles["CellMono"]), Paragraph("Raiz do repositorio. EDITE antes: URL/chave do Supabase e token brapi (opcional).", styles["Cell"])],
    [Paragraph("manifest.webmanifest", styles["CellMono"]), Paragraph("Raiz do repositorio (permite instalar como app).", styles["Cell"])],
    [Paragraph("sw.js", styles["CellMono"]), Paragraph("Raiz do repositorio (service worker / offline).", styles["Cell"])],
    [Paragraph("icons/ (pasta)", styles["CellMono"]), Paragraph("Suba a pasta inteira com os 3 icones dentro (icon.svg, icon-192.png, icon-512.png).", styles["Cell"])],
    [Paragraph("schema.sql", styles["CellMono"]), Paragraph("NAO vai para o GitHub. Rode no SQL Editor do Supabase (cria as tabelas).", styles["Cell"])],
    [Paragraph("migration_v2.sql", styles["CellMono"]), Paragraph("Rode no Supabase SO se ja tinha criado as tabelas antes (adiciona cotacoes).", styles["Cell"])],
    [Paragraph("README.md", styles["CellMono"]), Paragraph("Opcional no GitHub (documentacao). Nao afeta o app.", styles["Cell"])],
]
t = Table(rows, colWidths=[42*mm, 126*mm])
t.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,0),PRIMARY),
    ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#f7f8fb")]),
    ("GRID",(0,0),(-1,-1),0.5,BORDER),
    ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),
    ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
]))
E.append(t)
E.append(Spacer(1, 4))

# ---- Passo 1 ----
E.append(step_header(1, "Criar o banco no Supabase (gratis)"))
E.append(bullets([
    "Acesse <font name='Courier'>supabase.com</font> e crie uma conta. Clique em <b>New project</b>, "
    "escolha um nome e uma senha de banco, e aguarde criar (1-2 min).",
    "No menu lateral, abra <b>SQL Editor</b> e clique em <b>New query</b>.",
    "Abra o arquivo <font name='Courier'>schema.sql</font>, copie <b>todo</b> o conteudo, cole no editor e clique em <b>Run</b>.",
    "Isso cria as tabelas (transacoes, categorias, investimentos), ativa a seguranca por usuario e ja cadastra categorias padrao.",
    "Va em <b>Project Settings &gt; API Keys</b> e copie a <b>Publishable key</b> (comeca com <font name='Courier'>sb_publishable_</font>). "
    "Clique no icone de copiar da linha 'default' para pegar o valor COMPLETO.",
    "A <b>Project URL</b> e o endereco do seu projeto: <font name='Courier'>https://SEU_ID.supabase.co</font> "
    "(o SEU_ID aparece no endereco do painel; confirme tambem em Settings &gt; General).",
]))
E.append(note("info", "Login sem confirmar e-mail (opcional)",
    "Em Authentication &gt; Providers &gt; Email voce pode desativar 'Confirm email' para entrar direto apos criar a conta."))

# ---- Passo 2 ----
E.append(step_header(2, "Preencher o arquivo config.js"))
E.append(Paragraph("Abra o <font name='Courier'>config.js</font> num editor de texto e substitua pelos valores que voce copiou. "
    "O nome da variavel continua SUPABASE_ANON_KEY (e so o nome interno); o valor e a Publishable key.", styles["Body"]))
E.append(code('window.SUPABASE_URL = "https://SEU_ID.supabase.co";\n'
              'window.SUPABASE_ANON_KEY = "sb_publishable_EJ3RfSwrg...cole_o_valor_completo";\n\n'
              '// opcional (cotacoes de acoes/FIIs):\n'
              'window.BRAPI_TOKEN = "";'))
E.append(note("warn", "Atencao a seguranca",
    "Use APENAS a <b>Publishable key</b> (sb_publishable_...) - ela e segura no navegador porque o RLS do schema.sql "
    "protege os dados. NUNCA use a <b>Secret key</b> (sb_secret_...) aqui: ela ignora o RLS e da acesso total; e so para backend."))

# ---- Passo 3 ----
E.append(step_header(3, "Subir os arquivos no GitHub e ligar o Pages"))
E.append(Paragraph("<b>Opcao A - pelo site (mais simples):</b>", styles["Body"]))
E.append(bullets([
    "No GitHub, clique em <b>New repository</b>, de um nome (ex: <font name='Courier'>minhas-financas</font>) e crie.",
    "Na pagina do repositorio, clique em <b>Add file &gt; Upload files</b> e arraste TODOS os arquivos e a pasta <font name='Courier'>icons/</font>.",
    "Clique em <b>Commit changes</b>.",
    "Va em <b>Settings &gt; Pages</b>. Em <b>Source</b>, escolha <b>Deploy from a branch</b>, branch <b>main</b>, pasta <b>/ (root)</b>, e clique <b>Save</b>.",
    "Aguarde cerca de 1 minuto. O endereco aparece no topo: <font name='Courier'>https://SEU_USUARIO.github.io/minhas-financas/</font>",
]))
E.append(Paragraph("<b>Opcao B - por linha de comando (git):</b>", styles["Body"]))
E.append(code('git init\n'
              'git add .\n'
              'git commit -m "app financas"\n'
              'git branch -M main\n'
              'git remote add origin https://github.com/SEU_USUARIO/minhas-financas.git\n'
              'git push -u origin main'))
E.append(note("ok", "Estrutura correta no repositorio",
    "Os arquivos devem ficar na raiz, assim: index.html, style.css, app.js, config.js, "
    "manifest.webmanifest, sw.js e a pasta icons/ (com os 3 icones). Nao coloque dentro de subpastas."))

# ---- Passo 4 ----
E.append(step_header(4, "Instalar como aplicativo"))
E.append(Paragraph("Abra o link do GitHub Pages e instale:", styles["Body"]))
E.append(bullets([
    "<b>Android (Chrome):</b> menu (tres pontos) &gt; <b>Instalar app</b> / Adicionar a tela inicial.",
    "<b>iPhone (Safari):</b> botao Compartilhar &gt; <b>Adicionar a Tela de Inicio</b>.",
    "<b>Computador (Chrome/Edge):</b> icone de instalar na barra de endereco.",
    "Na primeira tela, clique em <b>Criar conta</b>, defina e-mail e senha, e comece a usar.",
]))

# ---- Extra: cotacoes ----
E.append(step_header(5, "Cotacoes automaticas (opcional)"))
E.append(bullets([
    "Nos investimentos, preencha <b>Ticker</b> e <b>Quantidade</b> e clique em <b>Atualizar cotacoes</b>.",
    "Acoes/FIIs: use o codigo da B3 (ex: PETR4, HGLG11). Cripto: classe 'Cripto' e id da moeda (ex: bitcoin, ethereum).",
    "Se as cotacoes da bolsa nao vierem, crie um token gratis em <font name='Courier'>brapi.dev/dashboard</font> e cole em <font name='Courier'>window.BRAPI_TOKEN</font> no config.js.",
]))
E.append(note("info", "Ja tinha criado as tabelas antes?",
    "Se voce ja havia rodado uma versao anterior do schema.sql, rode agora o <font name='Courier'>migration_v2.sql</font> "
    "no SQL Editor do Supabase para habilitar as cotacoes. Instalacao nova nao precisa."))

doc.build(E, onFirstPage=header_footer, onLaterPages=header_footer)
print("PDF gerado:", OUT)
