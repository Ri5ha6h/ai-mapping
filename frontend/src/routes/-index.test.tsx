import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

describe("workbench route composition", () => {
  it("orders the Mapping tab as setup, author, review, and save stages with secondary details", () => {
    const source = readFileSync(resolve(__dirname, "index.tsx"), "utf8")

    const setup = source.indexOf('title="Setup"')
    const author = source.indexOf('title="Author"')
    const review = source.indexOf('title="Review"')
    const save = source.indexOf('title="Save"')

    expect(setup).toBeGreaterThan(-1)
    expect(author).toBeGreaterThan(setup)
    expect(review).toBeGreaterThan(author)
    expect(save).toBeGreaterThan(review)
    expect(source).toContain('title="Field hints and schema fields"')
    expect(source).toContain('title="Diff and raw logs"')
    expect(source.indexOf('title="Review"')).toBeLessThan(
      source.indexOf("<RunReviewPanel")
    )
    expect(source).toContain("<Tabs")
    expect(source).toContain("<Dialog")
    expect(source).toContain("<RunReviewPanel workbench={workbench} />")
    expect(source).toContain("TemplateVersionPanel")
  })
})
