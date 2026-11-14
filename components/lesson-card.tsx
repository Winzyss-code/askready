import type { Lesson } from "@/config/scenarios";
import { cx } from "@/lib/cx";

/** The technique for a scenario: three steps, then a weak line beside a stronger one. Static copy we wrote, never generated. */
export function LessonCard({ lesson, className }: { lesson: Lesson; className?: string }) {
  return (
    <section className={cx("min-w-0", className)} aria-labelledby="lesson-heading">
      <p className="text-sm font-semibold text-neutral-500">Today’s technique</p>
      <h2 id="lesson-heading" className="display mt-1 text-xl">{lesson.technique}</h2>
      <p className="mt-3 max-w-measure text-neutral-600">{lesson.summary}</p>
      <ol className="mt-6 grid gap-x-8 sm:grid-cols-3">
        {lesson.steps.map((step, index) => (
          <li key={step.title} className="border-t border-neutral-300 py-4">
            <h3 className="flex items-baseline gap-2 font-semibold"><span aria-hidden="true" className="figure text-neutral-400">{index + 1}</span>{step.title}</h3>
            <p className="mt-1 text-sm text-neutral-600">{step.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-x-10 gap-y-6 border-t border-neutral-300 pt-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div><h3 className="text-sm font-semibold text-neutral-500">Sounds like</h3><blockquote className="mt-2 text-neutral-500">“{lesson.weak}”</blockquote></div>
        <div><h3 className="text-sm font-semibold">Try instead</h3><blockquote className="mt-2 text-lg font-medium"><span className="mark">“{lesson.strong}”</span></blockquote></div>
      </div>
      <p className="mt-4 text-sm text-neutral-500">An example we wrote to show the technique. Your rehearsal uses your own case.</p>
    </section>
  );
}
