/**
 * The scoring rubric, for display on the homepage.
 *
 * This mirrors api/_criteria.py so the marketing copy can never advertise rules
 * the scorer does not actually apply. `tests/test_rubric_sync.py` parses this
 * file and fails if the ids, labels or points drift from the Python source.
 */

export interface RubricEntry {
  id: string;
  label: string;
  points: number;
  description: string;
}

export const RUBRIC: RubricEntry[] = [
  {
    id: "readme",
    label: "Documentation",
    points: 20,
    description: "A README in the repository root (.md, .rst, .txt or no extension).",
  },
  {
    id: "size",
    label: "Project size",
    points: 20,
    description: "More than 100 KB of source — large enough to be a real project.",
  },
  {
    id: "language",
    label: "Primary language",
    points: 15,
    description: "GitHub can identify a primary programming language.",
  },
  {
    id: "license",
    label: "License",
    points: 10,
    description: "A LICENSE, LICENCE or COPYING file, or a license GitHub recognises.",
  },
  {
    id: "gitignore",
    label: "Version control hygiene",
    points: 10,
    description: "A .gitignore, so build output and secrets stay out of the repository.",
  },
  {
    id: "tests",
    label: "Testing",
    points: 10,
    description: "A tests/, test/, spec/ or __tests__/ directory, or a test config file.",
  },
  {
    id: "stars",
    label: "Community interest",
    points: 10,
    description: "At least one star from another GitHub user.",
  },
  {
    id: "forks",
    label: "Collaboration",
    points: 5,
    description: "At least one fork, indicating others have built on the work.",
  },
];

export const MAX_SCORE = RUBRIC.reduce((total, entry) => total + entry.points, 0);
