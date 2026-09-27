# BlazeResolver website

The marketing site and the documentation at `/docs`, in one Next.js app.

```bash
npm install
npm run dev     # http://localhost:3000 and http://localhost:3000/docs
npm run build
```

## Layout

The app has two route groups with **separate root layouts**, so their styles never mix:

| Route group | Serves | Styles |
| :--- | :--- | :--- |
| `src/app/(site)` | `/`, the marketing page | `src/app/globals.css` |
| `src/app/(docs)` | `/docs/*`, built with [Fumadocs](https://fumadocs.dev) | `src/app/(docs)/docs.css` (Fumadocs preset plus BlazeResolver colors) |

Moving between the two is a full page load; that's what keeps the stylesheets apart. `src/app/api/blaze` is the site's own BlazeResolver endpoint, and `src/app/api/search` serves docs search.

## Editing the docs

- Pages are MDX files in `content/docs/`. The file path is the URL: `content/docs/setup/widget.mdx` becomes `/docs/setup/widget`.
- Every page needs `title` and `description` frontmatter. The description is plain text, so no markdown or backticks.
- Sidebar order comes from `meta.json` in each folder. Add a new page's file name there, or it's appended at the end.
- Components available in MDX without importing: `Callout`, `Cards`/`Card`, `Steps`/`Step`, `Tabs`/`Tab`, `TypeTable`, `Accordions`/`Accordion`, `Files`/`Folder`/`File` (registered in `src/components/mdx.tsx`).
- Search indexes the pages automatically.
- Document behavior from the source in `../src`, not from memory. Most pages link the relevant command, option or file.
