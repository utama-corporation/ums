"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardHead } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

interface UserItem {
  id: string;
  username: string;
  email: string;
  fullName: string;
  employeeId?: string | null;
  departmentId?: string | null;
  position?: string | null;
  department?: { id: string; name: string };
  isActive: boolean;
  userRoles: { role: { id: string; name: string } }[];
}

interface SimpleOption {
  id: string;
  name: string;
}

interface FormState {
  id?: string;
  username: string;
  email: string;
  fullName: string;
  employeeId: string;
  departmentId: string;
  position: string;
  password: string;
  roleIds: string[];
}

const EMPTY_FORM: FormState = {
  username: "",
  email: "",
  fullName: "",
  employeeId: "",
  departmentId: "",
  position: "",
  password: "",
  roleIds: [],
};

export default function MasterUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [departments, setDepartments] = useState<SimpleOption[]>([]);
  const [roles, setRoles] = useState<SimpleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  async function loadUsers() {
    setLoading(true);
    const res = await apiClient<UserItem[]>("/users?limit=100");
    setLoading(false);
    if (res.success && res.data) {
      setUsers(res.data);
    } else {
      setErrorMsg(res.error?.message || "Gagal memuat data pengguna");
    }
  }

  useEffect(() => {
    loadUsers();
    apiClient<{ id: string; name: string }[]>("/departments").then((res) => {
      if (res.success && res.data) setDepartments(res.data.map((d) => ({ id: d.id, name: d.name })));
    });
    apiClient<{ id: string; name: string }[]>("/roles").then((res) => {
      if (res.success && res.data) setRoles(res.data);
    });
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(u: UserItem) {
    setForm({
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.fullName,
      employeeId: u.employeeId || "",
      departmentId: u.departmentId || "",
      position: u.position || "",
      password: "",
      roleIds: u.userRoles.map((ur) => ur.role.id),
    });
    setFormError("");
    setModalOpen(true);
  }

  function toggleRole(roleId: string) {
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(roleId) ? f.roleIds.filter((r) => r !== roleId) : [...f.roleIds, roleId],
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    if (form.id) {
      const payload = {
        username: form.username,
        email: form.email,
        fullName: form.fullName,
        employeeId: form.employeeId || null,
        departmentId: form.departmentId || null,
        position: form.position || null,
        roleIds: form.roleIds,
      };
      const res = await apiClient(`/users/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      setSaving(false);
      if (res.success) {
        setModalOpen(false);
        loadUsers();
      } else {
        setFormError(res.error?.message || "Gagal menyimpan pengguna");
      }
    } else {
      const payload = {
        username: form.username,
        email: form.email,
        fullName: form.fullName,
        employeeId: form.employeeId || undefined,
        departmentId: form.departmentId || null,
        position: form.position || null,
        password: form.password,
        roleIds: form.roleIds,
      };
      const res = await apiClient("/users", { method: "POST", body: JSON.stringify(payload) });
      setSaving(false);
      if (res.success) {
        setModalOpen(false);
        loadUsers();
      } else {
        setFormError(res.error?.message || "Gagal membuat pengguna");
      }
    }
  }

  async function toggleActive(u: UserItem) {
    const res = await apiClient(`/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !u.isActive }) });
    if (res.success) {
      loadUsers();
    } else {
      setErrorMsg(res.error?.message || "Gagal mengubah status pengguna");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetMsg("");
    const res = await apiClient(`/users/${resetTarget.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    });
    if (res.success) {
      setResetMsg("Password berhasil direset. Semua sesi login pengguna ini telah dinonaktifkan.");
      setNewPassword("");
    } else {
      setResetMsg(res.error?.message || "Gagal mereset password");
    }
  }

  return (
    <Card>
      <CardHead
        title="Master Data User"
        actions={
          <button onClick={openCreate} className="bg-ums-red hover:opacity-90 text-white font-bold px-4 py-2 rounded-md text-sm">
            + Tambah User
          </button>
        }
      />
      <p className="text-xs text-slate-500 -mt-2 mb-4">Kelola daftar pengguna dan hak akses aplikasi</p>

      {errorMsg && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>}

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat data user...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-ums-border bg-slate-50 text-slate-700">
                <th className="p-3">Username</th>
                <th className="p-3">Nama Lengkap</th>
                <th className="p-3">Email</th>
                <th className="p-3">Departemen</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-ums-border hover:bg-slate-50">
                  <td className="p-3 font-mono text-xs text-slate-700">{u.username}</td>
                  <td className="p-3 font-medium text-ums-text">{u.fullName}</td>
                  <td className="p-3 text-slate-600">{u.email}</td>
                  <td className="p-3 text-slate-600">{u.department?.name || "-"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {u.userRoles.map((ur) => (
                        <Badge key={ur.role.id} label={ur.role.name} color="blue" />
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge label={u.isActive ? "Aktif" : "Non-aktif"} color={u.isActive ? "green" : "gray"} />
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(u)} className="text-ums-blue font-bold text-xs">
                        Edit
                      </button>
                      <button onClick={() => toggleActive(u)} className="text-slate-500 font-bold text-xs">
                        {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        onClick={() => {
                          setResetTarget(u);
                          setResetMsg("");
                          setNewPassword("");
                        }}
                        className="text-ums-orange font-bold text-xs"
                      >
                        Reset Password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal title={form.id ? "Edit User" : "Tambah User"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-3.5">
            {formError && <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1.5">Username *</label>
                <input
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Nama Lengkap *</label>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              />
            </div>
            {!form.id && (
              <div>
                <label className="block text-xs font-bold mb-1.5">Password Awal *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1.5">Departemen</label>
                <select
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                >
                  <option value="">(Tidak ada)</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5">Jabatan</label>
                <input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5">Role</label>
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-full font-bold border ${
                      form.roleIds.includes(r.id) ? "bg-ums-blue text-white border-ums-blue" : "bg-white text-slate-600 border-ums-border"
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 font-bold">
                Batal
              </button>
              <button type="submit" disabled={saving} className="bg-ums-red text-white font-bold px-4 py-2 rounded-md text-sm disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`Reset Password: ${resetTarget.fullName}`} onClose={() => setResetTarget(null)}>
          <form onSubmit={handleResetPassword} className="space-y-3.5">
            {resetMsg && (
              <div className={`text-sm p-3 rounded border ${resetMsg.includes("berhasil") ? "bg-[#e5f7ed] text-[#10834d] border-[#c5ecd6]" : "bg-red-50 text-red-700 border-red-200"}`}>
                {resetMsg}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold mb-1.5">Password Baru *</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-ums-border rounded-md px-3 py-2.5 text-sm"
              />
            </div>
            <p className="text-xs text-slate-500">Mereset password akan otomatis mengeluarkan pengguna dari semua sesi login aktif.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setResetTarget(null)} className="px-4 py-2 text-sm text-slate-600 font-bold">
                Tutup
              </button>
              <button type="submit" className="bg-ums-orange text-white font-bold px-4 py-2 rounded-md text-sm">
                Reset Password
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}
