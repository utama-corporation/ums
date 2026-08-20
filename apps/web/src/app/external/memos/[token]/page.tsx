"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api";

interface ExternalMemoData {
  memoNumber?: string;
  title: string;
  memoDate: string;
  categoryName: string;
  typeName: string;
  priority: string;
  classification: string;
  bodyHtml: string;
  senders: string[];
  attachments: { id: string; fileName: string; size: number }[];
}

export default function ExternalMemoPage() {
  const params = useParams();
  const token = params.token as string;

  const [memo, setMemo] = useState<ExternalMemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadExternalMemo() {
      const res = await apiClient<ExternalMemoData>(`/external/memos/access/${token}`);
      setLoading(false);
      if (res.success && res.data) {
        setMemo(res.data);
      } else {
        setErrorMsg(res.error?.message || "Tautan akses memo eksternal tidak valid atau telah kadaluarsa.");
      }
    }
    loadExternalMemo();
  }, [token]);

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Memuat akses memo eksternal...</div>;
  }

  if (errorMsg || !memo) {
    return (
      <div className="bg-red-50 p-8 rounded-lg border border-red-200 text-center max-w-lg mx-auto my-12 text-red-900">
        <h2 className="text-xl font-bold mb-2">Akses Ditolak</h2>
        <p className="text-sm text-red-700">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 max-w-3xl mx-auto my-8">
      <div className="border-b pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-mono text-sky-800 font-bold bg-sky-50 px-2.5 py-1 rounded border border-sky-200">
              {memo.memoNumber || "PUBLISHED"}
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-3">{memo.title}</h1>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>{new Date(memo.memoDate).toLocaleDateString("id-ID")}</div>
            <div className="font-semibold text-slate-700 mt-1">{memo.categoryName}</div>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-600">
          <strong>Pengirim:</strong> {memo.senders.join(", ")}
        </div>
      </div>

      <div
        className="prose max-w-none text-slate-800 text-sm leading-relaxed mb-8 min-h-[200px]"
        dangerouslySetInnerHTML={{ __html: memo.bodyHtml }}
      />

      {memo.attachments.length > 0 && (
        <div className="border-t pt-4">
          <h3 className="text-xs font-bold text-slate-700 mb-2">Lampiran Dokumen:</h3>
          <ul className="space-y-1">
            {memo.attachments.map((att) => (
              <li key={att.id} className="text-xs text-sky-700 flex items-center space-x-2">
                <span>&bull; {att.fileName}</span>
                <span className="text-slate-400">({Math.round(att.size / 1024)} KB)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
