import React from "react";
import { Card } from "./Card";

export function StatCard({
  label,
  value,
  icon,
  iconBg = "#edf4ff",
  iconColor = "#1769ff",
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  subtitle?: string;
}) {
  return (
    <Card className="flex items-center gap-4 min-h-[108px]">
      <div
        className="w-[54px] h-[54px] rounded-[13px] flex items-center justify-center text-2xl flex-shrink-0"
        style={{ background: iconBg, color: iconColor }}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1.5">{label}</h3>
        <strong className="text-[27px] leading-none font-bold text-ums-text block">{value}</strong>
        {subtitle && <p className="text-xs text-slate-500 mt-1.5">{subtitle}</p>}
      </div>
    </Card>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  const count = React.Children.count(children);
  const cols = count >= 5 ? "sm:grid-cols-2 lg:grid-cols-5" : count === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return <div className={`grid grid-cols-1 ${cols} gap-4`}>{children}</div>;
}
