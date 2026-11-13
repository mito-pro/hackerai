"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { formatCurrency, formatNumber, readJsonSafe } from "@/lib/utils";
import type { Plan } from "@/lib/plans";
import { planLabel } from "@/lib/model-registry";

const BENEFITS = [
  {
    title: "Acesso seguro",
    text: "Autenticacao por codigo de verificacao, com foco na protecao das contas dos usuarios.",
  },
  {
    title: "Experiencia inteligente",
    text: "Recursos de conversacao voltados para esclarecer duvidas, criar conteudos, analisar informacoes e auxiliar em diferentes tarefas.",
  },
  {
    title: "Gestao de utilizacao",
    text: "Controle de consumo por usuario, com limites e planos configuraveis para uma administracao organizada.",
  },
  {
    title: "Interface moderna",
    text: "Design responsivo, navegacao intuitiva e experiencia adaptada para computadores e dispositivos moveis.",
  },
  {
    title: "Eficiencia operacional",
    text: "Ferramentas reunidas em um unico ambiente para simplificar processos e aumentar a produtividade.",
  },
  {
    title: "Evolucao continua",
    text: "Estrutura flexivel, preparada para receber melhorias, novas funcionalidades e aprimoramentos tecnologicos.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Informe o e-mail",
    text: "O sistema gera um codigo OTP de 6 digitos com validade de 10 minutos.",
  },
  {
    n: "02",
    title: "Valide o codigo",
    text: "A sessao httpOnly e criada e o primeiro usuario registrado vira administrador.",
  },
  {
    n: "03",
    title: "Use o terminal",
    text: "Escolha o modelo, converse e acompanhe o consumo de tokens em tempo real.",
  },
];

type PublicUser = {
  id: string;
  email: string;
  role: "user" | "admin";
};

export default function Home() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) =>
        response.ok
          ? readJsonSafe<{ user?: PublicUser }>(response)
          : Promise.resolve(null)
      )
      .then((data) => {
        if (active && data?.user) setUser(data.user);
      })
      .catch(() => undefined);

    fetch("/api/plans", { cache: "no-store" })
      .then((response) =>
        response.ok
          ? readJsonSafe<{ plans?: Plan[] }>(response)
          : Promise.resolve(null)
      )
      .then((data) => {
        if (active && Array.isArray(data?.plans)) setPlans(data.plans);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-5 sm:py-3">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/emblem-hackerai.png"
              alt="HACKER AI"
              width={32}
              height={32}
              className="size-8 rounded-md"
              priority
            />
            <span className="text-xs font-semibold tracking-[0.3em] text-neon sm:text-sm">
              HACKER<span className="text-text">_AI</span>
            </span>
            <span className="badge badge-muted hidden sm:inline-flex">NEXUS</span>
          </Link>

          <nav className="flex items-center gap-2">
            <a href="#planos" className="btn btn-xs hidden sm:inline-flex">
              Planos
            </a>
            <a href="#beneficios" className="btn btn-xs hidden md:inline-flex">
              Beneficios
            </a>
            {user ? (
              <>
                <Link href="/chat/" className="btn btn-xs btn-primary">
                  Terminal
                </Link>
                {user.role === "admin" ? (
                  <Link href="/admin/" className="btn btn-xs hidden sm:inline-flex">
                    Admin
                  </Link>
                ) : null}
              </>
            ) : (
              <Link href="/login/" className="btn btn-xs btn-primary">
                Entrar
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-5">
        <section className="grid gap-8 py-12 sm:gap-10 sm:py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-24">
          <div className="space-y-5">
            <p className="badge badge-neon mb-4">
              v1.0 :: plataforma de inteligencia artificial
            </p>
            <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">
              <span className="neon">HACKER_AI</span>
              <br />
              <span className="text-text">NEXUS</span>
            </h1>
            <p className="text-neon mt-3 text-[11px] tracking-[0.2em] uppercase sm:text-sm sm:mt-4">
              Inteligencia artificial. Produtividade. Controle.
            </p>
            <p className="text-muted mt-4 max-w-none text-sm sm:text-base">
              O HACKER_AI NEXUS e uma plataforma inteligente de conversacao
              idealizada e desenvolvida por{" "}
              <span className="text-neon">Mistico Virus</span>, criada para
              oferecer uma experiencia moderna, segura e eficiente de interacao
              com inteligencia artificial. Com uma interface intuitiva e recursos
              avancados, a plataforma reuni ferramentas para simplificar tarefas,
              organizar informacoes e otimizar o fluxo de trabalho em um unico
              ambiente digital.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
              <Link href={user ? "/chat/" : "/login/"} className="btn btn-primary">
                {user ? "Abrir terminal" : "Entrar com OTP"}
              </Link>
              {user ? (
                <Link href="/checkout/" className="btn btn-neon">
                  comprar plano
                </Link>
              ) : null}
              <a href="#planos" className="btn">
                Ver planos
              </a>
            </div>

            <dl className="mt-8 grid grid-cols-3 gap-3 sm:mt-10">
              {[
                { k: "5", v: "provedores" },
                { k: "3", v: "planos" },
                { k: "100%", v: "self-hosted" },
              ].map((item) => (
                <div key={item.v} className="panel-flat px-3 py-2 sm:px-4 sm:py-2.5">
                  <dt className="text-neon text-lg font-semibold sm:text-xl">{item.k}</dt>
                  <dd className="text-muted text-[11px] tracking-[0.14em] uppercase sm:text-[12px]">
                    {item.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="panel glow-box overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2 sm:px-4 sm:py-2.5">
              <span className="size-2 rounded-full bg-danger" />
              <span className="size-2 rounded-full bg-amber" />
              <span className="size-2 rounded-full bg-neon" />
              <span className="text-muted ml-2 text-[11px] tracking-[0.2em] sm:text-[12px]">
                nexus@shell:~
              </span>
            </div>
            <pre className="overflow-x-auto p-4 sm:p-5 text-[12px] leading-relaxed sm:text-[12.5px]">
              <code>
                {`$ npx hacker-ai --start
[ok] banco local ........ sqlite (data/hackerai.db)
[ok] sessao ............. httpOnly + hash sha-256
[ok] otp ................ 6 digitos / 10 min
[ok] provedores ......... groq, google, openrouter, ollama, runapi
[ok] motor local ........ nexus-core offline

> conectando ao nucleo...
> pronto. digite /help para os comandos.`}
                <span className="text-neon">█</span>
              </code>
            </pre>
          </div>
        </section>

        <section id="beneficios" className="scroll-mt-20 py-8 sm:py-10">
          <h2 className="text-neon text-xl tracking-[0.2em] uppercase">
            [ principais beneficios ]
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <article key={benefit.title} className="panel p-5 sm:p-6">
                <h3 className="text-neon text-sm tracking-[0.12em] uppercase">
                  {benefit.title}
                </h3>
                <p className="text-muted mt-2 text-[13px]">{benefit.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <div className="panel p-6 sm:p-8">
            <h2 className="text-neon text-xl tracking-[0.2em] uppercase">
              [ sobre o projeto ]
            </h2>

            <div className="mt-6 space-y-6">
              <div>
                <h3 className="text-neon text-sm tracking-[0.12em] uppercase">
                  Tecnologia e confiabilidade
                </h3>
                <p className="text-muted mt-2 text-[13px]">
                  Desenvolvido com foco em organizacao, desempenho e
                  escalabilidade, o HACKER_AI NEXUS busca oferecer uma
                  experiencia consistente, com recursos de gerenciamento e uma
                  estrutura preparada para acompanhar a evolucao das
                  necessidades dos usuarios.
                </p>
              </div>

              <div>
                <h3 className="text-neon text-sm tracking-[0.12em] uppercase">
                  Sobre o criador
                </h3>
                <p className="text-muted mt-2 text-[13px]">
                  <span className="text-neon">Mistico Virus</span> - Criador do
                  HACKER_AI NEXUS. Por meio de uma visao voltada a tecnologia,
                  inovacao e desenvolvimento de solucoes digitais, Mistico Virus
                  idealizou o projeto com o objetivo de tornar a inteligencia
                  artificial mais acessivel, pratica e util no dia a dia.
                </p>
              </div>

              <div>
                <h3 className="text-neon text-sm tracking-[0.12em] uppercase">
                  Modulos: texto, imagem, audio, video e arquivos
                </h3>
                <p className="text-muted mt-2 text-[13px]">
                  Gere imagens com GPT Image 2 e Nano Banana via RunAPI, crie
                  videos com Kling (texto/imagem para video), transforme texto
                  em audio e anexe arquivos. Armazenamento opcional em Cloudflare
                  R2. Tudo acessivel pelo terminal com um unico toque.
                </p>
              </div>

              <div>
                <h3 className="text-neon text-sm tracking-[0.12em] uppercase">
                  Uma nova forma de trabalhar com IA
                </h3>
                <p className="text-muted mt-2 text-[13px]">
                  Mais do que um chatbot, o HACKER_AI NEXUS representa uma
                  proposta de inovacao digital: unir inteligencia artificial,
                  praticidade e controle em uma plataforma moderna, desenvolvida
                  para ampliar possibilidades e facilitar tarefas.
                </p>
              </div>
            </div>

            <p className="text-muted mt-6 border-t border-line pt-4 text-[12.5px] italic">
              HACKER_AI NEXUS - Tecnologia inteligente para ir alem. Criado por
              Mistico Virus.
            </p>
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <h2 className="text-neon text-xl tracking-[0.2em] uppercase">
            [ como funciona ]
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="panel-flat p-5 sm:p-6">
                <span className="text-neon text-2xl font-semibold">{step.n}</span>
                <h3 className="mt-2 text-sm tracking-[0.12em] uppercase">
                  {step.title}
                </h3>
                <p className="text-muted mt-1 text-[13px]">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="planos" className="scroll-mt-20 py-10 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-5 lg:px-8">
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-neon text-2xl tracking-[0.25em] uppercase sm:text-3xl font-bold mb-4">
                [ escolha seu plano ]
              </h2>
              <p className="text-muted text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
                Todos os planos incluem o NEXUS Core local. Escolha o nivel de
                acesso aos modelos de texto, imagem, audio e video que mais
                combina com voce.
              </p>
            </div>

            <div className="grid gap-5 sm:gap-6 lg:gap-8 md:grid-cols-3">
              {plans.map((plan) => {
                const isPopular =
                  plan.id === "pro" || plan.id === "nexus-omega";
                const isFree = plan.id === "free";
                const isMax = plan.id === "nexus-full";

                return (
                  <div
                    key={plan.id}
                    className={[
                      "relative flex flex-col rounded-2xl overflow-hidden border border-line bg-panel hover:border-neon/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(0,255,255,0.15)]",
                      isPopular ? "ring-1 ring-neon/30" : "",
                      isMax ? "ring-1 ring-amber/50 bg-gradient-to-b from-panel/90 to-panel" : "",
                    ].join(" ")}
                  >
                    <div className="p-6 sm:p-8">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={[
                          "text-xl sm:text-2xl font-bold tracking-tight",
                          isPopular ? "text-neon" : "text-text",
                          isMax ? "text-amber" : "",
                        ].join(" ")}>
                          {plan.name}
                        </h3>
                        {plan.isDefault ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border border-neon/40 text-neon bg-neon/5">
                            padrao
                          </span>
                        ) : null}
                        {isPopular && (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border border-amber/40 text-amber bg-amber/5">
                            mais pedido
                          </span>
                        )}
                      </div>
                      {plan.category && (
                        <span className="inline-block px-3 py-1 mb-4 rounded-full border border-line/50 text-[10px] font-semibold tracking-wider uppercase text-muted bg-panel/50 backdrop-blur">
                          {plan.category}
                        </span>
                      )}

                      <div className="mb-6">
                        <p className="text-[11px] tracking-[0.15em] uppercase text-muted mb-2">
                          preço por mês
                        </p>
                        <div className="flex items-baseline gap-1">
                          <span className={[
                            "text-3xl sm:text-4xl font-bold",
                            isPopular ? "text-neon" : "text-text",
                            isMax ? "text-amber" : "",
                          ].join(" ")}>
                            {plan.price === 0 ? "0" : plan.price}
                          </span>
                          <span className="text-muted text-sm font-medium">
                            {plan.price === 0 ? "gratis" : "R$"}
                          </span>
                          <span className="text-muted text-xs font-normal">
                            {plan.price === 0 ? "" : ",00"}
                          </span>
                        </div>
                      </div>

                      <ul className="space-y-3 mb-8">
                        <li className="flex items-start gap-2 text-sm text-muted">
                          <span className="text-neon shrink-0">✓</span>
                          {formatNumber(plan.monthlyTokens)} tokens / mês
                        </li>
                        <li className="flex items-start gap-2 text-sm text-muted">
                          <span className="text-neon shrink-0">✓</span>
                          {plan.dailyMessages} mensagens / dia
                        </li>
                        <li className="flex items-start gap-2 text-sm text-muted">
                          <span className="text-neon shrink-0">✓</span>
                          contexto de {formatNumber(plan.maxContext)} tokens
                        </li>
                        <li className="flex items-start gap-2 text-sm text-muted">
                          <span className="text-neon shrink-0">✓</span>
                          modelos de IA:
                          <br />
                          <span className="ml-6 text-[11px] text-neon/80 leading-tight">
                            {planLabel(plan.id, plan.providers)}
                          </span>
                        </li>
                        {plan.historyDays > 0 ? (
                          <li className="flex items-start gap-2 text-sm text-muted">
                            <span className="text-neon shrink-0">✓</span>
                            histórico de {plan.historyDays} dias
                          </li>
                        ) : null}
                        {plan.capabilities.includes("multi_session") && (
                          <li className="flex items-start gap-2 text-sm text-muted">
                            <span className="text-neon shrink-0">✓</span>
                            sessoes simultaneas
                          </li>
                        )}
                        {plan.capabilities.includes("export_chat") && (
                          <li className="flex items-start gap-2 text-sm text-muted">
                            <span className="text-neon shrink-0">✓</span>
                            exportar conversas
                          </li>
                        )}
                        {plan.capabilities.includes("priority_queue") && (
                          <li className="flex items-start gap-2 text-sm text-muted">
                            <span className="text-neon shrink-0">✓</span>
                            fila prioritaria
                          </li>
                        )}
                        {plan.capabilities.includes("uncensored") && (
                          <li className="flex items-start gap-2 text-sm text-muted">
                            <span className="text-neon shrink-0">✓</span>
                            modelos sem censura
                          </li>
                        )}
                      </ul>

                      {plan.features.length > 0 && (
                        <div className="mb-8">
                          <p className="text-[10px] tracking-[0.12em] uppercase text-muted mb-3">
                            recursos adicionais
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {plan.features.map((feature) => (
                              <span
                                key={feature}
                                className="px-2.5 py-1 rounded border border-line/40 text-[10.5px] text-muted bg-panel/30"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-auto pt-6 border-t border-line/40">
                        <Link
                          href="/login/"
                          className={`block w-full text-center py-3.5 rounded-xl font-bold tracking-wider uppercase text-[11px] sm:text-sm transition-all duration-200 ${
                            isFree
                              ? "bg-neon text-ink hover:bg-neon/90"
                              : isPopular
                              ? "bg-gradient-to-r from-neon to-cyan-600 text-white hover:from-neon/90 hover:to-cyan-500"
                              : "bg-panel border border-line text-text hover:bg-panel/80 hover:border-neon/40"
                          }`}
                        >
                          {isFree
                            ? "abrir terminal"
                            : isPopular
                            ? `assinar ${plan.name}`
                            : `solicitar ${plan.name}`}
                        </Link>
                      </div>
                    </div>

                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-neon text-ink text-[10px] font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(0,255,255,0.4)]">
                        recomendado
                      </div>
                    )}
                    {isMax && (
                      <div className="absolute -top-3 right-3 px-3 py-1 rounded-full bg-amber text-ink text-[10px] font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(255,193,7,0.4)]">
                        acesso total
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-10 text-center text-[11px] text-muted">
              Precos informativos: a troca de plano e feita pelo administrador em
              <span className="text-neon font-medium"> Admin {'>'} Usuarios</span>.
              Nao ha cobranca automatica nesta versao.
            </p>
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <div className="panel p-6 sm:p-8">
            <h2 className="text-neon text-xl tracking-[0.2em] uppercase">
              [ apis gratuitas ]
            </h2>
            <p className="text-muted mt-2 text-[13px]">
              As chaves sao cadastradas pelo administrador em
              <span className="text-neon">{" Admin > Provedores"}</span> e
              gravadas criptografadas no banco (AES-256-GCM).
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  name: "Groq",
                  models: "Llama 3.3 70B / 3.1 8B",
                  where: "console.groq.com",
                },
                {
                  name: "Google Gemini",
                  models: "Gemini 2.0 Flash",
                  where: "aistudio.google.com",
                },
                {
                  name: "OpenRouter",
                  models: "DeepSeek + Llama :free",
                  where: "openrouter.ai/keys",
                },
                {
                  name: "Ollama",
                  models: "modelo local do PC",
                  where: "ollama.com/download",
                },
                {
                  name: "RunAPI",
                  models: "Kling video, GPT Image 2, Nano Banana",
                  where: "runapi.ai",
                },
              ].map((provider) => (
                <div key={provider.name} className="panel-flat p-4 sm:p-5">
                  <p className="text-neon text-sm tracking-[0.12em] uppercase">
                    {provider.name}
                  </p>
                  <p className="text-muted mt-1 text-[12.5px]">{provider.models}</p>
                  <p className="text-neon/70 mt-2 text-[11px]">{provider.where}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8">
        <div className="text-muted mx-auto flex max-w-6xl flex-col gap-2 px-5 text-[12px] sm:flex-row sm:items-center sm:justify-between">
          <p>
            HACKER_AI :: NEXUS - plataforma de IA auto-hospedada. Criado por
            Mistico Virus.
          </p>
          <p>
            Base: vercel/ai-chatbot (Apache-2.0) + AI SDK + Next.js + SQLite.
          </p>
          <button
            type="button"
            className="btn btn-xs self-start sm:self-auto"
            onClick={() => window.dispatchEvent(new CustomEvent("nexus:breach"))}
          >
            simulacao de intrusao
          </button>
        </div>
      </footer>
    </div>
  );
}
