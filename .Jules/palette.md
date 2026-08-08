## 2024-05-19 - Adding ARIA labels to Archive chat download buttons
**Learning:** Archive feature buttons (TXT, PDF downloads) lack ARIA labels, making screen reader usage difficult when scanning buttons.
**Action:** Always add aria-label attributes to action buttons especially those that use icons or abbreviations.
## 2026-08-04 - [Add ARIA label to main chat send button]
**Learning:** The main primary action button in a chat interface (the 'Send' button) was an icon-only button without an `aria-label`. When important interactive elements lack proper accessible names, screen readers cannot announce their purpose, severely breaking the core functionality for users who rely on assistive technologies.
**Action:** Always ensure that icon-only interactive elements, especially those representing primary actions like submitting a chat form, have descriptive `aria-label` attributes added. Also ensure to add aria-labels to main input elements like textarea and dates to provide better screen reader context.
## 2024-08-05 - Lack of Confirmation Dialogs
**Learning:** Destructive actions like deleting habits in the Kindred Coach app currently lack confirmation dialogs, leading to potential accidental data loss and a jarring user experience.
**Action:** Implemented an `AlertDialog` for habit deletion and should consider applying this pattern to other destructive actions in the app.
