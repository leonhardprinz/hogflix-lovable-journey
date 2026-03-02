#!/usr/bin/env node
/**
 * HogFlix Synthetic LLM Analytics Traffic Generator
 * 
 * Generates realistic $ai_generation events via PostHog Capture API
 * to populate the LLM Analytics dashboard with demo-ready data.
 * 
 * Usage:
 *   node scripts/generate-llm-traffic.js              # 14-day backfill
 *   INCREMENTAL=true node scripts/generate-llm-traffic.js  # single day (for CI)
 */

const POSTHOG_API_KEY = process.env.PH_PROJECT_API_KEY || process.env.POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh';
const POSTHOG_HOST = process.env.PH_HOST || 'https://eu.i.posthog.com';
const INCREMENTAL = process.env.INCREMENTAL === 'true';

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const DAYS_BACK = INCREMENTAL ? 1 : 14;
const CONVERSATIONS_PER_DAY = { min: 8, max: 25 };
const MESSAGES_PER_CONVERSATION = { min: 1, max: 5 };
const CACHE_HIT_RATE = 0.20;
const TOOL_USAGE_RATE = 0.15;
const STREAMING_RATE = 0.70;

// Guarantee at least 1 error and 1 outlier per run
const GUARANTEED_ERRORS_PER_DAY = 1;
const GUARANTEED_OUTLIERS_PER_DAY = 1;

// ─── MODELS & PROVIDERS ──────────────────────────────────────────────────────

const MODELS = [
    {
        model: 'gemini-2.0-flash', provider: 'google', baseUrl: 'https://generativelanguage.googleapis.com/v1', weight: 0.35,
        inputPrice: 0.10 / 1e6, outputPrice: 0.40 / 1e6
    },
    {
        model: 'gemini-2.5-flash', provider: 'google', baseUrl: 'https://generativelanguage.googleapis.com/v1', weight: 0.20,
        inputPrice: 0.15 / 1e6, outputPrice: 0.60 / 1e6
    },
    {
        model: 'gpt-4o-mini', provider: 'openai', baseUrl: 'https://api.openai.com/v1', weight: 0.20,
        inputPrice: 0.15 / 1e6, outputPrice: 0.60 / 1e6
    },
    {
        model: 'claude-3.5-sonnet', provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', weight: 0.15,
        inputPrice: 3.00 / 1e6, outputPrice: 15.00 / 1e6
    },
    {
        model: 'claude-3.5-haiku', provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', weight: 0.10,
        inputPrice: 0.80 / 1e6, outputPrice: 4.00 / 1e6
    },
];

// ─── USERS ───────────────────────────────────────────────────────────────────

const USERS = [
    'leo@posthog.com',
    'leonhardprinz@gmail.com',
    'summers.nor-7f@icloud.com',
    'slatted_combats.9i@icloud.com',
    'treadle-tidbit-1b@icloud.com',
    'toppers.tester_3c@icloud.com',
    'slate-polders3m@icloud.com',
    'cabals-foyer-5w@icloud.com',
    'arroyo.gunner_6z@icloud.com',
];

// ─── FLIXBUDDY SYSTEM PROMPT ────────────────────────────────────────────────

const FLIXBUDDY_SYSTEM_PROMPT = `You are FlixBuddy, the AI movie recommendation assistant for HogFlix. 
You help users discover movies and series from the HogFlix catalog. 
You can search the catalog, provide personalized recommendations, and answer questions about content.
Always be enthusiastic and helpful. Reference specific titles from the HogFlix catalog when possible.`;

// ─── CONVERSATION TEMPLATES (for clustering) ─────────────────────────────────

// CLUSTER 1: Movie recommendation requests (majority — ~70%)
const RECOMMENDATION_CONVERSATIONS = [
    [
        { user: "What's trending right now?", assistant: "Great question! Here are the top trending titles on HogFlix right now:\n\n1. **Lord of the Hogs: The Fellowship** - An epic adventure following Fro-hog Baggins on a quest across Middle Garth ⭐ 9.3\n2. **Jurassic Hog** - Prehistoric hedgehogs break free from a biotech park 🦔\n3. **The Hog Father** - A powerful crime saga about the Quillione family\n\nWant me to tell you more about any of these?" },
        { user: "Tell me more about Lord of the Hogs", assistant: "**Lord of the Hogs: The Fellowship** is our most-watched epic this month!\n\n📖 **Plot**: Young Fro-hog Baggins inherits a mysterious golden ring from his uncle Bil-hog. When the wizard Gandhog reveals its dark origin, Fro-hog must journey to Mount Doom to destroy it — joined by a fellowship of unlikely heroes.\n\n⏱️ Runtime: 2h 58m\n⭐ Rating: 9.3/10\n🎭 Genre: Fantasy, Adventure\n🎬 Director: Peter Jacksonhog\n\nIt's the first part of a trilogy — all three are available on HogFlix! Should I add it to your watchlist?" },
    ],
    [
        { user: "I want something funny", assistant: "Here are our top comedy picks! 😂\n\n1. **Hedgehog's Day** - A weatherhog relives the same day over and over until he gets it right\n2. **The Big Hedgowski** - A laid-back hedgehog gets caught up in a case of mistaken identity\n3. **Spiny Business** - A young hedgehog turns his living room into a dance floor\n4. **Hog Actually** - Multiple hedgehog love stories intertwine during the holidays\n\nAll are rated 4+ stars! Which one catches your eye?" },
    ],
    [
        { user: "Recommend a family movie for tonight", assistant: "Perfect family movie night picks! 🍿\n\n1. **Hog Wild** - A heartwarming adventure about a young hedgehog finding courage (PG, 1h 45m)\n2. **Finding Nemo-hog** - A father hedgehog crosses the ocean to find his lost son (PG, 1h 40m)\n3. **The Incredihogs** - A family of super-powered hedgehogs save the world (PG, 2h 5m)\n\nAll are family-friendly with no scary scenes. I'd especially recommend **Hog Wild** if you have younger kids — it's our most popular family title this month!" },
    ],
    [
        { user: "What's similar to Jurassic Hog?", assistant: "If you loved Jurassic Hog, you'll enjoy these sci-fi thrillers:\n\n1. **Interstellar Spines** - Hedgehogs venture beyond the solar system to save their species (⭐ 8.9)\n2. **The Martian Hedgehog** - A botanist hedgehog stranded on Mars must survive alone (⭐ 8.7)\n3. **Jurassic Hog: Fallen Kingdom** - The sequel! Even more prehistoric hedgehog action (⭐ 7.8)\n4. **Hedgehog Park** - A theme park with genetically engineered creatures goes wrong (⭐ 8.1)\n\nAll have that same blend of science, suspense, and spectacular visuals!" },
        { user: "Add Interstellar Spines to my watchlist", assistant: "Done! ✅ **Interstellar Spines** has been added to your watchlist.\n\nYou've got great taste — this one won 3 Hedgehog Academy Awards including Best Visual Effects. Enjoy the ride! 🚀" },
    ],
    [
        { user: "I'm in the mood for a thriller", assistant: "Buckle up! Here are our best thrillers:\n\n1. **Gone Hog** - A hedgehog's disappearance unravels dark secrets (⭐ 8.5)\n2. **The Silence of the Hedgehogs** - A young FBI agent seeks help from an imprisoned genius (⭐ 8.9)\n3. **Se-hog-en** - Two detectives hunt a serial criminal using the seven deadly sins (⭐ 8.6)\n4. **Shutter Hedgehog Island** - A US Marshal investigates a disappearance on a mysterious island (⭐ 8.2)\n\n⚠️ These are all rated R — perfect for a gripping evening!" },
    ],
    [
        { user: "Show me hidden gems I might have missed", assistant: "Here are some underrated treasures from the HogFlix vault:\n\n1. **The Grand Budapest Hedgehog** - A quirky adventure in a famous hotel (⭐ 8.8 but only 12% of users have watched it)\n2. **Moonrise Quilldom** - Two young hedgehogs run away together in the 60s\n3. **The Prickly Life of Walter Mitty** - A daydreaming hedgehog goes on a real adventure\n4. **Hunt for the Wilderhedgehog** - A heartwarming New Zealand comedy-drama\n\nThese are all critically acclaimed but often overlooked. Trust me, they're worth your time!" },
    ],
    [
        { user: "Any new releases this week?", assistant: "Fresh off the press! 🎬 This week's new additions:\n\n1. **Dune: Part Hog** - The highly anticipated sci-fi epic (added Tuesday)\n2. **Barbie-hog** - The cultural phenomenon finally on HogFlix (added Wednesday)\n3. **Oppenhedgehog** - Historical drama about the atomic age (added Thursday)\n4. **Poor Things Hedgehog** - A surreal Victorian-era tale (added Friday)\n\nDune is already our #1 most-watched new release! What catches your eye?" },
        { user: "Which one has the best reviews?", assistant: "By critical reception:\n\n1. 🥇 **Oppenhedgehog** - 94% critics score, Christopher Nolanhog's masterpiece\n2. 🥈 **Poor Things Hedgehog** - 92% critics, won Best Picture at the Quill Awards\n3. 🥉 **Dune: Part Hog** - 91% critics, stunning visuals and epic scope\n4. **Barbie-hog** - 88% critics, a fun and surprisingly deep exploration of identity\n\nIf you want to be wowed, go with Oppenhedgehog. If you want something lighter, Barbie-hog is a blast!" },
    ],
    [
        { user: "Suggest a binge-worthy series", assistant: "Here are series you won't be able to stop watching:\n\n1. **Prickly Blinders** - Period crime drama, 6 seasons (⭐ 9.1)\n2. **Breaking Spines** - A chemistry teacher hedgehog turns to crime, 5 seasons (⭐ 9.5)\n3. **The Quill** - Political drama about a hedgehog president, 4 seasons (⭐ 8.8)\n4. **Stranger Spines** - Sci-fi mystery in a small hedgehog town, 4 seasons (⭐ 8.7)\n\nIf you want the absolute best? **Breaking Spines** is widely considered one of the greatest series ever made." },
        { user: "How many episodes in Breaking Spines?", assistant: "**Breaking Spines** has:\n\n📺 5 Seasons, 62 episodes total\n⏱️ Episodes are ~47 minutes each\n🕐 Total watch time: ~49 hours\n\nPerfect for a weekend binge! Plus, there's also **Better Call Saul-hog** (6 seasons) as a prequel if you get hooked.\n\nPro tip: Start with S01E01 \"Pilot\" — the opening scene will have you instantly hooked! 🎬" },
    ],
    [
        { user: "What are the best action movies?", assistant: "Adrenaline time! 💥 Our top action picks:\n\n1. **Mad Max: Fury Hog** - Non-stop desert chase action (⭐ 8.8)\n2. **John Quill** - A retired assassin hedgehog comes back for revenge (⭐ 7.9)\n3. **The Dark Hedgehog** - The definitive superhero action film (⭐ 9.0)\n4. **Top Hog: Maverick** - Fighter pilot hedgehog action (⭐ 8.5)\n5. **Mission: Impossihog** - Spy thriller with insane stunts (⭐ 8.3)\n\nFor pure non-stop action, Mad Max can't be beat. For something with depth, The Dark Hedgehog is the one!" },
    ],
    [
        { user: "I liked The Hog Father, what else would I enjoy?", assistant: "If you loved The Hog Father, here are similar crime dramas:\n\n1. **Goodfellas: Hedgehog Edition** - Rise and fall of a mob hedgehog (⭐ 8.7)\n2. **Scarspine** - A Cuban hedgehog builds a criminal empire (⭐ 8.3)\n3. **The Departed Hedgehog** - Moles within the mob and police (⭐ 8.5)\n4. **Casino Hedgehog** - The rise and fall of a Las Vegas empire (⭐ 8.2)\n\nAll feature complex characters, family dynamics, and gripping storylines like The Hog Father. The Departed is probably the closest match!" },
    ],
];

// CLUSTER 2: Meaningful error conversations (~10%)
const ERROR_CONVERSATIONS = [
    {
        userMessages: [
            { user: "Recommend something for my 5 year old", assistant: null },
        ],
        error: 'Content filtering error: Unable to generate age-appropriate recommendations. The content safety filter flagged the request for additional review. Model returned empty response after 3 retry attempts.',
        errorType: 'content_safety_filter',
        httpStatus: 422,
    },
    {
        userMessages: [
            { user: "Give me a very detailed plot analysis of every single movie in the fantasy genre including all subplots, character arcs, thematic elements, symbolism, cinematographic choices, and directorial decisions for each of the 47 fantasy titles in the HogFlix catalog", assistant: null },
        ],
        error: 'Context length exceeded: Input of 127,493 tokens exceeds the maximum context window of 128,000 tokens. The request included too much catalog data. Consider breaking the request into smaller chunks.',
        errorType: 'context_length_exceeded',
        httpStatus: 400,
    },
    {
        userMessages: [
            { user: "What should I watch tonight?", assistant: null },
        ],
        error: 'Rate limit exceeded: 429 Too Many Requests. The Gemini API rate limit of 60 requests per minute has been exceeded. FlixBuddy is experiencing high demand. Retry after 32 seconds.',
        errorType: 'rate_limit',
        httpStatus: 429,
    },
    {
        userMessages: [
            { user: "Show me something romantic", assistant: null },
        ],
        error: 'Upstream provider timeout: The request to Google Gemini API timed out after 30000ms. The model did not respond within the expected timeframe. This is typically caused by high load on the provider side.',
        errorType: 'provider_timeout',
        httpStatus: 504,
    },
    {
        userMessages: [
            { user: "search for documentaries about nature", assistant: null },
        ],
        error: 'Tool execution failed: search_movies returned an error: Supabase connection pool exhausted (max 20 connections). Unable to query the movie catalog. Database connection timeout after 5000ms.',
        errorType: 'tool_execution_failed',
        httpStatus: 500,
    },
];

// CLUSTER 3: Outlier - off-topic "movie script discussion" (~5%)
const OUTLIER_CONVERSATIONS = [
    [
        { user: "I've been writing a screenplay about a hedgehog detective. Can you help me develop the plot?", assistant: "That sounds like a fun creative project! While I'm primarily designed to help you find movies to watch on HogFlix, I can share some thoughts:\n\nA hedgehog detective is a great concept! You might draw inspiration from some of our noir titles like **The Maltese Hedgehog** or **Chinatown Spines** for that classic detective atmosphere.\n\nBut for proper screenwriting help, I'd recommend checking out dedicated writing tools. Would you like me to recommend some detective movies instead for inspiration? 🎬" },
        { user: "No I want help with the actual script. The detective hedgehog discovers a conspiracy in a garden. How should I structure act 2?", assistant: "I appreciate the creativity! A garden conspiracy sounds intriguing 🌿\n\nFor Act 2 structure, traditionally you'd want:\n- The detective finds initial clues (maybe mysterious holes in the garden)\n- A midpoint twist (the gardener isn't who they seem)\n- Escalating stakes (the conspiracy goes deeper than one garden)\n\nHowever, I should be honest — I'm really built to recommend HogFlix content, not write scripts! For screenwriting structure, you might enjoy watching **Adaptation Hedgehog** on HogFlix — it's literally a movie about writing a screenplay.\n\nWant me to find some movies with great detective plot structures you could study? 🕵️" },
        { user: "Can you write me some dialogue for the confrontation scene between the detective and the villain?", assistant: "I'm flattered you'd ask! But writing original dialogue is really outside my wheelhouse — I'm FlixBuddy, your movie recommendation assistant! 🎬\n\nWhat I CAN do is point you to movies with legendary confrontation scenes:\n\n1. **The Silence of the Hedgehogs** — The Clarice/Hannibal scenes are masterclass dialogue\n2. **The Dark Hedgehog** — The interrogation scene is iconic\n3. **A Few Good Hedgehogs** — \"You can't handle the truth!\" \n\nStudying these would be way more helpful than anything I could write. Should I add any to your watchlist for research? 📝" },
    ],
    [
        { user: "I'm a film student and need to analyze the three-act structure. Can you explain it to me?", assistant: "Great question! While I'm a movie recommender rather than a film theory professor, I can give you the basics:\n\n**Three-Act Structure:**\n- **Act 1 (Setup)**: Introduce characters, world, and the inciting incident (~25%)\n- **Act 2 (Confrontation)**: Rising action, obstacles, midpoint twist (~50%)\n- **Act 3 (Resolution)**: Climax and resolution (~25%)\n\nFor hands-on learning, I'd recommend watching these HogFlix titles that have textbook structure:\n\n1. **The Spiny Redemption** — Perfect three-act execution\n2. **Jurassic Hog** — Clear act breaks you can feel\n3. **Lord of the Hogs** — Extended structure with multiple payoffs\n\nWant me to create a watchlist of films with notable narrative structures?" },
        { user: "Can you compare the narrative techniques of Kubrick and Nolan using examples?", assistant: "That's a deep film theory question! 🎓 I'll do my best:\n\n**Kubrickhog** style (cold, symmetrical, unsettling):\n- **2001: A Spine Odyssey** — Minimal dialogue, visual storytelling\n- **The Shining Hedgehog** — Slow build, psychological horror\n\n**Nolanhog** style (non-linear, cerebral, spectacle):\n- **Interstellar Spines** — Time manipulation as narrative device\n- **Inceptionhog** — Nested storylines\n\nBoth are available on HogFlix! For a proper deep dive, I'd recommend watching them back-to-back and taking notes. I'm better at finding you the right movie than being a film professor though! 😄" },
    ],
    [
        { user: "What's the difference between a dolly zoom and a tracking shot? I need this for my YouTube video essay", assistant: "Fun question! Quick answer:\n\n**Dolly Zoom (Vertigo Effect)**: Camera moves forward while zooming out (or vice versa), creating a disorienting background shift. Famous in **Jaws Hedgehog** and **Goodfellas Hedgehog Edition**.\n\n**Tracking Shot**: Camera physically moves alongside the subject. Think of the long take in **Prickly Blinders** or **The Revenant Hedgehog**.\n\nAll these films are on HogFlix if you want to see them in action! But honestly, for a YouTube essay, you'd get more value from cinematography-specific resources.\n\nShall I recommend films known for their cinematography instead? I can curate a proper visual filmmaker's watchlist! 🎥" },
    ],
];

// ─── TOOLS ───────────────────────────────────────────────────────────────────

const FLIXBUDDY_TOOLS = [
    { type: 'function', function: { name: 'search_movies', description: 'Search the HogFlix movie catalog', parameters: { type: 'object', properties: { query: { type: 'string' }, genre: { type: 'string' } } } } },
    { type: 'function', function: { name: 'get_recommendations', description: 'Get personalized recommendations for a user', parameters: { type: 'object', properties: { user_id: { type: 'string' }, limit: { type: 'number' } } } } },
    { type: 'function', function: { name: 'get_watchlist', description: 'Get user watchlist', parameters: { type: 'object', properties: { user_id: { type: 'string' } } } } },
    { type: 'function', function: { name: 'add_to_watchlist', description: 'Add a movie to user watchlist', parameters: { type: 'object', properties: { user_id: { type: 'string' }, movie_id: { type: 'string' } } } } },
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
    for (const item of items) {
        r -= item.weight;
        if (r <= 0) return item;
    }
    return items[items.length - 1];
}

function generateTimestamp(daysBack) {
    const now = new Date();
    const dayOffset = Math.random() * daysBack;
    const date = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);

    // Bias towards evening hours (more realistic usage)
    const hour = Math.random() < 0.6
        ? randInt(18, 23)  // 60% evening
        : Math.random() < 0.5
            ? randInt(12, 17)  // 20% afternoon
            : randInt(7, 11);  // 20% morning

    date.setHours(hour, randInt(0, 59), randInt(0, 59), randInt(0, 999));
    return date.toISOString();
}

/** Format messages in PostHog's expected structure */
function formatInput(systemPrompt, userMessage) {
    return [
        { role: 'system', content: [{ type: 'text', text: systemPrompt }] },
        { role: 'user', content: [{ type: 'text', text: userMessage }] },
    ];
}

function formatOutput(assistantMessage) {
    return [
        { role: 'assistant', content: [{ type: 'text', text: assistantMessage }] },
    ];
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
            body: JSON.stringify({
                api_key: POSTHOG_API_KEY,
                batch: batch,
            }),
        });

        if (!res.ok) {
            console.error(`   ❌ Batch failed: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.error(`      ${text.substring(0, 200)}`);
        }
    } catch (err) {
        console.error(`   ❌ Network error: ${err.message}`);
    }
}

function queueEvent(event) {
    batchQueue.push(event);
    eventCount++;
    if (batchQueue.length >= BATCH_SIZE) {
        return flushBatch();
    }
    return Promise.resolve();
}

// ─── GENERATION BUILDER ──────────────────────────────────────────────────────

function buildGeneration({ distinctId, timestamp, modelConfig, userMsg, assistantMsg, traceId, sessionId, spanId, parentId, isError, errorDetails }) {
    const inputTokens = randInt(50, 800);
    const outputTokens = isError ? 0 : randInt(100, 1500);
    const latency = isError ? randFloat(25, 30) : randFloat(0.3, 4.5);
    const ttft = modelConfig.provider === 'anthropic' ? randFloat(0.1, 0.8) : randFloat(0.05, 0.4);
    const temperature = pick([0.0, 0.3, 0.5, 0.7, 1.0]);
    const maxTokens = pick([1024, 2048, 4096, 8192]);

    const inputCost = inputTokens * modelConfig.inputPrice;
    const outputCost = outputTokens * modelConfig.outputPrice;

    const hasCacheHit = !isError && Math.random() < CACHE_HIT_RATE;
    const hasTools = !isError && Math.random() < TOOL_USAGE_RATE;
    const isStreaming = Math.random() < STREAMING_RATE;

    const properties = {
        // Core
        $ai_trace_id: traceId,
        $ai_session_id: sessionId,
        $ai_span_id: spanId,
        $ai_span_name: 'flixbuddy_chat_completion',
        $ai_model: modelConfig.model,
        $ai_provider: modelConfig.provider,
        $ai_base_url: modelConfig.baseUrl,
        $ai_http_status: isError ? (errorDetails?.httpStatus || 500) : 200,

        // Input/Output (structured format for PostHog display)
        $ai_input: formatInput(FLIXBUDDY_SYSTEM_PROMPT, userMsg),
        $ai_input_tokens: inputTokens,
        $ai_output_choices: isError ? [] : formatOutput(assistantMsg),
        $ai_output_tokens: outputTokens,

        // Performance
        $ai_latency: Math.round(latency * 1000) / 1000,

        // Cost
        $ai_input_cost_usd: Math.round(inputCost * 1e8) / 1e8,
        $ai_output_cost_usd: Math.round(outputCost * 1e8) / 1e8,
        $ai_total_cost_usd: Math.round((inputCost + outputCost) * 1e8) / 1e8,

        // Model params
        $ai_temperature: temperature,
        $ai_stream: isStreaming,
        $ai_max_tokens: maxTokens,

        // Error
        $ai_is_error: isError,

        // Custom
        hogflix_feature: 'FlixBuddy',

        $lib: 'posthog-node',
        $lib_version: '4.3.1',
    };

    // Streaming TTFT
    if (isStreaming && !isError) {
        properties.$ai_time_to_first_token = Math.round(ttft * 1000) / 1000;
    }

    // Parent span
    if (parentId) {
        properties.$ai_parent_id = parentId;
    }

    // Error details
    if (isError && errorDetails) {
        properties.$ai_error = errorDetails.error;
        properties.error_type = errorDetails.errorType;
    }

    // Cache properties
    if (hasCacheHit) {
        properties.$ai_cache_read_input_tokens = randInt(100, 500);
        properties.$ai_cache_creation_input_tokens = 0;
    } else if (!isError && Math.random() < 0.1) {
        properties.$ai_cache_read_input_tokens = 0;
        properties.$ai_cache_creation_input_tokens = randInt(200, 800);
    }

    // Tools
    if (hasTools) {
        properties.$ai_tools = FLIXBUDDY_TOOLS;
    }

    return {
        event: '$ai_generation',
        distinct_id: distinctId,
        timestamp,
        properties,
    };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🎬 HogFlix Synthetic LLM Analytics Generator');
    console.log('━'.repeat(50));
    console.log(`   Mode: ${INCREMENTAL ? 'INCREMENTAL (1 day)' : 'BACKFILL (14 days)'}`);
    console.log(`   Target: ${POSTHOG_HOST}`);
    console.log(`   Models: ${MODELS.map(m => m.model).join(', ')}`);
    console.log(`   Users: ${USERS.length}`);
    console.log('━'.repeat(50));

    let totalGenerations = 0;
    let totalErrors = 0;
    let totalOutliers = 0;

    for (let day = 0; day < DAYS_BACK; day++) {
        const conversationsToday = randInt(CONVERSATIONS_PER_DAY.min, CONVERSATIONS_PER_DAY.max);

        // Weekend boost
        const dayOfWeek = new Date(Date.now() - day * 86400000).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const adjustedConversations = isWeekend
            ? Math.round(conversationsToday * 1.4)
            : conversationsToday;

        console.log(`\n📅 Day -${day} (${isWeekend ? '🎉 weekend' : 'weekday'}): ${adjustedConversations} conversations`);

        let errorsToday = 0;
        let outliersToday = 0;

        for (let c = 0; c < adjustedConversations; c++) {
            const user = pick(USERS);
            const modelConfig = pickWeighted(MODELS);
            const traceId = uuid();
            const sessionId = `session-${uuid().substring(0, 8)}`;

            // Determine conversation type
            let conversationType = 'recommendation'; // default

            // Guarantee at least 1 error per day
            if (errorsToday < GUARANTEED_ERRORS_PER_DAY && c === Math.floor(adjustedConversations * 0.3)) {
                conversationType = 'error';
            }
            // Guarantee at least 1 outlier per day  
            else if (outliersToday < GUARANTEED_OUTLIERS_PER_DAY && c === Math.floor(adjustedConversations * 0.7)) {
                conversationType = 'outlier';
            }
            // Random additional errors/outliers
            else if (Math.random() < 0.05) {
                conversationType = 'error';
            }
            else if (Math.random() < 0.03) {
                conversationType = 'outlier';
            }

            const baseTimestamp = generateTimestamp(day + Math.random());
            const baseTime = new Date(baseTimestamp).getTime();
            let parentSpanId = null;

            if (conversationType === 'error') {
                // --- ERROR CONVERSATION ---
                const errorConvo = pick(ERROR_CONVERSATIONS);
                errorsToday++;
                totalErrors++;

                const spanId = uuid();
                const msg = errorConvo.userMessages[0];

                const gen = buildGeneration({
                    distinctId: user,
                    timestamp: baseTimestamp,
                    modelConfig,
                    userMsg: msg.user,
                    assistantMsg: '',
                    traceId,
                    sessionId,
                    spanId,
                    parentId: null,
                    isError: true,
                    errorDetails: errorConvo,
                });

                await queueEvent(gen);
                totalGenerations++;
                console.log(`      ❌ Error: ${errorConvo.errorType}`);

            } else if (conversationType === 'outlier') {
                // --- OUTLIER CONVERSATION (movie script discussion) ---
                const outlierConvo = pick(OUTLIER_CONVERSATIONS);
                outliersToday++;
                totalOutliers++;

                for (let m = 0; m < outlierConvo.length; m++) {
                    const spanId = uuid();
                    const exchange = outlierConvo[m];
                    const msgTimestamp = new Date(baseTime + m * randInt(15000, 60000)).toISOString();

                    const gen = buildGeneration({
                        distinctId: user,
                        timestamp: msgTimestamp,
                        modelConfig,
                        userMsg: exchange.user,
                        assistantMsg: exchange.assistant,
                        traceId,
                        sessionId,
                        spanId,
                        parentId: parentSpanId,
                        isError: false,
                    });

                    await queueEvent(gen);
                    totalGenerations++;
                    parentSpanId = spanId;
                }
                console.log(`      🔮 Outlier: movie script discussion (${outlierConvo.length} turns)`);

            } else {
                // --- NORMAL RECOMMENDATION CONVERSATION ---
                const convo = pick(RECOMMENDATION_CONVERSATIONS);

                for (let m = 0; m < convo.length; m++) {
                    const spanId = uuid();
                    const exchange = convo[m];
                    const msgTimestamp = new Date(baseTime + m * randInt(5000, 30000)).toISOString();

                    const gen = buildGeneration({
                        distinctId: user,
                        timestamp: msgTimestamp,
                        modelConfig,
                        userMsg: exchange.user,
                        assistantMsg: exchange.assistant,
                        traceId,
                        sessionId,
                        spanId,
                        parentId: parentSpanId,
                        isError: false,
                    });

                    await queueEvent(gen);
                    totalGenerations++;
                    parentSpanId = spanId;
                }
            }
        }
    }

    // Final flush
    while (batchQueue.length > 0) {
        await flushBatch();
    }

    console.log('\n' + '━'.repeat(50));
    console.log('✅ Generation complete!');
    console.log(`   📊 Generations: ${totalGenerations}`);
    console.log(`   ❌ Errors: ${totalErrors}`);
    console.log(`   🔮 Outliers: ${totalOutliers}`);
    console.log(`   📨 Total events sent: ${eventCount}`);
    console.log('\n⏳ Wait ~2 minutes for PostHog to ingest, then check:');
    console.log('   https://eu.posthog.com/project/85924/llm-analytics/dashboard');
}

main().catch(console.error);
