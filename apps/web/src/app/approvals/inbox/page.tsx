"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { PriorityBadge } from "@/components/ui/Badge";

interface AssignmentItem {
  id: string;
  assignedAt: string;
  workflowStep: {
    name: string;
    stepOrder: number;
    workflowInstance: {
      memo: {
        id: string;
        title: string;
        priority: string;
        classification: string;
        category?: { name: string };
        memoType?: { name: string };
        senders: { displayName: string }[];
      };
    };
  };
}

export default function ApprovalsInboxPage() {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadInbox() {
      const res = await apiClient<AssignmentItem[]>("/approvals/inbox");
      setLoading(false);
      if (res.success && res.data) {
        setAssignments(res.data);
      } else {
        setErrorMsg(res.error?.message || "Gagal memuat inbox persetujuan");
      }
    }
    loadInbox();
  }, []);

  return (
    <Card>
      <CardHead title="Inbox Menunggu Persetujuan" />
      <p className="text-xs text-slate-500 -mt-2 mb-4">Daftar memo yang memerlukan tindakan persetujuan (approval) Anda</p>

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat inbox...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-ums-border bg-slate-50 text-slate-700">
                <th className="p-3">Judul Memo</th>
                <th className="p-3">Pengirim</th>
                <th className="p-3">Tahap Approval</th>
                <th className="p-3">Prioritas</th>
                <th className="p-3">Waktu Ditugaskan</th>
                <th className="p-3">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 border-b border-ums-border">
                    Tidak ada memo yang menunggu persetujuan Anda saat ini.
                  </td>
                </tr>
              ) : (
                assignments.map((item) => {
                  const memo = item.workflowStep.workflowInstance.memo;
                  return (
                    <tr key={item.id} className="border-b border-ums-border hover:bg-slate-50">
                      <td className="p-3 font-medium text-ums-text">{memo.title}</td>
                      <td className="p-3 text-slate-600">{memo.senders.map((s) => s.displayName).join(", ")}</td>
                      <td className="p-3 font-semibold text-ums-blue text-xs">
                        Step {item.workflowStep.stepOrder}: {item.workflowStep.name}
                      </td>
                      <td className="p-3">
                        <PriorityBadge priority={memo.priority} />
                      </td>
                      <td className="p-3 text-slate-500 text-xs">{new Date(item.assignedAt).toLocaleString("id-ID")}</td>
                      <td className="p-3">
                        <Link
                          href={`/approvals/${item.id}`}
                          className="bg-ums-blue hover:opacity-90 text-white font-bold px-3 py-1.5 rounded-md text-xs transition"
                        >
                          Review &amp; Tindak Lanjut
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
