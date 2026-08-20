"use client";

import React from "react";
import MemoStatusListView from "@/components/MemoStatusListView";

export default function MemoApprovedPage() {
  return <MemoStatusListView status="APPROVED" emptyMessage="Belum ada memo yang disetujui." />;
}
