import type { CourseView } from "./course-list";

// One red dot and one line about the course closest to failing, or nothing.
export function riskText(courses: CourseView[]): string | null {
  const worst = courses.find(
    (c) =>
      ["over", "out", "last"].includes(c.pace) &&
      !(c.lives === 0 && c.left === 0),
  );
  if (!worst) return null;
  if (worst.pace === "over")
    return `${worst.name}: Over the limit. Talk to your professor.`;
  if (worst.pace === "out")
    return `${worst.name}: Out of lives. The next skip takes you below 80%.`;
  return `${worst.name} is on its last life. Guard it.`;
}

export function RiskLine({ courses }: { courses: CourseView[] }) {
  const text = riskText(courses);
  if (!text) return null;
  return (
    <p
      role="status"
      className="m-0 flex items-center gap-2 text-[15px] font-semibold text-danger [overflow-wrap:anywhere]"
    >
      <i
        aria-hidden="true"
        className="h-2 w-2 flex-none rounded-full bg-danger"
      />
      {text}
    </p>
  );
}
