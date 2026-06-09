export type FrontendIssue = {
  title: string
  detail: string
}

export function issueFromUnknown(error: unknown): FrontendIssue {
  if (error instanceof Error) {
    return { title: error.name, detail: error.message }
  }
  return { title: "Unexpected error", detail: String(error) }
}

