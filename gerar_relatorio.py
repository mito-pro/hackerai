# -*- coding: utf-8 -*-
from fpdf import FPDF
from datetime import datetime

FONT = r"C:\Windows\Fonts\arial.ttf"
FONT_BOLD = r"C:\Windows\Fonts\arialbd.ttf"

class PDF(FPDF):
    def header(self):
        self.set_font("ArialB", size=10)
        self.set_text_color(40, 40, 40)
        self.cell(0, 8, "Relatorio de Seguranca - concursosfcc.com.br", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)
        self.set_draw_color(0, 102, 204)
        self.set_line_width(0.6)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_x(self.l_margin)
        self.set_font("Arial", size=8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Pagina {self.page_no()}/{{nb}} | Analise passiva | {datetime.now().strftime('%d/%m/%Y %H:%M')}", align="C")

    def h1(self, text):
        self.set_x(self.l_margin)
        self.set_font("ArialB", size=14)
        self.set_text_color(0, 70, 140)
        self.ln(3)
        self.cell(0, 9, text, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(0, 102, 204)
        self.set_line_width(0.4)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

    def h2(self, text):
        self.set_x(self.l_margin)
        self.set_font("ArialB", size=11)
        self.set_text_color(30, 30, 30)
        self.ln(2)
        self.cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body(self, text):
        self.set_x(self.l_margin)
        self.set_font("Arial", size=10)
        self.set_text_color(20, 20, 20)
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def bullet(self, text, color=(20, 20, 20)):
        self.set_x(self.l_margin)
        self.set_font("Arial", size=10)
        self.set_text_color(*color)
        self.cell(6, 5.5, chr(8226))
        self.multi_cell(0, 5.5, text)

    def sev_row(self, sev, title, detail):
        colors = {
            "ALTA": (180, 30, 30),
            "MEDIA": (200, 120, 0),
            "BAIXA": (0, 100, 160),
            "INFO": (100, 100, 100),
        }
        c = colors.get(sev, (80, 80, 80))
        if self.get_y() > 255:
            self.add_page()
        self.set_x(self.l_margin)
        self.set_fill_color(*c)
        self.set_text_color(255, 255, 255)
        self.set_font("ArialB", size=9)
        self.cell(16, 6, sev, fill=True, align="C")
        self.set_text_color(20, 20, 20)
        self.set_font("ArialB", size=10)
        self.cell(0, 6, "  " + title, new_x="LMARGIN", new_y="NEXT")
        self.set_font("Arial", size=9.5)
        self.set_text_color(40, 40, 40)
        self.set_x(self.l_margin + 4)
        self.multi_cell(0, 5, detail)
        self.ln(2)


pdf = PDF()
pdf.alias_nb_pages()
pdf.add_font("Arial", "", FONT)
pdf.add_font("ArialB", "", FONT_BOLD)
pdf.set_auto_page_break(auto=True, margin=18)
pdf.add_page()

# Capa / titulo
pdf.set_x(pdf.l_margin)
pdf.set_font("ArialB", size=18)
pdf.set_text_color(0, 70, 140)
pdf.ln(6)
pdf.multi_cell(0, 10, "Relatorio de Analise de Seguranca", align="C")
pdf.set_x(pdf.l_margin)
pdf.set_font("Arial", size=13)
pdf.set_text_color(60, 60, 60)
pdf.multi_cell(0, 8, "https://www.concursosfcc.com.br/", align="C")
pdf.ln(2)
pdf.set_x(pdf.l_margin)
pdf.set_font("Arial", size=10)
pdf.multi_cell(0, 6,
    f"Data da analise: {datetime.now().strftime('%d/%m/%Y %H:%M')}\n"
    "Metodo: Analise passiva (reconhecimento publico / sem exploracao ativa)\n"
    "Escopo: Cabecalhos HTTP, arquivos publicos expostos, diretorios, CORS, tecnologias",
    align="C")
pdf.ln(4)

# Sumario executivo
pdf.h1("1. Sumario Executivo")
pdf.body(
    "Foi realizada uma analise de seguranca passiva do site https://www.concursosfcc.com.br/ "
    "e do Portal do Candidato (/portal_candidato/). Foram verificados cabecalhos HTTP de seguranca, "
    "exposicao de arquivos de banco/dump, listagem de diretorios, politicas CORS, versoes de "
    "servidor/bibliotecas e boas praticas de configuracao."
)
pdf.set_x(pdf.l_margin)
pdf.set_font("ArialB", size=10)
pdf.set_text_color(0, 100, 0)
pdf.multi_cell(0, 6,
    "RESULTADO SOBRE DADOS SQL PUBLICOS: NENHUM dump, backup ou arquivo .sql/.zip de banco "
    "foi encontrado exposto publicamente. Todos os caminhos testados retornaram HTTP 404. "
    "Nao ha informacoes de banco de dados para extrair.",
    align="C")
pdf.ln(2)
pdf.body(
    "Foram identificados 1 vulnerabilidade de severidade ALTA, 2 de severidade MEDIA, "
    "3 de severidade BAIXA e 2 itens informativos. A correcao prioritaria esta relacionada "
    "a versao obsoleta do Apache e a ausencia de cabecalhos de seguranca no site principal."
)

# SQL
pdf.h1("2. Busca por Dados SQL Publicos (escopo solicitado)")
pdf.h2("2.1 Arquivos testados (todos retornaram 404, exceto onde indicado)")
items = [
    "database.sql, dump.sql, backup.sql, db.sql, data.sql, site.sql, banco.sql, concursos.sql, fcc.sql",
    "backup.zip, backup.tar.gz, site.zip, www.zip, db.zip, dump.zip, database.zip",
    "database.sql.gz, backup.sql.gz, dump.sql.gz",
    "phpmyadmin/, pma/, adminer.php, adminer/, mysql/, dbadmin/",
    "backup/, backups/, sql/, dumps/, dump/",
    ".git/HEAD, .git/config, .svn/entries (ausentes - 404)",
    "web.config, .DS_Store, wp-config.php.bak, config.php.bak, configuration.php.bak",
    "index.php~, index.php.bak, .htaccess (403), .htpasswd (403)",
    ".env (404), phpinfo.php (404), wp-login.php (404), sitemap.xml (404)",
    ".well-known/security.txt (404 - nao existe)",
]
for i in items:
    pdf.bullet(i)
pdf.ln(2)
pdf.h2("2.2 Conclusao da busca por SQL")
pdf.body(
    "Nao ha vazamento publico de banco de dados, dumps SQL, backups comprimidos nem "
    "painéis de gerenciamento de banco (phpMyAdmin/Adminer) expostos. Os diretorios "
    "/arquivos/ e /js/ retornam 403 (protegidos). /server-status retorna 403 (restrito). "
    "A listagem de diretorios esta desabilitada em /concursos/ (serve pagina indice)."
)

# Vulnerabilidades
pdf.h1("3. Vulnerabilidades e Achados")

pdf.sev_row("ALTA", "Apache 2.4.37 desatualizado (EOL) + divulgacao de versao",
    "Servidor: Apache/2.4.37 (centos) OpenSSL/1.1.1k exposto no portal /portal_candidato/. "
    "Apache 2.4.37 foi lancado em 2018 e esta fora do suporte com varios CVEs conhecidos "
    "(ex.: HTTP/2, mod_proxy, path traversal). OpenSSL 1.1.1k tambem esta obsoleto. "
    "Risco: exploracao automatizada de CVEs conhecidos. "
    "Correcao: atualizar Apache/OpenSSL para versoes suportadas; configurar 'ServerTokens Prod' "
    "e 'ServerSignature Off' para ocultar versao.")

pdf.sev_row("MEDIA", "Site principal sem cabecalhos de seguranca",
    "Em https://www.concursosfcc.com.br/ AUSENTE: Strict-Transport-Security (HSTS), "
    "Content-Security-Policy, X-Frame-Options, X-Content-Type-Options. "
    "Risco: clickjacking (a pagina pode ser incorporada em iframe malicioso), "
    "MITM na primeira visita sem HTTPS forcado, sniffing de MIME. "
    "Correcao: adicionar HSTS (max-age>=31536000; includeSubDomains; preload), "
    "X-Frame-Options: DENY, X-Content-Type-Options: nosniff e CSP adequada.")

pdf.sev_row("MEDIA", "jQuery 1.8.1 obsoleto com CVEs de XSS",
    "Carregado em /js/jquery-1.8.1.min.js (versao de 2012). CVEs relevantes: "
    "CVE-2015-9251 (XSS via cross-domain AJAX), CVE-2019-11358 (prototype pollution), "
    "CVE-2020-11022 / CVE-2020-11023 (XSS com HTML nao confiavel em .html()/.append()). "
    "Risco: se a aplicacao passar HTML de usuarios/URLs para metodos jQuery, XSS refletido. "
    "Correcao: atualizar para jQuery 3.7.x e revisar uso de .html() com dados externos.")

pdf.sev_row("BAIXA", "robots.txt nao e controle de acesso",
    "robots.txt bloqueia /concursos/ e *.pdf para buscadores, porem /concursos/ retorna "
    "HTTP 200 publicamente. Qualquer pessoa pode acessar o caminho ignorando robots. "
    "Correcao: nao tratar robots.txt como protecao de conteudo sensivel; aplicar "
    "autenticacao/autorizacao no servidor se o conteudo for restrito.")

pdf.sev_row("BAIXA", "Divulgacao de infraestrutura nos cabecalhos",
    "Expostos: 'Server: Apache', 'Via: 1.1 varnish (Varnish/6.0)', 'X-Varnish: ...', "
    "'Server: Apache/2.4.37 (centos) OpenSSL/1.1.1k'. "
    "Risco: facilita fingerprinting e identificacao de componentes vulneraveis. "
    "Correcao: ocultar versoes (ServerTokens Prod) e remover headers Via/X-Varnish se possivel.")

pdf.sev_row("BAIXA", "Charset ISO-8859-1 em vez de UTF-8",
    "Paginas servidas com charset=ISO-8859-1. Em navegadores antigos, isso pode facilitar "
    "bypasses de filtros de XSS. Acentuacao incorreta tambem ja foi observada no conteudo. "
    "Correcao: migrar para UTF-8 (meta charset e resposta HTTP Content-Type).")

pdf.sev_row("INFO", "Informacao residual no codigo-fonte HTML",
    "Comentario HTML contendo configuracao do chatbot Huggy: "
    "uuid 'b900d470-d46b-4602-9c17-b230b15f2875', company '346411', context id. "
    "Google Tag Manager: GTM-593BFTQG. "
    "Risco: baixo (info disclosure); remover comentarios de configuracao do front-end.")

pdf.sev_row("INFO", "CORS no Portal do Candidato (avaliado, aparentemente correto)",
    "Resposta inclui Access-Control-Allow-Credentials: true, Allow-Methods GET/OPTIONS, "
    "Allow-Headers inclui Authorization. Testes com Origin: https://evil.example e Origin: null "
    "NAO resultaram em Access-Control-Allow-Origin refletido - comportamento correto. "
    "Recomendacao: manter whitelist explicita de origens; evitar ACAO: * com credenciais.")

# Itens positivos
pdf.h1("4. Boas Practicas Observadas")
for t in [
    "HTTPS ativo com redirecionamento 301 de http:// para https://",
    "Portal /portal_candidato/ possui HSTS (max-age=631138519; includeSubDomains), "
    "X-Frame-Options: DENY, X-Content-Type-Options: nosniff, X-XSS-Protection, "
    "CSP frame-ancestors 'self' *.concursosfcc.com.br *.fcc.org.br",
    "Acesso negado (403) em /arquivos/, /js/, /server-status, .htaccess, .htpasswd",
    "Sem exposicao de .env, phpinfo, painéis de banco, .git ou backups",
    "Listagem de diretorios desabilitada",
]:
    pdf.bullet(t, color=(0, 100, 0))

# Recomendacoes
pdf.h1("5. Plano de Correcao Recomendado")
recs = [
    "1. URGENTE - Atualizar Apache 2.4.37 e OpenSSL 1.1.1k; definir ServerTokens Prod.",
    "2. ALTO - Adicionar HSTS, X-Frame-Options, X-Content-Type-Options e CSP no site principal.",
    "3. ALTO - Atualizar jQuery 1.8.1 para 3.7.x e revisar tratamento de HTML dinamico.",
    "4. MEDIO - Remover divulgacao de versao/Varnish dos headers; limpar comentarios HTML.",
    "5. MEDIO - Migrar charset para UTF-8.",
    "6. BAIXO - Criar /.well-known/security.txt com contato de responsavel por seguranca.",
    "7. BAIXO - Considerar pentest completo autorizado (injecao SQL, XSS, auth do portal).",
]
for r in recs:
    pdf.bullet(r)

pdf.ln(4)
pdf.h1("6. Metodologia e Ressalvas")
pdf.body(
    "Analise passiva realizada apenas com requisicoes HTTP publicas (GET/HEAD) a caminhos "
    "comuns, leitura de cabecalhos e do codigo-fonte da pagina inicial. Nao foram executados "
    "testes de injecao SQL, fuzzing, exploracao de CVEs nem ataques de autenticacao. "
    "Ausencia de achado nao garante ausencia total de vulnerabilidades - recomenda-se "
    "verificacao continua e teste de penetracao profissional. Este relatorio foi gerado "
    "para o proprietario do site."
)

out = r"C:\Users\User\Desktop\Relatorio_Seguranca_concursosfcc.com.br.pdf"
pdf.output(out)
print("PDF gerado:", out)
