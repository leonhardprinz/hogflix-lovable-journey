#!/usr/bin/env node
/**
 * HogFlix Synthetic LLM Analytics Traffic Generator
 * 
 * Generates realistic $ai_generation + $ai_trace events via PostHog Capture API.
 * 
 * Usage:
 *   node scripts/generate-llm-traffic.js                              # 14-day backfill
 *   INCREMENTAL=true node scripts/generate-llm-traffic.js             # single day (for CI)
 *   REDACT_LLM_CONTENT=true node scripts/generate-llm-traffic.js     # redacted mode (PII-safe)
 */

const POSTHOG_API_KEY = process.env.PH_PROJECT_API_KEY || process.env.POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh';
const POSTHOG_HOST = process.env.PH_HOST || 'https://eu.i.posthog.com';
const INCREMENTAL = process.env.INCREMENTAL === 'true';
const REDACT_MODE = process.env.REDACT_LLM_CONTENT === 'true';

// Lightweight PII redactor for synthetic events (mirrors supabase/_shared/pii-redactor.ts)
function redactText(text) {
    if (!REDACT_MODE || !text) return text;
    return text
        .replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, '[REDACTED]')
        .replace(/\b(?:Mr|Mrs|Ms|Dr|Judge|Atty)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g, '[REDACTED]')
        .replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g, '[REDACTED]');
}

const DAYS_BACK = INCREMENTAL ? 1 : 14;
const CONVERSATIONS_PER_DAY = { min: 8, max: 25 };
const CACHE_HIT_RATE = 0.20;
const TOOL_USAGE_RATE = 0.15;
const STREAMING_RATE = 0.70;
const GUARANTEED_ERRORS_PER_DAY = 1;
const GUARANTEED_OUTLIERS_PER_DAY = 1;

// ─── MODELS ──────────────────────────────────────────────────────────────────

const MODELS = [
    { model: 'gemini-2.0-flash', provider: 'google', baseUrl: 'https://generativelanguage.googleapis.com/v1', weight: 0.35, inputPrice: 0.10 / 1e6, outputPrice: 0.40 / 1e6 },
    { model: 'gemini-2.5-flash', provider: 'google', baseUrl: 'https://generativelanguage.googleapis.com/v1', weight: 0.20, inputPrice: 0.15 / 1e6, outputPrice: 0.60 / 1e6 },
    { model: 'gpt-4o-mini', provider: 'openai', baseUrl: 'https://api.openai.com/v1', weight: 0.20, inputPrice: 0.15 / 1e6, outputPrice: 0.60 / 1e6 },
    { model: 'claude-3.5-sonnet', provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', weight: 0.15, inputPrice: 3.00 / 1e6, outputPrice: 15.00 / 1e6 },
    { model: 'claude-3.5-haiku', provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', weight: 0.10, inputPrice: 0.80 / 1e6, outputPrice: 4.00 / 1e6 },
];

const USERS = [
    'leo@posthog.com', 'leonhardprinz@gmail.com', 'summers.nor-7f@icloud.com',
    'slatted_combats.9i@icloud.com', 'treadle-tidbit-1b@icloud.com',
    'toppers.tester_3c@icloud.com', 'slate-polders3m@icloud.com',
    'cabals-foyer-5w@icloud.com', 'arroyo.gunner_6z@icloud.com',
];

const SYSTEM_PROMPT = 'You are FlixBuddy, the AI movie recommendation assistant for HogFlix. You help users discover movies and series from the HogFlix catalog. Always be enthusiastic and helpful.';

// ─── CONVERSATIONS ───────────────────────────────────────────────────────────

const RECOMMENDATION_CONVERSATIONS = [
    [
        { user: "What's trending right now?", assistant: "Great question! Here are the top trending titles on HogFlix right now:\n\n1. **Lord of the Hogs: The Fellowship** - An epic adventure following Fro-hog Baggins on a quest across Middle Garth ⭐ 9.3\n2. **Jurassic Hog** - Prehistoric hedgehogs break free from a biotech park 🦔\n3. **The Hog Father** - A powerful crime saga about the Quillione family\n\nWant me to tell you more about any of these?" },
        { user: "Tell me more about Lord of the Hogs", assistant: "**Lord of the Hogs: The Fellowship** is our most-watched epic this month!\n\n📖 **Plot**: Young Fro-hog Baggins inherits a mysterious golden ring from his uncle. When the wizard Gandhog reveals its dark origin, Fro-hog must journey to Mount Doom to destroy it.\n\n⏱️ Runtime: 2h 58m | ⭐ 9.3/10 | 🎭 Fantasy, Adventure\n\nIt's the first part of a trilogy — all three are available on HogFlix! Should I add it to your watchlist?" },
    ],
    [
        { user: "I want something funny", assistant: "Here are our top comedy picks! 😂\n\n1. **Hedgehog's Day** - A weatherhog relives the same day over and over\n2. **The Big Hedgowski** - A laid-back hedgehog gets caught up in mistaken identity\n3. **Spiny Business** - A young hedgehog turns his living room into a dance floor\n4. **Hog Actually** - Multiple hedgehog love stories during the holidays\n\nAll are rated 4+ stars! Which one catches your eye?" },
    ],
    [
        { user: "Recommend a family movie for tonight", assistant: "Perfect family movie night picks! 🍿\n\n1. **Hog Wild** - A heartwarming adventure about a young hedgehog finding courage (PG, 1h 45m)\n2. **Finding Nemo-hog** - A father hedgehog crosses the ocean to find his lost son (PG)\n3. **The Incredihogs** - A family of super-powered hedgehogs save the world (PG)\n\nI'd especially recommend **Hog Wild** if you have younger kids — it's our most popular family title this month!" },
    ],
    [
        { user: "What's similar to Jurassic Hog?", assistant: "If you loved Jurassic Hog, you'll enjoy these sci-fi thrillers:\n\n1. **Interstellar Spines** - Hedgehogs venture beyond the solar system (⭐ 8.9)\n2. **The Martian Hedgehog** - A botanist hedgehog stranded on Mars (⭐ 8.7)\n3. **Jurassic Hog: Fallen Kingdom** - The sequel! Even more prehistoric action (⭐ 7.8)\n\nAll have that same blend of science, suspense, and spectacular visuals!" },
        { user: "Add Interstellar Spines to my watchlist", assistant: "Done! ✅ **Interstellar Spines** has been added to your watchlist.\n\nYou've got great taste — this one won 3 Hedgehog Academy Awards including Best Visual Effects. Enjoy the ride! 🚀" },
    ],
    [
        { user: "I'm in the mood for a thriller", assistant: "Buckle up! Here are our best thrillers:\n\n1. **Gone Hog** - A hedgehog's disappearance unravels dark secrets (⭐ 8.5)\n2. **The Silence of the Hedgehogs** - A young FBI agent seeks help from an imprisoned genius (⭐ 8.9)\n3. **Se-hog-en** - Two detectives hunt a criminal using the seven deadly sins (⭐ 8.6)\n\n⚠️ These are all rated R — perfect for a gripping evening!" },
    ],
    [
        { user: "Show me hidden gems I might have missed", assistant: "Here are some underrated treasures from the HogFlix vault:\n\n1. **The Grand Budapest Hedgehog** - A quirky adventure in a famous hotel (⭐ 8.8 but only 12% have watched it)\n2. **Moonrise Quilldom** - Two young hedgehogs run away together in the 60s\n3. **Hunt for the Wilderhedgehog** - A heartwarming New Zealand comedy-drama\n\nThese are all critically acclaimed but often overlooked. Trust me, they're worth your time!" },
    ],
    [
        { user: "Any new releases this week?", assistant: "Fresh off the press! 🎬 This week's new additions:\n\n1. **Dune: Part Hog** - The highly anticipated sci-fi epic\n2. **Barbie-hog** - The cultural phenomenon finally on HogFlix\n3. **Oppenhedgehog** - Historical drama about the atomic age\n\nDune is already our #1 most-watched new release!" },
        { user: "Which one has the best reviews?", assistant: "By critical reception:\n\n1. 🥇 **Oppenhedgehog** - 94% critics score, Christopher Nolanhog's masterpiece\n2. 🥈 **Dune: Part Hog** - 91% critics, stunning visuals and epic scope\n3. **Barbie-hog** - 88% critics, a fun and surprisingly deep exploration\n\nIf you want to be wowed, go with Oppenhedgehog!" },
    ],
    [
        { user: "Suggest a binge-worthy series", assistant: "Here are series you won't be able to stop watching:\n\n1. **Prickly Blinders** - Period crime drama, 6 seasons (⭐ 9.1)\n2. **Breaking Spines** - A chemistry teacher hedgehog turns to crime, 5 seasons (⭐ 9.5)\n3. **Stranger Spines** - Sci-fi mystery in a small hedgehog town, 4 seasons (⭐ 8.7)\n\n**Breaking Spines** is widely considered one of the greatest series ever made." },
        { user: "How many episodes in Breaking Spines?", assistant: "**Breaking Spines** has:\n\n📺 5 Seasons, 62 episodes total\n⏱️ Episodes are ~47 minutes each\n🕐 Total watch time: ~49 hours\n\nPerfect for a weekend binge! Plus, there's **Better Call Saul-hog** (6 seasons) as a prequel." },
    ],
    [
        { user: "What are the best action movies?", assistant: "Adrenaline time! 💥\n\n1. **Mad Max: Fury Hog** - Non-stop desert chase action (⭐ 8.8)\n2. **John Quill** - A retired assassin hedgehog comes back for revenge (⭐ 7.9)\n3. **The Dark Hedgehog** - The definitive superhero action film (⭐ 9.0)\n4. **Top Hog: Maverick** - Fighter pilot hedgehog action (⭐ 8.5)\n\nFor pure non-stop action, Mad Max can't be beat!" },
    ],
    [
        { user: "I liked The Hog Father, what else would I enjoy?", assistant: "If you loved The Hog Father, here are similar crime dramas:\n\n1. **Goodfellas: Hedgehog Edition** - Rise and fall of a mob hedgehog (⭐ 8.7)\n2. **Scarspine** - A Cuban hedgehog builds a criminal empire (⭐ 8.3)\n3. **The Departed Hedgehog** - Moles within the mob and police (⭐ 8.5)\n\nAll feature complex characters and gripping storylines like The Hog Father!" },
    ],
];

const ERROR_CONVERSATIONS = [
    { user: "Recommend something for my 5 year old", error: 'Content filtering error: Unable to generate age-appropriate recommendations. The content safety filter flagged the request for additional review. Model returned empty response after 3 retry attempts.', errorType: 'content_safety_filter', httpStatus: 422 },
    { user: "Give me a very detailed plot analysis of every single movie in the fantasy genre including all subplots, character arcs, thematic elements, symbolism, cinematographic choices, and directorial decisions for each of the 47 fantasy titles in the HogFlix catalog", error: 'Context length exceeded: Input of 127,493 tokens exceeds the maximum context window of 128,000 tokens.', errorType: 'context_length_exceeded', httpStatus: 400 },
    { user: "What should I watch tonight?", error: 'Rate limit exceeded: 429 Too Many Requests. The Gemini API rate limit of 60 requests per minute has been exceeded. Retry after 32 seconds.', errorType: 'rate_limit', httpStatus: 429 },
    { user: "Show me something romantic", error: 'Upstream provider timeout: The request to Google Gemini API timed out after 30000ms. The model did not respond within the expected timeframe.', errorType: 'provider_timeout', httpStatus: 504 },
    { user: "Search for documentaries about nature", error: 'Tool execution failed: search_movies returned an error: Supabase connection pool exhausted (max 20 connections). Database connection timeout after 5000ms.', errorType: 'tool_execution_failed', httpStatus: 500 },
];

const OUTLIER_CONVERSATIONS = [
    [
        { user: "I've been writing a screenplay about a hedgehog detective. Can you help me develop the plot?", assistant: "That sounds like a fun creative project! While I'm primarily designed to help you find movies to watch on HogFlix, I can share some thoughts:\n\nA hedgehog detective is a great concept! You might draw inspiration from some of our noir titles like **The Maltese Hedgehog** for that classic detective atmosphere.\n\nWould you like me to recommend some detective movies instead for inspiration? 🎬" },
        { user: "No I want help with the actual script. How should I structure act 2?", assistant: "I appreciate the creativity! For Act 2 structure, traditionally you'd want escalating stakes and a midpoint twist.\n\nHowever, I'm really built to recommend HogFlix content, not write scripts! You might enjoy watching **Adaptation Hedgehog** on HogFlix — it's literally a movie about writing a screenplay.\n\nWant me to find some movies with great plot structures you could study? 🕵️" },
        { user: "Can you write me some dialogue for the confrontation scene?", assistant: "Writing original dialogue is outside my wheelhouse — I'm FlixBuddy, your movie recommendation assistant! 🎬\n\nWhat I CAN do is point you to movies with legendary confrontation scenes:\n\n1. **The Silence of the Hedgehogs** — Masterclass dialogue\n2. **The Dark Hedgehog** — Iconic interrogation scene\n3. **A Few Good Hedgehogs** — \"You can't handle the truth!\"\n\nShould I add any to your watchlist for research? 📝" },
    ],
    [
        { user: "I'm a film student analyzing three-act structure. Can you explain it?", assistant: "While I'm a movie recommender rather than a film theory professor, here are the basics:\n\n- **Act 1 (Setup)**: Introduce characters and inciting incident (~25%)\n- **Act 2 (Confrontation)**: Rising action, midpoint twist (~50%)\n- **Act 3 (Resolution)**: Climax and resolution (~25%)\n\nFor hands-on learning, I'd recommend watching **The Spiny Redemption** — perfect three-act execution! Want me to create a watchlist?" },
        { user: "Can you compare Kubrick and Nolan's narrative techniques?", assistant: "Deep film theory question! 🎓\n\n**Kubrickhog** (cold, symmetrical): **2001: A Spine Odyssey**, **The Shining Hedgehog**\n**Nolanhog** (non-linear, cerebral): **Interstellar Spines**, **Inceptionhog**\n\nBoth are on HogFlix! I'm better at finding you the right movie than being a film professor though! 😄" },
    ],
];

// 30-message Lord of the Hogs mega-conversation (for trace summarization demo)
const LOTH_MEGA_CONVERSATION = [
    { user: "I just finished Lord of the Hogs. That was INCREDIBLE. Tell me everything about this universe!", assistant: "Welcome to the fandom! 🎬 **Lord of the Hogs** is truly a masterpiece of hedgehog cinema.\n\nThe LOTH universe spans:\n- 📚 **3 main films**: The Fellowship, The Two Burrows, Return of the Quill\n- 📖 **The Hogbit trilogy**: A prequel adventure\n- 🎭 Extended editions with 45+ minutes of extra footage each\n\nThe world of Middle Garth was created by J.R.R. Tolkihog, and director Peter Jacksonhog spent 7 years bringing it to life. All films are available on HogFlix!\n\nWhat aspect interests you most? The lore, the characters, or the filmmaking? 🦔" },
    { user: "Tell me about all the main characters!", assistant: "The Fellowship is such a legendary ensemble!\n\n⚔️ **The Fellowship:**\n1. **Fro-hog Baggins** — Our hero, carrying the One Ring\n2. **Sam-wise Gamhog** — Fro-hog's loyal gardener (the real MVP)\n3. **Gandhog the Grey** — Ancient wizard hedgehog 🧙\n4. **Arahog (Strider)** — Ranger, heir to Gondor's throne\n5. **Legohog** — Elf-hog archer with impossibly good aim\n6. **Gimli** — Fierce dwarf-hog warrior\n7. **Borohog** — Warrior struggling with the Ring's temptation\n8. **Merry & Pippin** — Two mischievous hobbit-hogs\n\n🖤 **Villains:** Saurohog (Dark Lord), Sarumhog (corrupted wizard), Gollhog (tragic Ring-obsessed creature)\n\nWho's your favorite?" },
    { user: "Gollhog is fascinating! What's his full backstory?", assistant: "Oh, the most tragically complex character! 💔\n\n**Gollhog** (born Smé-hog) was once a regular hobbit-hog. His cousin found the One Ring while fishing. Smé-hog was consumed by desire, strangled his cousin, and took the Ring.\n\nOver 500 years of Ring-possession, he retreated deep into the Misty Mountains, lived alone eating raw fish, and developed a split personality — the corrupted Gollhog vs. the remnant of good Smé-hog.\n\nAndy Serquill-hog's motion-capture performance is often cited as the greatest in hedgehog cinema history.\n\nWant to watch the cave scene? It's in The Fellowship, chapter 14! 🎬" },
    { user: "Wait, so there's an entire lore behind Middle Garth? How old is this world?", assistant: "Strap in, the lore goes DEEP! 🌍\n\n🌅 **Before Time**: Eru Ilúva-hog creates the Ainur through music\n**First Age** (~4,500 years): Elv-hogs awaken, epic wars, dragons\n**Second Age** (~3,441 years): Rings of Power forged, Númenor rises and falls\n**Third Age** (~3,021 years): This is where LOTH takes place! Ring found by Gollhog, then Bil-hog, then Fro-hog\n\nThe movies only cover the LAST 2 years of a 10,000+ year history! 🤯\n\nHogFlix has a documentary called **\"The Lore of Middle Garth\"** if you want to go deeper!" },
    { user: "This is insane! What about the Rings of Power? How many are there?", assistant: "The famous verse tells it all! 🎭\n\n*\"Three Rings for the Elv-hog kings under the sky,\nSeven for the Dwarf-hog lords in their halls of stone,\nNine for Mortal Hedgehogs doomed to die,\nOne for the Dark Lord on his dark throne.\"*\n\n💍 **Three Elv-hog Rings** (Narya, Nenya, Vilya) — wielded by Gandhog, Galadri-hog, Elr-hog\n**Seven Dwarf-hog Rings** — made them richer but greedier\n**Nine for Men** — corrupted into the Nazgûl (Ringwraiths)!\n**The One Ring** — rules them all, can only be destroyed in Mount Doom\n\nThe entire plot is about destroying ONE ring. But what a ring! 🔥" },
    { user: "Who would win in a fight: Gandhog or Sarumhog?", assistant: "The wizard showdown! 🧙‍♂️⚔️🧙‍♂️\n\nInitially, Sarumhog wins — he's head of the wizard order and beats Gandhog at Orthanc tower in The Fellowship.\n\nBUT after Gandhog falls fighting the Balr-hog and is resurrected as **Gandhog the White**, the tables turn. Sarumhog has been weakened by obsession with the Ring.\n\n🏆 **Gandhog the White wins** — he shatters Sarumhog's staff in The Two Burrows.\n\nThe fight scenes are in The Fellowship (Orthanc) and The Two Burrows (Fangorn). Want me to queue them up? 🎬" },
    { user: "What about the Balr-hog??? That bridge scene was the most intense thing I've ever seen!", assistant: "\"YOU SHALL NOT PASS!\" 🔥⚔️\n\nThe Bridge of Khazad-dûm is voted the #1 most epic moment in hedgehog cinema!\n\n**The Balr-hog:** An ancient demon of fire and shadow, sleeping under the mountains for THOUSANDS of years. The dwarves woke it by mining too deep.\n\n**The fight:** Fellowship flees → Gandhog stays on bridge → shatters it with his staff → Balr-hog's whip catches him → \"Fly, you fools!\" → both fall into the abyss 😭\n\nFun fact: They continue fighting while FALLING, then battle on Zirakzigil peak for days!\n\nShould I play it? It's at 2:07:33 in the extended edition! 🎬" },
    { user: "YES PLAY IT! Also what happens to Gandhog after he falls?", assistant: "Queuing up the Bridge scene! ▶️\n\n📖 **Gandhog's Journey:**\n1. Falls with the Balr-hog into an underground lake\n2. Chases it through ancient tunnels\n3. They fight UP the Endless Stair to Zirakzigil Peak\n4. Final battle rages for 10 days on the mountaintop\n5. Gandhog throws down the Balr-hog but dies from his wounds\n6. Sent back by the Valar as **Gandhog the White** — more powerful, wiser\n\n\"I am Gandhog the White. And I come back to you now, at the turn of the tide.\"\n\n😭 I'm literally getting emotional just typing this!" },
    { user: "Ok I'm completely obsessed now. What about the romance?", assistant: "The most beautiful slow-burn in hedgehog cinema! ❤️\n\n**Arahog & Arw-hog:**\n- She's an Elf-hog princess, **2,700 years old**. He's 87.\n- Their love is forbidden because she must **choose mortality** to be with him — giving up eternal life! 💔\n- \"I choose a mortal life\" is absolutely devastating.\n\n**Other romances:**\n- **Sam & Rosie Cottohog** — The most pure, humble love story 🥺\n- **Gimli & Galadri-hog** — Wholesome friendship transcending elvish-dwarf rivalry\n\nThe extended Return of the Quill has 20 extra minutes of Arahog/Arw-hog content! 🎬" },
    { user: "Tell me about the Battle of Helm's Deep! I want every detail!", assistant: "THE BATTLE OF HELM'S DEEP! 💥⚔️🏰\n\nThis 40-minute sequence took 4 MONTHS to film at night!\n\n**Setup:** 10,000 Uruk-hai vs. 300 defenders + 500 arriving Elf-hog archers\n\n**The Stages:**\n1. 🌧️ Rain starts. Old hedgehog accidentally fires first arrow\n2. 🏹 Legohog/Gimli kill count competition (42 vs 43!)\n3. 💣 Gunpowder bombs blow open the wall!\n4. 😱 All seems lost, retreat to inner keep\n5. 🌅 Dawn — Gandhog arrives with 2,000 Rohirrim. CHARGE!\n\n**Trivia:** Viggo Mortens-hog broke two toes kicking an orc helmet — that scream was REAL!\n\nIt's from 1:23:00 to 2:05:00 in The Two Burrows 🎬" },
    { user: "What about the Ride of the Rohirrim? That charge scene!", assistant: "THE GREATEST SINGLE MOMENT IN CINEMA HISTORY! 🐴⚔️\n\nMinas Tirith under siege by 200,000. 6,000 Rohirrim arrive at dawn.\n\nKing Théod-hog's speech:\n*\"RIDE NOW! RIDE TO RUIN AND THE WORLD'S ENDING!\nDEATH! DEATH! DEEEEEATH!\"*\n\nThen... the horns sound. 🎺 6,000 horses charge.\n\n😭 I've seen this 50 times and cry EVERY. SINGLE. TIME.\n\nThe actors' reactions during the speech were genuine — they didn't know the delivery would be that powerful.\n\nReturn of the Quill, 1:47:00. Watch it in the dark with surround sound! 🎬" },
    { user: "I'm literally tearing up! What's the saddest moment?", assistant: "The moments that DESTROY fans: 😭\n\n**Tier 1 — Ugly crying:**\n1. 🥇 \"I can't carry it for you... but I can carry YOU!\" — Sam carries Fro-hog up Mount Doom\n2. 🥈 \"My friends... you bow to no one.\" — Arahog kneels before the hobbits\n3. 🥉 Borohog's death — \"I would have followed you, my brother. My captain. My king.\"\n\n**Tier 2 — Silent tears:**\n4. Grey Havens — Fro-hog leaves Middle Garth forever 💔\n5. \"There's light up there... beauty. They can't get to it.\" — Sam\n\n**Tier 3 — Happy tears:**\n6. \"PO-TAY-TOES!\" (so wholesome it hurts)\n\nWant me to create a \"Get Your Tissues Ready\" watchlist? 🎬" },
    { user: "Create that watchlist! Also why didn't they just fly the eagles to Mordor?", assistant: "THE question! 🦅\n\nWhy it wouldn't work:\n1. **Air defense** — Nazgûl ride flying dragons\n2. **The Eye** — Saurohog would see giant eagles from 500 miles\n3. **Corruption** — The Ring would corrupt proud eagles too\n4. **Eagles aren't taxis** — They're sentient beings, not Uber\n5. **Bad movie** — \"Lord of the Hogs: We Flew There\" (Runtime: 11 min) 😂\n\n**Fun theory:** Some fans think \"fly, you fools!\" was telling them to use eagles. Wild!\n\n✅ \"Get Your Tissues Ready\" watchlist added! 🎬📝" },
    { user: "Mind = blown. What's the correct watch order?", assistant: "Two valid orders! 🎬\n\n**Release Order (recommended):**\n1. The Fellowship — 3h 48m extended\n2. The Two Burrows — 3h 55m extended\n3. Return of the Quill — 4h 23m extended\n4. The Hogbit: Unexpected Journey — 3h 2m\n5. The Hogbit: Desolation of Smau-hog — 3h 6m\n6. The Hogbit: Battle of Five Armies — 2h 44m\n\n**Total: ~20 hours 58 minutes** ⏱️\n\n**Marathon plan:**\n🏠 Saturday: Fellowship + Two Burrows (8h)\n🏠 Sunday: Return + Hogbit 1 (7h)\n🏠 Next weekend: Hogbit 2+3 (6h)\n\nWant me to set up a marathon playlist? 🍿" },
    { user: "MARATHON PLAYLIST PLEASE! What snacks pair well?", assistant: "✅ **LOTH Ultimate Marathon** playlist created!\n\n🍿 **Snack Guide:**\n\n**The Fellowship:** 🍕 Elv-hog Bread (pizza) + 🍎 Apples for \"second breakfast\"\n**The Two Burrows:** 🥔 PO-TAY-TOES in every form — Sam demands it!\n**Return of the Quill:** 🧅 Comfort stew + 🧻 TISSUES. So many tissues.\n**Hogbit trilogy:** 🍰 Seed cake + 🐟 Raw fish if feeling Gollhog vibes 😂\n\nI'm genuinely jealous of your first watch-through! 🎬✨" },
    { user: "What's the most iconic line from the entire series?", assistant: "The Hall of Fame — I'll fight anyone who disagrees! 😤\n\n1. 🥇 \"One does not simply walk into Mordor.\" — Borohog (biggest meme ever)\n2. 🥈 \"YOU SHALL NOT PASS!\" — Gandhog\n3. 🥉 \"My precious...\" — Gollhog\n4. \"I am no man.\" — Éow-hog destroying the Witch-king 💪\n5. \"That still only counts as one!\" — Gimli\n6. \"DEATH!\" — Théod-hog's battle cry\n7. \"I would have followed you to the end.\" — Borohog 😭\n8. \"There's some good in this world, and it's worth fighting for.\" — Sam\n9. \"All we have to decide is what to do with the time that is given us.\" — Gandhog\n10. \"I can't carry it for you, but I can carry you!\" — Sam\n\nEvery one is on HogFlix with subtitles! 🎬" },
    { user: "Tell me about the deleted scenes! What's in the extended editions that I can't miss?", assistant: "The extended editions are the DEFINITIVE way to watch! 🎬✂️\n\n**The Fellowship (Extended):**\n- 🎁 Gift-giving in Lothlórien — Galadri-hog gives each Fellowship member a gift\n- 🍺 Gandhog's fireworks extended scene\n- 🗡️ Borohog training Merry & Pippin to swordfight\n\n**The Two Burrows (Extended):**\n- 🌳 Ent-hog wives backstory — devastating lost love\n- 🍖 Merry & Pippin find Sarumhog's pantry\n- ⚔️ Huon-hog's last stand at Helm's Deep\n\n**Return of the Quill (Extended):**\n- 💀 The Mouth of Saurohog — terrifying scene!\n- 👑 Sarumhog's fate — the Scouring resolution\n- 🏠 Extended Shire endings\n\n**Total added: 2+ hours of content!** All on HogFlix in 4K! 🎬" },
    { user: "What about the soundtrack? The music is SO good!", assistant: "Howard Shorehog's score is widely considered THE greatest film soundtrack ever! 🎵\n\n**Iconic Themes:**\n- 🏠 **The Shire** — Tin whistle, warm and nostalgic (you'll hum this forever)\n- 💍 **The Ring Theme** — Haunting boys' choir, creeping evil\n- ⚔️ **Rohan** — Hardanger fiddle, Nordic warrior vibes\n- 🏰 **Gondor** — Majestic French horns\n- 🧝 **Rivendell** — Ethereal strings and harps\n- 🦅 **The Eagles** — Soaring brass, pure triumph\n- 😭 **Into the West** — Annie Lennox-hog, Grey Havens farewell\n\n🏆 **Awards:** 3 Academy Awards for music across the trilogy!\n\nHogFlix has a \"Score Only\" audio track option. Try watching Mount Doom with JUST the music — absolutely devastating! 🎬🎵" },
    { user: "Are there any wild fan theories I should know about?", assistant: "Oh you're going down the rabbit hole now! 🕳️🐇\n\n**Tier 1 — Actually plausible:**\n🧙 **Gandhog knew about the eagles the whole time** — \"Fly, you fools\" = fly the eagles. He sacrificed himself to create a distraction!\n💍 **The Ring chose Gollhog at Mount Doom** — It made him slip so IT would be destroyed. Self-destructive Ring?\n🗡️ **Tom Bombadi-hog is Eru Ilúva-hog** — God just chilling in a forest? Maybe!\n\n**Tier 2 — Tinfoil hat:**\n🌋 **Mount Doom is sentient** — It only erupts when the Ring is destroyed. Coincidence?\n🧝 **Legohog is on the autism spectrum** — Hyper-focus, counting kills, sensory awareness\n🦔 **Fro-hog died in Mount Doom** — Everything after is a death dream 😱\n\n**Tier 3 — Chaos:**\n🍳 **The whole quest was about breakfast** — 7 meals a day is the true battle\n\nWant me to add a \"Fan Theories\" collection on your profile? 🎬" },
    { user: "OMG yes! Tell me about the map of Middle Garth. Where does everything happen?", assistant: "Middle Garth's geography is INCREDIBLE! 🗺️\n\n**West to East journey:**\n🏠 **The Shire** (NW) → Home of hobbits. Think rural England 🇬🇧\n🏔️ **Rivendell** → Hidden elv-hog valley in the Misty Mountains\n⛏️ **Moria** → Abandoned dwarf kingdom UNDER the mountains\n🌳 **Lothlórien** → Ethereal elf forest (filmed in NZ's Fernside)\n🏰 **Rohan** → Horse-lord kingdom, vast grasslands\n🏛️ **Gondor / Minas Tirith** → White city, 7 levels carved into a mountain!\n🌋 **Mordor** → Volcanic wasteland surrounded by mountains\n\n**Total distance Fro-hog walked: 1,800 miles** in ~13 months! 🦶\n\nFun fact: You can do the real walk in New Zealand — HogFlix has a documentary about fans who've done it! 🎬🗺️" },
    { user: "How did they even make the creatures? The Uruk-hai look so real!", assistant: "The creature design is LEGENDARY! 🎨🦔\n\nWeta Workshop (led by Richard Taylorhog) created everything:\n\n**By the Numbers:**\n- 🗡️ **48,000 pieces of armour** handcrafted\n- 🧟 **10,000 orc prosthetics** applied over 3 years\n- 🛡️ **500 bows** hand-carved\n- 🐴 **2,000 rubber swords** for battle safety\n\n**Creature Highlights:**\n- 🧌 **Uruk-hai** — Each actor sat 4+ hours in prosthetics DAILY\n- 🕷️ **Shelobhog** — Giant spider puppet + CGI, took 2 years to design\n- 🐉 **Smaug-hog** — Most complex CGI character ever at the time\n- 🌳 **Treebeard** — 14-foot puppet operated by 4 people!\n\nThe appendices show the full process — 6+ hours of behind-the-scenes content! 🎬" },
    { user: "What about the costumes? Arw-hog's dresses are stunning!", assistant: "Ngila Dicksonhog's costume design is pure ART! 👗✨\n\n**Mind-blowing stats:**\n- 🧵 **19,000 costumes** made for the trilogy\n- 💎 **40 versions** of Arw-hog's Evenstar dress\n- ⛓️ **12.5 million rings** hand-linked for chainmail (real metal!)\n- 🧝 Each elv-hog ear was individually sculpted and hand-painted\n\n**Iconic Costumes:**\n- 👸 **Galadri-hog's white gown** — 6 handmaidens needed to manage the train\n- 🧙 **Gandhog the White** — 7 layers of white robes, secret inner silver\n- ⚔️ **Arahog's ranger outfit** — Viggo Mortens-hog wore the same boots for 3 years\n- 🖤 **Nazgûl robes** — Stuntmen could barely see through the mesh!\n\n🏆 Won Academy Award for Best Costume Design!\n\nHogFlix has a \"Costume Close-up\" viewing mode with pop-up details! 🎬👗" },
    { user: "How different are the theatrical vs extended editions? Is it worth watching both?", assistant: "Great question — and yes, they're DIFFERENT experiences! 🎬\n\n**The Fellowship:**\n- Theatrical: 2h 58m → Extended: 3h 48m (+50 min)\n- Key additions: Gift-giving, more Shire, Gandhog fireworks\n- Verdict: Extended is ESSENTIAL ✅\n\n**The Two Burrows:**\n- Theatrical: 2h 59m → Extended: 3h 55m (+56 min)\n- Key additions: Ent-hog wives, Borohog flashback, more Helm's Deep\n- Verdict: Extended adds SO much context ✅\n\n**Return of the Quill:**\n- Theatrical: 3h 21m → Extended: 4h 23m (+62 min!)\n- Key additions: Mouth of Saurohog, Sarumhog's fate, Paths of the Dead\n- Verdict: MANDATORY. Changes the ending completely ✅✅\n\n**Pro tip:** Watch theatrical first, then extended rewatch = TWO magical experiences! 🍿" },
    { user: "What do you think of The Hogbit trilogy compared to LOTH?", assistant: "This is the spiciest debate in hedgehog cinema! 🌶️📢\n\n**The Case FOR The Hogbit:**\n✅ Martin Freemhog as young Bil-hog is PERFECT\n✅ Riddles in the Dark (Bil-hog meets Gollhog) = masterpiece scene\n✅ Smaug-hog is the best dragon in cinema\n✅ Connects brilliantly to LOTH's lore\n\n**The Case AGAINST:**\n❌ One 300-page book stretched into THREE movies\n❌ Too much CGI vs. LOTH's practical effects\n❌ Invented love triangle (Tauri-hog/Kili/Legohog) felt forced\n❌ Battle of Five Armies = CGI overload\n\n**FlixBuddy's verdict:** Watch Unexpected Journey (genuinely great), then decide. Desolation of Smau-hog has incredible set pieces even if the padding shows.\n\n**Rating:** LOTH = 10/10 | Hogbit = 7/10 🎬" },
    { user: "Did Lord of the Hogs win any awards? It deserved ALL of them!", assistant: "Prepare to feel VINDICATED! 🏆🏆🏆\n\n**Return of the Quill** won **11 Academy Awards** — tying the record!\n\nIncluding:\n🏆 Best Picture\n🏆 Best Director (Peter Jacksonhog)\n🏆 Best Adapted Screenplay\n🏆 Best Original Score\n🏆 Best Film Editing\n🏆 Best Art Direction\n🏆 Best Costume Design\n🏆 Best Makeup\n🏆 Best Visual Effects\n🏆 Best Sound Mixing\n🏆 Best Original Song (Into the West)\n\n**The trilogy total: 17 wins from 30 nominations!**\n\nIt swept the 2004 ceremony — literally won EVERY category it was nominated for. Standing ovation when Best Picture was announced. Peter Jacksonhog cried.\n\nHogFlix has the acceptance speeches as bonus content! 🎬🏆" },
    { user: "That's insane! Are there any real-world places I can visit from the films?", assistant: "New Zealand IS Middle Garth! 🇳🇿✈️\n\n**Must-Visit Locations:**\n🏠 **Matamata** — The actual Hobbiton set! 44 hobbit holes preserved permanently\n🏔️ **Tongariro National Park** — Mount Doom (Mount Ngauruhoe)\n🌳 **Fernside Lodge** — Lothlórien's forest scenes\n🏰 **Edoras** — Mount Sunday, Canterbury (Rohan capital location)\n🌊 **Kaitoke Regional Park** — Rivendell's forest\n⛰️ **Remarkables, Queenstown** — Dimrill Dale\n\n**The Numbers:**\n- 🎬 150+ filming locations across both NZ islands\n- 🚗 A full road trip takes 2-3 weeks\n- 📸 Most locations have permanent photo boards matching film shots\n\nHogFlix has Peter Jacksonhog's location scouting diaries — fascinating to see why each spot was chosen! 🎬🗺️" },
    { user: "I need to book that trip immediately! What should I watch AFTER finishing LOTH?", assistant: "If you loved LOTH, your next watches should be! 🎬\n\n**Tier 1 — Essential if you loved LOTH:**\n📺 **The Rings of Powerhog** (HogFlix series) — Second Age prequel\n🎬 **The Prin-hog Bride** — Fantasy adventure with the same heart\n⚔️ **Brave-hog** — Scottish princess, archery, bears. Gorgeous.\n\n**Tier 2 — Same Epic Scale:**\n🦁 **The Chronicles of Nar-hog** — Turkish Delight and talking lions\n🗡️ **The Witcherhog** — Dark fantasy, monster hunting, moral grey areas\n🐉 **How to Train Your Drag-hog** — Don't judge by the title. You'll CRY.\n\n**Tier 3 — Deep Cuts:**\n📖 **Stardust** — Underrated gem from Neil Gaim-hog\n🌊 **The Shape of Wat-hog** — Beautiful, artistic fantasy romance\n🧙 **The Name of the Ros-hog** — Medieval mystery\n\nWant me to create a \"Life After LOTH\" watchlist? 🍿" },
    { user: "Tell me about the behind-the-scenes drama! Any crazy stories from filming?", assistant: "The production stories are WILD! 🎬😱\n\n**Legendary Behind-the-Scenes Moments:**\n\n🗡️ **Viggo Mortens-hog:**\n- Deflected a REAL thrown knife (it was supposed to miss!)\n- Broke two toes kicking the orc helmet — that scream is real\n- Would stay in costume BETWEEN shoots, sword and all\n- Almost died white-water rafting during Isen scene\n\n🧙 **Sir Ian McKellenhog:**\n- Cried on set because he was acting alone against green screens for The Hogbit\n- Memorized ALL of Gandhog's book dialogue, not just the script\n\n🏹 **Orlando Bloomhog:**\n- Broke a rib falling off a horse. Came back NEXT DAY.\n- Did the shield-surfing stunt himself!\n\n🎬 **Peter Jacksonhog:**\n- Had no insurance for the first 2 weeks of filming\n- Shot 438 days total. His editors had 1,100+ hours of footage 😵\n\nThe appendices documentaries cover ALL of this — 12+ hours! 🎬📹" },
    { user: "What about the music at the Grey Havens? That scene with Into the West makes me SOB", assistant: "The Grey Havens is the most emotionally devastating farewell in cinema. 😭🚢\n\n**\"Into the West\"** by Annie Lennox-hog:\n\n*\"Lay down your sweet and weary head\nNight is falling, you have come to journey's end\nSleep now, and dream of the ones who came before\nThey are calling from across a distant shore...\"*\n\n**Why it WRECKS you:**\n1. 😭 Fro-hog says goodbye to Sam, Merry, Pippin FOREVER\n2. 💔 He's been too damaged by the Ring to stay in Middle Garth\n3. 🚢 He sails to the Undying Lands — basically hedgehog heaven\n4. 📖 Sam's face. Elijah Woodhog's performance. Devastating.\n5. 🎵 The music swells at \"We can find the light, this day...\"\n\n**Real-world heartbreak:** The song was written in memory of a young filmmaker who died during production. So the tears are in the DNA of the music itself. 💔\n\n🏆 Won Academy Award for Best Original Song\n\nI'm not crying, YOU'RE crying! 😭🎬" },
    { user: "OK last question: if you had to pick ONE scene that captures everything LOTH is about, what would it be?", assistant: "Only one scene? The hardest question you've asked! 🎬\n\nI choose: **Sam's speech at the end of The Two Burrows.** 🏔️\n\nFro-hog is ready to give up. The quest seems impossible. Sam looks at him and says:\n\n*\"I know. It's all wrong. By rights we shouldn't even be here. But we are. It's like in the great stories, Mr. Fro-hog. The ones that really mattered. Full of darkness and danger, they were. And sometimes you didn't want to know the end. Because how could the end be happy?\n\nHow could the world go back to the way it was when so much bad had happened?\n\nBut in the end, it's only a passing thing, this shadow. Even darkness must pass. A new day will come. And when the sun shines it will shine out the clearer.\n\nThose were the stories that stayed with you. That meant something, even if you were too small to understand why.\n\nFolk in those stories had lots of chances of turning back, only they didn't. They kept going. Because they were holding on to something.\"\n\nFro-hog: \"What are we holding onto, Sam?\"\n\nSam: **\"That there's some good in this world, Mr. Fro-hog... and it's worth fighting for.\"** ✨\n\nThat's Lord of the Hogs. That's everything. 🦔💍🎬" },
    { user: "You just made me the biggest Lord of the Hogs fan ever. Thank you FlixBuddy, this was the best conversation I've ever had!!", assistant: "Welcome to the fandom, friend! 🦔💍✨\n\n✅ **Marathon Playlist**: All 6 films, extended, release order\n✅ **Tissues Ready Watchlist**: Most emotional moments bookmarked\n✅ **Snack Guide**: Saved to your profile\n✅ **Fan Theories Collection**: Added to your library\n✅ **Life After LOTH Watchlist**: 9 films queued\n✅ **Costume Close-up Mode**: Enabled for all LOTH films\n\n**Your LOTH journey in numbers:**\n- 🎬 30 messages of pure fandom\n- 📚 10,000 years of lore explored\n- 😭 At least 6 confirmed crying moments\n- 🍿 Complete snack pairing guide\n- 🗺️ New Zealand trip inspiration\n- 🏆 17 Academy Awards celebrated\n\n*\"I will not say: do not weep; for not all tears are an evil.\"* — Gandhog\n\nEnjoy the journey, friend. I'm always here. 🎬🦔💍" },
];

// ─── TOOLS ───────────────────────────────────────────────────────────────────

const TOOLS = [
    { type: 'function', function: { name: 'search_movies', description: 'Search the HogFlix movie catalog', parameters: { type: 'object', properties: { query: { type: 'string' }, genre: { type: 'string' } } } } },
    { type: 'function', function: { name: 'get_recommendations', description: 'Get personalized recommendations', parameters: { type: 'object', properties: { user_id: { type: 'string' }, limit: { type: 'number' } } } } },
    { type: 'function', function: { name: 'add_to_watchlist', description: 'Add a movie to watchlist', parameters: { type: 'object', properties: { user_id: { type: 'string' }, movie_id: { type: 'string' } } } } },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }

function pickWeighted(items) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = Math.random() * total;
    for (const item of items) { r -= item.weight; if (r <= 0) return item; }
    return items[items.length - 1];
}

function generateTimestamp(daysBack) {
    const now = new Date();
    const date = new Date(now.getTime() - Math.random() * daysBack * 86400000);
    const hour = Math.random() < 0.6 ? randInt(18, 23) : Math.random() < 0.5 ? randInt(12, 17) : randInt(7, 11);
    date.setHours(hour, randInt(0, 59), randInt(0, 59), randInt(0, 999));
    return date.toISOString();
}

// ─── EVENT SENDER ────────────────────────────────────────────────────────────

let eventCount = 0;
let batchQueue = [];
const BATCH_SIZE = 50;

async function flushBatch() {
    if (batchQueue.length === 0) return;
    const batch = batchQueue.splice(0, BATCH_SIZE);
    try {
        const res = await fetch(`${POSTHOG_HOST}/batch/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: POSTHOG_API_KEY, batch }),
        });
        if (!res.ok) {
            const text = await res.text();
            console.error(`   ❌ Batch failed: ${res.status} — ${text.substring(0, 200)}`);
        }
    } catch (err) { console.error(`   ❌ Network error: ${err.message}`); }
}

function queueEvent(event) {
    batchQueue.push(event);
    eventCount++;
    if (batchQueue.length >= BATCH_SIZE) return flushBatch();
    return Promise.resolve();
}

// ─── BUILD GENERATION EVENT ──────────────────────────────────────────────────

function buildGeneration({ distinctId, timestamp, modelConfig, userMsg, assistantMsg, traceId, sessionId, spanId, parentId, isError, errorDetails }) {
    const inputTokens = randInt(50, 800);
    const outputTokens = isError ? 0 : randInt(100, 1500);
    const latency = isError ? randFloat(25, 30) : randFloat(0.3, 4.5);
    const inputCost = inputTokens * modelConfig.inputPrice;
    const outputCost = outputTokens * modelConfig.outputPrice;

    const properties = {
        $ai_trace_id: traceId,
        $ai_session_id: sessionId,
        $ai_span_id: spanId,
        $ai_span_name: 'flixbuddy_chat_completion',
        $ai_model: modelConfig.model,
        $ai_provider: modelConfig.provider,
        $ai_base_url: modelConfig.baseUrl,
        $ai_http_status: isError ? (errorDetails?.httpStatus || 500) : 200,
        $ai_input: [{ role: 'system', content: redactText(SYSTEM_PROMPT) }, { role: 'user', content: redactText(userMsg) }],
        $ai_input_tokens: inputTokens,
        $ai_output_choices: isError ? [] : [{ role: 'assistant', content: redactText(assistantMsg) }],
        $ai_output_tokens: outputTokens,
        $ai_latency: Math.round(latency * 1000) / 1000,
        $ai_input_cost_usd: Math.round(inputCost * 1e8) / 1e8,
        $ai_output_cost_usd: Math.round(outputCost * 1e8) / 1e8,
        $ai_total_cost_usd: Math.round((inputCost + outputCost) * 1e8) / 1e8,
        $ai_temperature: pick([0.0, 0.3, 0.5, 0.7, 1.0]),
        $ai_stream: Math.random() < STREAMING_RATE,
        $ai_max_tokens: pick([1024, 2048, 4096, 8192]),
        $ai_is_error: isError,
        ...(REDACT_MODE ? { $ai_content_redacted: true } : {}),
        $ai_prompt_name: 'flixbuddy-system-prompt',
        hogflix_feature: 'FlixBuddy',
        $lib: 'posthog-node',
        $lib_version: '4.3.1',
    };

    if (properties.$ai_stream && !isError) {
        properties.$ai_time_to_first_token = Math.round(randFloat(0.05, 0.5) * 1000) / 1000;
    }
    if (parentId) properties.$ai_parent_id = parentId;
    if (isError && errorDetails) {
        properties.$ai_error = errorDetails.error;
        properties.error_type = errorDetails.errorType;
    }
    if (!isError && Math.random() < CACHE_HIT_RATE) {
        properties.$ai_cache_read_input_tokens = randInt(100, 500);
        properties.$ai_cache_creation_input_tokens = 0;
    }
    if (!isError && Math.random() < TOOL_USAGE_RATE) properties.$ai_tools = TOOLS;

    return { event: '$ai_generation', distinct_id: distinctId, timestamp, properties };
}

// ─── BUILD TRACE EVENT ───────────────────────────────────────────────────────

function buildTrace({ distinctId, timestamp, traceId, sessionId, traceName, firstUserMsg, lastAssistantMsg, totalLatency, isError }) {
    return {
        event: '$ai_trace',
        distinct_id: distinctId,
        timestamp,
        properties: {
            $ai_trace_id: traceId,
            $ai_session_id: sessionId,
            $ai_trace_name: traceName,
            $ai_latency: totalLatency,
            // Must be a JSON object with a `messages` array so the backend can parse it
            // with orjson.loads() and the frontend can read inputState.messages
            $ai_input_state: { messages: [{ role: 'user', content: redactText(firstUserMsg) }] },
            $ai_output_state: lastAssistantMsg
                ? { messages: [{ role: 'assistant', content: redactText(lastAssistantMsg) }] }
                : null,
            $ai_is_error: isError,
            ...(REDACT_MODE ? { $ai_content_redacted: true } : {}),
            hogflix_feature: 'FlixBuddy',
            $lib: 'posthog-node',
            $lib_version: '4.3.1',
        },
    };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🎬 HogFlix Synthetic LLM Analytics Generator');
    console.log('━'.repeat(50));
    console.log(`   Mode: ${INCREMENTAL ? 'INCREMENTAL (1 day)' : 'BACKFILL (14 days)'}`);
    console.log(`   Target: ${POSTHOG_HOST}`);
    console.log(`   Users: ${USERS.length}`);
    console.log('━'.repeat(50));

    let totalGens = 0, totalTraces = 0, totalErrors = 0, totalOutliers = 0, megaSent = false;

    for (let day = 0; day < DAYS_BACK; day++) {
        const dayOfWeek = new Date(Date.now() - day * 86400000).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const count = Math.round(randInt(CONVERSATIONS_PER_DAY.min, CONVERSATIONS_PER_DAY.max) * (isWeekend ? 1.4 : 1));

        console.log(`\n📅 Day -${day} (${isWeekend ? '🎉 weekend' : 'weekday'}): ${count} conversations`);

        let errorsToday = 0, outliersToday = 0;

        for (let c = 0; c < count; c++) {
            const user = pick(USERS);
            const model = pickWeighted(MODELS);
            const traceId = uuid();
            const sessionId = `session-${uuid().substring(0, 8)}`;

            // Decide type
            let type = 'rec';
            if (!megaSent && day === 0 && c === 0) type = 'mega';
            else if (errorsToday < GUARANTEED_ERRORS_PER_DAY && c === Math.floor(count * 0.3)) type = 'error';
            else if (outliersToday < GUARANTEED_OUTLIERS_PER_DAY && c === Math.floor(count * 0.7)) type = 'outlier';
            else if (Math.random() < 0.05) type = 'error';
            else if (Math.random() < 0.03) type = 'outlier';

            const baseTime = new Date(generateTimestamp(day + Math.random())).getTime();
            let parentSpanId = null;

            if (type === 'error') {
                const err = pick(ERROR_CONVERSATIONS);
                errorsToday++; totalErrors++;
                const spanId = uuid();

                await queueEvent(buildGeneration({ distinctId: user, timestamp: new Date(baseTime).toISOString(), modelConfig: model, userMsg: err.user, assistantMsg: '', traceId, sessionId, spanId, parentId: null, isError: true, errorDetails: err }));
                totalGens++;

                // Explicit trace with input/output for the traces view
                await queueEvent(buildTrace({ distinctId: user, timestamp: new Date(baseTime).toISOString(), traceId, sessionId, traceName: 'flixbuddy_chat_completion', firstUserMsg: err.user, lastAssistantMsg: err.error, totalLatency: randFloat(25, 30), isError: true }));
                totalTraces++;
                console.log(`      ❌ Error: ${err.errorType}`);

            } else if (type === 'outlier') {
                const convo = pick(OUTLIER_CONVERSATIONS);
                outliersToday++; totalOutliers++;

                for (let m = 0; m < convo.length; m++) {
                    const spanId = uuid();
                    const ts = new Date(baseTime + m * randInt(15000, 60000)).toISOString();
                    await queueEvent(buildGeneration({ distinctId: user, timestamp: ts, modelConfig: model, userMsg: convo[m].user, assistantMsg: convo[m].assistant, traceId, sessionId, spanId, parentId: parentSpanId, isError: false }));
                    totalGens++;
                    parentSpanId = spanId;
                }

                await queueEvent(buildTrace({ distinctId: user, timestamp: new Date(baseTime).toISOString(), traceId, sessionId, traceName: 'flixbuddy_chat_completion', firstUserMsg: convo[0].user, lastAssistantMsg: convo[convo.length - 1].assistant, totalLatency: randFloat(2, 12), isError: false }));
                totalTraces++;
                console.log(`      🔮 Outlier (${convo.length} turns)`);

            } else if (type === 'mega') {
                megaSent = true;
                const megaUser = 'leo@posthog.com';

                for (let m = 0; m < LOTH_MEGA_CONVERSATION.length; m++) {
                    const spanId = uuid();
                    const ts = new Date(baseTime + m * randInt(30000, 90000)).toISOString();
                    await queueEvent(buildGeneration({ distinctId: megaUser, timestamp: ts, modelConfig: MODELS[0], userMsg: LOTH_MEGA_CONVERSATION[m].user, assistantMsg: LOTH_MEGA_CONVERSATION[m].assistant, traceId, sessionId, spanId, parentId: parentSpanId, isError: false }));
                    totalGens++;
                    parentSpanId = spanId;
                }

                await queueEvent(buildTrace({ distinctId: megaUser, timestamp: new Date(baseTime).toISOString(), traceId, sessionId, traceName: 'flixbuddy_chat_completion', firstUserMsg: LOTH_MEGA_CONVERSATION[0].user, lastAssistantMsg: LOTH_MEGA_CONVERSATION[LOTH_MEGA_CONVERSATION.length - 1].assistant, totalLatency: randFloat(30, 60), isError: false }));
                totalTraces++;
                console.log(`      🏔️ MEGA: Lord of the Hogs deep-dive (${LOTH_MEGA_CONVERSATION.length} messages!)`);

            } else {
                const convo = pick(RECOMMENDATION_CONVERSATIONS);

                for (let m = 0; m < convo.length; m++) {
                    const spanId = uuid();
                    const ts = new Date(baseTime + m * randInt(5000, 30000)).toISOString();
                    await queueEvent(buildGeneration({ distinctId: user, timestamp: ts, modelConfig: model, userMsg: convo[m].user, assistantMsg: convo[m].assistant, traceId, sessionId, spanId, parentId: parentSpanId, isError: false }));
                    totalGens++;
                    parentSpanId = spanId;
                }

                await queueEvent(buildTrace({ distinctId: user, timestamp: new Date(baseTime).toISOString(), traceId, sessionId, traceName: 'flixbuddy_chat_completion', firstUserMsg: convo[0].user, lastAssistantMsg: convo[convo.length - 1].assistant, totalLatency: randFloat(1, 8), isError: false }));
                totalTraces++;
            }
        }
    }

    while (batchQueue.length > 0) await flushBatch();

    console.log('\n' + '━'.repeat(50));
    console.log('✅ Generation complete!');
    console.log(`   📊 Generations: ${totalGens}`);
    console.log(`   🔗 Traces: ${totalTraces}`);
    console.log(`   ❌ Errors: ${totalErrors}`);
    console.log(`   🔮 Outliers: ${totalOutliers}`);
    console.log(`   🏔️ Mega: ${megaSent ? 'YES' : 'no'}`);
    console.log(`   📨 Total events: ${eventCount}`);
    console.log('\n⏳ Wait ~2 min for PostHog to ingest, then check:');
    console.log('   https://eu.posthog.com/project/85924/llm-analytics/dashboard');
}

main().catch(console.error);
