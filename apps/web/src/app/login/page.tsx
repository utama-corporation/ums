"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { useSession } from "@/lib/SessionProvider";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
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
    } else {
      setErrorMsg(res.error?.message || "Login failed");
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

          <form onSubmit={handleLogin}>
            <label className="block text-[#251f27] font-bold text-[13px] mb-1.5">NIK / Username</label>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 rounded-md border-0 mb-3 bg-white text-[#101828] placeholder:text-slate-400"
              placeholder="NIK Anda, atau username untuk admin"
            />

            <label className="block text-[#251f27] font-bold text-[13px] mb-1.5">Password</label>
            <input
              type="password"
              required
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
