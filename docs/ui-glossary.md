# UI Glossary

This glossary names the frontend UI patterns used by the Auto Mapping workbench.

- Workbench card: A shadcn `Card` wrapper used for a complete panel, such as schema detail, script authoring, validation, or templates.
- Panel header: The repeated kicker, title, description, and action/icon area at the top of a workbench card.
- Status badge: A compact `Badge` used for counts, workflow state, selected/current markers, and short statuses.
- Status alert: A shadcn `Alert` wrapper used for issue banners, helper notes, selected context, and validation state.
- Segmented control: A local wrapper for mutually exclusive modes such as source/target, paste/upload, local/AI-assisted, and saved sample/override.
- Field: A label, control, and optional helper/error text wrapper for form inputs.
- Schema card: A selectable saved schema row presented as a bordered card-like button.
- Archive row: A restore-focused row for archived schemas or templates.
- Preview block: A dark monospace `pre` block for payload, canonical sample, script reference, and output previews.
- Workflow step: A numbered stage card in the Mapping or Schema flow.
- Workbench grid: A custom layout grid retained in `styles.css` for dense operational panels and responsive collapse behavior.
