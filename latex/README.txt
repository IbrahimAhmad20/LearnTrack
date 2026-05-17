LearnTrack — DBMS report (LaTeX, modular)
==========================================

Main file
---------
`DBMS_PROJECT_REPORT.tex` — preamble, title page, abstract, table of contents,
then `\input{chapters/...}` for each chapter. **Compile from the `latex/` folder**
so paths to `figures/` and `chapters/` resolve correctly.

Chapter files (edit these)
---------------------------
All under `latex/chapters/`:

| File | Topic |
|------|--------|
| `01-introduction.tex` | Motivation, problem, objectives, scope |
| `02-system-overview.tex` | Architecture, API prefix, roles |
| `03-requirements.tex` | Stakeholders, functional/non-functional requirements |
| `04-conceptual-design.tex` | ER narrative, cardinality, ERD figure placeholder |
| `05-logical-design.tex` | Normalisation, FDs, RDM figure placeholder |
| `06-physical-design.tex` | Indexes, types, materialized view indexes |
| `07-data-dictionary.tex` | Tables and views explained in plain language |
| `08-database-objects.tex` | Triggers, functions, sample SQL listing |
| `09-transactions.tex` | Enrollment & quiz flows, endpoint mapping |
| `10-analytics.tex` | Joins, aggregates, refresh strategy |
| `11-workflows.tex` | Authoring, learning session, analytics refresh |
| `12-sql-patterns.tex` | Worked SQL examples |
| `13-frontend.tex` | React ↔ API data flow |
| `14-qa-testing.tex` | Testing and manual checklist |
| `15-deployment.tex` | Vercel / Render / env vars |
| `16-conclusion.tex` | Summary, limits, future work |
| `99-appendices.tex` | REST inventory, glossary, repo map |

Figures
-------
Place `erd.pdf` / `erd.png` and `rdm.pdf` / `rdm.png` under `figures/`.
Uncomment the `\includegraphics` lines inside chapters 4 and 5.
See `figures/README.txt`.

Compile (TeX Live / MiKTeX)
---------------------------
```text
cd learntrack\latex
pdflatex DBMS_PROJECT_REPORT.tex
pdflatex DBMS_PROJECT_REPORT.tex
```

Output: `DBMS_PROJECT_REPORT.pdf`

Overleaf
--------
Upload `DBMS_PROJECT_REPORT.tex`, the whole `chapters/` folder, and `figures/`.
Set the Overleaf project root so `chapters/` sits next to the main `.tex` file.

Style note
----------
The report text is written in **clear, plain English** for presentations; technical
terms are introduced when needed. Row-Level Security (RLS) exists in `ddl.sql`
but this report emphasises JWT + Express role checks unless your instructor
asks for RLS detail.
