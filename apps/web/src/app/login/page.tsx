"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { useSession } from "@/lib/SessionProvider";

type Mode = "login" | "set-password";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nik, setNik] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const res = await apiClient("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (res.success) {
      await refresh();
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : "/dashboard");
    } else if (res.error?.code === "PASSWORD_NOT_SET") {
      setMode("set-password");
      setErrorMsg("");
      setPassword("");
    } else {
      setErrorMsg(res.error?.message || "Login failed");
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (newPassword.length < 8) {
      setErrorMsg("Password minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Konfirmasi password tidak cocok.");
      return;
    }

    setLoading(true);
    const res = await apiClient("/auth/set-initial-password", {
      method: "POST",
      body: JSON.stringify({ username, employeeId: nik, newPassword }),
    });
    setLoading(false);

    if (res.success) {
      setMode("login");
      setSuccessMsg("Password berhasil dibuat. Silakan login dengan password baru Anda.");
      setNik("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setErrorMsg(res.error?.message || "Gagal membuat password");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ background: "linear-gradient(135deg,#5f506f,#c17891 58%,#ffad47)" }}
    >
      <div className="w-full max-w-[440px] text-center text-white">
        <h1 className="text-3xl md:text-4xl font-bold mb-6">Welcome to UMS!</h1>

        <div className="text-left bg-white/35 backdrop-blur-md p-7 rounded-[22px] shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ums-logo.png" alt="UMS" className="w-[110px] mx-auto block" />
          <h2 className="text-center text-ums-red font-bold text-lg mt-2">UTAMA MEMO SYSTEM</h2>
          <p className="text-center text-ums-red text-sm mb-3">Sistem Memo Internal</p>
          <hr className="border-white/40 mb-4" />

          {errorMsg && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded border border-red-200 mb-4">{errorMsg}</div>
          )}
          {successMsg && (
            <div className="bg-green-50 text-green-700 text-sm p-3 rounded border border-green-200 mb-4">{successMsg}</div>
          )}

          {mode === "login" ? (
            <form onSubmit={handleLogin}>
              <label htmlFor="login-username" className="block text-[#251f27] font-bold text-[13px] mb-1.5">NIK / Username</label>
              <input
                id="login-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 rounded-md border-0 mb-3 bg-white text-[#101828] placeholder:text-slate-400"
                placeholder="NIK Anda, atau username untuk admin"
              />

              <label htmlFor="login-password" className="block text-[#251f27] font-bold text-[13px] mb-1.5">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 rounded-md border-0 bg-white text-[#101828] placeholder:text-slate-400"
                placeholder="••••••••"
              />

              <div className="mt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="float-right bg-ums-red text-white border-0 rounded-full px-7 py-2.5 font-bold disabled:opacity-50"
                >
                  {loading ? "Memproses..." : "Login"}
                </button>
                <div className="clear-both" />
              </div>
            </form>
          ) : (
            <form onSubmit={handleSetPassword}>
              <p className="text-xs text-[#251f27] mb-3">
                Akun <b>{username}</b> belum punya password. Masukkan NIK Anda untuk verifikasi, lalu buat password baru.
              </p>

              <label htmlFor="setpw-nik" className="block text-[#251f27] font-bold text-[13px] mb-1.5">NIK</label>
              <input
                id="setpw-nik"
                type="text"
                required
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                className="w-full p-3 rounded-md border-0 mb-3 bg-white text-[#101828] placeholder:text-slate-400"
                placeholder="Nomor Induk Karyawan Anda"
              />

              <label htmlFor="setpw-new" className="block text-[#251f27] font-bold text-[13px] mb-1.5">Password Baru</label>
              <input
                id="setpw-new"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-3 rounded-md border-0 mb-3 bg-white text-[#101828] placeholder:text-slate-400"
                placeholder="Minimal 8 karakter"
              />

              <label htmlFor="setpw-confirm" className="block text-[#251f27] font-bold text-[13px] mb-1.5">Konfirmasi Password</label>
              <input
                id="setpw-confirm"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 rounded-md border-0 bg-white text-[#101828] placeholder:text-slate-400"
                placeholder="Ulangi password baru"
              />

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErrorMsg("");
                  }}
                  className="text-[#251f27] font-bold text-xs underline"
                >
                  &larr; Kembali ke login
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-ums-red text-white border-0 rounded-full px-7 py-2.5 font-bold disabled:opacity-50"
                >
                  {loading ? "Memproses..." : "Buat Password"}
                </button>
              </div>
            </form>
          )}
        </div>

        <small className="block mt-8 text-white/90">
          Copyright &copy; {new Date().getFullYear()}, Utama Corporation
          <br />
          All rights reserved.
        </small>
      </div>
    </div>
  );
}
