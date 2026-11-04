"use client";

import { useState } from "react";

type Day = { day: string; store: number; topups: number; orders: number };

const money = (n: number) => `GH₵ ${n.toLocaleString("en-GH", { maximumFractionDigits: 0 })}`;

/**
 * Daily verified revenue as one bar per day (store + top-ups), with a hover
 * tooltip that splits it. A table view sits underneath for screen readers
 * and for anyone who wants exact numbers.
 */
export function RevenueChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = days.map((d) => Number(d.store) + Number(d.topups));
  const max = Math.max(1, ...totals);
  const empty = totals.every((t) => t === 0);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const fmt = new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short" });
  const labelEvery = Math.ceil(days.length / 8);
  const h = 180;

  return (
    <figure>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <div className="grid grid-cols-[3.5rem_1fr] gap-2">
          <div className="relative" style={{ height: h }} aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2 text-[11px] tabular text-ink-faint" style={{ bottom: (t / top) * h - 0 }}>
                {t >= 1000 ? `${(t / 1000).toLocaleString("en-GH", { maximumFractionDigits: 1 })}k` : t}
              </span>
            ))}
          </div>
          <div className="relative" style={{ height: h }}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: (t / top) * h }} aria-hidden />
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px]" role="img" aria-label="Daily revenue chart. Exact figures are in the table below.">
              {days.map((d, i) => (
                <div
                  key={d.day}
                  className="relative flex h-full flex-1 items-end"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={0}
                  aria-label={`${fmt.format(new Date(d.day))}: ${money(totals[i])}`}
                >
                  <div
                    className="w-full rounded-t-[4px] bg-brand transition-opacity"
                    style={{ height: totals[i] ? Math.max(2, (totals[i] / top) * h) : 0, opacity: hover === null || hover === i ? 1 : 0.45 }}
                  />
                </div>
              ))}
            </div>
            {empty ? (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-soft">No verified payments in this period yet.</p>
            ) : null}
            {hover !== null ? (
              <div
                className="pointer-events-none absolute -top-2 z-10 min-w-40 -translate-y-full rounded-[var(--radius-field)] border border-line bg-surface px-3 py-2 text-xs shadow-sm"
                style={{ left: `clamp(0px, calc(${((hover + 0.5) / days.length) * 100}% - 80px), calc(100% - 160px))` }}
              >
                <p className="font-medium">{fmt.format(new Date(days[hover].day))}</p>
                <p className="mt-1 flex justify-between gap-4"><span className="text-ink-soft">Store</span><span className="tabular">{money(Number(days[hover].store))}</span></p>
                <p className="flex justify-between gap-4"><span className="text-ink-soft">Top-ups</span><span className="tabular">{money(Number(days[hover].topups))}</span></p>
                <p className="flex justify-between gap-4"><span className="text-ink-soft">Paid orders</span><span className="tabular">{days[hover].orders}</span></p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="ml-[4rem] mt-1.5 flex gap-[2px]" aria-hidden>
          {days.map((d, i) => (
            <span key={d.day} className="flex-1 text-center text-[11px] text-ink-faint">{i % labelEvery === 0 ? fmt.format(new Date(d.day)) : ""}</span>
          ))}
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-soft hover:text-ink">Show as a table</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-soft"><tr><th className="py-1 font-medium">Day</th><th className="py-1 text-right font-medium">Store</th><th className="py-1 text-right font-medium">Top-ups</th><th className="py-1 text-right font-medium">Orders</th></tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <td className="py-1">{fmt.format(new Date(d.day))}</td>
                  <td className="py-1 text-right tabular">{money(Number(d.store))}</td>
                  <td className="py-1 text-right tabular">{money(Number(d.topups))}</td>
                  <td className="py-1 text-right tabular">{d.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function niceStep(max: number) {
  const raw = Math.max(1, max / 4);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}
