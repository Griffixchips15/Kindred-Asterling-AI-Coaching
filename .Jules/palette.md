## 2026-34-06 - Added missing aria-labels to icon-only buttons
**Learning:** The sidebar elements shrink to icon-only buttons when collapsed. While they use Tooltips, they still require an `aria-label` attribute directly on the `<button>` to be accessible to screen readers, especially because the tooltip content is conditionally rendered or visually separated.
**Action:** When working with responsive sidebars or tooltips, always ensure the underlying interactive element (like `<button>` or `<a>`) maintains an `aria-label` if the text content is conditionally hidden.
## 2026-34-06 - Added confirmation dialog for delete medication
**Learning:** Destructive actions like deleting a medication need a confirmation step to prevent accidental data loss. The `AlertDialog` component is an effective pattern for this.
**Action:** When implementing delete or other destructive actions, wrap them in an `AlertDialog` rather than just a simple button.
