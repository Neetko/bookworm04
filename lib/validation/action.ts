import { z } from "zod"

export class ActionValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ActionValidationError"
  }
}

function formatIssuePath(issue: z.ZodIssue) {
  if (issue.path.length === 0) return null
  return issue.path
    .map((segment) => (typeof segment === "number" ? String(segment + 1) : String(segment)))
    .join(".")
}

export function formatValidationIssues(issues: z.ZodIssue[]) {
  const messages = issues.slice(0, 3).map((issue) => {
    const path = formatIssuePath(issue)
    return path ? `${path}: ${issue.message}` : issue.message
  })

  if (issues.length > 3) {
    messages.push(`${issues.length - 3} more ${issues.length - 3 === 1 ? "issue" : "issues"}`)
  }

  return messages.join("; ")
}

export function parseActionInput<TSchema extends z.ZodTypeAny>(schema: TSchema, input: unknown): z.infer<TSchema> {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new ActionValidationError(formatValidationIssues(result.error.issues))
  }

  return result.data
}
