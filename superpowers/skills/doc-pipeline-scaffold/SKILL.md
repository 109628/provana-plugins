---
name: doc-pipeline-scaffold
description: Use for all Pod 2 Doc.AI and document extraction work at Provana. Scaffolds ingest/parse/extract/store pipelines, runs document discovery interviews, generates field extraction schemas from sample documents, builds extraction QC harnesses, and creates classification training labels. Trigger on "doc.ai", "document extraction", "extract fields", "parse documents", "doc pipeline", "schema extraction", "document AI", "ingest", "doc types", "extraction accuracy", or any Pod 2 delivery work.
---

# Doc.AI Pipeline Scaffold

Pod 2 domain skill. Covers the full technical delivery surface for document extraction and Doc.AI products.

**Announce at start:** "Running doc-pipeline-scaffold for Pod 2 (Doc.AI / Eng-facing) work."

## What this skill covers

- Document pipeline scaffolding (ingest → parse → extract → store)
- Document discovery interview (types, volumes, formats)
- Schema extraction from sample documents
- Extraction QC harness (accuracy, missed fields, edge cases)
- Document type classification and labelling
- Integration with Kiran's platform (schema maps, QC checklists, arch review)

## Step 1: Document discovery interview

Before writing any code, run this interview with PM/QA and the business stakeholder:

```markdown
## Document Discovery Interview

**Volume & format:**
- Approximate monthly volume of documents to process?
- Primary document types: [invoices / contracts / medical forms / financial statements / other]
- Primary formats: [PDF / scanned image / Word / Excel / email / other]
- Languages: [English only / multilingual — which languages?]
- Source systems: [email attachments / SFTP / SharePoint / Azure Blob / other]

**Field requirements:**
- List the 10 most important fields to extract (name, value, data type)
- Which fields are always present? Which are conditional?
- What is the acceptable accuracy threshold per field? (Provana default: >85%)
- What happens when a field is missing or below confidence threshold?

**Edge cases:**
- Document variations (different layouts for same type)?
- Handwritten content present?
- Tables, nested structures, or multi-page documents?
- PII fields requiring special handling?

**Downstream use:**
- Where does extracted data go? (database, API, Azure Board, other)
- How is extraction output validated today?
- Who does final QC? (PM/QA, business team, automated only)
```

Save answers to `docs/doc-discovery-[date].md` before continuing.

## Pipeline scaffold

```python
# src/doc_ai/pipelines/[name]_pipeline.py
from src.doc_ai.ingest import DocumentIngestor
from src.doc_ai.parsers import DocumentParser
from src.doc_ai.extractors.[name]_extractor import [Name]Extractor
from src.doc_ai.store import ExtractionStore

class [Name]Pipeline:
    """
    [Document type] extraction pipeline.
    SLOs: field accuracy >85%, missed fields <5%
    """
    def __init__(self, config: PipelineConfig):
        self.ingestor = DocumentIngestor(config.ingest)
        self.parser = DocumentParser(config.parse)
        self.extractor = [Name]Extractor(config.extract)
        self.store = ExtractionStore(config.store)

    def process(self, document_path: str) -> ExtractionResult:
        raw = self.ingestor.load(document_path)
        parsed = self.parser.parse(raw)
        extracted = self.extractor.extract(parsed)
        self.store.save(extracted)
        return extracted
```

## Schema from sample documents

Run this against a set of 10+ real sample documents (anonymised):

```python
# tools/schema_extractor.py
"""
Generates field extraction schema from sample documents.
Usage: python tools/schema_extractor.py --samples path/to/samples/ --output src/doc_ai/schemas/
"""
# Outputs:
# - [doc_type]_schema.py: field definitions with types and confidence thresholds
# - [doc_type]_schema.md: human-readable schema for PM/QA review
```

Schema structure:

```python
# src/doc_ai/schemas/[name]_schema.py
from dataclasses import dataclass
from typing import Optional

@dataclass
class [Name]Schema:
    # Required fields (always present)
    [field_1]: str          # e.g. invoice_number: str
    [field_2]: float        # e.g. total_amount: float
    [field_3]: date         # e.g. invoice_date: date

    # Conditional fields
    [field_4]: Optional[str] = None   # e.g. purchase_order: Optional[str]

    # Metadata
    confidence: dict = None  # per-field confidence scores
    missing_fields: list = None
    doc_type: str = "[name]"
    extraction_version: str = "1.0.0"
```

## Extraction QC harness

```python
# tests/doc_ai/harness/extraction_qc.py
class ExtractionQC:
    """PM/QA runs this harness to verify extraction accuracy."""

    def run_accuracy_suite(self, ground_truth_dataset: list[GroundTruth]) -> QCReport:
        results = []
        for sample in ground_truth_dataset:
            extracted = self.pipeline.process(sample.document_path)
            for field in sample.expected_fields:
                results.append(FieldAccuracyResult(
                    field=field.name,
                    expected=field.value,
                    actual=getattr(extracted, field.name),
                    correct=extracted[field.name] == field.value,
                    confidence=extracted.confidence.get(field.name, 0.0),
                ))
        return QCReport(
            total_fields=len(results),
            correct_fields=sum(r.correct for r in results),
            accuracy=sum(r.correct for r in results) / len(results),
            missed_fields=[r.field for r in results if r.actual is None],
            below_threshold=[r.field for r in results if r.confidence < 0.85],
        )
```

## Integration with Kiran's platform

For Pod 2, the handoff to Engineering includes:
- Schema maps (field definitions, data types, confidence thresholds)
- QC checklists (per document type, per field)
- Arch review requests (how extraction pipeline integrates with existing systems)
- Ground-truth datasets for ongoing QC evaluation

Document these in `docs/arch.md` with an arch review request before go-live.

## Extraction accuracy ground-truth dataset

PM/QA builds and owns the ground-truth dataset:
- Minimum 50 documents per document type
- All fields labelled by a human
- Stored in `tests/doc_ai/ground_truth/[doc_type]/`
- Never generated by AI — must be human-labelled

The `extraction-qc` skill (PM/QA owned) uses this dataset for ongoing accuracy verification.
