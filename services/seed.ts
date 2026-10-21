import type {
  ArenaSettings,
  Attendance,
  CancellationRequest,
  ChurnReason,
  ChurnRecord,
  ClassGroup,
  Court,
  Exercise,
  ExpenseCategory,
  Feedback,
  Level,
  Plan,
  SportType,
  Student,
  Subscription,
  Teacher,
  Tenant,
  TrainingPlan,
  Transaction,
  Weekday,
} from "@/types";
import { addDays, addMonths, startOfMonth, toDateTime, today, weekdayOf } from "@/lib/date";
import { uid } from "@/lib/utils";
import { STORAGE_PREFIX, storage, writeJSON } from "./core/storage";
import { tenantService } from "./core/tenant";
import { DEFAULT_SETTINGS } from "./settings.service";
import { emitChange } from "./core/events";

// ---------------------------------------------------------------------------
// PRNG determinístico para dados de demonstração estáveis
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  "Ana", "Bruno", "Camila", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João",
  "Larissa", "Marcelo", "Natália", "Otávio", "Paula", "Rafael", "Sabrina", "Thiago", "Vanessa", "Wagner",
  "Beatriz", "Caio", "Daniela", "Enzo", "Fernanda", "Gustavo", "Helena", "Igor", "Juliana", "Lucas",
  "Mariana", "Nicolas", "Patrícia", "Renata", "Samuel", "Tatiana", "Vitor", "Yasmin",
];
const LAST = [
  "Silva", "Souza", "Oliveira", "Costa", "Pereira", "Almeida", "Ferreira", "Rodrigues", "Martins", "Rocha",
  "Carvalho", "Gomes", "Ribeiro", "Barbosa", "Lima", "Teixeira", "Mendes", "Cardoso", "Moraes", "Nunes",
];

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, ".");
}

interface SeedConfig {
  seed: number;
  studentCount: number;
  sports: SportType[];
  courts: { name: string; sport: SportType; covered: boolean }[];
  teachers: { name: string; sports: SportType[]; color: string }[];
}

const now = () => new Date().toISOString();

export function buildSeed(tenantId: string, cfg: SeedConfig) {
  const rand = mulberry32(cfg.seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const chance = (p: number) => rand() < p;
  const ts = now();
  const base = { tenantId, createdAt: ts, updatedAt: ts };
  const t = today();

  // ----------------------------------------------------------------- Quadras
  const courts: Court[] = cfg.courts.map((c) => ({
    ...base,
    id: uid("crt"),
    name: c.name,
    sport_type: c.sport,
    covered: c.covered,
    active: true,
  }));

  // -------------------------------------------------------------- Professores
  const teachers: Teacher[] = cfg.teachers.map((tc) => ({
    ...base,
    id: uid("tch"),
    name: tc.name,
    phone: `(47) 9${Math.floor(1000 + rand() * 8999)}-${Math.floor(1000 + rand() * 8999)}`,
    email: `${slug(tc.name)}@arena.com.br`,
    sports: tc.sports,
    color: tc.color,
    bio: "Professor certificado, foco em técnica e tática de jogo.",
    active: true,
  }));

  // ------------------------------------------------------------------- Planos
  const planTpl: { name: string; type: Plan["type"]; price: number; credits: number; validityDays: number; sport_type?: SportType }[] = [
    { name: "Mensal 1x/semana", type: "mensal", price: 190, credits: 4, validityDays: 30, sport_type: undefined },
    { name: "Mensal 2x/semana", type: "mensal", price: 320, credits: 8, validityDays: 30, sport_type: undefined },
    { name: "Mensal 3x/semana", type: "mensal", price: 420, credits: 12, validityDays: 30, sport_type: undefined },
    { name: "Pacote 10 aulas", type: "pacote", price: 450, credits: 10, validityDays: 60, sport_type: undefined },
    { name: "Pacote 5 aulas", type: "pacote", price: 250, credits: 5, validityDays: 30, sport_type: undefined },
    { name: "Aula avulsa", type: "avulso", price: 65, credits: 1, validityDays: 15, sport_type: undefined },
  ];
  const plans: Plan[] = planTpl.map((p) => ({
    ...base,
    id: uid("pln"),
    ...p,
    description:
      p.type === "mensal"
        ? "Renovação automática a cada 30 dias. Créditos não acumulam."
        : p.type === "pacote"
          ? "Créditos válidos dentro do prazo do pacote."
          : "Uma aula experimental ou avulsa.",
    active: true,
  }));
  const [mensal1, mensal2, mensal3, pacote10, pacote5, avulsa] = plans;

  // ------------------------------------------------------------------- Turmas
  type GroupTpl = { sport: SportType; level: Level; days: Weekday[]; start: string; end: string; cap: number };
  const templates: GroupTpl[] = [
    { sport: "beach_tennis", level: "iniciante", days: [1, 3], start: "07:00", end: "08:00", cap: 5 },
    { sport: "beach_tennis", level: "intermediario", days: [1, 3], start: "08:00", end: "09:00", cap: 5 },
    { sport: "beach_tennis", level: "avancado", days: [2, 4], start: "07:00", end: "08:00", cap: 5 },
    { sport: "beach_tennis", level: "iniciante", days: [2, 4], start: "08:00", end: "09:00", cap: 5 },
    { sport: "beach_tennis", level: "iniciante", days: [2, 4], start: "18:00", end: "19:00", cap: 5 },
    { sport: "beach_tennis", level: "intermediario", days: [1, 3], start: "18:00", end: "19:00", cap: 5 },
    { sport: "beach_tennis", level: "intermediario", days: [1, 3, 5], start: "19:00", end: "20:00", cap: 5 },
    { sport: "beach_tennis", level: "intermediario", days: [2, 4], start: "19:00", end: "20:00", cap: 5 },
    { sport: "beach_tennis", level: "avancado", days: [2, 4], start: "20:00", end: "21:00", cap: 5 },
    { sport: "beach_tennis", level: "avancado", days: [1, 3], start: "20:00", end: "21:00", cap: 5 },
    { sport: "beach_tennis", level: "iniciante", days: [5], start: "18:00", end: "19:00", cap: 6 },
    { sport: "beach_tennis", level: "iniciante", days: [6], start: "09:00", end: "10:30", cap: 8 },
    { sport: "beach_tennis", level: "intermediario", days: [6], start: "10:30", end: "12:00", cap: 8 },
    { sport: "futevolei", level: "iniciante", days: [1, 3], start: "18:00", end: "19:00", cap: 6 },
    { sport: "futevolei", level: "avancado", days: [1, 3], start: "19:00", end: "20:00", cap: 6 },
    { sport: "futevolei", level: "intermediario", days: [2, 4], start: "19:00", end: "20:00", cap: 6 },
    { sport: "futevolei", level: "iniciante", days: [6], start: "08:00", end: "09:30", cap: 8 },
    { sport: "padel", level: "iniciante", days: [2, 4], start: "17:00", end: "18:00", cap: 4 },
    { sport: "padel", level: "avancado", days: [2, 4], start: "19:00", end: "20:00", cap: 4 },
    { sport: "padel", level: "intermediario", days: [1, 5], start: "20:00", end: "21:00", cap: 4 },
    { sport: "padel", level: "iniciante", days: [6], start: "10:00", end: "11:00", cap: 4 },
  ];
  const activeTemplates = templates.filter((g) => cfg.sports.includes(g.sport) && courts.some((c) => c.sport_type === g.sport));

  const levelName: Record<Level, string> = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" };
  const sportName: Record<SportType, string> = { beach_tennis: "BT", futevolei: "Futevôlei", padel: "Padel" };
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const overlaps = (a: GroupTpl, b: ClassGroup) =>
    a.days.some((d) => b.weekdays.includes(d)) && toMin(a.start) < toMin(b.endTime) && toMin(b.startTime) < toMin(a.end);
  const groups: ClassGroup[] = [];
  for (const tpl of activeTemplates) {
    // escolhe quadra e professor livres no horário (sem conflito)
    const court = courts.find((c) => c.sport_type === tpl.sport && !groups.some((g) => g.courtId === c.id && overlaps(tpl, g)));
    if (!court) continue;
    const sportTeachers = teachers.filter((tc) => tc.sports.includes(tpl.sport));
    const offset = groups.length % Math.max(1, sportTeachers.length);
    const rotated = [...sportTeachers.slice(offset), ...sportTeachers.slice(0, offset)];
    const teacher = rotated.find((tc) => !groups.some((g) => g.teacherId === tc.id && overlaps(tpl, g))) ?? rotated[0];
    groups.push({
      ...base,
      id: uid("cls"),
      name: `${sportName[tpl.sport]} ${levelName[tpl.level]} ${tpl.start.slice(0, 2)}h${tpl.days.length === 1 && tpl.days[0] === 6 ? " (Sáb)" : ""}`,
      sport_type: tpl.sport,
      level: tpl.level,
      teacherId: teacher.id,
      courtId: court.id,
      weekdays: tpl.days,
      startTime: tpl.start,
      endTime: tpl.end,
      capacity: tpl.cap,
      studentIds: [],
      active: true,
    });
  }

  // ------------------------------------------------------------------- Alunos
  const usedNames = new Set<string>();
  const students: Student[] = [];
  for (let i = 0; i < cfg.studentCount; i++) {
    let name = "";
    do name = `${pick(FIRST)} ${pick(LAST)}`;
    while (usedNames.has(name));
    usedNames.add(name);
    const sport: SportType = chance(0.68) ? "beach_tennis" : pick(cfg.sports);
    const level: Level = pick(["iniciante", "iniciante", "intermediario", "intermediario", "avancado"] as const);
    const joinedAt = addDays(t, -Math.floor(rand() * 300) - 3);
    students.push({
      ...base,
      id: uid("stu"),
      name,
      phone: `(47) 9${Math.floor(1000 + rand() * 8999)}-${Math.floor(1000 + rand() * 8999)}`,
      email: `${slug(name)}@email.com`,
      birthDate: addDays(t, -Math.floor((18 + rand() * 35) * 365)),
      level,
      sports: chance(0.12) ? [sport, pick(cfg.sports)].filter((v, idx, a) => a.indexOf(v) === idx) : [sport],
      status: "ativo",
      joinedAt,
      notes: chance(0.15) ? "Prefere aulas no período da manhã." : undefined,
    });
  }
  // Alguns alunos novos neste mês
  students.slice(0, 3).forEach((s, i) => (s.joinedAt = addDays(startOfMonth(t), Math.min(i * 3, Math.max(0, Number(t.slice(8)) - 1)))));

  // Aloca alunos nas turmas (mesmo esporte e nível)
  for (const s of students) {
    const options = groups.filter(
      (g) => s.sports.includes(g.sport_type) && g.level === s.level && g.studentIds.length < g.capacity,
    );
    const fallback = groups.filter((g) => s.sports.includes(g.sport_type) && g.studentIds.length < g.capacity);
    const g = options[0] ?? fallback[0];
    if (g) g.studentIds.push(s.id);
    if (chance(0.25)) {
      const extra = (options[1] ?? fallback[1]) as ClassGroup | undefined;
      if (extra && extra.id !== g?.id && extra.studentIds.length < extra.capacity) extra.studentIds.push(s.id);
    }
  }

  // Inativos (churn) e trancado
  const churnReasons: ChurnReason[] = ["horario", "preco", "mudanca", "lesao", "falta_tempo", "insatisfacao_aula", "outro_esporte"];
  const churn: ChurnRecord[] = [];
  const unassigned = students.filter((s) => !groups.some((g) => g.studentIds.includes(s.id)));
  const toChurn = [...unassigned, ...students.slice(-4)].slice(0, Math.max(3, Math.round(cfg.studentCount * 0.12)));
  toChurn.forEach((s, i) => {
    s.status = "inativo";
    groups.forEach((g) => (g.studentIds = g.studentIds.filter((id) => id !== s.id)));
    churn.push({
      ...base,
      id: uid("chn"),
      studentId: s.id,
      date: i === 0 ? addDays(t, -Math.min(3, Number(t.slice(8)) - 1)) : addDays(t, -(20 + i * 17)),
      reason: churnReasons[i % churnReasons.length],
      details: i % 2 === 0 ? "Informou na recepção." : undefined,
      wouldReturn: i % 3 !== 0,
    });
  });
  const trancado = students.find((s) => s.status === "ativo" && !groups.some((g) => g.studentIds.includes(s.id)));
  if (trancado) trancado.status = "trancado";

  // ------------------------------------------------------------- Assinaturas
  const subscriptions: Subscription[] = [];
  const transactions: Transaction[] = [];
  const weeklyFreq = (s: Student) => groups.filter((g) => g.studentIds.includes(s.id)).reduce((a, g) => a + g.weekdays.length, 0);

  for (const s of students) {
    if (s.status !== "ativo") continue;
    const freq = weeklyFreq(s);
    let plan: Plan = freq >= 3 ? mensal3 : freq === 2 ? mensal2 : mensal1;
    if (chance(0.2)) plan = pick([pacote10, pacote5]);
    if (freq === 0) plan = avulsa;
    const offset = Math.floor(rand() * (plan.validityDays - 2));
    const startDate = addDays(t, -offset);
    const sub: Subscription = {
      ...base,
      id: uid("sub"),
      studentId: s.id,
      planId: plan.id,
      startDate,
      endDate: addDays(startDate, plan.validityDays - 1),
      creditsTotal: plan.credits,
      creditsUsed: 0,
      status: "ativa",
      autoRenew: plan.type === "mensal",
    };
    subscriptions.push(sub);
    const paid = chance(0.82);
    const payDay = addDays(startDate, Math.floor(rand() * 3));
    transactions.push({
      ...base,
      id: uid("txn"),
      type: "receita",
      category: plan.type === "mensal" ? "mensalidade" : plan.type === "pacote" ? "pacote" : "avulso",
      description: `${plan.name} — ${s.name}`,
      amount: plan.price,
      dueDate: startDate,
      paidDate: paid ? (payDay > t ? t : payDay) : undefined,
      status: paid ? "pago" : "pendente",
      method: paid ? pick(["pix", "pix", "pix", "cartao", "dinheiro"] as const) : undefined,
      studentId: s.id,
      subscriptionId: sub.id,
    });

    // Histórico de mensalidades anteriores (5 meses) para alunos mensais antigos
    if (plan.type === "mensal") {
      for (let m = 1; m <= 5; m++) {
        const due = addMonths(startDate, -m);
        if (due < s.joinedAt) break;
        transactions.push({
          ...base,
          id: uid("txn"),
          type: "receita",
          category: "mensalidade",
          description: `${plan.name} — ${s.name}`,
          amount: plan.price,
          dueDate: due,
          paidDate: addDays(due, Math.floor(rand() * 4)),
          status: "pago",
          method: pick(["pix", "pix", "cartao", "dinheiro"] as const),
          studentId: s.id,
        });
      }
    }
  }

  // -------------------------------------------------------------- Presenças
  const attendances: Attendance[] = [];
  const nowDate = new Date();
  const subByStudent = new Map(subscriptions.map((s) => [s.studentId, s]));
  for (let back = 21; back >= 0; back--) {
    const date = addDays(t, -back);
    const wd = weekdayOf(date);
    for (const g of groups) {
      if (!g.weekdays.includes(wd)) continue;
      if (toDateTime(date, g.endTime) > nowDate) continue; // ainda não aconteceu
      if (back === 0) continue; // a chamada de hoje fica para a demonstração
      for (const sid of g.studentIds) {
        const sub = subByStudent.get(sid);
        if (!sub || date < sub.startDate) continue;
        const r = rand();
        const status = r < 0.84 ? "presente" : r < 0.93 ? "falta" : "justificada";
        let debitedSubscriptionId: string | undefined;
        if (status !== "justificada" && sub.creditsUsed < sub.creditsTotal) {
          sub.creditsUsed++;
          debitedSubscriptionId = sub.id;
        }
        attendances.push({
          ...base,
          id: uid("att"),
          classGroupId: g.id,
          studentId: sid,
          date,
          status,
          isMakeup: false,
          debitedSubscriptionId,
        });
      }
    }
  }

  // ---------------------------------------------------------- Cancelamentos
  const cancellations: CancellationRequest[] = [];
  const reasons = ["Viagem a trabalho", "Consulta médica", "Compromisso familiar", "Chuva forte no trajeto", "Dor muscular"];
  const futureSessions: { g: ClassGroup; date: string }[] = [];
  for (let d = 1; d <= 6; d++) {
    const date = addDays(t, d);
    groups.filter((g) => g.weekdays.includes(weekdayOf(date)) && g.studentIds.length).forEach((g) => futureSessions.push({ g, date }));
  }
  futureSessions.slice(0, 4).forEach(({ g, date }, i) => {
    const sid = g.studentIds[i % g.studentIds.length];
    cancellations.push({
      ...base,
      id: uid("cnl"),
      studentId: sid,
      classGroupId: g.id,
      classDate: date,
      reason: reasons[i % reasons.length],
      requestedAt: ts,
      hoursInAdvance: Math.round((toDateTime(date, g.startTime).getTime() - nowDate.getTime()) / 360_000) / 10,
      eligibleForMakeup: true,
      status: "pendente",
      makeupDeadline: addDays(date, DEFAULT_SETTINGS.makeupValidityDays),
    });
    attendances.push({
      ...base,
      id: uid("att"),
      classGroupId: g.id,
      studentId: sid,
      date,
      status: "justificada",
      isMakeup: false,
    });
  });
  // Cancelamentos passados: um fora do prazo e um justificado aguardando reposição
  const pastJustified = attendances.filter((a) => a.status === "justificada" && a.date < t).slice(0, 3);
  pastJustified.forEach((a, i) => {
    const g = groups.find((x) => x.id === a.classGroupId)!;
    const late = i === 2;
    if (late) {
      a.status = "falta";
    }
    cancellations.push({
      ...base,
      id: uid("cnl"),
      studentId: a.studentId,
      classGroupId: a.classGroupId,
      classDate: a.date,
      reason: reasons[(i + 2) % reasons.length],
      requestedAt: new Date(toDateTime(a.date, g.startTime).getTime() - (late ? 1.5 : 12) * 3_600_000).toISOString(),
      hoursInAdvance: late ? 1.5 : 12,
      eligibleForMakeup: !late,
      status: late ? "sem_reposicao" : "pendente",
      makeupDeadline: late ? undefined : addDays(a.date, DEFAULT_SETTINGS.makeupValidityDays),
    });
  });

  // ------------------------------------------------------------ Despesas
  const expenseTpl: { cat: ExpenseCategory; desc: string; amount: number; day: number }[] = [
    { cat: "aluguel", desc: "Aluguel do terreno", amount: 2800, day: 5 },
    { cat: "salarios", desc: "Repasse professores", amount: 3900, day: 5 },
    { cat: "energia", desc: "Energia elétrica (iluminação)", amount: 640, day: 12 },
    { cat: "agua", desc: "Água e irrigação da areia", amount: 180, day: 12 },
    { cat: "manutencao", desc: "Reposição e nivelamento de areia", amount: 420, day: 18 },
    { cat: "materiais", desc: "Bolas e redes", amount: 280, day: 20 },
    { cat: "marketing", desc: "Anúncios Instagram", amount: 300, day: 1 },
  ];
  const scale = cfg.studentCount / 60;
  for (let m = 5; m >= 0; m--) {
    const monthStart = addMonths(startOfMonth(t), -m);
    for (const e of expenseTpl) {
      const due = addDays(monthStart, e.day - 1);
      const amount = Math.round(e.amount * (e.cat === "aluguel" ? 1 : scale) * (0.9 + rand() * 0.2));
      const paid = due <= t;
      transactions.push({
        ...base,
        id: uid("txn"),
        type: "despesa",
        category: e.cat,
        description: e.desc,
        amount,
        dueDate: due,
        paidDate: paid ? due : undefined,
        status: paid ? "pago" : "pendente",
        method: paid ? "transferencia" : undefined,
      });
    }
    // Receitas avulsas (locação/eventos)
    transactions.push({
      ...base,
      id: uid("txn"),
      type: "receita",
      category: "locacao",
      description: "Locação de quadras (avulsas)",
      amount: Math.round((1800 + rand() * 900) * scale),
      dueDate: addDays(monthStart, 27) > t ? t : addDays(monthStart, 27),
      paidDate: addDays(monthStart, 27) > t ? t : addDays(monthStart, 27),
      status: "pago",
      method: "pix",
    });
  }

  // ----------------------------------------------------------- Exercícios
  const exerciseTpl: Omit<Exercise, keyof typeof base | "id">[] = [
    {
      name: "Saque por baixo com alvo",
      fundamental: "saque",
      sport_type: "beach_tennis",
      level: "iniciante",
      description:
        "Aluno executa saque por baixo buscando cones posicionados no fundo da quadra adversária. Foco em consistência antes de potência.",
      coachingPoints: ["Pés paralelos à linha de base", "Contato à frente do corpo", "Terminar o movimento apontando para o alvo"],
      durationMin: 10,
      equipment: "6 cones, cesto de bolas",
      videoUrl: "https://www.youtube.com/results?search_query=beach+tennis+saque+por+baixo",
    },
    {
      name: "Saque por cima — lançamento",
      fundamental: "saque",
      sport_type: "beach_tennis",
      level: "intermediario",
      description: "Série de lançamentos sem bater na bola, seguida de saques completos. Trabalha regularidade do lançamento e ritmo.",
      coachingPoints: ["Lançamento na altura do braço estendido", "Bola levemente à frente", "Transferência de peso para frente"],
      durationMin: 12,
      equipment: "Cesto de bolas",
    },
    {
      name: "Saque com efeito slice",
      fundamental: "saque",
      sport_type: "beach_tennis",
      level: "avancado",
      description: "Saque com efeito lateral buscando abrir a quadra do recebedor. Alternar alvos diagonal e paralela.",
      coachingPoints: ["Raquete escovando a lateral da bola", "Empunhadura continental", "Disfarçar a direção até o contato"],
      durationMin: 15,
      equipment: "Cones, cesto de bolas",
    },
    {
      name: "Voleio de bloqueio em dupla",
      fundamental: "voleio",
      sport_type: "beach_tennis",
      level: "iniciante",
      description: "Dupla na rede troca voleios curtos e controlados. Objetivo: 20 trocas sem erro.",
      coachingPoints: ["Raquete sempre à frente", "Sem swing — apenas bloquear", "Joelhos flexionados"],
      durationMin: 10,
    },
    {
      name: "Voleio cruzado 2x1",
      fundamental: "voleio",
      sport_type: "beach_tennis",
      level: "intermediario",
      description: "Dois alunos na rede contra um no fundo. Os da rede devem direcionar voleios cruzados e profundos.",
      coachingPoints: ["Abrir a raquete para cruzar", "Comunicação entre parceiros", "Recuperar posição após cada golpe"],
      durationMin: 15,
    },
    {
      name: "Smash com deslocamento para trás",
      fundamental: "smash",
      sport_type: "beach_tennis",
      level: "intermediario",
      description: "Professor lança bolas altas; aluno recua em passos cruzados e finaliza com smash em zona-alvo.",
      coachingPoints: ["Virar de lado ao recuar", "Braço livre apontando a bola", "Contato no ponto mais alto"],
      durationMin: 12,
      equipment: "Cones para zona-alvo",
    },
    {
      name: "Smash x defesa (jogo condicionado)",
      fundamental: "smash",
      sport_type: "beach_tennis",
      level: "avancado",
      description: "Um lado só pode atacar com smash, outro só defende com lob. Troca de funções a cada 5 pontos.",
      coachingPoints: ["Paciência para escolher a bola", "Variar direção do smash", "Defensores: lob alto e profundo"],
      durationMin: 20,
    },
    {
      name: "Defesa de smash — muralha",
      fundamental: "defesa",
      sport_type: "beach_tennis",
      level: "intermediario",
      description: "Aluno no fundo recebe sequência de smashes controlados do professor e devolve com lob ou bloqueio.",
      coachingPoints: ["Raquete alta e à frente", "Base larga", "Devolver alto para ganhar tempo"],
      durationMin: 12,
    },
    {
      name: "Lob defensivo de recuperação",
      fundamental: "defesa",
      sport_type: "beach_tennis",
      level: "iniciante",
      description: "Bolas curtas e anguladas; aluno corre, recupera e devolve com lob alto.",
      coachingPoints: ["Chegar antes da bola", "Abrir a face da raquete", "Voltar para o centro"],
      durationMin: 10,
    },
    {
      name: "Split step e reação",
      fundamental: "movimentacao",
      sport_type: "beach_tennis",
      level: "iniciante",
      description: "Ao sinal do professor, aluno faz split step e reage para a direção indicada tocando o cone.",
      coachingPoints: ["Pequeno salto no momento do golpe adversário", "Peso na ponta dos pés", "Passos curtos na areia"],
      durationMin: 8,
      equipment: "4 cones",
    },
    {
      name: "Circuito de agilidade na areia",
      fundamental: "movimentacao",
      sport_type: "beach_tennis",
      level: "intermediario",
      description: "Circuito com deslocamento lateral, frontal e recuo entre cones, finalizando com golpe de voleio.",
      coachingPoints: ["Centro de gravidade baixo", "Não cruzar as pernas no lateral", "Explodir na saída"],
      durationMin: 10,
      equipment: "8 cones, escada de agilidade",
    },
    {
      name: "Shark — ataque no meio",
      fundamental: "voleio",
      sport_type: "beach_tennis",
      level: "avancado",
      description: "Treino tático de interceptação: jogador da rede antecipa e ataca bolas no meio da dupla adversária.",
      coachingPoints: ["Ler a raquete do adversário", "Partida no momento certo", "Finalizar para baixo"],
      durationMin: 15,
    },
    {
      name: "Shark de cabeça no futevôlei",
      fundamental: "smash",
      sport_type: "futevolei",
      level: "intermediario",
      description: "Levantamento do parceiro e finalização de shark (ataque de peito do pé) em zona-alvo.",
      coachingPoints: ["Aproximação em 3 passos", "Bloquear o tornozelo", "Contato no peito do pé"],
      durationMin: 15,
    },
    {
      name: "Recepção de peito e levantamento",
      fundamental: "defesa",
      sport_type: "futevolei",
      level: "iniciante",
      description: "Recepção de bola alta no peito, controle e levantamento para o parceiro.",
      coachingPoints: ["Arquear o tronco para amortecer", "Olhar o parceiro antes de levantar", "Levantamento alto e próximo à rede"],
      durationMin: 12,
    },
    {
      name: "Bandeja com saída de parede",
      fundamental: "smash",
      sport_type: "padel",
      level: "intermediario",
      description: "Bola alta após parede de fundo; aluno executa bandeja controlada para manter a rede.",
      coachingPoints: ["Raquete preparada atrás da cabeça", "Golpe com corte", "Não buscar força — buscar profundidade"],
      durationMin: 15,
    },
  ];
  const exercises: Exercise[] = exerciseTpl
    .filter((e) => cfg.sports.includes(e.sport_type))
    .map((e) => ({ ...base, id: uid("exe"), ...e }));

  // --------------------------------------------------------------- Treinos
  const bt = (f: Exercise["fundamental"]) => exercises.filter((e) => e.fundamental === f && e.sport_type === "beach_tennis");
  const trainingTpl: Omit<TrainingPlan, keyof typeof base | "id">[] = [
    {
      title: "Consistência no saque",
      date: t,
      sport_type: "beach_tennis",
      level: "iniciante",
      classGroupIds: groups.filter((g) => g.sport_type === "beach_tennis" && g.level === "iniciante").map((g) => g.id),
      objective: "Colocar 7 de 10 saques em quadra e iniciar o ponto com segurança.",
      warmup: "5 min de mobilidade (ombro, quadril, tornozelo) + 5 min de mini beach na rede.",
      mainDrill: "Saque por baixo com alvo: 3 séries de 10 saques alternando diagonal e paralela. Quem acertar 7/10 sobe para saque por cima.",
      exerciseIds: [...bt("saque").slice(0, 1), ...bt("movimentacao").slice(0, 1)].map((e) => e.id),
      cooldown: "Jogo de pontos curtos iniciando sempre pelo saque + alongamento.",
      notes: "Atenção à posição dos pés — muitos alunos pisando na linha.",
      durationMin: 60,
    },
    {
      title: "Rede agressiva e voleio cruzado",
      date: t,
      sport_type: "beach_tennis",
      level: "intermediario",
      classGroupIds: groups.filter((g) => g.sport_type === "beach_tennis" && g.level === "intermediario").map((g) => g.id),
      objective: "Ganhar a rede depois do saque e finalizar com voleio cruzado profundo.",
      warmup: "Split step e reação (8 min) + voleio de bloqueio em dupla.",
      mainDrill: "Voleio cruzado 2x1 com rotação a cada 2 minutos. Ponto bônus para voleio que cai após a linha de fundo do saque.",
      exerciseIds: [...bt("movimentacao").slice(0, 1), ...bt("voleio").slice(0, 2)].map((e) => e.id),
      cooldown: "Jogo de duplas: ponto só vale se terminado na rede.",
      durationMin: 60,
    },
    {
      title: "Smash x Defesa",
      date: addDays(t, 1),
      sport_type: "beach_tennis",
      level: "avancado",
      classGroupIds: groups.filter((g) => g.sport_type === "beach_tennis" && g.level === "avancado").map((g) => g.id),
      objective: "Melhorar seleção de bola para o smash e qualidade do lob defensivo.",
      warmup: "Circuito de agilidade na areia (10 min).",
      mainDrill: "Smash com deslocamento para trás (12 min) seguido de jogo condicionado smash x defesa.",
      exerciseIds: [...bt("movimentacao").slice(1, 2), ...bt("smash"), ...bt("defesa").slice(0, 1)].map((e) => e.id),
      cooldown: "Alongamento de ombros e panturrilha.",
      durationMin: 60,
    },
    {
      title: "Defesa e recuperação",
      date: addDays(t, -2),
      sport_type: "beach_tennis",
      level: "iniciante",
      classGroupIds: [],
      objective: "Recuperar bolas curtas e devolver alto.",
      warmup: "Mobilidade + deslocamentos laterais.",
      mainDrill: "Lob defensivo de recuperação em 4 séries de 2 minutos.",
      exerciseIds: bt("defesa").map((e) => e.id),
      durationMin: 60,
    },
  ];
  const trainings: TrainingPlan[] = trainingTpl
    .filter((tr) => cfg.sports.includes(tr.sport_type))
    .map((tr) => ({ ...base, id: uid("trn"), ...tr }));

  // ------------------------------------------------------------- Feedbacks
  const comments = [
    "Professor muito atencioso, aula dinâmica!",
    "A areia da quadra 2 está muito fofa, difícil de se movimentar.",
    "Adoro o horário das 7h, começo o dia bem.",
    "Poderia ter mais horários à noite.",
    "Vestiário precisa de mais chuveiros.",
    "Melhor aula que já fiz, evolui muito no saque.",
    "Iluminação noturna excelente.",
    "Turma muito cheia em alguns dias.",
  ];
  const feedbacks: Feedback[] = Array.from({ length: Math.round(cfg.studentCount * 0.6) }, (_, i) => {
    const good = chance(0.78);
    const r = () => (good ? 4 + Math.round(rand()) : 2 + Math.round(rand() * 2));
    const createdAt = new Date(nowDate.getTime() - Math.floor(rand() * 60) * 86_400_000).toISOString();
    return {
      tenantId,
      id: uid("fdb"),
      createdAt,
      updatedAt: createdAt,
      classRating: r(),
      teacherRating: Math.min(5, r() + (chance(0.3) ? 1 : 0)),
      structureRating: good ? 3 + Math.round(rand() * 2) : 2 + Math.round(rand()),
      nps: good ? 8 + Math.round(rand() * 2) : 3 + Math.round(rand() * 4),
      sport_type: pick(cfg.sports),
      teacherId: chance(0.7) ? pick(teachers).id : undefined,
      comment: chance(0.5) ? comments[i % comments.length] : undefined,
    };
  });

  const settings: ArenaSettings = { ...base, id: uid("set"), ...DEFAULT_SETTINGS };

  return {
    courts,
    teachers,
    plans,
    class_groups: groups,
    students,
    subscriptions,
    attendances,
    cancellations,
    exercises,
    trainings,
    transactions,
    feedbacks,
    churn,
    settings: [settings],
  };
}

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
const SEED_FLAG = `${STORAGE_PREFIX}:seeded`;

export const DEMO_TENANTS: { tenant: Omit<Tenant, "createdAt">; config: SeedConfig }[] = [
  {
    tenant: {
      id: "arena-sol-areia",
      name: "Arena Sol & Areia",
      slug: "sol-e-areia",
      city: "Balneário Camboriú - SC",
      sports: ["beach_tennis", "futevolei", "padel"],
    },
    config: {
      seed: 42,
      studentCount: 60,
      sports: ["beach_tennis", "futevolei", "padel"],
      courts: [
        { name: "Quadra 1", sport: "beach_tennis", covered: false },
        { name: "Quadra 2", sport: "beach_tennis", covered: true },
        { name: "Quadra 3", sport: "futevolei", covered: false },
        { name: "Quadra Padel", sport: "padel", covered: true },
      ],
      teachers: [
        { name: "Carla Mendes", sports: ["beach_tennis"], color: "#f97316" },
        { name: "Rodrigo Alves", sports: ["beach_tennis", "padel"], color: "#0ea5e9" },
        { name: "Léo Santos", sports: ["futevolei", "beach_tennis"], color: "#10b981" },
        { name: "Bianca Freitas", sports: ["beach_tennis", "padel"], color: "#8b5cf6" },
      ],
    },
  },
  {
    tenant: {
      id: "beach-club-norte",
      name: "Beach Club Norte",
      slug: "beach-club-norte",
      city: "Itajaí - SC",
      sports: ["beach_tennis", "futevolei"],
    },
    config: {
      seed: 7,
      studentCount: 22,
      sports: ["beach_tennis", "futevolei"],
      courts: [
        { name: "Quadra Central", sport: "beach_tennis", covered: false },
        { name: "Quadra Futevôlei", sport: "futevolei", covered: false },
      ],
      teachers: [
        { name: "Marina Couto", sports: ["beach_tennis"], color: "#ec4899" },
        { name: "Pedro Henrique", sports: ["futevolei", "beach_tennis"], color: "#14b8a6" },
      ],
    },
  },
];

export function writeTenantData(tenantId: string, data: ReturnType<typeof buildSeed>) {
  for (const [collection, items] of Object.entries(data)) {
    writeJSON(`${STORAGE_PREFIX}:${tenantId}:${collection}`, items);
  }
}

export async function ensureSeeded() {
  if (storage.getItem(SEED_FLAG)) return false;
  for (const { tenant, config } of DEMO_TENANTS) {
    const existing = (await tenantService.list()).find((t) => t.id === tenant.id);
    if (!existing) await tenantService.create({ ...tenant, createdAt: now() });
    writeTenantData(tenant.id, buildSeed(tenant.id, config));
  }
  storage.setItem(SEED_FLAG, "1");
  if (!storage.getItem(`${STORAGE_PREFIX}:current-tenant`)) await tenantService.switchTo(DEMO_TENANTS[0].tenant.id);
  emitChange("seed");
  return true;
}

/** Restaura os dados de demonstração da arena atual */
export async function resetCurrentTenant() {
  const id = tenantService.currentId();
  const demo = DEMO_TENANTS.find((d) => d.tenant.id === id);
  const config: SeedConfig = demo?.config ?? DEMO_TENANTS[1].config;
  writeTenantData(id, buildSeed(id, config));
  emitChange("seed");
}

/** Cria uma nova arena vazia (apenas configurações padrão) */
export async function createEmptyTenant(input: { name: string; city: string; sports: SportType[] }) {
  const id = `${input.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
  const tenant: Tenant = { id, name: input.name, slug: id, city: input.city, sports: input.sports, createdAt: now() };
  await tenantService.create(tenant);
  await tenantService.switchTo(id);
  return tenant;
}
