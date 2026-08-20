"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { Card } from "@/components/ui/Card";

export default function ApprovalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.id as string;

  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const handleAction = async (actionType: "approve" | "reject" | "request-revision") => {
    setLoading(true);
    setErrorMsg("");
    setActionSuccess("");

    if ((actionType === "reject" || actionType === "request-revision") && !reason) {
      setErrorMsg("Alasan (reason) wajib diisi untuk penolakan atau permintaan revisi.");
      setLoading(false);
      return;
    }

    const endpoint = `/approval-assignments/${assignmentId}/${actionType}`;
    const res = await apiClient(endpoint, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });

    setLoading(false);

    if (res.success) {
      setActionSuccess(`Tindakan ${actionType.toUpperCase()} berhasil diproses.`);
      setTimeout(() => {
        router.push("/approvals/inbox");
      }, 1500);
    } else {
      setErrorMsg(res.error?.message || "Gagal memproses keputusan approval.");
    }
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-5 pb-4 border-b border-ums-border">
        <div>
          <h1 className="text-xl font-bold text-ums-text">Detail Persetujuan Memo</h1>
          <p className="text-xs text-slate-500">ID Assignment: {assignmentId}</p>
        </div>
        <button
          onClick={() => router.push("/approvals/inbox")}
          className="text-xs text-slate-600 border border-ums-border px-3 py-1.5 rounded-md font-bold"
        >
          &larr; Kembali ke Inbox
        </button>
      </div>

      {actionSuccess && <div className="bg-[#e5f7ed] text-[#10834d] text-sm p-4 rounded-lg border border-[#c5ecd6] mb-5">{actionSuccess}</div>}
      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-4 rounded border border-red-200 mb-5">{errorMsg}</div>}

      <div className="bg-slate-50 p-4 rounded-lg border border-ums-border">
        <h2 className="text-sm font-bold text-slate-700 mb-2">Form Keputusan Approver</h2>
        <label className="block text-xs font-bold mb-1.5">Catatan / Alasan Keputusan (Wajib untuk Reject &amp; Revisi)</label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full p-2.5 border border-ums-border rounded-md text-sm bg-white mb-4"
          placeholder="Tuliskan catatan persetujuan, saran revisi, atau alasan penolakan..."
        />

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleAction("approve")}
            disabled={loading}
            className="bg-ums-green text-white font-bold px-4 py-2 rounded-md text-sm transition disabled:opacity-50"
          >
            Setujui Memo
          </button>
          <button
            onClick={() => handleAction("request-revision")}
            disabled={loading}
            className="bg-ums-orange text-white font-bold px-4 py-2 rounded-md text-sm transition disabled:opacity-50"
          >
            Minta Revisi
          </button>
          <button
            onClick={() => handleAction("reject")}
            disabled={loading}
            className="bg-ums-red text-white font-bold px-4 py-2 rounded-md text-sm transition disabled:opacity-50"
          >
            Tolak Memo
          </button>
        </div>
      </div>
    </Card>
  );
}
