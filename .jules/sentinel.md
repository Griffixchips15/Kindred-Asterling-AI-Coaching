## 2024-08-04 - [Fix unintended wildcard searches in admin/users endpoint]
**Vulnerability:** A user could enter SQL wildcards (`%`, `_`) in the `/admin/users` search query, which would be directly interpolated into a `LIKE` clause and could be used to perform unintended wildcard searches.
**Learning:** Drizzle uses parameterized queries when inserting variables into a `sql\`` template string, but not in all other contexts. When using the `like` operator with string templates, you should escape `%` and `_` characters in user inputs if you want them to be treated as literals rather than wildcards.
**Prevention:** Escape `%` and `_` characters in user-provided search terms when they are used in `LIKE` queries unless you specifically want to allow wildcard functionality.
