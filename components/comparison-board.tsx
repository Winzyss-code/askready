import { DeltaBadge } from "@/components/ui/badge";
import { Bar } from "@/components/ui/score-bar";

export type BoardRow = { label: string; before: number; after: number };

/** Attempt 1 against attempt 2: the two answers, the average, then one paired row per rubric dimension. */
export function ComparisonBoard({ id, answers, rows, average, caption }: {
  id: string;
  answers: { before: string; after: string };
  rows: BoardRow[];
  average: { before: number; after: number };
  caption: string;
}) {
  const scale = <span className="ml-1 font-sans text-sm font-normal tracking-normal text-neutral-500">/100</span>;
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-4 md:gap-x-10">
        <div className="md:col-start-1 md:row-start-1">
          <p className="text-sm font-semibold text-neutral-500">Attempt 1</p>
          <p className="figure mt-2 text-2xl text-neutral-500 md:text-3xl"><span className="sr-only">Average </span>{average.before}{scale}</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 md:col-start-2 md:row-span-2 md:row-start-1">
          <span aria-hidden="true" className="w-px flex-1 bg-neutral-200 max-md:hidden" />
          <p className="animate-settle [animation-delay:500ms]"><span className="sr-only">Average change: </span><DeltaBadge size="lg" value={average.after - average.before} /></p>
          <span aria-hidden="true" className="w-px flex-1 bg-neutral-200 max-md:hidden" />
        </div>
        <div className="md:col-start-3 md:row-start-1">
          <p className="text-sm font-semibold">Attempt 2</p>
          <p className="figure mt-2 text-2xl md:text-3xl"><span className="sr-only">Average </span><span className="mark-figure">{average.after}</span>{scale}</p>
        </div>
        <div className="col-span-3 mt-6 md:col-span-1 md:col-start-1 md:row-start-2">
          <p className="mb-1 text-xs font-semibold text-neutral-500 md:hidden">Attempt 1 answer</p>
          <p className="whitespace-pre-wrap break-words text-neutral-500">{answers.before}</p>
        </div>
        <div className="col-span-3 mt-4 md:col-span-1 md:col-start-3 md:row-start-2 md:mt-6">
          <p className="mb-1 text-xs font-semibold md:hidden">Attempt 2 answer</p>
          <p className="whitespace-pre-wrap break-words">{answers.after}</p>
        </div>
      </div>

      <p aria-hidden="true" className="mt-10 flex gap-4 text-xs font-semibold text-neutral-600 md:hidden">
        <span className="flex items-center gap-2"><span className="h-2 w-4 rounded-full bg-neutral-400" />Attempt 1</span>
        <span className="flex items-center gap-2"><span className="h-2 w-4 rounded-full bg-ink" />Attempt 2</span>
      </p>
      <div role="table" aria-label="Scores by dimension" aria-describedby={`${id}-caption`} className="mt-3 md:mt-10">
        <div role="row" className="board-row border-t-0 pb-3 pt-0 text-xs font-semibold text-neutral-500 max-md:sr-only">
          <span role="columnheader">Dimension</span><span role="columnheader">Attempt 1</span><span role="columnheader">Attempt 2</span><span role="columnheader" className="text-right">Change</span>
        </div>
        {rows.map((row, index) => (
          <div role="row" key={row.label} className="board-row">
            <span role="rowheader" className="text-sm font-semibold">{row.label}</span>
            <span role="cell" className="flex items-center gap-3"><span className="figure w-8 shrink-0 text-base text-neutral-500">{row.before}</span><Bar value={row.before} tone="muted" /></span>
            <span role="cell" className="flex items-center gap-3"><span className="figure w-8 shrink-0 text-base">{row.after}</span><Bar value={row.after} from={row.before} delay={0.15 + index * 0.08} /></span>
            <span role="cell" className="board-delta"><DeltaBadge value={row.after - row.before} /></span>
          </div>
        ))}
        <div role="row" className="board-row border-ink">
          <span role="rowheader" className="font-semibold">Average / 100</span>
          <span role="cell" className="flex items-center gap-3"><span className="figure w-8 shrink-0 text-lg text-neutral-500">{average.before}</span><Bar value={average.before} tone="muted" /></span>
          <span role="cell" className="flex items-center gap-3"><span className="figure w-8 shrink-0 text-lg">{average.after}</span><Bar value={average.after} from={average.before} delay={0.15 + rows.length * 0.08} /></span>
          <span role="cell" className="board-delta"><DeltaBadge value={average.after - average.before} /></span>
        </div>
      </div>
      <p id={`${id}-caption`} className="mt-4 text-sm text-neutral-500">{caption}</p>
    </div>
  );
}
