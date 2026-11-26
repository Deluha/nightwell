/** One thing a checker found wrong. Checkers return these; they never print or exit. */
export interface Problem {
  rule: string;
  message: string;
  file?: string;
  line?: number;
}

export function formatProblem(problem: Problem): string {
  const where =
    problem.file === undefined
      ? ""
      : `${problem.file}${problem.line === undefined ? "" : `:${problem.line}`}: `;
  return `${where}${problem.message} [${problem.rule}]`;
}
