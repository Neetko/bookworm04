**Technical Spec: Weighted Book Tagging Engine**
Objective: Normalize disparate metadata from Google Books and Open Library into 7 canonical genre tags using a weighted heuristic.

1. Canonical Genre Set
HORROR, ROMANCE, FANTASY, SCI-FI, ADVENTURE, MYSTERY, NON-FICTION.

2. Input Processing & Weighted Hierarchy
Process inputs in descending order of authority. Weights are cumulative but capped at 1.0 per tag.

Priority,Source Field,Logic / Heuristic,Weight
Tier 1,Google.categories (BISAC),"Direct string match (e.g., ""Fiction / Horror"" → HORROR).",1.0
Tier 2,OL.lc_classifications,"Starts with P: Fiction. Check PZ (Add ADVENTURE).  Starts with A-O, Q-Z: Add NON-FICTION.",0.9
Tier 2,OL.dewey_decimal_class,800-899: Fiction.  000-799 & 900-999: Add NON-FICTION.,0.9
Tier 3,OL.subjects / subject_facet,"Scan for crossover keywords (e.g., ""Space Opera"").",0.7
Tier 4,Google/OL.description,Regex keyword extraction (Match frequency ≥3).,0.4

Gemini said
To make this professional and "developer-ready," we should format it as a Technical Specification. This reduces ambiguity for the AI and ensures it handles the logic sequence correctly.

Technical Spec: Weighted Book Tagging Engine
Objective: Normalize disparate metadata from Google Books and Open Library into 7 canonical genre tags using a weighted heuristic.

1. Canonical Genre Set
HORROR, ROMANCE, FANTASY, SCI-FI, ADVENTURE, MYSTERY, NON-FICTION.

2. Input Processing & Weighted Hierarchy
Process inputs in descending order of authority. Weights are cumulative but capped at 1.0 per tag.

Priority	Source Field	Logic / Heuristic	Weight
Tier 1	Google.categories (BISAC)	Direct string match (e.g., "Fiction / Horror" → HORROR).	1.0
Tier 2	OL.lc_classifications	
Starts with P: Fiction. Check PZ (Add ADVENTURE). 


 Starts with A-O, Q-Z: Add NON-FICTION.

0.9
Tier 2	OL.dewey_decimal_class	
800-899: Fiction. 


 000-799 & 900-999: Add NON-FICTION.

0.9
Tier 3	OL.subjects / subject_facet	Scan for crossover keywords (e.g., "Space Opera").	0.7
Tier 4	Google/OL.description	Regex keyword extraction (Match frequency ≥3).	0.4
3. Advanced Mapping & Edge Cases
Biographical Fiction: * Trigger: BISAC: BIO + OL: Classification P.

Action: Assign NON-FICTION and ADVENTURE.

The Drama/Prose Rule:

Trigger: BISAC: DRAMA.

Action: Map to ADVENTURE (if prose/novel) or MYSTERY (if crime-themed). Add metadata attribute format: script if detected.

Reliability Enforcement: * Strings starting with BIO, HIS, or TRU must force-apply the NON-FICTION tag before evaluating sub-tags.

4. Refined Keyword Trigger Matrix

Canonical Tag,Keywords (Tier 3 & 4),Crossover Logic (Multi-Tag)
HORROR,"Occult, Slasher, Gothic, Monsters, Ghost, Splatterpunk",Dark Fantasy → HORROR + FANTASY
ROMANCE,"Erotica, Relationships, Clean & Wholesome, Billionaire",Romantic Suspense → ROMANCE + MYSTERY
FANTASY,"Magic, Dragons, Mythology, Epic, Sword & Sorcery",Urban Fantasy → FANTASY + MYSTERY
SCI-FI,"Space Opera, Dystopian, Cyberpunk, Android, Alien",Steampunk → SCI-FI + ADVENTURE
ADVENTURE,"Survival, War, Military, Sea Stories, Western, Exploration",Heist → ADVENTURE + MYSTERY
MYSTERY,"Detective, Crime, Thriller, Noir, Procedural, Hardboiled",Psychological Thriller → MYSTERY + HORROR
NON-FICTION,"History, Biography, Science, Philosophy, Travel, True Crime",Biographical Fiction → NON-FICTION + ADVENTURE

Gemini said
To make this professional and "developer-ready," we should format it as a Technical Specification. This reduces ambiguity for the AI and ensures it handles the logic sequence correctly.

Technical Spec: Weighted Book Tagging Engine
Objective: Normalize disparate metadata from Google Books and Open Library into 7 canonical genre tags using a weighted heuristic.

1. Canonical Genre Set
HORROR, ROMANCE, FANTASY, SCI-FI, ADVENTURE, MYSTERY, NON-FICTION.

2. Input Processing & Weighted Hierarchy
Process inputs in descending order of authority. Weights are cumulative but capped at 1.0 per tag.

Priority	Source Field	Logic / Heuristic	Weight
Tier 1	Google.categories (BISAC)	Direct string match (e.g., "Fiction / Horror" → HORROR).	1.0
Tier 2	OL.lc_classifications	
Starts with P: Fiction. Check PZ (Add ADVENTURE). 


 Starts with A-O, Q-Z: Add NON-FICTION.

0.9
Tier 2	OL.dewey_decimal_class	
800-899: Fiction. 


 000-799 & 900-999: Add NON-FICTION.

0.9
Tier 3	OL.subjects / subject_facet	Scan for crossover keywords (e.g., "Space Opera").	0.7
Tier 4	Google/OL.description	Regex keyword extraction (Match frequency ≥3).	0.4
3. Advanced Mapping & Edge Cases
Biographical Fiction: * Trigger: BISAC: BIO + OL: Classification P.

Action: Assign NON-FICTION and ADVENTURE.

The Drama/Prose Rule:

Trigger: BISAC: DRAMA.

Action: Map to ADVENTURE (if prose/novel) or MYSTERY (if crime-themed). Add metadata attribute format: script if detected.

Reliability Enforcement: * Strings starting with BIO, HIS, or TRU must force-apply the NON-FICTION tag before evaluating sub-tags.

4. Refined Keyword Trigger Matrix
Canonical Tag	Keywords (Tier 3 & 4)	Crossover Logic (Multi-Tag)
HORROR	Occult, Slasher, Gothic, Monsters, Ghost, Splatterpunk	Dark Fantasy → HORROR + FANTASY
ROMANCE	Erotica, Relationships, Clean & Wholesome, Billionaire	Romantic Suspense → ROMANCE + MYSTERY
FANTASY	Magic, Dragons, Mythology, Epic, Sword & Sorcery	Urban Fantasy → FANTASY + MYSTERY
SCI-FI	Space Opera, Dystopian, Cyberpunk, Android, Alien	Steampunk → SCI-FI + ADVENTURE
ADVENTURE	Survival, War, Military, Sea Stories, Western, Exploration	Heist → ADVENTURE + MYSTERY
MYSTERY	Detective, Crime, Thriller, Noir, Procedural, Hardboiled	Psychological Thriller → MYSTERY + HORROR
NON-FICTION	History, Biography, Science, Philosophy, Travel, True Crime	Biographical Fiction → NON-FICTION + ADVENTURE
5. Implementation Requirements
Multi-Tagging: The engine must support an array of tags. If a book matches multiple criteria (e.g., "A vampire romance set in space"), it must return [HORROR, ROMANCE, SCI-FI].

Output Sorting: * Internal: [{tag: "SCI-FI", weight: 1.0}, {tag: "HORROR", weight: 0.7}]

External (UI): Return a flat array of unique strings, sorted by weight descending: ["SCI-FI", "HORROR"].

Library Science Secret Sauce:

PS3550–3626 (Modern American Fiction) → Default to ADVENTURE if no other Tier 1/2 tag is found.

PZ (Juvenile/Young Adult) → Boost ADVENTURE and FANTASY weights.

