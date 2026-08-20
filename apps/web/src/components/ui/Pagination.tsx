import React from "react";

export function TablePagination({
  page,
  totalPages,
  total,
  limit,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 text-xs text-slate-500">
      <span>
        Menampilkan {from} - {to} dari {total.toLocaleString("id-ID")} data
      </span>
      <div className="flex gap-1.5">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="w-8 h-8 bg-white border border-ums-border rounded-md disabled:opacity-40"
          aria-label="Halaman sebelumnya"
        >
          ‹
        </button>
        {pageNumbers.map((p, idx) => (
          <React.Fragment key={p}>
            {idx > 0 && pageNumbers[idx - 1] !== p - 1 && <span className="px-1">…</span>}
            <button
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`w-8 h-8 border rounded-md ${
                p === page ? "border-ums-red text-ums-red font-bold" : "bg-white border-ums-border"
              }`}
            >
              {p}
            </button>
          </React.Fragment>
        ))}
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="w-8 h-8 bg-white border border-ums-border rounded-md disabled:opacity-40"
          aria-label="Halaman berikutnya"
        >
          ›
        </button>
      </div>
    </div>
  );
}
