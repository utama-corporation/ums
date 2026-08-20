"use client";

import React from "react";
import MemoStatusListView from "@/components/MemoStatusListView";
import { apiClient } from "@/lib/api";

export default function ArchivePage() {
  async function restore(id: string) {
    const res = await apiClient(`/memos/${id}/restore`, { method: "POST" });
    if (!res.success) throw new Error(res.error?.message || "Gagal memulihkan memo");
  }

  return <MemoStatusListView status="ARCHIVED" emptyMessage="Belum ada memo yang diarsipkan." onRestore={restore} />;
}
