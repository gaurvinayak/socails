import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Code2,
  Columns,
  Image,
  Inbox,
  Link2,
  ListOrdered,
  Layers,
  PenSquare,
  Plug2,
  Settings,
  Target,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const NAV_PUBLISH = [
  { to: "/composer",  label: "Composer",         icon: PenSquare   },
  { to: "/carousel",  label: "Carousel",          icon: Columns     },
  { to: "/calendar",  label: "Calendar",          icon: CalendarDays },
  { to: "/queue",     label: "Queue",             icon: ListOrdered },
];

const NAV_MONITOR = [
  { to: "/inbox",     label: "Inbox",             icon: Inbox      },
  { to: "/analytics", label: "Analytics",         icon: BarChart3  },
  { to: "/library",   label: "Library",           icon: Image      },
];

const NAV_STRATEGY = [
  { to: "/pillars",   label: "Content Pillars",   icon: Layers     },
  { to: "/goals",     label: "SMART Goals",       icon: Target     },
  { to: "/utm",       label: "UTM Builder",       icon: Link2      },
  { to: "/plan",      label: "90-Day Plan",       icon: CheckSquare },
];

const navCls = ({ isActive }) =>
  [
    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
    isActive
      ? "bg-white/10 text-white"
      : "text-slate-400 hover:bg-white/5 hover:text-white",
  ].join(" ");

const SectionLabel = ({ label }) => (
  <p className="px-3 pt-3 pb-1 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
    {label}
  </p>
);

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-slate-900 flex flex-col z-10">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
        <span className="text-white font-bold text-xl tracking-tight">socails</span>
        <span className="text-xs bg-violet-500 text-white px-1.5 py-0.5 rounded font-medium">
          beta
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        {/* Accounts — top-level, no group */}
        <NavLink to="/accounts" className={navCls}>
          <Plug2 size={17} />
          Accounts
        </NavLink>

        <SectionLabel label="Publish" />
        {NAV_PUBLISH.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={navCls}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}

        <SectionLabel label="Monitor" />
        {NAV_MONITOR.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={navCls}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}

        <SectionLabel label="Strategy" />
        {NAV_STRATEGY.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={navCls}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-white/10 space-y-0.5">
        <a
          href="http://localhost:8002/api/docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <Code2 size={17} />
          API Docs
        </a>
        <NavLink to="/settings" className={navCls}>
          <Settings size={17} />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}
