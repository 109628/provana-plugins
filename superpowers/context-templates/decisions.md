# Architectural Decisions Log
<!-- docs/decisions.md — append-only. Never edit or delete existing entries. -->
<!-- Every architectural decision, deferred item, and mid-sprint change goes here. -->
<!-- Consumed by: mem-compile.sh, arch-notify.sh, finishing-provana-branch skill -->

**Format:**
```
[YYYY-MM-DD] [Category]: [Decision]. [Reason]. [Alternatives considered]. [Trade-offs accepted].
```

**Categories:** Architecture | LLMOps | Mid-sprint | Deferred | Rollback | Postmortem

---

## Decisions

<!-- Add entries below this line. Newest entries at the bottom. -->

[YYYY-MM-DD] Architecture: [Example entry] Using PyMuPDF for PDF parsing over pdfplumber.
  Reason: 3x faster on multi-column layouts in benchmark on client document set.
  Alternatives: pdfplumber (better table detection), Tika (Java dependency, rejected).
  Trade-offs: Less robust on scanned/low-res PDFs. Acceptable given client doc quality.

[YYYY-MM-DD] LLMOps: [Example] Prompt version 1.0 deployed to production for invoice extraction.
  Accuracy on ground-truth: 91.2%. Latency p95: 380ms.
  Logged in: llmops/prompt_versions.log

[YYYY-MM-DD] Deferred: [Example] Confidence score calibration for low-res documents.
  Reason: Deferred to sprint N+1 — client's document quality is high, low priority.
  Azure Board: AB#142

[YYYY-MM-DD] Mid-sprint change: [Example] story-003 AC2 updated to require `missing_fields` list.
  Original requirement did not specify handling. Client clarified during review.
  Impact: 2 files, 1 task. Approved by: [PM/QA name]. Worktree: mid-sprint/missing-fields-0510.

---

## Deferred items tracker

| Item | Story | Azure Board | Sprint target | Status |
|------|-------|-------------|---------------|--------|
| [item] | story-NNN | AB#NNN | Sprint N+1 | Open |
