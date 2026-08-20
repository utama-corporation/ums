"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface WorkflowStepItem {
  id: string;
  stepOrder: number;
  name: string;
  mode: string;
  approverRules: { strategy: string; targetId: string | null }[];
}

interface WorkflowVersionItem {
  id: string;
  versionNumber: number;
  status: string;
  steps: WorkflowStepItem[];
}

interface WorkflowItem {
  id: string;
  name: string;
  description?: string | null;
  versions: WorkflowVersionItem[];
}

interface SimpleOption {
  id: string;
  name: string;
}

type Strategy = "USER" | "ROLE" | "DEPARTMENT_HEAD" | "MANAGER_OF_REQUESTER";

interface ApproverRuleForm {
  strategy: Strategy;
  targetId: string;
}

interface StepForm {
  name: string;
  mode: "SEQUENTIAL" | "PARALLEL";
  parallelPolicy: "ALL" | "ANY" | "QUORUM";
  requireSignature: boolean;
  slaHours: string;
  approverRules: ApproverRuleForm[];
}

function newStep(): StepForm {
  return {
    name: "",
    mode: "SEQUENTIAL",
    parallelPolicy: "ALL",
    requireSignature: false,
    slaHours: "",
    approverRules: [{ strategy: "DEPARTMENT_HEAD", targetId: "" }],
  };
}

const STRATEGY_LABELS: Record<Strategy, string> = {
  USER: "User Tertentu",
  ROLE: "Role Tertentu",
  DEPARTMENT_HEAD: "Kepala Departemen Pengaju",
  MANAGER_OF_REQUESTER: "Atasan Langsung Pengaju",
};

export default function MasterWorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [categories, setCategories] = useState<SimpleOption[]>([]);
  const [users, setUsers] = useState<SimpleOption[]>([]);
  const [roles, setRoles] = useState<SimpleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newSteps, setNewSteps] = useState<StepForm[]>([newStep()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [versionTarget, setVersionTarget] = useState<WorkflowItem | null>(null);
  const [versionSteps, setVersionSteps] = useState<StepForm[]>([newStep()]);

  async function loadWorkflows() {
    setLoading(true);
    const res = await apiClient<WorkflowItem[]>("/workflows");
    setLoading(false);
    if (res.success && res.data) {
      setWorkflows(res.data);
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat workflow");
    }
  }

  useEffect(() => {
    loadWorkflows();
    apiClient<SimpleOption[]>("/categories").then((res) => res.success && res.data && setCategories(res.data));
    apiClient<SimpleOption[]>("/users?limit=100").then((res) => res.success && res.data && setUsers(res.data));
    apiClient<SimpleOption[]>("/roles").then((res) => res.success && res.data && setRoles(res.data));
  }, []);

  function stepListEditor(steps: StepForm[], setSteps: (s: StepForm[]) => void) {
    function updateStep(idx: number, patch: Partial<StepForm>) {
      setSteps(steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
    }
    function updateRule(stepIdx: number, ruleIdx: number, patch: Partial<ApproverRuleForm>) {
      const step = steps[stepIdx];
      const rules = step.approverRules.map((r, i) => (i === ruleIdx ? { ...r, ...patch } : r));
      updateStep(stepIdx, { approverRules: rules });
    }

    return (
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div key={idx} className="border border-ums-border rounded-lg p-3 bg-slate-50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-ums-blue">Step {idx + 1}</span>
              {steps.length > 1 && (
                <button type="button" onClick={() => setSteps(steps.filter((_, i) => i !== idx))} className="text-xs text-red-600 font-bold">
                  Hapus Step
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                required
                placeholder="Nama step (mis. Review Atasan)"
                value={step.name}
                onChange={(e) => updateStep(idx, { name: e.target.value })}
                className="col-span-2 border border-ums-border rounded-md px-2.5 py-2 text-sm"
              />
              <select
                value={step.mode}
                onChange={(e) => updateStep(idx, { mode: e.target.value as StepForm["mode"] })}
                className="border border-ums-border rounded-md px-2.5 py-2 text-sm"
              >
                <option value="SEQUENTIAL">Sequential</option>
                <option value="PARALLEL">Parallel</option>
              </select>
              {step.mode === "PARALLEL" ? (
                <select
                  value={step.parallelPolicy}
                  onChange={(e) => updateStep(idx, { parallelPolicy: e.target.value as StepForm["parallelPolicy"] })}
                  className="border border-ums-border rounded-md px-2.5 py-2 text-sm"
                >
                  <option value="ALL">Semua harus setuju</option>
                  <option value="ANY">Salah satu cukup</option>
                  <option value="QUORUM">Mayoritas (quorum)</option>
                </select>
              ) : (
                <input
                  type="number"
                  min={0}
                  placeholder="SLA (jam, opsional)"
                  value={step.slaHours}
                  onChange={(e) => updateStep(idx, { slaHours: e.target.value })}
                  className="border border-ums-border rounded-md px-2.5 py-2 text-sm"
                />
              )}
            </div>
            <label className="flex items-center gap-2 text-xs mb-2">
              <input type="checkbox" checked={step.requireSignature} onChange={(e) => updateStep(idx, { requireSignature: e.target.checked })} />
              Wajib tanda tangan digital di step ini
            </label>

            <div className="text-xs font-bold text-slate-600 mb-1">Approver</div>
            {step.approverRules.map((rule, ruleIdx) => (
              <div key={ruleIdx} className="flex gap-2 mb-1.5">
                <select
                  value={rule.strategy}
                  onChange={(e) => updateRule(idx, ruleIdx, { strategy: e.target.value as Strategy, targetId: "" })}
                  className="flex-1 border border-ums-border rounded-md px-2.5 py-2 text-xs"
                >
                  {(Object.keys(STRATEGY_LABELS) as Strategy[]).map((s) => (
                    <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>
                  ))}
                </select>
                {rule.strategy === "USER" && (
                  <select
                    value={rule.targetId}
                    onChange={(e) => updateRule(idx, ruleIdx, { targetId: e.target.value })}
                    className="flex-1 border border-ums-border rounded-md px-2.5 py-2 text-xs"
                  >
                    <option value="">Pilih user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                )}
                {rule.strategy === "ROLE" && (
                  <select
                    value={rule.targetId}
                    onChange={(e) => updateRule(idx, ruleIdx, { targetId: e.target.value })}
                    className="flex-1 border border-ums-border rounded-md px-2.5 py-2 text-xs"
                  >
                    <option value="">Pilih role...</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}
                {step.approverRules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => updateStep(idx, { approverRules: step.approverRules.filter((_, i) => i !== ruleIdx) })}
                    className="text-red-600 text-xs font-bold px-1"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => updateStep(idx, { approverRules: [...step.approverRules, { strategy: "DEPARTMENT_HEAD", targetId: "" }] })}
              className="text-xs text-ums-blue font-bold"
            >
              + Tambah approver rule
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSteps([...steps, newStep()])}
          className="w-full border border-dashed border-ums-border rounded-lg py-2 text-xs font-bold text-slate-500"
        >
          + Tambah Step
        </button>
      </div>
    );
  }

  function stepsToPayload(steps: StepForm[]) {
    return steps.map((s, idx) => ({
      stepOrder: idx + 1,
      name: s.name,
      mode: s.mode,
      parallelPolicy: s.parallelPolicy,
      requireSignature: s.requireSignature,
      slaHours: s.slaHours ? Number(s.slaHours) : null,
      approverRules: s.approverRules.map((r) => ({ strategy: r.strategy, targetId: r.targetId || null })),
      conditions: [],
    }));
  }

  async function handleCreateWorkflow(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const res = await apiClient("/workflows", {
      method: "POST",
      body: JSON.stringify({
        name: newName,
        description: newDescription || null,
        categoryId: newCategoryId || null,
        steps: stepsToPayload(newSteps),
      }),
    });
    setSaving(false);
    if (res.success) {
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      setNewCategoryId("");
      setNewSteps([newStep()]);
      loadWorkflows();
    } else {
      setFormError(res.error?.message || "Gagal membuat workflow");
    }
  }

  async function handleCreateVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!versionTarget) return;
    setSaving(true);
    setFormError("");
    const res = await apiClient(`/workflows/${versionTarget.id}/versions`, {
      method: "POST",
      body: JSON.stringify({ steps: stepsToPayload(versionSteps) }),
    });
    setSaving(false);
    if (res.success) {
      setVersionTarget(null);
      setVersionSteps([newStep()]);
      loadWorkflows();
    } else {
      setFormError(res.error?.message || "Gagal membuat versi baru");
    }
  }

  async function activateVersion(versionId: string) {
    setActionMsg("");
    const res = await apiClient(`/workflows/versions/${versionId}/activate`, { method: "POST" });
    if (res.success) {
      setActionMsg("Versi workflow berhasil diaktifkan.");
      loadWorkflows();
    } else {
      setActionMsg(res.error?.message || "Gagal mengaktifkan versi");
    }
  }

  return (
    <Card>
      <CardHead
        title="Master Workflow Designer"
        actions={
          <button onClick={() => setCreateOpen(true)} className="bg-ums-red hover:opacity-90 text-white font-bold px-4 py-2 rounded-md text-sm">
            + Buat Workflow Baru
          </button>
        }
      />
      <p className="text-xs text-slate-500 -mt-2 mb-4">Kelola alur persetujuan (approval flow) dan versi aktif workflow</p>

      {actionMsg && <div className="bg-sky-50 text-sky-700 text-sm p-3 rounded border border-sky-200 mb-4">{actionMsg}</div>}
      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat workflow...</div>
      ) : (
        <div className="space-y-3">
          {workflows.length === 0 ? (
            <div className="text-center py-10 text-slate-400 border border-dashed border-ums-border rounded-lg text-sm">
              Belum ada workflow. Klik &quot;Buat Workflow Baru&quot; untuk membuat.
            </div>
          ) : (
            workflows.map((wf) => (
              <div key={wf.id} className="border border-ums-border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2 gap-3">
                  <div>
                    <h2 className="text-base font-bold text-ums-text">{wf.name}</h2>
                    <p className="text-xs text-slate-500">{wf.description || "Tanpa deskripsi"}</p>
                  </div>
                  <button
                    onClick={() => {
                      setVersionTarget(wf);
                      setVersionSteps([newStep()]);
                      setFormError("");
                    }}
                    className="bg-white border border-ums-border font-bold text-xs px-3 py-1.5 rounded-md flex-shrink-0"
                  >
                    + Versi Baru
                  </button>
                </div>

                <div className="space-y-2">
                  {wf.versions.map((v) => (
                    <div key={v.id} className="bg-slate-50 border border-ums-border rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <Badge
                          label={`Versi ${v.versionNumber} — ${v.status}`}
                          color={v.status === "ACTIVE" ? "green" : v.status === "DRAFT" ? "orange" : "gray"}
                        />
                        {v.status === "DRAFT" && (
                          <button onClick={() => activateVersion(v.id)} className="text-xs font-bold text-ums-green">
                            Aktifkan Versi Ini
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto py-1 text-xs">
                        {v.steps.map((step, idx) => (
                          <React.Fragment key={step.id}>
                            <div className="bg-[#e8f1ff] border border-[#c7dcff] p-2 rounded-lg min-w-[140px]">
                              <div className="font-semibold text-ums-blue">
                                Step {step.stepOrder}: {step.name}
                              </div>
                              <div className="text-[10px] text-slate-500">{step.approverRules.map((r) => r.strategy).join(", ")}</div>
                            </div>
                            {idx < v.steps.length - 1 && <span className="text-slate-400 font-bold">&rarr;</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {createOpen && (
        <Modal title="Buat Workflow Baru" onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreateWorkflow} className="space-y-3.5">
            {formError && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{formError}</div>}
            <div>
              <label className="block text-xs font-bold mb-1.5">Nama Workflow *</label>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Deskripsi</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Kategori Terkait</label>
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              >
                <option value="">(Berlaku untuk semua kategori)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Langkah Persetujuan *</label>
              {stepListEditor(newSteps, setNewSteps)}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm text-slate-600 font-bold">
                Batal
              </button>
              <button type="submit" disabled={saving} className="bg-ums-red text-white font-bold px-4 py-2 rounded-md text-sm disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan & Aktifkan"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {versionTarget && (
        <Modal title={`Versi Baru: ${versionTarget.name}`} onClose={() => setVersionTarget(null)}>
          <form onSubmit={handleCreateVersion} className="space-y-3.5">
            {formError && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{formError}</div>}
            <p className="text-xs text-slate-500">
              Versi baru dibuat sebagai <b>draft</b> dan tidak langsung aktif. Aktifkan manual setelah direview.
            </p>
            {stepListEditor(versionSteps, setVersionSteps)}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setVersionTarget(null)} className="px-4 py-2 text-sm text-slate-600 font-bold">
                Batal
              </button>
              <button type="submit" disabled={saving} className="bg-ums-red text-white font-bold px-4 py-2 rounded-md text-sm disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan sebagai Draft"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}
