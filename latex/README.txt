LearnTrack — Detailed DBMS report (LaTeX)
=========================================

File: DBMS_PROJECT_REPORT.tex

Contents (expanded edition):
  - Extended abstract & keywords
  - Motivation, problem statement, objectives, scope
  - Layered architecture table; roles (student / instructor / admin)
  - Requirements traceability table → relations
  - ER narrative & cardinality matrix
  - Normalisation discussion (functional dependencies, decomposition)
  - Physical design: indexes, column types
  - Data dictionary prose for all core tables & views inventory
  - Triggers/functions; illustrative SQL listing (performance summary joins)
  - Transactional workflows: enrollment & quiz grading (step-by-step)
  - API ↔ table mapping sketch; concurrency (enrollment UNIQUE)
  - Join taxonomy, aggregation caveats, materialized-view staleness
  - Frontend data perspective (quiz JSON import pattern)
  - Testing, deployment, limitations, conclusions
  - Bibliography | Appendices: REST inventory, glossary, repo file map

This report deliberately does NOT discuss PostgreSQL Row-Level Security (RLS);
access control is described as JWT + Express middleware + query scoping only.

ERD / RDM placeholders
----------------------
The report includes framed placeholders for:
  • Figure: conceptual ERD       (Chapter: Conceptual Database Design)
  • Figure: relational RDM       (Chapter: Logical Design)
Add PDF/PNG files under figures/ — see figures/README.txt — then uncomment
the \includegraphics lines in the two figure blocks.

Compile (TeX Live / MiKTeX):

  cd learntrack\latex
  pdflatex DBMS_PROJECT_REPORT.tex
  pdflatex DBMS_PROJECT_REPORT.tex

Output: DBMS_PROJECT_REPORT.pdf

Overleaf: upload DBMS_PROJECT_REPORT.tex and create a folder "figures/"
if you add erd.pdf / rdm.pdf there.
