import type {
  ArenaSettings,
  Attendance,
  CancellationRequest,
  ChurnRecord,
  ClassGroup,
  Court,
  Exercise,
  Feedback,
  Plan,
  Student,
  Subscription,
  Teacher,
  TrainingPlan,
  Transaction,
} from "@/types";
import { LocalStorageRepository, type Repository } from "./core/repository";

/**
 * Ponto único de composição dos repositórios.
 * Para migrar para Supabase, troque `LocalStorageRepository` por
 * `SupabaseRepository` aqui — nenhuma tela precisa mudar.
 */
export const db = {
  students: new LocalStorageRepository<Student>("students", "stu") as Repository<Student>,
  teachers: new LocalStorageRepository<Teacher>("teachers", "tch") as Repository<Teacher>,
  courts: new LocalStorageRepository<Court>("courts", "crt") as Repository<Court>,
  classGroups: new LocalStorageRepository<ClassGroup>("class_groups", "cls") as Repository<ClassGroup>,
  plans: new LocalStorageRepository<Plan>("plans", "pln") as Repository<Plan>,
  subscriptions: new LocalStorageRepository<Subscription>("subscriptions", "sub") as Repository<Subscription>,
  attendances: new LocalStorageRepository<Attendance>("attendances", "att") as Repository<Attendance>,
  cancellations: new LocalStorageRepository<CancellationRequest>("cancellations", "cnl") as Repository<CancellationRequest>,
  exercises: new LocalStorageRepository<Exercise>("exercises", "exe") as Repository<Exercise>,
  trainings: new LocalStorageRepository<TrainingPlan>("trainings", "trn") as Repository<TrainingPlan>,
  transactions: new LocalStorageRepository<Transaction>("transactions", "txn") as Repository<Transaction>,
  feedbacks: new LocalStorageRepository<Feedback>("feedbacks", "fdb") as Repository<Feedback>,
  churn: new LocalStorageRepository<ChurnRecord>("churn", "chn") as Repository<ChurnRecord>,
  settings: new LocalStorageRepository<ArenaSettings>("settings", "set") as Repository<ArenaSettings>,
};

export type Database = typeof db;
