"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { PriorityBadge } from "@/components/ui/Badge";

interface DashboardStats {
  scope: "ALL" | "SELF_AND_DEPARTMENT";
  totals: Record<string, number>;
  unfinishedTasks: number;
  unreadCount: number;
  categoryBreakdown: { categoryId: string; categoryName: string; count: number }[];
  departmentBreakdown: { departmentId: string | null; departmentName: string | null; count: number }[];
  trend: { month: string; count: number }[];
  waitingApprovalPreview: { id: string; title: string; memoNumber: string | null; priority: string; authorName: string }[];
  recentActivity: {
    id: string;
    memoId: string;
    memoTitle: string;
    memoNumber: string | null;
    fromStatus: string | null;
    toStatus: string;
    createdAt: string;
  }[];
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "Mei", "06": "Jun",
  "07": "Jul", "08": "Agu", "09": "Sep", "10": "Okt", "11": "Nov", "12": "Des",
};

function pct(part: number, total: number): string {
  const value = total === 0 ? 0 : (part / total) * 100;
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}% dari total`;
}

function DonutChart({ totals, total }: { totals: Record<string, number>; total: number }) {
  const segments = [
    { key: "APPROVED", color: "#18a866" },
    { key: "WAITING_APPROVAL", color: "#ff9416" },
    { key: "REJECTED", color: "#ed1c24" },
  ];

  let cursor = 0;
  const stops: string[] = [];
  for (const seg of segments) {
    const value = totals[seg.key] ?? 0;
    const start = cursor;
    const end = cursor + (total > 0 ? (value / total) * 100 : 0);
    stops.push(`${seg.color} ${start}% ${end}%`);
    cursor = end;
  }
  stops.push(`#9ca3af ${cursor}% 100%`);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="w-[190px] h-[190px] rounded-full relative"
        style={{ background: `conic-gradient(${stops.join(",")})` }}
        role="img"
        aria-label={`Distribusi status memo dari total ${total}`}
      >
        <div className="absolute inset-[45px] bg-white rounded-full flex flex-col items-center justify-center text-center">
          <span className="text-xs text-slate-500">Total</span>
          <strong className="text-lg">{total.toLocaleString("id-ID")}</strong>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3 text-xs">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            {s.key === "APPROVED" ? "Disetujui" : s.key === "WAITING_APPROVAL" ? "Menunggu" : "Ditolak"}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          Lainnya
        </span>
      </div>
    </div>
  );
}

function TrendChart({ trend }: { trend: { month: string; count: number }[] }) {
  if (trend.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-16">Belum ada data tren</p>;
  }
  const max = Math.max(1, ...trend.map((t) => t.count));
  return (
    <div className="h-[220px] flex items-end gap-3 md:gap-4 px-2 pb-6 pt-4 border-l border-b border-ums-border">
      {trend.map((t) => {
        const [, m] = t.month.split("-");
        const heightPx = Math.max(4, Math.round((t.count / max) * 170));
        return (
          <div key={t.month} className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="text-[11px] text-slate-500 mb-1">{t.count}</span>
            <div
              className="w-full rounded-t-md"
              style={{ height: `${heightPx}px`, background: "linear-gradient(#2e79ff,#7db4ff)" }}
              title={`${t.month}: ${t.count} memo`}
            />
            <span className="text-[10px] text-slate-500 mt-1.5">{MONTH_LABELS[m] ?? m}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
      const res = await apiClient<DashboardStats>("/dashboard");
      setLoading(false);
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        setErrorMsg(res.error?.message || "Gagal memuat dashboard");
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-slate-500 text-sm">Memuat dashboard...</div>;
  }

  if (errorMsg || !stats) {
    return (
      <div className="bg-red-50 text-red-700 text-sm p-4 rounded border border-red-200">
        {errorMsg || "Data dashboard tidak tersedia"}
      </div>
    );
  }

  const totalMemo = Object.values(stats.totals).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <StatGrid>
        <StatCard label="Total Memo" value={totalMemo.toLocaleString("id-ID")} icon="▣" subtitle="Semua memo" />
        <StatCard
          label="Menunggu Persetujuan"
          value={stats.totals.WAITING_APPROVAL ?? 0}
          icon="◷"
          iconBg="#fff0dd"
          iconColor="#ff9416"
          subtitle={pct(stats.totals.WAITING_APPROVAL ?? 0, totalMemo)}
        />
        <StatCard
          label="Disetujui"
          value={stats.totals.APPROVED ?? 0}
          icon="✓"
          iconBg="#e5f7ed"
          iconColor="#15a866"
          subtitle={pct(stats.totals.APPROVED ?? 0, totalMemo)}
        />
        <StatCard
          label="Ditolak"
          value={stats.totals.REJECTED ?? 0}
          icon="✕"
          iconBg="#fde7e8"
          iconColor="#ed1c24"
          subtitle={pct(stats.totals.REJECTED ?? 0, totalMemo)}
        />
        <StatCard
          label="Draft"
          value={stats.totals.DRAFT ?? 0}
          icon="✎"
          iconBg="#eef1f5"
          iconColor="#5d6675"
          subtitle={pct(stats.totals.DRAFT ?? 0, totalMemo)}
        />
      </StatGrid>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHead title="Statistik Memo per Bulan" />
            <TrendChart trend={stats.trend} />
          </Card>
          <Card>
            <CardHead title="Statistik Status Memo" />
            <DonutChart totals={stats.totals} total={totalMemo} />
          </Card>
        </div>

        <Card>
          <CardHead title="Menunggu Persetujuan" />
          {stats.waitingApprovalPreview.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Tidak ada memo menunggu persetujuan</p>
          ) : (
            <div className="grid gap-2.5">
              {stats.waitingApprovalPreview.map((m) => (
                <Link
                  key={m.id}
                  href={`/memos/${m.id}`}
                  className="border border-ums-border rounded-lg p-2.5 flex justify-between items-center gap-2 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <b className="block text-sm text-ums-text truncate">{m.authorName}</b>
                    <small className="block text-slate-500 text-xs truncate">{m.memoNumber || m.title}</small>
                  </div>
                  <PriorityBadge priority={m.priority} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHead title="Aktivitas Terbaru" />
        {stats.recentActivity.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Belum ada aktivitas</p>
        ) : (
          <div className="grid gap-2">
            {stats.recentActivity.map((a) => (
              <div key={a.id} className="border border-ums-border rounded-lg p-2.5 flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <Link href={`/memos/${a.memoId}`} className="text-ums-blue font-medium hover:underline text-sm">
                    {a.memoNumber || a.memoTitle}
                  </Link>
                  <span className="text-xs text-slate-500 ml-2">
                    {a.fromStatus ? `${a.fromStatus} → ${a.toStatus}` : a.toStatus}
                  </span>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{new Date(a.createdAt).toLocaleString("id-ID")}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
