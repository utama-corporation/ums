import React from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-ums-border rounded-xl shadow-[0_4px_14px_rgba(20,35,60,0.04)] p-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardHead({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center mb-3">
      <h2 className="text-[17px] font-bold text-ums-text m-0">{title}</h2>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
