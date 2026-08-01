import { buildPageTokens } from "../../domain/pagination";
import "./Pagination.css";
import Icon from "./Icon";
interface PaginationProps {
  current: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  current,
  perPage,
  total,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = total === 0 ? 0 : (current - 1) * perPage + 1;
  const end = Math.min(current * perPage, total);
  const tokens = buildPageTokens(current, totalPages);

  return (
    <div className="pagination-bar">
      <div className="pagination-info">
        Showing <strong>{start}–{end}</strong> of <strong>{total}</strong>{" "}
        record{total !== 1 ? "s" : ""}
      </div>

      <div className="pagination-controls">
        <button
          className="page-btn nav-btn"
          disabled={current === 1}
          onClick={() => onPageChange(current - 1)}
        >
          <Icon name="chevron-left" />
        </button>

        {tokens.map((t, i) =>
          t === "…" ? (
            <button key={`e-${i}`} className="page-btn ellipsis" disabled>
              …
            </button>
          ) : (
            <button
              key={t}
              className={`page-btn ${t === current ? "active" : ""}`}
              disabled={t === current}
              onClick={() => onPageChange(t)}
            >
              {t}
            </button>
          ),
        )}

        <button
          className="page-btn nav-btn"
          disabled={current === totalPages}
          onClick={() => onPageChange(current + 1)}
        >
          <Icon name="chevron-right" />
        </button>
      </div>
    </div>
  );
}