Diagrams for LaTeX report (ERD & RDM)
======================================

Place exported images here so DBMS_PROJECT_REPORT.tex can include them:

  Bahria.jpg               — University logo (title page); optional but recommended
  erd.pdf   OR   erd.png    — Conceptual Entity–Relationship Diagram
  rdm.pdf   OR   rdm.png    — Relational Data Model (logical schema diagram)

The .tex file sets:
  \graphicspath{{figures/}}

So filenames are referenced as "erd.pdf" / "erd.png" (no "figures/" prefix).

Suggested tools
-----------------
• draw.io / diagrams.net — export PDF or PNG
• dbdiagram.io — DBML → diagram (good for RDM-style table boxes)
• Lucidchart / Visio — Chen or crow's foot notation for ERD
• pgAdmin / pgModeler — auto schema diagrams for RDM (PostgreSQL)

ERD vs RDM (cheat sheet)
------------------------
ERD (conceptual):
  - Entity TYPES and RELATIONSHIP labels
  - Cardinality: 1:1, 1:N, M:N (enrollment resolves M:N student–course)
  - Usually no “VARCHAR(100)” column detail

RDM (relational / logical):
  - One box per TABLE (relation)
  - Mark PK, FK → other_table(pk_col)
  - List main attributes; FK lines between boxes

After adding files, edit DBMS_PROJECT_REPORT.tex:
  • In the ERD figure: comment out the \fbox{...} block, uncomment
      \includegraphics[...]{erd.pdf}
  • In the RDM figure: same for rdm.pdf / rdm.png

Optional: keep both placeholder and real figure during draft by duplicating
the figure environment.
