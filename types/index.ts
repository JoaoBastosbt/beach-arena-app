// ============================================================================
// Tipos de domínio — Beach Arena
// Todas as entidades multiempresa carregam `tenantId`. Os nomes de campos
// seguem snake_case apenas onde fazem parte do contrato com o banco
// (ex.: sport_type), para facilitar o mapeamento futuro para Supabase/PostgreSQL.
// ============================================================================

export type ID = string;
/** Data local no formato YYYY-MM-DD */
export type ISODate = string;
/** Data/hora ISO completa */
export type ISODateTime = string;
/** Horário no formato HH:mm */
export type TimeHHMM = string;

export type SportType = "beach_tennis" | "futevolei" | "padel";
export type Level = "iniciante" | "intermediario" | "avancado";
/** 0 = domingo ... 6 = sábado */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BaseEntity {
  id: ID;
  tenantId: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Campos que o chamador informa ao criar uma entidade */
export type NewEntity<T extends BaseEntity> = Omit<T, keyof BaseEntity>;

// ----------------------------------------------------------------------------
// Multiempresa
// ----------------------------------------------------------------------------
export interface Tenant {
  id: ID;
  name: string;
  slug: string;
  city: string;
  sports: SportType[];
  createdAt: ISODateTime;
}

export interface ArenaSettings extends BaseEntity {
  /** Antecedência mínima (horas) para cancelar com direito a reposição */
  cancellationMinHours: number;
  /** Prazo (dias) para usar uma reposição após o cancelamento */
  makeupValidityDays: number;
  /** Falta sem aviso debita crédito? */
  debitOnAbsence: boolean;
  openingTime: TimeHHMM;
  closingTime: TimeHHMM;
  /** Dias com funcionamento */
  openDays: Weekday[];
  /** Avisar renovação com X dias de antecedência */
  renewalWarningDays: number;
}

// ----------------------------------------------------------------------------
// Pessoas & Turmas
// ----------------------------------------------------------------------------
export type StudentStatus = "ativo" | "inativo" | "trancado";

export interface Student extends BaseEntity {
  name: string;
  phone: string;
  email: string;
  birthDate?: ISODate;
  level: Level;
  sports: SportType[];
  status: StudentStatus;
  notes?: string;
  joinedAt: ISODate;
}

export interface Teacher extends BaseEntity {
  name: string;
  phone: string;
  email: string;
  sports: SportType[];
  /** Cor usada na agenda */
  color: string;
  bio?: string;
  active: boolean;
}

export interface Court extends BaseEntity {
  name: string;
  sport_type: SportType;
  covered: boolean;
  active: boolean;
}

export interface ClassGroup extends BaseEntity {
  name: string;
  sport_type: SportType;
  level: Level;
  teacherId: ID;
  courtId: ID;
  weekdays: Weekday[];
  startTime: TimeHHMM;
  endTime: TimeHHMM;
  capacity: number;
  studentIds: ID[];
  active: boolean;
}

// ----------------------------------------------------------------------------
// Planos, pacotes e assinaturas
// ----------------------------------------------------------------------------
export type PlanType = "mensal" | "pacote" | "avulso";

export interface Plan extends BaseEntity {
  name: string;
  type: PlanType;
  sport_type?: SportType;
  price: number;
  /** Créditos (aulas) concedidos por ciclo/pacote */
  credits: number;
  /** Validade em dias a partir do início */
  validityDays: number;
  description?: string;
  active: boolean;
}

export type SubscriptionStatus = "ativa" | "expirada" | "cancelada";

export interface Subscription extends BaseEntity {
  studentId: ID;
  planId: ID;
  startDate: ISODate;
  endDate: ISODate;
  creditsTotal: number;
  creditsUsed: number;
  status: SubscriptionStatus;
  autoRenew: boolean;
  /** Assinatura anterior (para histórico de renovações) */
  renewedFromId?: ID;
}

// ----------------------------------------------------------------------------
// Presenças, cancelamentos e reposições
// ----------------------------------------------------------------------------
export type AttendanceStatus = "presente" | "falta" | "justificada";

export interface Attendance extends BaseEntity {
  classGroupId: ID;
  studentId: ID;
  date: ISODate;
  status: AttendanceStatus;
  /** Indica que o aluno estava nesta aula como reposição */
  isMakeup: boolean;
  /** Assinatura de onde o crédito foi debitado (se houve débito) */
  debitedSubscriptionId?: ID;
}

export type CancellationStatus =
  | "pendente" // aguardando alocação em reposição
  | "reposicao_agendada"
  | "reposta" // reposição concluída
  | "sem_reposicao" // cancelado fora do prazo
  | "recusada"
  | "expirada";

export interface CancellationRequest extends BaseEntity {
  studentId: ID;
  classGroupId: ID;
  /** Data da aula cancelada */
  classDate: ISODate;
  reason: string;
  requestedAt: ISODateTime;
  hoursInAdvance: number;
  eligibleForMakeup: boolean;
  status: CancellationStatus;
  makeupClassGroupId?: ID;
  makeupDate?: ISODate;
  makeupDeadline?: ISODate;
  decidedBy?: string;
  decisionNote?: string;
}

// ----------------------------------------------------------------------------
// Metodologia
// ----------------------------------------------------------------------------
export type Fundamental = "saque" | "voleio" | "smash" | "defesa" | "movimentacao";

export interface Exercise extends BaseEntity {
  name: string;
  fundamental: Fundamental;
  sport_type: SportType;
  level: Level;
  description: string;
  coachingPoints: string[];
  durationMin: number;
  equipment?: string;
  videoUrl?: string;
}

export interface TrainingPlan extends BaseEntity {
  title: string;
  date: ISODate;
  sport_type: SportType;
  level: Level;
  classGroupIds: ID[];
  objective: string;
  warmup: string;
  mainDrill: string;
  exerciseIds: ID[];
  cooldown?: string;
  notes?: string;
  durationMin: number;
}

// ----------------------------------------------------------------------------
// Financeiro
// ----------------------------------------------------------------------------
export type TransactionType = "receita" | "despesa";
export type TransactionStatus = "pago" | "pendente" | "cancelado";
export type PaymentMethod = "pix" | "cartao" | "dinheiro" | "boleto" | "transferencia";

export type RevenueCategory = "mensalidade" | "pacote" | "avulso" | "locacao" | "evento" | "loja" | "outros";
export type ExpenseCategory =
  | "aluguel"
  | "salarios"
  | "manutencao"
  | "energia"
  | "agua"
  | "materiais"
  | "marketing"
  | "impostos"
  | "outros";

export interface Transaction extends BaseEntity {
  type: TransactionType;
  category: RevenueCategory | ExpenseCategory;
  description: string;
  amount: number;
  dueDate: ISODate;
  paidDate?: ISODate;
  status: TransactionStatus;
  method?: PaymentMethod;
  studentId?: ID;
  subscriptionId?: ID;
}

// ----------------------------------------------------------------------------
// Feedback & churn
// ----------------------------------------------------------------------------
export interface Feedback extends BaseEntity {
  /** 1..5 */
  classRating: number;
  teacherRating: number;
  structureRating: number;
  /** 0..10 */
  nps: number;
  sport_type?: SportType;
  teacherId?: ID;
  comment?: string;
}

export type ChurnReason =
  | "preco"
  | "horario"
  | "mudanca"
  | "lesao"
  | "insatisfacao_aula"
  | "insatisfacao_estrutura"
  | "falta_tempo"
  | "outro_esporte"
  | "outros";

export interface ChurnRecord extends BaseEntity {
  studentId: ID;
  date: ISODate;
  reason: ChurnReason;
  details?: string;
  wouldReturn: boolean;
}
