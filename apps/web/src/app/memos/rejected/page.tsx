"use client";

import React from "react";
import MemoStatusListView from "@/components/MemoStatusListView";

export default function MemoRejectedPage() {
  return <MemoStatusListView status="REJECTED" emptyMessage="Belum ada memo yang ditolak." />;
}
