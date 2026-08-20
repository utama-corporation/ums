"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { MemoStatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { TablePagination } from "@/components/ui/Pagination";

interface MemoListItem {
  id: string;
  memoNumber: string | null;
  title: string;
  priority: string;
  status: string;
  updatedAt: string;
  category?: { name: string } | null;
  memoType?: { name: string } | null;
  senders: { displayName: string }[];
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function MemoStatusListView({
  status,
  emptyMessage,
  onRestore,
}: {
  status: string;
  emptyMessage: string;
  onRestore?: (id: string) => Promise<void>;
}) {
  const [memos, setMemos] = useState<MemoListItem[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  async function load(page = 1) {
    setLoading(true);
    const params = new URLSearchParams({ status, page: String(page), limit: "10" });
    if (search) params.set("search", search);
    const res = await apiClient<MemoListItem[]>(`/memos?${params.toString()}`);
    setLoading(false);
    if (res.success && res.data) {
      setMemos(res.data);
      setMeta(res.meta as Meta);
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat daftar memo");
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleRestore(id: string) {
    if (!onRestore) return;
    setActionMsg("");
    try {
      await onRestore(id);
      setActionMsg("Memo berhasil dipulihkan dari arsip.");
      load(meta?.page ?? 1);
    } catch {
      setActionMsg("Gagal memulihkan memo.");
    }
  }

  return (
    <Card>
      <CardHead
        title="Daftar Memo"
        actions={
          <>
            <button onClick={() => window.print()} className="bg-white border border-ums-border rounded-md px-3 py-1.5 text-xs font-bold">
              Cetak
            </button>
          </>
        }
      />

      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(1)}
          placeholder="Cari nomor / judul memo"
          className="flex-1 border border-ums-border rounded-md px-3 py-2 text-sm"
          aria-label="Cari memo"
        />
        <button onClick={() => load(1)} className="bg-ums-red text-white rounded-md px-4 py-2 text-sm font-bold">
          Filter
        </button>
      </div>

      {actionMsg && <div className="bg-sky-50 text-sky-700 text-sm p-3 rounded border border-sky-200 mb-3">{actionMsg}</div>}
      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-3">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-ums-border bg-slate-50 text-slate-700">
                <th className="p-3">No.</th>
                <th className="p-3">Nomor Memo</th>
                <th className="p-3">Judul</th>
                <th className="p-3">Pengirim</th>
                <th className="p-3">Prioritas</th>
                <th className="p-3">Status</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {memos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 border-b border-ums-border">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                memos.map((m, i) => (
                  <tr key={m.id} className="border-b border-ums-border hover:bg-slate-50">
                    <td className="p-3">{((meta?.page ?? 1) - 1) * (meta?.limit ?? 10) + i + 1}</td>
                    <td className="p-3 font-bold">{m.memoNumber || "-"}</td>
                    <td className="p-3">
                      <Link href={`/memos/${m.id}`} className="text-ums-text hover:text-ums-blue hover:underline">
                        {m.title}
                      </Link>
                    </td>
                    <td className="p-3 text-slate-600">{m.senders.map((s) => s.displayName).join(", ") || "-"}</td>
                    <td className="p-3">
                      <PriorityBadge priority={m.priority} />
                    </td>
                    <td className="p-3">
                      <MemoStatusBadge status={m.status} />
                    </td>
                    <td className="p-3 text-slate-500 text-xs">{new Date(m.updatedAt).toLocaleString("id-ID")}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Link href={`/memos/${m.id}`} className="bg-white border border-ums-border rounded-md px-3 py-1.5 text-xs font-bold">
                          Lihat
                        </Link>
                        {onRestore && (
                          <button
                            onClick={() => handleRestore(m.id)}
                            className="bg-white border border-ums-border rounded-md px-3 py-1.5 text-xs font-bold text-ums-blue"
                          >
                            Pulihkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {meta && <TablePagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onChange={load} />}
    </Card>
  );
}
