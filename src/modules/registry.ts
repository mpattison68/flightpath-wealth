import {
  LayoutDashboard, Briefcase, Compass, FlaskConical, MessageSquare,
  Home, Landmark, Scale, Coins, ShieldCheck, FolderOpen, Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ModuleDef = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  visible: boolean;
  description: string;
};

export const MODULES: ModuleDef[] = [
  { id: "dashboard", label: "Dashboard",  path: "/dashboard",  icon: LayoutDashboard, visible: true,  description: "Where am I today?" },
  { id: "portfolio", label: "Portfolio",  path: "/portfolio",  icon: Briefcase,       visible: true,  description: "Holdings, allocation and performance." },
  { id: "retirement",label: "Retirement", path: "/retirement", icon: Compass,         visible: true,  description: "Your flightpath to retirement." },
  { id: "scenarios", label: "Scenarios",  path: "/scenarios",  icon: FlaskConical,    visible: true,  description: "What if you made a different choice?" },
  { id: "coach",     label: "AI Coach",   path: "/coach",      icon: MessageSquare,   visible: true,  description: "Ask anything about your plan." },
  { id: "property",  label: "Property",   path: "/property",   icon: Home,            visible: false, description: "Property as a retirement asset." },
  { id: "pensions",  label: "Pensions",   path: "/pensions",   icon: Landmark,        visible: false, description: "Guaranteed income sources." },
  { id: "estate",    label: "Estate",     path: "/estate",     icon: Scale,           visible: false, description: "Wills and estate planning." },
  { id: "tax",       label: "Tax",        path: "/tax",        icon: Coins,           visible: false, description: "Tax efficiency and planning." },
  { id: "insurance", label: "Insurance",  path: "/insurance",  icon: ShieldCheck,     visible: false, description: "Cover and protection." },
  { id: "documents", label: "Documents",  path: "/documents",  icon: FolderOpen,      visible: false, description: "Your financial document library." },
  { id: "settings",  label: "Settings",   path: "/settings",   icon: Settings,        visible: true,  description: "Assumptions and preferences." },
];

export const VISIBLE_MODULES = MODULES.filter((m) => m.visible);