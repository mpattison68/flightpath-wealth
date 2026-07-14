import {
  LayoutDashboard, Briefcase, Compass, FlaskConical, MessageSquare,
  Home, Landmark, Scale, Coins, ShieldCheck, FolderOpen, Settings, SlidersHorizontal,
  Wallet, HeartPulse, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ModuleDef = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  visible: boolean;
  description: string;
  status?: "active" | "planned" | "future";
  engine?: "portfolio" | "property" | "state_pension" | "private_pension" | "consulting" | "rental" | "annuity";
};

export const MODULES: ModuleDef[] = [
  { id: "dashboard",   label: "Dashboard",   path: "/dashboard",   icon: LayoutDashboard,    visible: true,  status: "active",  description: "Where am I today?" },
  { id: "portfolio",   label: "Portfolio",   path: "/portfolio",   icon: Briefcase,          visible: true,  status: "active",  engine: "portfolio",     description: "Holdings, allocation and performance." },
  { id: "retirement",  label: "Retirement",  path: "/retirement",  icon: Compass,            visible: true,  status: "active",  description: "How every engine funds your retirement." },
  { id: "spending",    label: "Retirement Lifestyle", path: "/spending", icon: Wallet,       visible: true,  status: "active",  description: "The lifestyle your portfolio must fund each year, in your Target Currency." },
  { id: "assumptions", label: "Assumptions", path: "/assumptions", icon: SlidersHorizontal,  visible: true,  status: "active",  description: "The numbers behind every projection." },
  { id: "scenarios",   label: "Scenarios",   path: "/scenarios",   icon: FlaskConical,       visible: true,  status: "active",  description: "What if you made a different choice?" },
  { id: "coach",       label: "AI Coach",    path: "/coach",       icon: MessageSquare,      visible: true,  status: "active",  description: "Ask anything about your plan." },
  { id: "property",    label: "Property",    path: "/property",    icon: Home,               visible: false, status: "planned", engine: "property",       description: "Property as a retirement engine." },
  { id: "pensions",    label: "Pensions",    path: "/pensions",    icon: Landmark,           visible: false, status: "planned", engine: "private_pension", description: "Private and state pension income engines." },
  { id: "tax",         label: "Tax",         path: "/tax",         icon: Coins,              visible: false, status: "planned", description: "Tax-efficient drawdown planning." },
  { id: "estate",      label: "Estate",      path: "/estate",      icon: Scale,              visible: false, status: "planned", description: "Wills, gifts and legacy planning." },
  { id: "insurance",   label: "Insurance",   path: "/insurance",   icon: ShieldCheck,        visible: false, status: "planned", description: "Cover and protection." },
  { id: "healthcare",  label: "Healthcare",  path: "/healthcare",  icon: HeartPulse,         visible: false, status: "planned", description: "Long-term healthcare planning." },
  { id: "documents",   label: "Documents",   path: "/documents",   icon: FolderOpen,         visible: false, status: "planned", description: "Your financial document library." },
  { id: "committee",   label: "Investment Committee", path: "/committee", icon: Users,       visible: false, status: "future",  description: "AI panel of specialist advisers." },
  { id: "settings",    label: "Settings",    path: "/settings",    icon: Settings,           visible: true,  status: "active",  description: "App preferences." },
];

export const VISIBLE_MODULES = MODULES.filter((m) => m.visible);

export const PLANNED_MODULES = MODULES.filter((m) => m.status === "planned" || m.status === "future");