"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export default function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function refreshUnreadCount() {
    const res = await apiClient<{ unreadCount: number }>("/notifications/unread-count");
    if (res.success && res.data) setUnreadCount(res.data.unreadCount);
  }

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      const res = await apiClient<NotificationItem[]>("/notifications?limit=8");
      setLoading(false);
      if (res.success && res.data) setItems(res.data);
    }
  }

  async function handleItemClick(item: NotificationItem) {
    setOpen(false);
    if (!item.isRead) {
      apiClient(`/notifications/${item.id}/read`, { method: "POST" });
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (item.link) router.push(item.link);
  }

  async function handleMarkAllRead() {
    await apiClient("/notifications/read-all", { method: "POST" });
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  return (
    <div className="relative">
      <button onClick={toggleOpen} className="relative text-xl" aria-label={`${unreadCount} notifikasi belum dibaca`} aria-haspopup="menu" aria-expanded={open}>
        🔔
        {!!unreadCount && (
          <i className="not-italic absolute -right-2 -top-2 bg-ums-red text-white rounded-full px-1.5 text-[10px] font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </i>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-80 bg-white border border-ums-border rounded-lg shadow-lg text-sm z-20 max-h-[420px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <b className="text-ums-text">Notifikasi</b>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-ums-blue font-bold">
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="text-center py-8 text-slate-400 text-xs">Memuat...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">Belum ada notifikasi.</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`w-full text-left px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 ${!n.isRead ? "bg-[#fff7f7]" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-ums-red flex-shrink-0" />}
                    <div className={n.isRead ? "pl-3.5" : ""}>
                      <p className="font-bold text-ums-text text-xs">{n.title}</p>
                      <p className="text-slate-600 text-xs line-clamp-2">{n.message}</p>
                      <p className="text-slate-400 text-[10px] mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <Link href="/notifications" onClick={() => setOpen(false)} className="block text-center text-xs font-bold text-ums-blue py-2.5 border-t border-slate-100">
            Lihat Semua
          </Link>
        </div>
      )}
    </div>
  );
}
