import {
  BookOpenText,
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  GraduationCap,
  LayoutDashboard,
  MessageSquareHeart,
  Repeat,
  Settings,
  Ticket,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: "Visão geral", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Operação de quadra",
    items: [
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/chamada", label: "Chamada", icon: ClipboardCheck },
      { href: "/reposicoes", label: "Cancelamentos & Reposições", icon: Repeat },
    ],
  },
  {
    title: "Pessoas",
    items: [
      { href: "/alunos", label: "Alunos", icon: Users },
      { href: "/professores", label: "Professores", icon: GraduationCap },
      { href: "/turmas", label: "Turmas & Quadras", icon: UsersRound },
    ],
  },
  {
    title: "Comercial",
    items: [
      { href: "/planos", label: "Planos & Pacotes", icon: Ticket },
      { href: "/financeiro", label: "Financeiro", icon: Wallet },
    ],
  },
  {
    title: "Metodologia",
    items: [
      { href: "/treinos", label: "Treinos", icon: Dumbbell },
      { href: "/exercicios", label: "Biblioteca de exercícios", icon: BookOpenText },
    ],
  },
  {
    title: "Qualidade",
    items: [{ href: "/feedback", label: "Feedback & Churn", icon: MessageSquareHeart }],
  },
  { title: "Sistema", items: [{ href: "/configuracoes", label: "Configurações", icon: Settings }] },
];

/** Atalhos da barra inferior no celular (uso do professor na quadra) */
export const MOBILE_NAV: NavItem[] = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/chamada", label: "Chamada", icon: ClipboardCheck },
  { href: "/treinos", label: "Treinos", icon: Dumbbell },
];

/** Rotas públicas, sem sidebar */
export const PUBLIC_ROUTES = ["/avaliar"];
