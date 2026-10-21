# Beach Arena — Gestão de arenas e escolas de esportes de areia

MVP 100% local (Next.js 16 App Router + TypeScript + Tailwind CSS v4 + Lucide) para gestão de arenas de **Beach Tennis**, com arquitetura pronta para **Futevôlei**, **Padel** e **multiempresa (multitenant)**.

Os dados ficam no **LocalStorage** do navegador, atrás de uma camada de serviços assíncrona em TypeScript — para migrar para Supabase/PostgreSQL basta trocar a implementação dos repositórios, sem reescrever telas.

## Como rodar

```bash
npm install          # instala tudo, incluindo lucide-react, clsx e tailwind-merge
npm run dev          # http://localhost:3000
```

Na primeira abertura o app cria **duas arenas de demonstração** (Arena Sol & Areia e Beach Club Norte) com alunos, turmas, presenças, planos, financeiro, treinos e avaliações gerados em relação à data de hoje. Em **Configurações** é possível restaurar a demonstração, exportar/importar backup JSON, criar arenas vazias ou apagar tudo.

## Módulos

| Rota | Módulo |
| --- | --- |
| `/` | Dashboard do gestor — alunos ativos, ocupação das quadras, faturamento, retenção/churn, aulas de hoje, alertas e atalhos |
| `/agenda` | Grade diária (colunas por quadra), semanal e lista; clique na aula abre a chamada |
| `/chamada` | Chamada com 1 toque (presente/falta), saldo de aulas, reposições e cancelamentos da aula, "todos presentes" |
| `/reposicoes` | Cancelamentos com regra de antecedência + painel para alocar reposição em turmas com vaga |
| `/alunos` | Matrícula (dados + turmas + plano), ficha, histórico, trancar, cancelar matrícula com motivo (churn) |
| `/professores` | Equipe, especialidades, cor na agenda, carga horária |
| `/turmas` | Turmas/horários com detecção de conflito de quadra/professor, alunos da turma e cadastro de quadras |
| `/planos` | Planos mensais, pacotes de créditos e avulsos; venda, renovação, ajuste de créditos |
| `/financeiro` | Contas a receber (com cobrança via WhatsApp), mensalidades, lançamentos, despesas e resumo do mês |
| `/treinos` | Planejamento do dia/semana (objetivo, aquecimento, drill principal, exercícios) + **Modo quadra** em tela cheia |
| `/exercicios` | Biblioteca por fundamento (Saque, Voleio, Smash, Defesa, Movimentação) com vídeo incorporado (YouTube/Vimeo) |
| `/feedback` | NPS, notas de aula/professor/estrutura, comentários anônimos e análise de motivos de saída |
| `/avaliar` | **Formulário público e anônimo** (sem sidebar). Use `/avaliar?arena=<id>` para direcionar a uma arena |
| `/configuracoes` | Regras de cancelamento/reposição, horário de funcionamento, dados da arena, multiempresa, backup |

### Regras de negócio implementadas

- **Créditos**: presença debita 1 crédito da assinatura válida que vence primeiro; falta sem aviso também debita (configurável). Desmarcar a chamada estorna o crédito.
- **Cancelamento**: com antecedência ≥ X horas (padrão 4h) gera direito a reposição em até Y dias (padrão 30) e não debita; fora do prazo vira falta.
- **Reposição**: vagas calculadas por data = capacidade − matriculados + quem cancelou − reposições já alocadas. O aluno alocado aparece na chamada da turma de destino marcado como "Reposição".
- **Renovação**: planos mensais com renovação automática geram novo ciclo e cobrança pendente ao vencer (rotina executada ao abrir o app). Assinaturas vencidas expiram; reposições não usadas expiram após o prazo.
- **Churn**: cancelar matrícula remove o aluno das turmas, encerra planos, cancela cobranças futuras e registra o motivo.

## Estrutura

```
app/                    rotas (App Router) — cada módulo em sua pasta
components/
  layout/               AppShell (sidebar, topbar e bottom-nav mobile, seletor de arena)
  ui/                   primitivas (Button, Card, Modal, Tabs, badges, toasts/confirm)
  charts/ students/ trainings/ exercises/
hooks/                  useLiveQuery (consultas reativas), useMounted
lib/                    datas, constantes/rótulos, utilitários
services/
  core/                 storage driver, eventos, tenant, Repository<T> + LocalStorageRepository
  repositories.ts       ponto único de composição dos repositórios  ← troque aqui para Supabase
  *.service.ts          regras de domínio (assinaturas, chamada, reposições, alunos, financeiro, dashboard)
  seed.ts               dados de demonstração
types/                  tipos de domínio (todas as entidades têm tenantId)
```

## Migrando para Supabase / PostgreSQL

1. Crie as tabelas espelhando `types/index.ts` (cada tabela com `id`, `tenant_id`, `created_at`, `updated_at`) e políticas RLS por `tenant_id`.
2. Implemente `SupabaseRepository<T>` com a interface `Repository<T>` de `services/core/repository.ts` (`list(where)` → `.select().match(where)`, `create` → `.insert()`, etc.).
3. Troque as instâncias em `services/repositories.ts`.
4. Troque `tenantService` pelo tenant do usuário autenticado e emita `emitChange()` a partir do Supabase Realtime para manter as telas reativas.

Os serviços de domínio e as telas continuam iguais. Para operações que precisam ser atômicas (ex.: débito de crédito na chamada), considere mover a lógica para funções RPC do Postgres mantendo a mesma assinatura do serviço.

## Adicionando um esporte

Inclua o valor em `SportType` (`types/index.ts`) e uma entrada em `SPORTS` (`lib/constants.ts`). Turmas, quadras, planos, exercícios, treinos e filtros passam a oferecê-lo automaticamente.
