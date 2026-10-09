<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Kickoff architecture
- Treat anonymous organiser URLs and temporary scorer sessions as capability credentials; all writes use validated server functions because public links must remain read-only.
- Derive tables and player statistics from matches and events instead of storing duplicate totals, so corrections remain consistent.
- Keep public tournament screens in shared feature components and thin route files, so live updates and navigation stay consistent across detail pages.

- Return typed denial results for expected organiser-link and scorer-PIN rejections; render them inline so rejected credentials never become server runtime exceptions.
- Generate knockout fixtures in a standalone tested helper and represent undecided teams as null, so fixture creation never writes empty UUIDs.
