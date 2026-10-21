import type {
  AttendanceStatus,
  CancellationStatus,
  ChurnReason,
  ExpenseCategory,
  Fundamental,
  Level,
  PaymentMethod,
  PlanType,
  RevenueCategory,
  SportType,
  StudentStatus,
  SubscriptionStatus,
} from "@/types";

/**
 * Registro de esportes — para adicionar um novo esporte basta incluir
 * o tipo em `SportType` e uma entrada aqui.
 */
export const SPORTS: Record<SportType, { label: string; short: string; emoji: string; badge: string; dot: string }> = {
  beach_tennis: {
    label: "Beach Tennis",
    short: "BT",
    emoji: "🎾",
    badge: "bg-sun-100 text-sun-800 ring-sun-200",
    dot: "bg-sun-500",
  },
  futevolei: {
    label: "Futevôlei",
    short: "FV",
    emoji: "⚽",
    badge: "bg-ocean-100 text-ocean-800 ring-ocean-200",
    dot: "bg-ocean-500",
  },
  padel: {
    label: "Padel",
    short: "PD",
    emoji: "🏓",
    badge: "bg-violet-100 text-violet-800 ring-violet-200",
    dot: "bg-violet-500",
  },
};
export const SPORT_OPTIONS = Object.entries(SPORTS).map(([value, s]) => ({ value: value as SportType, label: s.label }));

export const LEVELS: Record<Level, { label: string; badge: string }> = {
  iniciante: { label: "Iniciante", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  intermediario: { label: "Intermediário", badge: "bg-sky-50 text-sky-700 ring-sky-200" },
  avancado: { label: "Avançado", badge: "bg-rose-50 text-rose-700 ring-rose-200" },
};
export const LEVEL_OPTIONS = Object.entries(LEVELS).map(([value, l]) => ({ value: value as Level, label: l.label }));

export const STUDENT_STATUS: Record<StudentStatus, { label: string; badge: string }> = {
  ativo: { label: "Ativo", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  trancado: { label: "Trancado", badge: "bg-amber-50 text-amber-700 ring-amber-200" },
  inativo: { label: "Inativo", badge: "bg-slate-100 text-slate-600 ring-slate-200" },
};

export const PLAN_TYPES: Record<PlanType, { label: string; description: string; badge: string }> = {
  mensal: { label: "Mensal", description: "Créditos renovados a cada ciclo", badge: "bg-ocean-50 text-ocean-700 ring-ocean-200" },
  pacote: { label: "Pacote", description: "Créditos com validade", badge: "bg-sun-50 text-sun-800 ring-sun-200" },
  avulso: { label: "Avulso", description: "Aula única", badge: "bg-slate-100 text-slate-700 ring-slate-200" },
};

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; badge: string }> = {
  ativa: { label: "Ativa", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  expirada: { label: "Expirada", badge: "bg-slate-100 text-slate-600 ring-slate-200" },
  cancelada: { label: "Cancelada", badge: "bg-rose-50 text-rose-700 ring-rose-200" },
};

export const ATTENDANCE_STATUS: Record<AttendanceStatus, { label: string; badge: string }> = {
  presente: { label: "Presente", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  falta: { label: "Falta", badge: "bg-rose-50 text-rose-700 ring-rose-200" },
  justificada: { label: "Cancelou", badge: "bg-amber-50 text-amber-700 ring-amber-200" },
};

export const CANCELLATION_STATUS: Record<CancellationStatus, { label: string; badge: string }> = {
  pendente: { label: "Aguardando reposição", badge: "bg-amber-50 text-amber-700 ring-amber-200" },
  reposicao_agendada: { label: "Reposição agendada", badge: "bg-ocean-50 text-ocean-700 ring-ocean-200" },
  reposta: { label: "Reposta", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  sem_reposicao: { label: "Fora do prazo", badge: "bg-slate-100 text-slate-600 ring-slate-200" },
  recusada: { label: "Recusada", badge: "bg-rose-50 text-rose-700 ring-rose-200" },
  expirada: { label: "Expirada", badge: "bg-slate-100 text-slate-600 ring-slate-200" },
};

export const FUNDAMENTALS: Record<Fundamental, { label: string; color: string }> = {
  saque: { label: "Saque", color: "bg-sun-500" },
  voleio: { label: "Voleio", color: "bg-ocean-500" },
  smash: { label: "Smash", color: "bg-rose-500" },
  defesa: { label: "Defesa", color: "bg-emerald-500" },
  movimentacao: { label: "Movimentação", color: "bg-violet-500" },
};
export const FUNDAMENTAL_OPTIONS = Object.entries(FUNDAMENTALS).map(([value, f]) => ({
  value: value as Fundamental,
  label: f.label,
}));

export const REVENUE_CATEGORIES: Record<RevenueCategory, string> = {
  mensalidade: "Mensalidade",
  pacote: "Pacote de aulas",
  avulso: "Aula avulsa",
  locacao: "Locação de quadra",
  evento: "Torneio / Evento",
  loja: "Loja / Bar",
  outros: "Outras receitas",
};

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  aluguel: "Aluguel",
  salarios: "Salários / Professores",
  manutencao: "Manutenção de quadras",
  energia: "Energia",
  agua: "Água",
  materiais: "Materiais (bolas, redes)",
  marketing: "Marketing",
  impostos: "Impostos",
  outros: "Outras despesas",
};

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
  transferencia: "Transferência",
};

export const CHURN_REASONS: Record<ChurnReason, string> = {
  preco: "Preço / financeiro",
  horario: "Horários incompatíveis",
  mudanca: "Mudança de cidade",
  lesao: "Lesão / saúde",
  insatisfacao_aula: "Insatisfação com as aulas",
  insatisfacao_estrutura: "Insatisfação com a estrutura",
  falta_tempo: "Falta de tempo",
  outro_esporte: "Trocou de esporte / arena",
  outros: "Outros",
};

export const TEACHER_COLORS = ["#0ea5e9", "#f97316", "#10b981", "#8b5cf6", "#ec4899", "#eab308", "#14b8a6", "#ef4444"];
