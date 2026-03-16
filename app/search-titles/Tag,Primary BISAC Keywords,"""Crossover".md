**Build a Weighted Tagging Engine** that processes book metadata from Google Books (volumeInfo.categories) and Open Library (lc_classifications, dewey_decimal_class, and subjects).

The engine must output a JSON object containing a list of tags from my 7 Canonical Genres: HORROR, ROMANCE, FANTASY, SCI-FI, ADVENTURE, MYSTERY, NON-FICTION.

1. Input Priority & Weighting
Tier 1 (Weight 1.0): Direct BISAC matches from Google categories (e.g., FICTION / Romance → ROMANCE).

Tier 2 (Weight 0.9): Library Classifications from Open Library:

LC Classification: If starts with P (Literature), check subclasses: PZ (Adventure/Juvenile), PR/PS (General/Adventure). If starts with anything else (e.g., Q, H, B), tag as NON-FICTION.

Dewey Decimal: 800-899 → Fiction (Scan subjects for genre); 000-799 & 900-999 → NON-FICTION.

Tier 3 (Weight 0.7): Open Library subject_facet and subjects. Scan for refined keywords (e.g., 'Space Opera' → SCI-FI + ADVENTURE).

Tier 4 (Weight 0.4): Keyword extraction from the description field.

2. Conflict & Mapping Rules
Biographical Fiction: If BIOGRAPHY appears in BISAC but Fiction appears in OL classification, apply tags NON-FICTION and ADVENTURE.

The "Drama" Rule: Map BISAC DRAMA to ADVENTURE if prose, or keep as a secondary 'Script' attribute.

Multi-Tagging: Allow a book to have multiple tags if keywords from different categories are found (e.g., Romantic Suspense → ROMANCE + MYSTERY).

3. Output Format
Return a flat array of unique strings for the UI, but maintain the weights internally to sort the most relevant tag to the first position."

Why this works (The "Secret Sauce")
Using the LC Classifications is your biggest win. In library science:

PS3550-3626 is where almost all modern American genre fiction lives.

PZ is the "Adventure" goldmine for any book with a younger protagonist.

By checking the LC Classification first, you bypass the "metadata noise" where a publisher might forget to tag a book as "Non-Fiction" because they think "Biography" is enough






Tag,Primary BISAC Keywords,"""Crossover"" Trigger Words"

In BISAC, anything that doesn't start with FIC, JUV, or YAF is Non-Fiction.

Reliability Check: If the string starts with BIO (Biography), HIS (History), or TRU (True Crime), always apply the NON-FICTION tag first, then look for sub-tags.

Example: TRUE CRIME / Murder / Serial Killers -> Tags: NON-FICTION, MYSTERY.

HORROR,"Horror, Occult, Supernatural, Slasher, Gothic, Monsters, Ghost Stories",
Dark Fantasy (Triggers Horror + Fantasy)
ROMANCE,"Romance, Love Stories, Erotica, Relationships, Clean & Wholesome",
Romantic Suspense (Triggers Romance + Mystery)
FANTASY,"Fantasy, Magic, Dragons, Fairy Tales, Mythology, Epic, Urban Fantasy",
Science Fiction / Fantasy (Triggers Fantasy + Sci-Fi)
SCI-FI,"Science Fiction, Space Opera, Dystopian, Cyberpunk, Androids, Time Travel, Alien",
Steampunk (Triggers Sci-Fi + Adventure)
ADVENTURE,"Action & Adventure, Survival, War, Military, Sea Stories, Westerns, Exploration",
Heist (Triggers Adventure + Mystery)
MYSTERY,"Mystery, Detective, Crime, Thriller, Suspense, True Crime, Noir, Procedural",
Psychological Thriller (Triggers Mystery + Horror)
NON-FICTION,"Any string NOT starting with FICTION, JUVENILE FICTION, or YOUNG ADULT FICTION",
Biographical Fiction (Triggers Non-Fiction + Adventure/Mystery)