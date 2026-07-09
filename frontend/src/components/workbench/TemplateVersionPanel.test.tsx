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

    expect(screen.getAllByText("Save template").length).toBeGreaterThan(0)
    expect(screen.getAllByText("New version").length).toBeGreaterThan(0)
    expect(screen.getByText(/Versions preserve script, samples, schema snapshots/i)).toBeTruthy()
    expect(screen.getByText("Version 1")).toBeTruthy()
    expect(screen.getByText("current")).toBeTruthy()
    expect(screen.getByText(/0 field rules/i)).toBeTruthy()
    expect(screen.getByText("Archived")).toBeTruthy()
    expect(screen.getAllByText(/archived template/i).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("combobox", { name: "Templates" }))
    expect(screen.getByRole("option", { name: "Example: Example v1" })).toBeTruthy()
    expect(screen.getByRole("option", { name: "Saved: Saved v1" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /New version/i }))
    fireEvent.click(screen.getByRole("button", { name: /Load/i }))

    expect(onCreateVersion).toHaveBeenCalled()
    expect(onLoadTemplate).toHaveBeenCalledWith("saved", 1)
  })

  it("uses restore-focused empty archive copy", () => {
    render(
      <TemplateVersionPanel
        templates={[seededTemplate]}
        deletedTemplates={[]}
        activeTemplate={null}
        selectedTemplateId=""
        templateName=""
        templateDescription=""
        canSave={false}
        busyAction={null}
        onTemplateNameChange={vi.fn()}
        onTemplateDescriptionChange={vi.fn()}
        onSelectedTemplateChange={vi.fn()}
        onSaveTemplate={vi.fn()}
        onCreateVersion={vi.fn()}
        onDeleteTemplate={vi.fn()}
        onRestoreTemplate={vi.fn()}
        onLoadTemplate={vi.fn()}
        onRefreshTemplates={vi.fn()}
      />
    )

    expect(screen.getByText("Archived mapping templates will appear here with restore controls.")).toBeTruthy()
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
