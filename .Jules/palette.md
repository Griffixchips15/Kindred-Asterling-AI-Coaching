## 2026-34-06 - Added missing aria-labels to icon-only buttons
**Learning:** The sidebar elements shrink to icon-only buttons when collapsed. While they use Tooltips, they still require an `aria-label` attribute directly on the `<button>` to be accessible to screen readers, especially because the tooltip content is conditionally rendered or visually separated.
**Action:** When working with responsive sidebars or tooltips, always ensure the underlying interactive element (like `<button>` or `<a>`) maintains an `aria-label` if the text content is conditionally hidden.
## 2026-34-06 - Added confirmation dialog for delete medication
**Learning:** Destructive actions like deleting a medication need a confirmation step to prevent accidental data loss. The `AlertDialog` component is an effective pattern for this.
**Action:** When implementing delete or other destructive actions, wrap them in an `AlertDialog` rather than just a simple button.
## 2024-11-28 - Added missing async loading states
**Learning:** Found multiple forms (morning check-in, evening check-out, scans) lacking visual indication of loading during form submission. Since users might click multiple times, adding a simple loading spinner gives immediate feedback that their action was received and prevents confusion.
**Action:** Always include a visual loading state (like `<Loader2 className="w-5 h-5 animate-spin mr-2" />`) in submit buttons that trigger async actions, and combine it with disabled state and appropriate text change (e.g. "Saving..."). Use flex styling (`flex items-center justify-center`) to keep the button layout clean.
