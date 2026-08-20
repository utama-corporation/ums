"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { TablePagination } from "@/components/ui/Pagination";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Meta {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  async function load(page = 1) {
    setLoading(true);
    const res = await apiClient<NotificationItem[]>(`/notifications?page=${page}&limit=20`);
    setLoading(false);
    if (res.success && res.data) {
      setItems(res.data);
      if (res.meta) setMeta({ page: res.meta.page || 1, totalPages: res.meta.totalPages || 1, total: res.meta.total || 0, limit: res.meta.limit || 20 });
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat notifikasi");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleClick(item: NotificationItem) {
    if (!item.isRead) {
      await apiClient(`/notifications/${item.id}/read`, { method: "POST" });
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
    }
    if (item.link) router.push(item.link);
  }

  async function handleMarkAllRead() {
    await apiClient("/notifications/read-all", { method: "POST" });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  const hasUnread = items.some((n) => !n.isRead);

  return (
    <Card>
      <CardHead
        title="Notifikasi"
        actions={
          hasUnread ? (
            <button onClick={handleMarkAllRead} className="text-sm font-bold text-ums-blue">
              Tandai semua dibaca
            </button>
          ) : undefined
        }
      />

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">Belum ada notifikasi.</div>
      ) : (
        <div className="divide-y divide-ums-border">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left px-2 py-3.5 hover:bg-slate-50 flex items-start gap-3 ${!n.isRead ? "bg-[#fff7f7]" : ""}`}
            >
              {!n.isRead && <span className="mt-2 w-2 h-2 rounded-full bg-ums-red flex-shrink-0" />}
              <div className={n.isRead ? "pl-5" : ""}>
                <p className="font-bold text-ums-text text-sm">{n.title}</p>
                <p className="text-slate-600 text-sm">{n.message}</p>
                <p className="text-slate-400 text-xs mt-1">{new Date(n.createdAt).toLocaleString("id-ID")}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <TablePagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onChange={load} />
      )}
    </Card>
  );
}
