# Heart Projects and Community Map

## Problem Statement

CoNectar currently gives each Member one free-text Heart Project field. Members can pursue several distinct Heart Projects, but cannot publish, maintain, or show them separately. The single Profile-context embedding also blends Heart Project text with Passions, so it cannot explain which project shares a theme with another Member's project.

Members want to see the shape of the Community: a visual map of broad themes and the Heart Projects connected to them. The map should help them appreciate shared pursuits and open the Profile behind a project. It must not spend AI tokens whenever someone views it.

## Solution

Let a Member publish up to 10 separate Heart Projects, each with a title and description. Use the established multi-item Resource editor interaction pattern during onboarding and Profile editing, adapted to a single list of two-field items. Show every project separately on the Member's Profile.

Give Admins theme management in the Admin Dashboard. Each broad Theme has a name and one-sentence description. Embed each Heart Project and Theme independently through the existing Vercel AI Gateway. On project save, assign up to four active Themes whose cosine similarity passes a threshold calibrated with real Romanian examples. Store the resulting links in Supabase. Recompute links when a project embedding changes or an Admin changes the Theme catalog. A project without a qualifying Theme remains visible under an **Other projects** node.

Add a Member-only Community Map with a central CoNectar node, Theme nodes around it, and one node per visible Heart Project linked to all its matching Themes. The map supports pan, zoom, and a local search over Theme names, project titles, and Member names. Clicking a Theme highlights its projects. Clicking a project opens a right-side detail panel with its title, description, owner, and link to the owner's Profile. Viewing the map only reads persisted data and draws it in the browser; it performs no embedding or LLM call.

## User Stories

1. As an invited participant, I want to understand that I may have several Heart Projects, so that I do not compress unrelated pursuits into one paragraph.
2. As an invited participant, I want to add Heart Projects during onboarding, so that my published Profile reflects what I intend to pursue.
3. As an invited participant, I want to add a project with a title and description, so that its purpose is clear to other Members.
4. As an invited participant, I want to add several projects in one onboarding step, so that each remains distinct.
5. As an invited participant still seeking a Heart Project, I want the existing seeking choice to keep working, so that I am not forced to invent a project.
6. As a Member, I want to add, edit, remove, and reorder my Heart Projects in the Profile editor, so that my Profile stays current.
7. As a Member, I want a clear 10-project limit, so that I understand why I cannot add an eleventh item.
8. As a Member, I want removal to be undoable before saving, so that an accidental tap does not lose my writing.
9. As a keyboard user, I want to complete project editing without dragging, so that ordering and corrections remain accessible.
10. As a mobile Member, I want project editing controls that work with touch and scrolling, so that I can maintain my Profile on a phone.
11. As a Member, I want a visible saving state while embeddings and matching finish, so that I know the app is processing my changes.
12. As a Member, I want a failed embedding or save to leave my published projects unchanged and show a clear toast, so that I can retry safely.
13. As a Member, I want unchanged project text to retain its embedding, so that reordering or editing unrelated Profile fields does not spend unnecessary AI tokens.
14. As a Member viewing a Profile, I want its Heart Projects displayed as distinct ordered items, so that I can understand each pursuit.
15. As a Member using People Search, I want every Heart Project to remain discoverable, so that the move away from one text field does not hide Members.
16. As a Member reading a People Search answer, I want the matching Heart Project identified as a pursuit, so that it is not mistaken for a Resource being offered.
17. As an Admin, I want to create broad Themes with a name and description, so that the map has stable, understandable categories.
18. As an Admin, I want to edit a Theme and rerun matching across Heart Projects, so that a clearer definition changes the map.
19. As an Admin, I want to archive a Theme, so that it disappears from the active map without destroying its record.
20. As an Admin, I want Theme management restricted to Admins, so that Members cannot alter Community-wide categories.
21. As a Member, I want to see CoNectar, Themes, and Heart Projects together, so that I can appreciate the Community's shared pursuits.
22. As a Member, I want one project to connect to several Themes, so that a therapy retreat space can show both its physical-space and therapy aspects.
23. As a Member, I want unmatched projects visible under Other projects, so that the map does not silently omit them.
24. As a Member, I want to pan and zoom the map, so that I can explore dense parts without losing the whole view.
25. As a Member, I want to search Theme names, project titles, and Member names on the map, so that I can focus on a known part of the Community.
26. As a Member, I want a Theme click to highlight its connected projects, so that their shared connection is easy to see.
27. As a Member, I want a project click to open its details and owner Profile link, so that I can learn who is behind it.
28. As a mobile Member, I want the map and project detail panel to remain usable on a narrow screen, so that discovery is not desktop-only.
29. As a Member, I want map viewing to make no AI request, so that exploring it does not spend AI credits.
30. As an invited participant who has not become a Member, I want the map and project details to remain inaccessible, so that the Community stays private.
31. As a current Member, I want my existing Heart Project text carried into the new format, so that migration does not lose my Profile content.

## Implementation Decisions

- **Vocabulary:** Use **Heart Project** in the domain model and the current Romanian product term **Proiect de Suflet** in the interface. Use **Member**, **Profile**, **Passions**, **Resources**, **People Search**, and **Admin Dashboard** as the glossary defines them. Update the glossary's singular Heart Project definition to allow zero to ten projects; keep the existing “still seeking a Heart Project” meaning. Do not introduce per-project status or collaborator-seeking fields.
- **Editor:** Adapt the Resource editor's add, edit, remove with undo, reorder, keyboard, touch, validation, and unsaved-change conventions to a single Heart Project list. Each item has title and description. The same interaction pattern appears in onboarding and full Profile editing. Project content is required only for an item being published. Preserve the existing onboarding path for a Member who is still seeking a Heart Project.
- **Saving feedback:** During synchronous project embedding, matching, and persistence, disable repeat submission and show an accessible blocking overlay with a spinner and Romanian copy equivalent to “Saving your projects and updating the map…”. Use the app's toast convention for success and errors; do not present a success or error paragraph inline. A failed embedding or database write must not partially publish project changes or graph links.
- **Storage:** Add owner-scoped, ordered Heart Project records containing title, description, a 1536-dimensional embedding, and indexing metadata. Add Theme records containing name, description, embedding, and archive state. Add persisted project-to-Theme links with similarity and match-version metadata sufficient to detect stale assignments. Keep the **Other projects** node as a read-model representation of projects with no active links, not as a user-editable Theme.
- **Access:** Follow the existing Member-readable RLS model for Heart Projects, active Themes, and links. Only a Member may change their own projects; only an Admin may change Themes. Authenticated people who have not completed onboarding cannot read the map. Avoid service-role reads for the Member map where RLS can enforce access.
- **Embedding and matching:** Use `openai/text-embedding-3-small` through Vercel AI Gateway, as in ADR-0008. Embed a project's normalized title and description independently; embed each Theme's normalized name and description independently. Compare vectors with pgvector cosine similarity, retain only active Themes over a calibrated threshold, and cap automatic links at four per project. Do not force a weak closest match. Calibrate the threshold against representative Romanian projects and broad Themes before launch; do not treat the existing People Search threshold as the map threshold.
- **Update boundary:** A changed project title or description gets a new embedding and persisted links before save succeeds. A reorder or unrelated Profile edit reuses unchanged project embeddings. Adding, editing, or archiving a Theme recomputes affected project links; editing a Theme definition reruns all matches. Do not add per-link manual overrides or an approval workflow in this release. Admins correct a Theme definition and rerun matching, accepting that this can affect many projects.
- **Graph read model:** The persisted project, Theme, and link rows are the graph's source of truth. A map request loads these rows for eligible Members and performs no embedding, LLM generation, clustering, or semantic matching. Browser layout work uses no AI tokens; exact node coordinates need not persist between visits. Each project appears as one node even if it has multiple Theme links.
- **Visualization:** Use Cytoscape.js for the graph. Render CoNectar at the conceptual center, then active Themes and their project links. Theme clicks highlight connected projects without opening a Theme sidebar. Project clicks open the right-side detail panel; on mobile it remains reachable and dismissible. Search filters or focuses the already-loaded graph locally and makes no AI call. Provide accessible text equivalents for important graph relationships and a usable non-pointer path to project details.
- **Profile and People Search:** Show all published Heart Projects on Profiles. Extend ADR-0010's separated search approach: keep Resources as offers, keep Passions as Profile context, and retrieve individual Heart Projects as pursuit evidence. Merge evidence by Member so one Member is not duplicated in an answer. Do not classify a Heart Project as a Free or Paid Resource. Update the Profile-context re-embedding and webhook path so it does not retain stale scalar Heart Project content or double-embed projects.
- **Migration:** Backfill each nonempty legacy Heart Project description into one owned project titled **Soul project**, preserving its description. Let the owner rename it later. Preserve the existing “still seeking” semantics for Profiles with no project. Backfill per-project embeddings and links after Themes exist. Coordinate the schema, RPCs, generated database types, Profile readers, and seed data through Supabase CLI migrations and type generation; no manual dashboard schema changes.
- **Initial Theme catalog:** An Admin enters roughly 8–12 broad, flat Themes in the Admin Dashboard before launch. No automatic Theme discovery, topic hierarchy, member-selected labels, or code-seeded Theme list is part of this release.
- **Navigation and scale:** Add a Member-only Community Map entry to navigation. The whole active graph is initially visible with pan and zoom, and search can focus it. CoNectar targets at most about 1,000 Members, but graph readability and load time must be measured with representative project counts before release.

## Testing Decisions

- Good tests assert observable outcomes: published projects, assigned Themes, Member access, People Search evidence, and rendered interactions. They do not assert helper calls, React state, CSS classes, vector storage layout, or a particular Cytoscape layout algorithm.
- Use the existing onboarding and Profile save service/action boundary as the primary automated seam with an injected embedder and database adapter. Cover multiple projects, zero projects for a seeking Member, maximum 10, edits, deletion, ordering, unchanged-text embedding reuse, synchronous failure without partial publication, and loading/toast behavior. Existing onboarding submission and Profile update tests are prior art.
- Extend rendered editor tests at the shared interaction surface to cover title/description validation, add/edit/remove/undo, keyboard and touch-accessible reorder alternatives, disabled submission, and both onboarding and Profile editing. Existing Resource editor and onboarding form tests are prior art.
- Use local Supabase integration tests for migrations, pgvector matching, transaction boundaries, Member and Admin RLS, Theme archive/recompute behavior, and the legacy data backfill. Existing Resource database, Profile update RPC, and Member-readable RLS tests are prior art. Tests must run against `supabase start`, not a remote project.
- Exercise People Search at its orchestration seam with fake gateway responses and representative Romanian project text. Verify the separate Heart Project evidence path, multi-project matches, deduplication by Member, unchanged Resource classification, and no false claim that a pursuit is an offer. Existing search-members tests are prior art.
- Exercise the map's Member-facing data boundary and rendered UI with persisted example rows. Verify multi-Theme edges, unmatched projects under Other projects, archive effects, local search, Theme highlighting, project detail/profile navigation, empty states, and no gateway call on page view.
- **Manual Chrome QA is required before handoff for every rendered or interactive change.** Use the signed-in Chrome session at `http://localhost:3000/`, not an anonymous browser. Before testing, select the Chrome browser family explicitly in the browser-control runtime, read its documentation, list open user tabs, claim the exact CoNectar localhost tab (or open localhost in the same Chrome profile if absent), and inspect the page. Confirm the expected URL and authenticated navigation/Profile plus sign-out control from visible page state. Do not inspect cookies or local storage to infer sign-in.
- In that signed-in Chrome session, exercise onboarding with multiple projects, the seeking path, Profile add/edit/remove/reorder, the saving overlay, success and failure toasts, Profile display, Admin Dashboard Theme creation/edit/archive and rematching, People Search project evidence, map search/pan/zoom, Theme highlight, project detail panel, and Profile link. Check at both desktop and mobile viewport sizes, including keyboard interaction and validation states. Record the flows and results in the implementation handoff.
- If Chrome control is unavailable, run the extension/browser connection diagnostics and resolve access before claiming manual QA complete. Do not substitute an unsigned browser or report unverified steps as passed. The implementation handoff must state any remaining browser blocker explicitly.

## Out of Scope

- Automatic discovery or naming of Themes with BERTopic, KeyBERT, an LLM, or another clustering pipeline.
- Member-selected Themes, Theme hierarchies, per-link Admin overrides, and an Admin approval queue for assignments.
- Per-project active/aspirational state, collaborator availability, other status fields, external project links, or richer project pages.
- Resource or Passion nodes in the map. The graph read model should allow additional typed nodes later without requiring this release to display them.
- Persistent pixel coordinates, graph snapshots, or AI-generated graph layouts.
- Member-to-Member working groups, collaboration requests, messaging from the map, or project-specific contact methods.
- Public or signed-out access to the map.

## Further Notes

- The automatic assignment is **matching projects against a curated Theme catalog**, not discovering new Theme names. This allows multiple understandable labels per project and keeps assignments stable enough to store and inspect.
- A broad Theme description is a coarse correction tool. Editing one to fix a mistaken link may alter many projects. Validate the initial threshold and Theme wording with real Romanian examples such as a dance space, therapy retreat space, therapy course, and agroforestry space, including expected multi-label and unmatched cases.
- ADR-0008 fixes the embedding model and Gateway path. ADR-0006 fixes the Member gate. ADR-0010's two-path People Search design needs an explicit update when individual Heart Projects become a third retrieval path. The project glossary needs a corresponding Heart Project definition update.
- Cytoscape.js is the selected open-source graph renderer: <https://js.cytoscape.org/>.
- At spec drafting, system diagnostics showed Chrome, its extension, and native-host manifest were healthy, and the signed-in CoNectar tab had been read successfully. A later browser-control attempt still referenced a deleted plugin cache after the ChatGPT app reopened. Treat connection verification as a QA preflight, not as evidence that the feature was browser-tested.
