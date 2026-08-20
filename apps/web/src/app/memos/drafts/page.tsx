"use client";

import React from "react";
import Link from "next/link";
import MemoStatusListView from "@/components/MemoStatusListView";

export default function MemoDraftsPage() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-ums-text">Draf Memo Saya</h2>
          <p className="text-xs text-slate-500">Daftar draf memo yang sedang Anda susun</p>
        </div>
        <Link href="/memos/new" className="bg-ums-red hover:opacity-90 text-white font-bold px-4 py-2 rounded-md text-sm transition">
          + Buat Memo Baru
        </Link>
      </div>
      <MemoStatusListView status="DRAFT" emptyMessage='Belum ada draf memo. Klik "Buat Memo Baru" untuk mulai menyusun.' />
    </div>
  );
}
