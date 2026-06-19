// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TemplateVersionPanel } from "./TemplateVersionPanel"

afterEach(cleanup)

describe("TemplateVersionPanel", () => {
  it("groups example and saved templates and exposes version actions", async () => {
    const onSelectedTemplateChange = vi.fn()
    const onCreateVersion = vi.fn()
    const onLoadTemplate = vi.fn()

    render(
      <TemplateVersionPanel
        templates={[seededTemplate, savedTemplate]}
        deletedTemplates={[deletedTemplate]}
        activeTemplate={savedTemplate}
        selectedTemplateId="saved"
        templateName="Saved transform"
        templateDescription="Reusable"
        canSave
        busyAction={null}
        onTemplateNameChange={vi.fn()}
        onTemplateDescriptionChange={vi.fn()}
        onSelectedTemplateChange={onSelectedTemplateChange}
        onSaveTemplate={vi.fn()}
        onCreateVersion={onCreateVersion}
        onDeleteTemplate={vi.fn()}
        onRestoreTemplate={vi.fn()}
        onLoadTemplate={onLoadTemplate}
        onRefreshTemplates={vi.fn()}
      />
    )

    expect(screen.getByRole("group", { name: "Examples" })).toBeTruthy()
    expect(screen.getByRole("group", { name: "Saved" })).toBeTruthy()
    expect(screen.getByText(/field validation rules so older versions remain reproducible/i)).toBeTruthy()
    expect(screen.getByText("Archived")).toBeTruthy()
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "seed" } })
    fireEvent.click(screen.getByRole("button", { name: /New version/i }))
    fireEvent.click(screen.getByRole("button", { name: /Load/i }))

    expect(onSelectedTemplateChange).toHaveBeenCalledWith("seed")
    expect(onCreateVersion).toHaveBeenCalled()
    expect(onLoadTemplate).toHaveBeenCalledWith("saved", 1)
  })
})

const version = {
  version: 1,
  source_format: "json" as const,
  target_format: "json" as const,
  source_schema_id: null,
  target_schema_id: null,
  source_schema_snapshot: null,
  target_schema_snapshot: null,
  mapping_spec: { engine: "script_js" as const, script_version: 1, script: "function transform() { return {}; }" },
  validation_rules: [],
  field_validation_rules: [],
  sample_source_content: "{}",
  sample_target_content: "{}",
  created_at: "2026-06-19T00:00:00Z",
}

const seededTemplate = { template_id: "seed", name: "Example", description: "", active_version: 1, is_seeded: true, versions: [version] }
const savedTemplate = { template_id: "saved", name: "Saved", description: "", active_version: 1, is_seeded: false, versions: [version] }
const deletedTemplate = { template_id: "deleted", name: "Archived", description: "", active_version: 1, is_seeded: false, deleted_at: "2026-06-19T00:00:00Z", versions: [version] }
