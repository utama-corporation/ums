"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";

interface OutboxMemoItem {
  id: string;
  memoNumber?: string;
  title: string;
  updatedAt: string;
  readStats: {
    totalRecipients: number;
    readCount: number;
    unreadCount: number;
    readPercentage: number;
  };
}

export default function MemoOutboxPage() {
  const [memos, setMemos] = useState<OutboxMemoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadOutbox() {
      const res = await apiClient<OutboxMemoItem[]>("/memos/outbox");
      setLoading(false);
      if (res.success && res.data) {
        setMemos(res.data);
      } else {
        setErrorMsg(res.error?.message || "Gagal memuat outbox memo");
      }
    }
    loadOutbox();
  }, []);

  return (
    <Card>
      <CardHead title="Outbox Memo Terkirim" />
      <p className="text-xs text-slate-500 -mt-2 mb-4">Pantau status pengiriman dan tanda terima baca (read receipts)</p>

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat outbox memo...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-ums-border bg-slate-50 text-slate-700">
                <th className="p-3">Nomor Memo</th>
                <th className="p-3">Judul Memo</th>
                <th className="p-3">Total Penerima</th>
                <th className="p-3">Progres Dibaca</th>
                <th className="p-3">Tanggal Distribusi</th>
              </tr>
            </thead>
            <tbody>
              {memos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 border-b border-ums-border">
                    Belum ada memo terdistribusi di outbox Anda.
                  </td>
                </tr>
              ) : (
                memos.map((m) => (
                  <tr key={m.id} className="border-b border-ums-border hover:bg-slate-50">
                    <td className="p-3 font-bold text-ums-blue">{m.memoNumber || "-"}</td>
                    <td className="p-3 font-medium text-ums-text">{m.title}</td>
                    <td className="p-3 text-slate-600">{m.readStats.totalRecipients} Penerima</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div className="bg-ums-green h-full" style={{ width: `${m.readStats.readPercentage}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700">
                          {m.readStats.readCount}/{m.readStats.totalRecipients} ({m.readStats.readPercentage}%)
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-500 text-xs">{new Date(m.updatedAt).toLocaleString("id-ID")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
