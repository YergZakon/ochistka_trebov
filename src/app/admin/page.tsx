"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Pagination from "@/components/Pagination";

interface Requirement {
  id: number;
  external_id: string;
  category: string;
  text_original: string;
  article_ref: string | null;
  npa_title: string | null;
  confidence: string;
  admin_status: string;
  confirms: string;
  rejects: string;
  total_votes: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminPage() {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: 20, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("active");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const router = useRouter();

  const fetchData = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: "20",
          status,
          vote_status: "all",
        });
        const res = await fetch(`/api/requirements?${params}`);
        if (!res.ok) throw new Error("unauthorized");
        const data = await res.json();
        setRequirements(data.requirements);
        setPagination(data.pagination);
        setSelected(new Set());
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    },
    [status, router]
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === requirements.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(requirements.map((r) => r.id)));
    }
  }

  async function handleReject() {
    if (selected.size === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementIds: Array.from(selected),
          reason: "admin_review",
        }),
      });
      if (res.ok) fetchData(pagination.page);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestore() {
    if (selected.size === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/reject", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementIds: Array.from(selected) }),
      });
      if (res.ok) fetchData(pagination.page);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-800">
            Управление реестром
          </h2>
          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="active">Активные</option>
              <option value="rejected">Отклонённые</option>
            </select>
            {selected.size > 0 && (
              <>
                <span className="text-sm text-slate-500">
                  Выбрано: {selected.size}
                </span>
                {status === "active" ? (
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Отклонить
                  </button>
                ) : (
                  <button
                    onClick={handleRestore}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Восстановить
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-slate-400">Загрузка...</div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === requirements.length && requirements.length > 0}
                      onChange={selectAll}
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">ID</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Кат.</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Текст</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">НПА</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">Голоса</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requirements.map((r) => (
                  <tr
                    key={r.id}
                    className={`hover:bg-slate-50 ${
                      selected.has(r.id) ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">
                      {r.external_id}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-medium">{r.category}</span>
                    </td>
                    <td className="px-3 py-2 max-w-md">
                      <div className="text-xs text-slate-700 line-clamp-2">
                        {r.text_original}
                      </div>
                    </td>
                    <td className="px-3 py-2 max-w-40">
                      <div className="text-xs text-slate-500 truncate">
                        {r.npa_title || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-xs">
                        <span className="text-green-600">{r.confirms}✓</span>{" "}
                        <span className="text-red-600">{r.rejects}✗</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={(p) => fetchData(p)}
        />
      </main>
    </div>
  );
}
