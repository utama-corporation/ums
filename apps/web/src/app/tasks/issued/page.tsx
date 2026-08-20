"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { TaskStatusBadge } from "@/components/ui/Badge";

interface DispositionItem {
  id: string;
  instruction: string;
  createdAt: string;
  memo?: { id: string; title: string; memoNumber?: string };
  tasks: {
    id: string;
    title: string;
    status: string;
    progress: number;
  }[];
}

export default function IssuedDispositionsPage() {
  const [dispositions, setDispositions] = useState<DispositionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadIssuedDispositions() {
      const res = await apiClient<DispositionItem[]>("/tasks/issued");
      setLoading(false);
      if (res.success && res.data) {
        setDispositions(res.data);
      } else {
        setErrorMsg(res.error?.message || "Gagal memuat disposisi yang dikeluarkan");
      }
    }
    loadIssuedDispositions();
  }, []);

  const handleVerify = async (taskId: string, action: "APPROVE_COMPLETED" | "REJECT_REWORK") => {
    const res = await apiClient(`/tasks/${taskId}/verify`, {
      method: "POST",
      body: JSON.stringify({ action, comment: action === "APPROVE_COMPLETED" ? "Verifikasi disetujui" : "Diminta perbaikan ulang" }),
    });

    if (res.success) {
      alert("Status verifikasi tugas berhasil diperbarui");
      window.location.reload();
    } else {
      alert(res.error?.message || "Gagal memverifikasi tugas");
    }
  };

  return (
    <Card>
      <CardHead title="Monitoring Disposisi Dikeluarkan" />
      <p className="text-xs text-slate-500 -mt-2 mb-4">Pantau progres dan lakukan verifikasi tugas disposisi yang Anda terbitkan</p>

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat monitoring disposisi...</div>
      ) : (
        <div className="space-y-3">
          {dispositions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 border border-dashed border-ums-border rounded-lg text-sm">
              Belum ada instruksi disposisi yang Anda terbitkan.
            </div>
          ) : (
            dispositions.map((disp) => (
              <div key={disp.id} className="border border-ums-border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2 gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-ums-blue font-bold bg-[#e8f1ff] px-2 py-0.5 rounded">
                      Memo: {disp.memo?.memoNumber || "PUBLISHED"}
                    </span>
                    <h2 className="text-base font-bold text-ums-text mt-1">{disp.memo?.title}</h2>
                    <p className="text-xs text-slate-600 mt-1">Instruksi: {disp.instruction}</p>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0">{new Date(disp.createdAt).toLocaleDateString("id-ID")}</span>
                </div>

                <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-ums-border space-y-2">
                  <div className="text-xs font-bold text-slate-700 mb-1">Daftar Sub-Tugas Disposisi:</div>
                  {disp.tasks.map((t) => (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-2 border-b border-ums-border last:border-b-0 text-xs">
                      <div>
                        <span className="font-semibold text-ums-text">{t.title}</span>
                        <div className="text-slate-500">Progres: {t.progress}%</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TaskStatusBadge status={t.status} />
                        {t.status === "WAITING_VERIFICATION" && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleVerify(t.id, "APPROVE_COMPLETED")}
                              className="bg-ums-green text-white px-2 py-1 rounded font-bold"
                            >
                              Verifikasi Selesai
                            </button>
                            <button
                              onClick={() => handleVerify(t.id, "REJECT_REWORK")}
                              className="bg-ums-orange text-white px-2 py-1 rounded font-bold"
                            >
                              Minta Perbaikan
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
