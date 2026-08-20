"use client";

import React from "react";
import MemoStatusListView from "@/components/MemoStatusListView";

export default function MemoPublishedPage() {
  return <MemoStatusListView status="PUBLISHED" emptyMessage="Belum ada memo yang dipublikasikan." />;
}
