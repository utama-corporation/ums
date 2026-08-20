"use client";

import React, { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { MemoStatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { TablePagination } from "@/components/ui/Pagination";

interface SearchResultItem {
  id: string;
  title: string;
  memoNumber: string | null;
  status: string;
  priority: string;
  classification: string;
  category?: { name: string };
}

interface SearchMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_OPTIONS = [
  "DRAFT", "SUBMITTED", "WAITING_APPROVAL", "REVISION", "REJECTED",
  "CANCELLED", "APPROVED", "OUTBOX", "PUBLISHED", "ARCHIVED",
];

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searched, setSearched] = useState(false);

  async function runSearch(page = 1) {
    setLoading(true);
    setErrorMsg("");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    params.set("page", String(page));
    params.set("limit", "20");

    const res = await apiClient<SearchResultItem[]>(`/search?${params.toString()}`);
    setLoading(false);
    setSearched(true);
    if (res.success && res.data) {
      setResults(res.data);
      setMeta(res.meta as SearchMeta);
    } else {
      setErrorMsg(res.error?.message || "Pencarian gagal");
      setResults([]);
    }
  }

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(1);
        }}
        className="grid md:grid-cols-4 gap-3 mb-6 items-end"
      >
        <div className="md:col-span-2">
          <label className="block text-xs font-bold mb-1.5">Pencarian</label>
          <input
            type="text"
            placeholder="Cari judul atau nomor memo..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1.5">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm">
            <option value="">Semua Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1.5">Prioritas</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm">
            <option value="">Semua Prioritas</option>
            <option value="NORMAL">Normal</option>
            <option value="IMPORTANT">Penting</option>
            <option value="URGENT">Mendesak</option>
            <option value="CRITICAL">Kritis</option>
          </select>
        </div>
        <button type="submit" className="bg-ums-red hover:opacity-90 text-white font-bold px-4 py-2.5 rounded-md text-sm transition md:col-span-4">
          Cari
        </button>
      </form>

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Mencari...</div>
      ) : !searched ? (
        <div className="text-center py-10 text-slate-400 text-sm">Masukkan kata kunci atau filter untuk mulai mencari.</div>
      ) : results.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">Tidak ada memo yang cocok dengan pencarian.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-ums-border bg-slate-50 text-slate-700">
                  <th className="p-3">Nomor Memo</th>
                  <th className="p-3">Judul</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Prioritas</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-b border-ums-border hover:bg-slate-50">
                    <td className="p-3 text-slate-600">{r.memoNumber || "-"}</td>
                    <td className="p-3 font-medium">
                      <Link href={`/memos/${r.id}`} className="text-ums-text hover:text-ums-blue hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td className="p-3 text-slate-600">{r.category?.name || "-"}</td>
                    <td className="p-3">
                      <MemoStatusBadge status={r.status} />
                    </td>
                    <td className="p-3">
                      <PriorityBadge priority={r.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && <TablePagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onChange={runSearch} />}
        </>
      )}
    </Card>
  );
}
