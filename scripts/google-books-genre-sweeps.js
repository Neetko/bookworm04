const fs = require('fs');
const env = fs.readFileSync('.env.local','utf8');
const keyMatch = env.match(/GOOGLE_BOOKS_API_KEY=['\"]?([^'\"\n]+)['\"]?/i);
const key = keyMatch ? keyMatch[1] : '';

const categories = {
  romance: [
    'pride and prejudice','sense and sensibility','emma','wuthering heights','jane eyre','outlander','me before you','the notebook','the time traveler\'s wife','twilight','the fault in our stars','beautiful disaster','fifty shades of grey','the hating game','red white and royal blue','it ends with us','people we meet on vacation','beach read','the kiss quotient','the bride test','the wedding date','one day','call me by your name','the rosie project','a walk to remember','the princess bride','the light we lost','p.s. i love you','the proposal','the selection','anna and the french kiss','the duke and i','to all the boys i\'ve loved before','love in the time of cholera','the time traveler\'s wife'
  ],
  horror: [
    'dracula','frankenstein','it stephen king','the shining','salem\'s lot','pet sematary','misery','carrie','the stand','the exorcist','the haunting of hill house','house of leaves','world war z','bird box','mexican gothic','the silence of the lambs','the cabin at the end of the world','the hunger','the ruins','the strain','let the right one in','the girl with all the gifts','the turn of the screw','the lottery','the outsider','the mist','the haunting of hill house','the amityville horror'
  ],
  mystery: [
    'murder on the orient express','and then there were none','the girl with the dragon tattoo','gone girl','the da vinci code','the big sleep','the maltese falcon','the hound of the baskervilles','the name of the rose','in the woods','the dry','big little lies','sharp objects','the silent patient','the woman in the window','the girl on the train','the cuckoo\'s calling','the no. 1 ladies\' detective agency','the lovely bones','a is for alibi','the alienist','the snowman','the secret history','the talisman','the seven deaths of evelyn hardcastle'
  ],
  adventure: [
    'treasure island','the count of monte cristo','the three musketeers','around the world in eighty days','robinson crusoe','moby dick','the odyssey','the iliad','the call of the wild','white fang','the lost world','king solomon\'s mines','journey to the center of the earth','twenty thousand leagues under the sea','the hobbit','the lord of the rings','the martian','life of pi','the alchemist','the road','the jungle book','hatchet','the river','into the wild','endurance','the adventures of tom sawyer','the adventures of huckleberry finn'
  ],
  fantasy: [
    'the hobbit','the lord of the rings','harry potter and the sorcerer\'s stone','a game of thrones','the name of the wind','mistborn','the way of kings','the wheel of time','the chronicles of narnia','the golden compass','the last unicorn','american gods','the priory of the orange tree','the lies of locke lamora','the blade itself','the eye of the world','the fellowship of the ring','the two towers','the return of the king','eragon','the magicians','the dark tower','the once and future king','the stormlight archive'
  ],
  scifi: [
    'dune','foundation','ender\'s game','neuromancer','snow crash','the martian','project hail mary','the expanse','do androids dream of electric sheep','fahrenheit 451','brave new world','1984','the left hand of darkness','hyperion','the time machine','war of the worlds','childhood\'s end','the hitchhiker\'s guide to the galaxy','red mars','old man\'s war','the forever war','the moon is a harsh mistress','ringworld','the three-body problem','blindsight','the dispossessed'
  ]
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const concurrency = 4;

async function fetchCategories(q, categoryCounts, errors) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books${key ? `&key=${key}` : ''}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      errors.push({ q, status: res.status });
      return;
    }
    const json = await res.json();
    const items = json.items || [];
    for (const it of items) {
      const cats = it?.volumeInfo?.categories;
      if (Array.isArray(cats) && cats.length) {
        for (const c of cats) {
          const norm = String(c).trim();
          if (!norm) continue;
          categoryCounts.set(norm, (categoryCounts.get(norm) || 0) + 1);
        }
      }
    }
  } catch (e) {
    errors.push({ q, error: String(e) });
  } finally {
    clearTimeout(timeout);
  }
}

async function sweep(label, queries) {
  const categoryCounts = new Map();
  const errors = [];
  let index = 0;
  let completed = 0;

  async function worker() {
    while (index < queries.length) {
      const current = index++;
      await fetchCategories(queries[current], categoryCounts, errors);
      completed += 1;
      if (completed % 25 === 0 || completed === queries.length) {
        console.error(`${label} progress: ${completed}/${queries.length}`);
      }
      await delay(120);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  const sorted = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    label,
    queries: queries.length,
    categoryCount: sorted.length,
    top: sorted.slice(0, 20),
    errors,
  };
}

(async () => {
  const results = [];
  for (const [label, queries] of Object.entries(categories)) {
    results.push(await sweep(label, queries.slice(0, 100)));
  }
  console.log(JSON.stringify(results, null, 2));
})();
