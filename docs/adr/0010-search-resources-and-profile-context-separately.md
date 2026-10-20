# Search Resources, Profile context, and Heart Projects separately

People Search embeds each Resource independently, keeps a separate per-Member embedding for
Passions as Profile context, and embeds each published Heart Project independently from its title
and description. Every query searches all three indexes and merges evidence by Member, so a
Member with several matching projects appears once in the answer. The answer distinguishes an
explicit free or paid Resource offer from a Passion or Heart Project pursuit; it may identify
the matching project but must not imply that the Member offers it as a Resource. Help-seeking
queries rank Resource evidence first, while explicit free or paid wording filters strictly to
that Resource classification. Separate retrieval prevents Profile context from diluting precise
need-to-offer matching and lets an edit to one Resource or Heart Project re-embed only that item.

Cost intent remains conversational rather than becoming a search control. A lightweight structured
classification step maps natural Romanian phrasing to `any`, `free`, or `paid` before retrieval, so
explicit cost intent can be enforced as a database filter instead of being left to answer generation.
