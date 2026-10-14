# Design Decisions

Lightweight, reversible product and design decisions that should remain visible but do not warrant
an Architecture Decision Record.

## 2026-10-14 — CoNectar appearance and navigation

**Status:** Current

The CoNectar Brandbook defines the app's light and dark colors, system sans typography, and button states. The device appearance is the default; a member's saved choice can override it. The appearance icon follows sign out in the desktop navbar. Desktop navigation shows Chat, Membri, Profil, and Admin for admins, with the 🍯 CoNectar mark on the left. Mobile retains the drawer and offers the same appearance choice. The audience language includes people in men's and women's circles. Invite mechanics and the existing affiliated-community catalog remain unchanged.

## 2026-08-11 — Community Affiliations do not influence People Search

**Status:** Current

Community Affiliations are displayed on a Member's Profile but are not included in People Search
embeddings, matching, filtering, or answers. People Search keeps its current behavior.

This can be added later without changing the Community Affiliation data model. Doing so will require
adding affiliations to the profile embedding input, triggering re-embedding when affiliations change,
and backfilling embeddings for existing Members.

## 2026-08-11 — Profile editing uses immediate validity feedback

**Status:** Current

The complete Profile editor validates on every input change. A required or otherwise invalid field
receives a red border immediately, and the save button remains disabled whenever any Profile rule is
unsatisfied. The button becomes enabled again as soon as the entire Profile is valid.
