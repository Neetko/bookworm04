const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const keyMatch = env.match(/GOOGLE_BOOKS_API_KEY=['\"]?([^'\"\n]+)['\"]?/i);
const key = keyMatch ? keyMatch[1] : '';

const baseQueries = [
  'war and peace','dune','the hobbit','atomic habits','pride and prejudice','harry potter','lord of the rings','game of thrones','the alchemist','1984','to kill a mockingbird','the great gatsby','moby dick','crime and punishment','anna karenina','brave new world','the catcher in the rye','the little prince','the kite runner','the book thief','the hunger games','twilight','the fault in our stars','gone girl','the girl on the train','the da vinci code','angels and demons','inferno','the maze runner','ready player one','endurance','educated','sapiens','homo deus','thinking fast and slow','rich dad poor dad','the lean startup','zero to one','deep work','atomic','elon musk','steve jobs','becoming','michelle obama','barack obama','the bible','quran','bhagavad gita','tao te ching','meditations','the art of war','the prince','the odyssey','the iliad','hamlet','macbeth','romeo and juliet','don quixote','ulysses','the sun also rises','of mice and men','the grapes of wrath','dracula','frankenstein','jane eyre','wuthering heights','little women','sense and sensibility','emma','great expectations','a tale of two cities','les miserables','the count of monte cristo','the three musketeers','the stranger','the plague','the brothers karamazov','the idiot','notes from underground','the trial','the metamorphosis','the picture of dorian gray','the road','the handmaid\'s tale','the testaments','life of pi','the name of the wind','mistborn','wheel of time','stormlight archive','foundation','dune messiah','neuromancer','snow crash','ender\'s game','do androids dream of electric sheep','fahrenheit 451','the martian','project hail mary','the expanse','ready player one','the silent patient','the girl with the dragon tattoo','the help','the secret','the power of habit','mindset','grit','outliers','the tipping point','blink','the 7 habits of highly effective people','how to win friends and influence people','the subtle art of not giving a f*ck',
  'the shadow of the wind','one hundred years of solitude','love in the time of cholera','the pillars of the earth','the name of the rose','the road to character','thinking in systems','the design of everyday things','the art of computer programming','clean code','clean architecture','introduction to algorithms','design patterns','structure and interpretation of computer programs','the pragmatic programmer','the myth of sisyphus','being and nothingness','thus spoke zarathustra','the republic','the symposium','critique of pure reason','phenomenology of spirit','the wealth of nations','capital in the twenty-first century','freakonomics','the undercover economist','nudge','the psychology of money','the intelligent investor','security analysis','the little book of common sense investing','on writing','bird by bird','steal like an artist','save the cat','the artist\'s way','the elements of style','the chicago manual of style','the fellowship of the ring','the two towers','the return of the king','the silmarillion','the children of hurin','the fall of gondolin','the wheel of time','a game of thrones','a clash of kings','a storm of swords','a feast for crows','a dance with dragons','the winds of winter','the kingkiller chronicle','the wise man\'s fear','the slow regard of silent things','the lies of locke lamora','red rising','golden son','morning star','iron gold','dark age','the expanse leviathan wakes','caliban\'s war','abaddon\'s gate','cibola burn','nemesis games','babylon\'s ashes','persepolis rising','tiamat\'s wrath','leviathan falls','the color purple','beloved','their eyes were watching god','the color of water','educated','the glass castle','into the wild','wild cheryl strayed','the immortal life of henrietta lacks','unbroken','seabiscuit','the devil in the white city','the boys in the boat','endurance shackleton','into thin air','the perfect storm','the right stuff','the soul of a new machine','the phoenix project','accelerate','measure what matters','radical candor','good to great','built to last','the e-myth revisited','rework','hooked','influence','predictably irrational','thinking fast and slow','the happiness hypothesis','the power of now','the four agreements','the alchemist','the prophet','siddhartha','man\'s search for meaning','the road less traveled','the war of art','the obstacle is the way','ego is the enemy','stillness is the key'
];

const templates = [
  'history of {x}','introduction to {x}','advanced {x}','{x} for beginners','the art of {x}','{x} handbook','{x} guide','{x} textbook','{x} study guide','the {x} anthology','{x} biography','{x} memoir','{x} essays','{x} poems','{x} short stories','the {x} cookbook','{x} recipes','{x} workbook','{x} companion','{x} analysis'
];

const topics = [
  'python','javascript','machine learning','data science','statistics','calculus','linear algebra','physics','chemistry','biology','neuroscience','economics','finance','investing','marketing','design','architecture','philosophy','psychology','sociology','anthropology','history','politics','law','medicine','nursing','public health','education','leadership','management','entrepreneurship','writing','literature','poetry','art','music','film','photography','cooking','baking','nutrition','fitness','mindfulness','meditation','stoicism','buddhism','christianity','islam','judaism','mythology','fantasy','science fiction','mystery','thriller','romance','horror','adventure','nonfiction','biography','memoir','self help','graphic novels','comics','young adult'
];

const expanded = [];
for (const t of topics) {
  for (const temp of templates) {
    expanded.push(temp.replace('{x}', t));
  }
}

const all = [...new Set([...baseQueries, ...expanded])].slice(0, 500);
const categoryCounts = new Map();
const noCategory = [];
const errors = [];
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const concurrency = 8;

async function fetchCategories(q) {
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
    let found = false;
    for (const it of items) {
      const cats = it?.volumeInfo?.categories;
      if (Array.isArray(cats) && cats.length) {
        found = true;
        for (const c of cats) {
          const norm = String(c).trim();
          if (!norm) continue;
          categoryCounts.set(norm, (categoryCounts.get(norm) || 0) + 1);
        }
      }
    }
    if (!found) noCategory.push(q);
  } catch (e) {
    errors.push({ q, error: String(e) });
  } finally {
    clearTimeout(timeout);
  }
}

(async () => {
  let index = 0;
  let completed = 0;

  async function worker() {
    while (index < all.length) {
      const current = index++;
      await fetchCategories(all[current]);
      completed += 1;
      if (completed % 50 === 0 || completed === all.length) {
        console.error(`Progress: ${completed}/${all.length}`);
      }
      await delay(80);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  const sorted = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
  const out = {
    queries: all.length,
    categoryCount: sorted.length,
    top: sorted.slice(0, 40),
    noCategory: noCategory.slice(0, 40),
    errors,
  };
  console.log(JSON.stringify(out, null, 2));
})();
