"use client";

interface FiltersProps {
  category: string;
  onCategoryChange: (v: string) => void;
  voteStatus: string;
  onVoteStatusChange: (v: string) => void;
  npaList?: { id: number; title: string }[];
  npaId: string;
  onNpaChange: (v: string) => void;
}

const CATEGORIES = [
  { value: "", label: "Все категории" },
  { value: "OBL", label: "Обязанность" },
  { value: "ZAP", label: "Запрет" },
  { value: "USL", label: "Условие" },
  { value: "SRK", label: "Срок" },
  { value: "DOC", label: "Документ" },
  { value: "FIN", label: "Финансы" },
  { value: "OTV", label: "Ответственность" },
  { value: "PRO", label: "Процедура" },
  { value: "STD", label: "Стандарт" },
];

const VOTE_STATUSES = [
  { value: "all", label: "Все" },
  { value: "unvoted", label: "Не оценённые" },
  { value: "voted", label: "Оценённые" },
];

export default function Filters({
  category,
  onCategoryChange,
  voteStatus,
  onVoteStatusChange,
  npaId,
  onNpaChange,
  npaList,
}: FiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        value={voteStatus}
        onChange={(e) => onVoteStatusChange(e.target.value)}
        className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      >
        {VOTE_STATUSES.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>

      {npaList && npaList.length > 0 && (
        <select
          value={npaId}
          onChange={(e) => onNpaChange(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none max-w-xs"
        >
          <option value="">Все НПА</option>
          {npaList.map((n) => (
            <option key={n.id} value={n.id.toString()}>
              {n.title.length > 50 ? n.title.slice(0, 50) + "..." : n.title}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
