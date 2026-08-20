"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { TaskStatusBadge } from "@/components/ui/Badge";

interface TaskItem {
  id: string;
  title: string;
  instruction: string;
  priority: string;
  status: string;
  progress: number;
  deadline?: string | null;
  disposition?: {
    memo?: { id: string; title: string; memoNumber?: string };
  };
}

export default function AssignedTasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [newProgress, setNewProgress] = useState<number>(0);

  useEffect(() => {
    async function loadTasks() {
      const res = await apiClient<TaskItem[]>("/tasks/assigned");
      setLoading(false);
      if (res.success && res.data) {
        setTasks(res.data);
      } else {
        setErrorMsg(res.error?.message || "Gagal memuat tugas disposisi");
      }
    }
    loadTasks();
  }, []);

  const handleUpdateProgress = async (taskId: string, targetProgress: number, targetStatus: string) => {
    const res = await apiClient(`/tasks/${taskId}/progress`, {
      method: "PATCH",
      body: JSON.stringify({
        progress: targetProgress,
        status: targetStatus,
        comment: `Progres diperbarui ke ${targetProgress}%`,
      }),
    });

    if (res.success) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, progress: targetProgress, status: targetStatus } : t))
      );
      setUpdatingTaskId(null);
    } else {
      alert(res.error?.message || "Gagal memperbarui progres tugas");
    }
  };

  return (
    <Card>
      <CardHead title="Tugas Disposisi Saya" />
      <p className="text-xs text-slate-500 -mt-2 mb-4">Daftar instruksi disposisi memo yang ditugaskan kepada Anda</p>

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat tugas disposisi...</div>
      ) : (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-10 text-slate-400 border border-dashed border-ums-border rounded-lg text-sm">
              Tidak ada tugas disposisi yang ditugaskan kepada Anda saat ini.
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="border border-ums-border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2 gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-ums-blue font-bold bg-[#e8f1ff] px-2 py-0.5 rounded">
                      Memo: {task.disposition?.memo?.memoNumber || "PUBLISHED"}
                    </span>
                    <h2 className="text-base font-bold text-ums-text mt-1">{task.title}</h2>
                    <p className="text-xs text-slate-600 mt-1">{task.instruction}</p>
                  </div>
                  <TaskStatusBadge status={task.status} />
                </div>

                <div className="mt-4 pt-3 border-t border-ums-border flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600">Progres:</span>
                    <div className="w-32 bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-ums-blue h-full" style={{ width: `${task.progress}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{task.progress}%</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {updatingTaskId === task.id ? (
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-ums-border">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="10"
                          value={newProgress}
                          onChange={(e) => setNewProgress(Number(e.target.value))}
                          className="w-24"
                        />
                        <span className="text-xs font-bold w-8">{newProgress}%</span>
                        <button
                          onClick={() => handleUpdateProgress(task.id, newProgress, newProgress === 100 ? "WAITING_VERIFICATION" : "IN_PROGRESS")}
                          className="bg-ums-green text-white text-xs px-2.5 py-1.5 rounded-md font-bold"
                        >
                          Simpan
                        </button>
                        <button onClick={() => setUpdatingTaskId(null)} className="text-xs text-slate-500 hover:text-slate-800">
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setUpdatingTaskId(task.id);
                          setNewProgress(task.progress);
                        }}
                        className="bg-ums-blue hover:opacity-90 text-white text-xs font-bold px-3 py-1.5 rounded-md transition"
                      >
                        Update Progres
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
