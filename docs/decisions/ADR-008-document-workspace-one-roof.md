# ADR-008: Document Workspace — one roof for humans and agents

**Status:** Accepted  
**Date:** 2026-09-29

## Context

The draft editor grew peer “modes” (fields, PDF annotate, Office edit, structure)
that swapped the whole main pane and felt like leaving the product. Cap dogfood
could not tell what each mode was for. Agents already reach the same jobs via
MCP (`seal_annotate_document_pdf`, `seal_rotate_document_pdf`, `seal_split_document`,
field tools, etc.) while the SPA invented a parallel taxonomy.

Seal needs to absorb more document capabilities over time without inventing a
new surface each time.

## Decision

1. **One Document Workspace** owns the draft document chrome (shell, rail,
   sidebar). Capabilities plug into it; they do not exile the user into a
   separate app.
2. **Capability registry** (`DOCUMENT_CAPABILITIES`) is the product surface.
   Each capability has a stable `id`, human label/description, and the agent
   MCP tool names that implement the same job. New work extends the registry.
3. **Engines may differ underneath** today (field canvas vs EmbedPDF vs Office
   editors). Convergence onto a single canvas is allowed later; the roof and
   IDs stay.
4. **Humans and agents share the same capability map.** SPA rail and MCP tools
   must not invent parallel names for the same job.

## Consequences

- SPA uses a persistent capability rail, not “Leave signature fields” menus.
- Pages ops (rotate / merge / split) are a first-class capability, not only a
  buried sidebar accordion.
- Adding OCR, compare, or redaction packs means a new registry entry + panel —
  not a new top-level product mode.
- Drift between MCP tool names and registry `agentTools` is a bug.

## Canvas convergence (2026-09-29)

**Fields**, **Mark up**, and read-only **view** share one EmbedPDF mount
(`DocumentCanvas`). Switching the rail changes interaction chrome and the Seal
field overlay — it does not tear down the PDF. Zoom / page keyboard shortcuts
live on that canvas (SEA-78 / SEA-79). Office / Pages / Layout remain capability
panels on the same workspace roof until they also need that canvas.
