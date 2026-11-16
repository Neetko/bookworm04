-- Deterministic local showcase fixtures.
-- `supabase db reset --local` rebuilds these titles, optimized covers, demo reader,
-- five followed profiles, and a populated activity feed without external APIs.

insert into public.titles (id, title, author, description, cover_image_url, genre, published_year, isbn)
values
  (
    'dbf57f4e-cabd-40b5-a6cb-89824eb6868f',
    'Pride and Prejudice',
    'Jane Austen',
    'Elizabeth Bennet navigates family expectations, first impressions, and love.',
    '/demo-covers/pride-and-prejudice.webp',
    array['ROMANCE']::text[],
    1813,
    '9780141439518'
  ),
  (
    '8118851f-6df9-4724-bfe2-20495087fd3b',
    'Frankenstein',
    'Mary Shelley',
    'A scientist confronts the consequences of creating life and abandoning it.',
    '/demo-covers/frankenstein.webp',
    array['HORROR', 'SCI-FI']::text[],
    1818,
    '9780141439471'
  ),
  (
    'c5e09322-84d5-4d66-a9cb-cd2e73a7468e',
    'Jane Eyre',
    'Charlotte Brontë',
    'An orphaned governess seeks independence, belonging, and an equal place in love.',
    '/demo-covers/jane-eyre.webp',
    array['ROMANCE', 'MYSTERY']::text[],
    1847,
    '9781784871680'
  ),
  (
    '54228380-6e52-42d8-bcbf-950eb9868f43',
    'The Picture of Dorian Gray',
    'Oscar Wilde',
    'A portrait bears the marks of a young man’s choices while he remains outwardly unchanged.',
    '/demo-covers/picture-of-dorian-gray.webp',
    array['HORROR', 'FANTASY']::text[],
    1890,
    '9780141439570'
  ),
  (
    'e2a2e11c-bc67-4b97-a0b4-89e3efc0a68d',
    'Dracula',
    'Bram Stoker',
    'Letters and journals trace Count Dracula’s arrival in England and the people determined to stop him.',
    '/demo-covers/dracula.webp',
    array['HORROR']::text[],
    1897,
    '9780141439846'
  ),
  (
    '1a0f90d5-f199-44fd-8289-5e25bdfd5f1f',
    'The Time Machine',
    'H. G. Wells',
    'A Victorian inventor travels into Earth’s distant future and discovers the divided descendants of humanity.',
    '/demo-covers/time-machine.webp',
    array['SCI-FI', 'ADVENTURE']::text[],
    1895,
    '9781502969262'
  ),
  (
    '8db639a0-6a8e-4788-9847-587bd86ba3fe',
    'Alice’s Adventures in Wonderland',
    'Lewis Carroll',
    'Alice follows a white rabbit into a dreamlike world governed by riddles, transformations, and curious rules.',
    '/demo-covers/alice-in-wonderland.webp',
    array['FANTASY', 'ADVENTURE']::text[],
    1865,
    '9780141439761'
  ),
  (
    'e1f3e64a-82d3-4b85-8d1e-e3124dd76893',
    'The Adventures of Sherlock Holmes',
    'Arthur Conan Doyle',
    'Sherlock Holmes and Dr. Watson investigate twelve cases of deception, danger, and deduction.',
    '/demo-covers/sherlock-holmes.webp',
    array['MYSTERY', 'ADVENTURE']::text[],
    1892,
    '9781593080341'
  ),
  (
    '76ac0b6f-bb0d-4244-8af3-3905f66ddf90',
    'The Count of Monte Cristo',
    'Alexandre Dumas',
    'After a wrongful imprisonment, Edmond Dantès remakes himself and pursues an intricate plan of revenge.',
    '/demo-covers/count-of-monte-cristo.webp',
    array['ADVENTURE', 'MYSTERY']::text[],
    1844,
    '9780140449266'
  ),
  (
    'bb04e641-8673-4c36-9bfc-99a4c68e8edb',
    'Narrative of the Life of Frederick Douglass',
    'Frederick Douglass',
    'Frederick Douglass recounts his life under slavery, his pursuit of literacy, and his escape to freedom.',
    '/demo-covers/frederick-douglass.webp',
    array['NON-FICTION']::text[],
    1845,
    '0192832506'
  ),
  (
    '30000000-0000-4000-8000-000000000011',
    'Wuthering Heights',
    'Emily Brontë',
    'The passionate bond between Catherine Earnshaw and Heathcliff shapes two generations on the Yorkshire moors.',
    '/demo-covers/wuthering-heights.webp',
    array['ROMANCE']::text[],
    1847,
    '9780141439556'
  ),
  (
    '30000000-0000-4000-8000-000000000012',
    'Little Women',
    'Louisa May Alcott',
    'The four March sisters grow toward adulthood while navigating family, ambition, love, and loss.',
    '/demo-covers/little-women.webp',
    array['ROMANCE']::text[],
    1868,
    '9780147514011'
  ),
  (
    '30000000-0000-4000-8000-000000000013',
    'The Great Gatsby',
    'F. Scott Fitzgerald',
    'Nick Carraway observes Jay Gatsby’s pursuit of an idealized past amid the wealth and illusions of Jazz Age Long Island.',
    '/demo-covers/great-gatsby.webp',
    array['ROMANCE']::text[],
    1925,
    '9780743273565'
  ),
  (
    '30000000-0000-4000-8000-000000000014',
    'The Turn of the Screw',
    'Henry James',
    'A governess at a remote estate becomes convinced that two children are haunted by malevolent figures.',
    '/demo-covers/turn-of-the-screw.webp',
    array['HORROR', 'MYSTERY']::text[],
    1898,
    '9780141441351'
  ),
  (
    '30000000-0000-4000-8000-000000000015',
    'The Strange Case of Dr Jekyll and Mr Hyde',
    'Robert Louis Stevenson',
    'A London lawyer investigates the connection between the respected Dr. Jekyll and the violent Mr. Hyde.',
    '/demo-covers/jekyll-and-hyde.webp',
    array['HORROR', 'MYSTERY']::text[],
    1886,
    '9780141439730'
  ),
  (
    '30000000-0000-4000-8000-000000000016',
    'The War of the Worlds',
    'H. G. Wells',
    'Martian machines descend on England, forcing ordinary people to survive the collapse of familiar civilization.',
    '/demo-covers/war-of-the-worlds.webp',
    array['SCI-FI', 'ADVENTURE']::text[],
    1898,
    '9780141441030'
  ),
  (
    '30000000-0000-4000-8000-000000000017',
    'Twenty Thousand Leagues Under the Sea',
    'Jules Verne',
    'Professor Aronnax joins Captain Nemo aboard the Nautilus for an extraordinary voyage beneath the world’s oceans.',
    '/demo-covers/twenty-thousand-leagues.webp',
    array['SCI-FI', 'ADVENTURE']::text[],
    1870,
    '9780553212525'
  ),
  (
    '30000000-0000-4000-8000-000000000018',
    'A Princess of Mars',
    'Edgar Rice Burroughs',
    'Civil War veteran John Carter is transported to Mars, where he becomes entangled in warfare and a planetary romance.',
    '/demo-covers/princess-of-mars.webp',
    array['SCI-FI', 'ADVENTURE', 'ROMANCE']::text[],
    1912,
    '9780143104889'
  ),
  (
    '30000000-0000-4000-8000-000000000019',
    'The Wonderful Wizard of Oz',
    'L. Frank Baum',
    'Dorothy follows the yellow brick road with three unlikely companions in search of the Wizard of Oz.',
    '/demo-covers/wizard-of-oz.webp',
    array['FANTASY', 'ADVENTURE']::text[],
    1900,
    '9780141321028'
  ),
  (
    '30000000-0000-4000-8000-000000000020',
    'Peter Pan',
    'J. M. Barrie',
    'Peter Pan leads Wendy and her brothers to Neverland, where childhood wonder meets pirates and peril.',
    '/demo-covers/peter-pan.webp',
    array['FANTASY', 'ADVENTURE']::text[],
    1911,
    '9780141322575'
  ),
  (
    '30000000-0000-4000-8000-000000000021',
    'The Wind in the Willows',
    'Kenneth Grahame',
    'Mole, Rat, Badger, and impulsive Mr. Toad share adventures along the riverbank and beyond.',
    '/demo-covers/wind-in-the-willows.webp',
    array['FANTASY', 'ADVENTURE']::text[],
    1908,
    '9780141321134'
  ),
  (
    '30000000-0000-4000-8000-000000000022',
    'Treasure Island',
    'Robert Louis Stevenson',
    'Jim Hawkins finds a pirate map and sails toward buried treasure, mutiny, and Long John Silver.',
    '/demo-covers/treasure-island.webp',
    array['ADVENTURE']::text[],
    1883,
    '9780141321004'
  ),
  (
    '30000000-0000-4000-8000-000000000023',
    'Moby-Dick',
    'Herman Melville',
    'Ishmael joins the Pequod as Captain Ahab drives its crew toward a fatal hunt for the white whale.',
    '/demo-covers/moby-dick.webp',
    array['ADVENTURE']::text[],
    1851,
    '9780142437247'
  ),
  (
    '30000000-0000-4000-8000-000000000024',
    'The Secret Garden',
    'Frances Hodgson Burnett',
    'A lonely child discovers a locked garden whose restoration transforms a household.',
    '/demo-covers/secret-garden.webp',
    array['FANTASY']::text[],
    1911,
    '9780141321066'
  ),
  (
    '30000000-0000-4000-8000-000000000025',
    'The Moonstone',
    'Wilkie Collins',
    'A priceless diamond disappears from an English country house, drawing multiple narrators into the investigation.',
    '/demo-covers/moonstone.webp',
    array['MYSTERY']::text[],
    1868,
    '9780140434088'
  ),
  (
    '30000000-0000-4000-8000-000000000026',
    'The Woman in White',
    'Wilkie Collins',
    'A drawing teacher’s encounter with a mysterious woman uncovers conspiracy, stolen identity, and confinement.',
    '/demo-covers/woman-in-white.webp',
    array['MYSTERY', 'ROMANCE']::text[],
    1859,
    '9780141439617'
  ),
  (
    '30000000-0000-4000-8000-000000000027',
    'A Study in Scarlet',
    'Arthur Conan Doyle',
    'Sherlock Holmes and Dr. Watson meet and investigate a baffling murder in their first recorded case.',
    '/demo-covers/study-in-scarlet.webp',
    array['MYSTERY']::text[],
    1887,
    '9780140439083'
  ),
  (
    '30000000-0000-4000-8000-000000000028',
    'Walden',
    'Henry David Thoreau',
    'Thoreau reflects on simplicity, self-reliance, nature, and society after living beside Walden Pond.',
    '/demo-covers/walden.webp',
    array['NON-FICTION']::text[],
    1854,
    '9780140390445'
  ),
  (
    '30000000-0000-4000-8000-000000000029',
    'The Souls of Black Folk',
    'W. E. B. Du Bois',
    'Du Bois examines race, citizenship, education, and double consciousness in post-Reconstruction America.',
    '/demo-covers/souls-of-black-folk.webp',
    array['NON-FICTION']::text[],
    1903,
    '9780486280417'
  ),
  (
    '30000000-0000-4000-8000-000000000030',
    'The Autobiography of Benjamin Franklin',
    'Benjamin Franklin',
    'Franklin recounts his rise from apprentice printer to public figure and describes his experiments in self-improvement.',
    '/demo-covers/benjamin-franklin-autobiography.webp',
    array['NON-FICTION']::text[],
    1791,
    '9780142437605'
  )
on conflict (id) do update set
  title = excluded.title,
  author = excluded.author,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  genre = excluded.genre,
  published_year = excluded.published_year,
  isbn = excluded.isbn,
  updated_at = now();

-- A local-only reviewer account. These credentials are intentionally documented in README.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'demo@bookworm.test',
  crypt('BookwormDemo!2026', gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"demo@bookworm.test","email_verified":true,"phone_verified":false}'::jsonb,
  now(),
  now(),
  false,
  false
)
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  email_change_token_new = excluded.email_change_token_new,
  email_change = excluded.email_change,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  '11111111-1111-4111-8111-111111111112',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"demo@bookworm.test","email_verified":true,"phone_verified":false}'::jsonb,
  'email',
  now(),
  now(),
  now()
)
on conflict (provider_id, provider) do update set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

-- Normalize the trigger-created viewer profile, then add five public demo readers.
insert into public.user_profiles (
  id,
  auth_user_id,
  username,
  email,
  bio,
  role,
  onboarding_completed_at,
  favorite_genres
)
values (
  '20000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'Demo Reader',
  'demo@bookworm.test',
  'Exploring Bookworm locally.',
  'reader',
  now(),
  array['HORROR', 'SCI-FI']::text[]
)
on conflict (auth_user_id) do update set
  id = excluded.id,
  username = excluded.username,
  email = excluded.email,
  bio = excluded.bio,
  role = excluded.role,
  onboarding_completed_at = excluded.onboarding_completed_at,
  favorite_genres = excluded.favorite_genres,
  updated_at = now();

insert into public.user_profiles (id, username, email, bio, role, onboarding_completed_at, favorite_genres)
values
  (
    '20000000-0000-4000-8000-000000000002',
    'Ava Quill',
    null,
    'A slow reader with a weakness for impossible journeys.',
    'reader',
    now(),
    array['ADVENTURE', 'FANTASY']::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'Marcus Reed',
    null,
    'Gothic fiction, annotations, and very strong coffee.',
    'reader',
    now(),
    array['HORROR', 'MYSTERY']::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'Priya Shah',
    null,
    'Host of Gothic After Dark.',
    'reader',
    now(),
    array['HORROR', 'FANTASY']::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    'Theo Bennett',
    null,
    'Looking for the next unsettling classic.',
    'reader',
    now(),
    array['HORROR', 'SCI-FI']::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    'Sofia Pages',
    null,
    'Reading the classics with a pencil in hand.',
    'reader',
    now(),
    array['ROMANCE', 'MYSTERY']::text[]
  )
on conflict (id) do update set
  username = excluded.username,
  email = excluded.email,
  bio = excluded.bio,
  role = excluded.role,
  onboarding_completed_at = excluded.onboarding_completed_at,
  favorite_genres = excluded.favorite_genres,
  updated_at = now();

insert into public.title_lists (id, user_profile_id, name, list_type, is_public, is_default)
values
  ('41000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Current Reading', 'current-reading', true, true),
  ('41000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Finished Reading', 'finished-reading', true, true),
  ('41000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'Current Reading', 'current-reading', true, true),
  ('41000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 'Finished Reading', 'finished-reading', true, true),
  ('41000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006', 'Finished Reading', 'finished-reading', true, true)
on conflict (id) do update set
  name = excluded.name,
  is_public = excluded.is_public,
  is_default = excluded.is_default,
  updated_at = now();

insert into public.title_list_items (id, list_id, title_id, created_at)
values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '76ac0b6f-bb0d-4244-8af3-3905f66ddf90', now() - interval '3 days'),
  ('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002', '8db639a0-6a8e-4788-9847-587bd86ba3fe', now() - interval '12 days'),
  ('42000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000002', '54228380-6e52-42d8-bcbf-950eb9868f43', now() - interval '20 days'),
  ('42000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000003', '1a0f90d5-f199-44fd-8289-5e25bdfd5f1f', now() - interval '2 days'),
  ('42000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000004', '8118851f-6df9-4724-bfe2-20495087fd3b', now() - interval '1 day'),
  ('42000000-0000-4000-8000-000000000006', '41000000-0000-4000-8000-000000000005', 'dbf57f4e-cabd-40b5-a6cb-89824eb6868f', now() - interval '1 day')
on conflict (id) do update set
  list_id = excluded.list_id,
  title_id = excluded.title_id,
  created_at = excluded.created_at;

insert into public.title_user_progress (
  id,
  user_profile_id,
  title_id,
  current_page,
  total_pages,
  progress_percent,
  is_completed,
  last_read_at
)
values
  ('45000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '76ac0b6f-bb0d-4244-8af3-3905f66ddf90', 638, 1276, 50, false, now() - interval '1 day'),
  ('45000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '8db639a0-6a8e-4788-9847-587bd86ba3fe', 192, 192, 100, true, now() - interval '12 days'),
  ('45000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '1a0f90d5-f199-44fd-8289-5e25bdfd5f1f', 44, 118, 37, false, now() - interval '2 hours'),
  ('45000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', '8118851f-6df9-4724-bfe2-20495087fd3b', 280, 280, 100, true, now() - interval '25 minutes'),
  ('45000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006', 'dbf57f4e-cabd-40b5-a6cb-89824eb6868f', 432, 432, 100, true, now() - interval '1 day')
on conflict (user_profile_id, title_id) do update set
  current_page = excluded.current_page,
  total_pages = excluded.total_pages,
  progress_percent = excluded.progress_percent,
  is_completed = excluded.is_completed,
  last_read_at = excluded.last_read_at,
  updated_at = now();

insert into public.reading_diary_entries (
  id,
  user_profile_id,
  title_id,
  entry_date,
  note_text,
  progress_mode,
  current_page,
  total_pages,
  progress_percent,
  is_completed,
  created_at
)
values
  ('46000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '8db639a0-6a8e-4788-9847-587bd86ba3fe', current_date - 12, 'Finished it. The ending is stranger and kinder than I remembered.', 'pages', 192, 192, 100, true, now() - interval '12 days'),
  ('46000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '1a0f90d5-f199-44fd-8289-5e25bdfd5f1f', current_date - 1, 'The future world is beginning to reveal its rules.', 'pages', 44, 118, 37, false, now() - interval '1 day'),
  ('46000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '8118851f-6df9-4724-bfe2-20495087fd3b', current_date, 'Finished. The creature’s account changes the entire novel.', 'pages', 280, 280, 100, true, now() - interval '25 minutes'),
  ('46000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000006', 'dbf57f4e-cabd-40b5-a6cb-89824eb6868f', current_date - 1, 'Still one of the sharpest comedies of manners.', 'pages', 432, 432, 100, true, now() - interval '1 day')
on conflict (id) do update set
  note_text = excluded.note_text,
  current_page = excluded.current_page,
  total_pages = excluded.total_pages,
  progress_percent = excluded.progress_percent,
  is_completed = excluded.is_completed,
  created_at = excluded.created_at;

insert into public.clubs (
  id,
  type,
  name,
  description,
  owner_user_id,
  join_policy,
  categories
)
values (
  '43000000-0000-4000-8000-000000000001',
  'book',
  'Gothic After Dark',
  'A monthly reading club for haunted houses, unreliable narrators, and candlelit classics.',
  '20000000-0000-4000-8000-000000000004',
  'open',
  array['HORROR']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  owner_user_id = excluded.owner_user_id,
  join_policy = excluded.join_policy,
  categories = excluded.categories,
  updated_at = now();

insert into public.club_members (id, club_id, user_id, created_at)
values
  ('44000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', now() - interval '3 days'),
  ('44000000-0000-4000-8000-000000000002', '43000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', now() - interval '5 hours')
on conflict (user_id, club_id) do update set
  created_at = excluded.created_at;

insert into public.reviews (id, user_id, title_id, rating, review_text, created_at, updated_at)
values
  ('47000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '54228380-6e52-42d8-bcbf-950eb9868f43', 8, 'Elegant, unsettling, and much funnier than its reputation suggests.', now() - interval '20 days', now() - interval '20 days'),
  ('47000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000006', 'dbf57f4e-cabd-40b5-a6cb-89824eb6868f', 9, 'Sharp, funny, and much warmer than I remembered.', now() - interval '1 day', now() - interval '1 day')
on conflict (user_id, title_id) do update set
  rating = excluded.rating,
  review_text = excluded.review_text,
  updated_at = excluded.updated_at;

insert into public.discussion_posts (id, title_id, user_id, content, likes_count, created_at, updated_at)
values (
  '49000000-0000-4000-8000-000000000001',
  '8118851f-6df9-4724-bfe2-20495087fd3b',
  '20000000-0000-4000-8000-000000000003',
  '<p>The creature’s account changes the moral center of the novel. Did Victor ever have a chance to make this right?</p>',
  0,
  now() - interval '18 minutes',
  now() - interval '18 minutes'
)
on conflict (id) do update set
  content = excluded.content,
  likes_count = excluded.likes_count,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.user_follows (
  id,
  follower_profile_id,
  followed_profile_id,
  is_private,
  is_friend,
  created_at
)
values
  ('48000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', true, false, now() - interval '10 days'),
  ('48000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', true, false, now() - interval '9 days'),
  ('48000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', true, false, now() - interval '8 days'),
  ('48000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', true, false, now() - interval '7 days'),
  ('48000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000006', true, false, now() - interval '6 days')
on conflict (follower_profile_id, followed_profile_id) do update set
  is_private = excluded.is_private,
  is_friend = excluded.is_friend;

insert into public.activity_events (id, user_profile_id, title_id, event_type, metadata, created_at)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '1a0f90d5-f199-44fd-8289-5e25bdfd5f1f',
    'list_item_added',
    jsonb_build_object(
      'title', jsonb_build_object(
        'id', '1a0f90d5-f199-44fd-8289-5e25bdfd5f1f',
        'title', 'The Time Machine',
        'cover', (select cover_image_url from public.titles where id = '1a0f90d5-f199-44fd-8289-5e25bdfd5f1f')
      ),
      'list', jsonb_build_object(
        'id', '41000000-0000-4000-8000-000000000003',
        'name', 'Current Reading'
      )
    ),
    now() - interval '5 minutes'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    '8118851f-6df9-4724-bfe2-20495087fd3b',
    'title_finished',
    jsonb_build_object(
      'title', jsonb_build_object(
        'id', '8118851f-6df9-4724-bfe2-20495087fd3b',
        'title', 'Frankenstein',
        'cover', (select cover_image_url from public.titles where id = '8118851f-6df9-4724-bfe2-20495087fd3b')
      )
    ),
    now() - interval '25 minutes'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000004',
    null,
    'club_created',
    jsonb_build_object(
      'club', jsonb_build_object(
        'id', '43000000-0000-4000-8000-000000000001',
        'name', 'Gothic After Dark',
        'avatar_url', null
      )
    ),
    now() - interval '2 hours'
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000005',
    null,
    'club_joined',
    jsonb_build_object(
      'club', jsonb_build_object(
        'id', '43000000-0000-4000-8000-000000000001',
        'name', 'Gothic After Dark',
        'avatar_url', null
      )
    ),
    now() - interval '5 hours'
  ),
  (
    '50000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000006',
    'dbf57f4e-cabd-40b5-a6cb-89824eb6868f',
    'review_posted',
    jsonb_build_object(
      'title', jsonb_build_object(
        'id', 'dbf57f4e-cabd-40b5-a6cb-89824eb6868f',
        'title', 'Pride and Prejudice',
        'cover', (select cover_image_url from public.titles where id = 'dbf57f4e-cabd-40b5-a6cb-89824eb6868f')
      ),
      'rating', 9,
      'reviewText', 'Sharp, funny, and much warmer than I remembered.'
    ),
    now() - interval '1 day'
  )
on conflict (id) do update set
  user_profile_id = excluded.user_profile_id,
  title_id = excluded.title_id,
  event_type = excluded.event_type,
  metadata = excluded.metadata,
  created_at = excluded.created_at;
