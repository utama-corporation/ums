"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface InboxMemoItem {
  id: string;
  memoNumber?: string;
  title: string;
  priority: string;
  classification: string;
  updatedAt: string;
  isRead: boolean;
  firstReadAt?: string | null;
  category?: { name: string };
  memoType?: { name: string };
  senders: { displayName: string }[];
}

export default function MemoInboxPage() {
  const [memos, setMemos] = useState<InboxMemoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadInbox() {
      const res = await apiClient<InboxMemoItem[]>("/memos/inbox");
      setLoading(false);
      if (res.success && res.data) {
        setMemos(res.data);
      } else {
        setErrorMsg(res.error?.message || "Gagal memuat inbox memo");
      }
    }
    loadInbox();
  }, []);

  return (
    <Card>
      <CardHead title="Inbox Memo Masuk" />
      <p className="text-xs text-slate-500 -mt-2 mb-4">Daftar memo resmi yang didistribusikan ke Anda atau Departemen Anda</p>

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat inbox memo...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-ums-border bg-slate-50 text-slate-700">
                <th className="p-3">Nomor Memo</th>
                <th className="p-3">Judul Memo</th>
                <th className="p-3">Pengirim</th>
                <th className="p-3">Klasifikasi</th>
                <th className="p-3">Status Dibaca</th>
                <th className="p-3">Tanggal Diterima</th>
              </tr>
            </thead>
            <tbody>
              {memos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 border-b border-ums-border">
                    Belum ada memo yang diterima di inbox Anda.
                  </td>
                </tr>
              ) : (
                memos.map((m) => (
                  <tr key={m.id} className={`border-b border-ums-border hover:bg-slate-50 ${!m.isRead ? "bg-blue-50/40 font-semibold" : ""}`}>
                    <td className="p-3 font-bold text-ums-blue">{m.memoNumber || "DRAFT"}</td>
                    <td className="p-3 text-ums-text">
                      <Link href={`/memos/${m.id}`} className="hover:underline hover:text-ums-blue">
                        {m.title}
                      </Link>
                    </td>
                    <td className="p-3 text-slate-600">{m.senders.map((s) => s.displayName).join(", ")}</td>
                    <td className="p-3">
                      <Badge label={m.classification} color="blue" />
                    </td>
                    <td className="p-3">{m.isRead ? <Badge label="Dibaca" color="green" /> : <Badge label="Belum Dibaca" color="orange" />}</td>
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
