#!/usr/bin/env node
/**
 * HogFlix Synthetic LLM Analytics Traffic Generator
 * 
 * Generates realistic $ai_generation and $ai_trace events via PostHog Capture API
 * to populate the LLM Analytics dashboard with demo-ready data.
 * 
 * Usage: node scripts/generate-llm-traffic.js
 */

const POSTHOG_API_KEY = process.env.PH_PROJECT_API_KEY || process.env.POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh';
const POSTHOG_HOST = process.env.PH_HOST || 'https://eu.i.posthog.com';
const INCREMENTAL = process.env.INCREMENTAL === 'true';

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const DAYS_BACK = INCREMENTAL ? 1 : 14;
const CONVERSATIONS_PER_DAY = { min: 8, max: 25 };
const MESSAGES_PER_CONVERSATION = { min: 1, max: 5 };
const ERROR_RATE = 0.05;
const CACHE_HIT_RATE = 0.20;
const TOOL_USAGE_RATE = 0.15;
const STREAMING_RATE = 0.70;

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

// ─── USE CASES ───────────────────────────────────────────────────────────────

const USE_CASES = [
    {
        name: 'flixbuddy_chat',
        spanName: 'flixbuddy_chat_completion',
        systemPrompt: 'You are FlixBuddy, a movie recommendation assistant for HogFlix. Help users discover hedgehog-themed movies and series.',
        userMessages: [
            "What's trending right now?",
            "I want something funny with hedgehogs",
            "Recommend a family-friendly movie",
            "What are the best action movies?",
            "I'm in the mood for a thriller",
            "Show me hidden gems I might have missed",
            "What's similar to Lord of the Hogs?",
            "Any new releases this week?",
            "I liked Jurassic Hog, what else would I enjoy?",
            "Recommend something for date night",
            "What's the highest rated content?",
            "Show me hedgehog documentaries",
            "I want a movie with great cinematography",
            "What are people watching most?",
            "Suggest a binge-worthy series",
        ],
        assistantResponses: [
            "Great choice! Here are the top trending titles on HogFlix right now:\n\n1. **Lord of the Hogs: The Fellowship** - An epic adventure following Fro-hog Baggins\n2. **Jurassic Hog** - Prehistoric hedgehogs roam free on a remote island\n3. **The Hog Father** - A powerful crime drama about the Quillione family\n\nWould you like more details about any of these?",
            "If you're looking for laughs, you'll love:\n\n1. **Hedgehog's Day** - A weatherhog relives the same day over and over 😂\n2. **The Big Hedgowski** - A laid-back hedgehog gets caught up in a case of mistaken identity\n3. **Spiny Business** - A young hedgehog turns his living room into a dance floor\n\nAll highly rated comedies!",
            "Based on your viewing history and preferences, I'd recommend:\n\n1. **Quill & Order** - A gripping legal drama with a hedgehog twist\n2. **Breaking Spines** - An unlikely hedgehog hero in the desert\n3. **Hog Wild** - Adventure awaits in this family-friendly romp\n\nShall I add any to your watchlist?",
            "Here's a mix of critically acclaimed titles you might enjoy:\n\n1. **The Spiny Redemption** - A tale of hope and perseverance (⭐ 9.2)\n2. **Prickly Blinders** - Period drama meets hedgehog gangsters\n3. **Sonic Speed** - High-octane action with our fastest hedgehog hero\n\nI can tell you more about any of these!",
            "For date night, I'd suggest something with great atmosphere:\n\n1. **Eternal Quillshine of the Spotless Mind** - A beautiful romantic sci-fi\n2. **The Notebook of Spines** - Classic romance, hedgehog style\n3. **La La Hedgehog** - Musical magic under the stars\n\nAll perfect for a cozy evening in! 🎬",
        ],
        tools: [
            { type: 'function', function: { name: 'search_movies', parameters: { query: 'string', genre: 'string' } } },
            { type: 'function', function: { name: 'get_recommendations', parameters: { user_id: 'string', limit: 'number' } } },
            { type: 'function', function: { name: 'get_watchlist', parameters: { user_id: 'string' } } },
        ],
    },
    {
        name: 'ai_search',
        spanName: 'ai_search_query',
        systemPrompt: 'You are a semantic search engine for HogFlix. Return relevant movie results based on natural language queries.',
        userMessages: [
            "hedgehog movies with time travel",
            "best rated series 2025",
            "action movies similar to sonic",
            "family movies with animals",
            "dark comedy hedgehog films",
            "award winning documentaries",
            "movies about friendship and adventure",
        ],
        assistantResponses: [
            "Found 3 results matching your search:\n\n1. **Hedgehog's Day** (Comedy, 2024) - Time loop comedy, 92% match\n2. **Back to the Burrow** (Sci-Fi, 2023) - Time-traveling hedgehog, 87% match\n3. **Interstellar Spines** (Sci-Fi, 2024) - Space-time manipulation, 78% match",
            "Top rated series for 2025:\n\n1. **Prickly Blinders S3** - ⭐ 9.4 (Drama)\n2. **Quill & Order: SVU** - ⭐ 9.1 (Legal Drama)\n3. **The Spiny Crown** - ⭐ 8.9 (Historical Drama)",
            "Search results for 'action movies similar to sonic':\n\n1. **Sonic Speed** - 95% match, high-octane racing action\n2. **The Fast and the Prickly** - 88% match, street racing hedgehogs\n3. **Hog Hard** - 82% match, one hedgehog vs. a skyscraper",
        ],
        tools: [
            { type: 'function', function: { name: 'semantic_search', parameters: { query: 'string', top_k: 'number' } } },
            { type: 'function', function: { name: 'filter_results', parameters: { genre: 'string', min_rating: 'number' } } },
        ],
    },
    {
        name: 'video_summary',
        spanName: 'generate_video_summary',
        systemPrompt: 'You are a video content summarizer for HogFlix. Generate concise, engaging summaries of movie content.',
        userMessages: [
            "Summarize the plot of Lord of the Hogs",
            "Give me a quick overview of Jurassic Hog",
            "What happens in The Spiny Redemption?",
            "Brief summary of Prickly Blinders season 1",
            "Tell me about Hedgehog's Day without spoilers",
        ],
        assistantResponses: [
            "**Lord of the Hogs: The Fellowship**\n\nIn the tranquil, rolling gardens of the Shire, a young and unassuming hedgehog named Fro-hog Baggins inherits a mysterious golden ring from his eccentric uncle, Bil-hog. When the wise wizard Gandhog reveals the ring's dark origin, Fro-hog must embark on a perilous journey to destroy it in the fires of Mount Doom. Along the way, he's joined by a fellowship of unlikely allies.\n\n⏱️ Runtime: 2h 58m | ⭐ 9.1/10 | 🎭 Fantasy, Adventure",
            "**Jurassic Hog**\n\nEccentric billionaire John Hammond has achieved the impossible: a remote island sanctuary where genetically-engineered, prehistoric hedgehogs roam free. He invites a select group of experts to preview his creation, but when the park's security systems fail during a tropical storm, the ancient hedgehogs break free. What was meant to be a wonder of science becomes a fight for survival.\n\n⏱️ Runtime: 2h 7m | ⭐ 8.4/10 | 🎭 Sci-Fi, Thriller",
        ],
        tools: [],
    },
    {
        name: 'content_moderation',
        spanName: 'moderate_user_content',
        systemPrompt: 'You are a content moderation system for HogFlix. Analyze user-submitted reviews and comments for policy violations.',
        userMessages: [
            "Review: This movie was absolutely terrible, worst thing I've ever seen!",
            "Comment: Great film, loved every minute of it! ⭐⭐⭐⭐⭐",
            "Review: The special effects were mind-blowing but the plot was thin",
            "Comment: Can't wait for the sequel, when is it coming out?",
        ],
        assistantResponses: [
            '{"verdict": "approved", "confidence": 0.95, "categories": {"toxicity": 0.15, "spam": 0.02, "nsfw": 0.0}, "reasoning": "Negative opinion but within acceptable criticism guidelines"}',
            '{"verdict": "approved", "confidence": 0.99, "categories": {"toxicity": 0.0, "spam": 0.05, "nsfw": 0.0}, "reasoning": "Positive review, no policy violations"}',
            '{"verdict": "approved", "confidence": 0.97, "categories": {"toxicity": 0.08, "spam": 0.01, "nsfw": 0.0}, "reasoning": "Constructive mixed review"}',
        ],
        tools: [
            { type: 'function', function: { name: 'check_profanity', parameters: { text: 'string' } } },
            { type: 'function', function: { name: 'classify_sentiment', parameters: { text: 'string' } } },
        ],
    },
    {
        name: 'recommendation_engine',
        spanName: 'generate_recommendations',
        systemPrompt: 'You are the recommendation engine for HogFlix. Based on user watch history and preferences, generate personalized content recommendations.',
        userMessages: [
            "Generate recommendations for user who watched: Lord of the Hogs, Jurassic Hog, The Hog Father",
            "Recommend for a user who prefers: comedy, family, short films",
            "What should a thriller fan watch next?",
            "Recommendations for a new user with no history",
            "Generate weekend binge recommendations",
        ],
        assistantResponses: [
            '{"recommendations": [{"title": "The Spiny Redemption", "score": 0.94, "reason": "Epic narrative style matches your preferences"}, {"title": "Prickly Blinders", "score": 0.89, "reason": "Crime drama similar to The Hog Father"}, {"title": "Interstellar Spines", "score": 0.85, "reason": "Adventure + sci-fi blend"}], "algorithm": "collaborative_filtering_v3"}',
            '{"recommendations": [{"title": "Hedgehog\'s Day", "score": 0.96, "reason": "Top comedy match"}, {"title": "Hog Wild", "score": 0.91, "reason": "Family-friendly adventure"}, {"title": "Spiny Business", "score": 0.87, "reason": "Short comedy classic"}], "algorithm": "content_based_v2"}',
        ],
        tools: [
            { type: 'function', function: { name: 'get_watch_history', parameters: { user_id: 'string' } } },
            { type: 'function', function: { name: 'collaborative_filter', parameters: { user_id: 'string', top_k: 'number' } } },
            { type: 'function', function: { name: 'content_similarity', parameters: { video_ids: 'array', limit: 'number' } } },
        ],
    },
];

const ERROR_MESSAGES = [
    'Rate limit exceeded: 429 Too Many Requests',
    'Model overloaded, please retry after 30s',
    'Request timeout after 30000ms',
    'Context length exceeded: 128000 tokens max',
    'Invalid API key or insufficient permissions',
    'Service temporarily unavailable',
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

function buildGeneration({ distinctId, timestamp, modelConfig, useCase, userMsg, assistantMsg, traceId, sessionId, spanId, parentId, isError }) {
    const inputTokens = randInt(50, 800);
    const outputTokens = isError ? 0 : randInt(100, 1500);
    const latency = isError ? randFloat(25, 30) : randFloat(0.3, 4.5);
    const ttft = modelConfig.provider === 'anthropic' ? randFloat(0.1, 0.8) : randFloat(0.05, 0.4);
    const temperature = pick([0.0, 0.3, 0.5, 0.7, 1.0]);
    const maxTokens = pick([1024, 2048, 4096, 8192]);

    const inputCost = inputTokens * modelConfig.inputPrice;
    const outputCost = outputTokens * modelConfig.outputPrice;

    const hasCacheHit = !isError && Math.random() < CACHE_HIT_RATE;
    const hasTools = !isError && useCase.tools.length > 0 && Math.random() < TOOL_USAGE_RATE;
    const isStreaming = Math.random() < STREAMING_RATE;

    const properties = {
        // Core
        $ai_trace_id: traceId,
        $ai_session_id: sessionId,
        $ai_span_id: spanId,
        $ai_span_name: useCase.spanName,
        $ai_model: modelConfig.model,
        $ai_provider: modelConfig.provider,
        $ai_base_url: modelConfig.baseUrl,
        $ai_http_status: isError ? pick([429, 500, 503, 408]) : 200,

        // Input/Output
        $ai_input: [
            { role: 'system', content: useCase.systemPrompt },
            { role: 'user', content: userMsg },
        ],
        $ai_input_tokens: inputTokens,
        $ai_output_choices: isError ? [] : [
            { role: 'assistant', content: assistantMsg },
        ],
        $ai_output_tokens: outputTokens,

        // Performance
        $ai_latency: Math.round(latency * 1000) / 1000,
        $ai_time_to_first_token: isStreaming ? Math.round(ttft * 1000) / 1000 : undefined,

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

        // Custom HogFlix properties
        hogflix_use_case: useCase.name,
        hogflix_feature: useCase.name === 'flixbuddy_chat' ? 'FlixBuddy' : useCase.name,
    };

    // Parent span (for multi-step traces)
    if (parentId) {
        properties.$ai_parent_id = parentId;
    }

    // Error details
    if (isError) {
        properties.$ai_error = pick(ERROR_MESSAGES);
    }

    // Cache properties
    if (hasCacheHit) {
        properties.$ai_cache_read_input_tokens = randInt(100, 500);
        properties.$ai_cache_creation_input_tokens = 0;
    } else if (!isError && Math.random() < 0.1) {
        // 10% chance of cache write
        properties.$ai_cache_read_input_tokens = 0;
        properties.$ai_cache_creation_input_tokens = randInt(200, 800);
    }

    // Tools
    if (hasTools) {
        properties.$ai_tools = useCase.tools;
    }

    // Clean undefined values
    Object.keys(properties).forEach(k => {
        if (properties[k] === undefined) delete properties[k];
    });

    return {
        event: '$ai_generation',
        distinct_id: distinctId,
        timestamp,
        properties: {
            ...properties,
            $lib: 'posthog-node',
            $lib_version: '4.3.1',
        },
    };
}

// ─── TRACE BUILDER ───────────────────────────────────────────────────────────

function buildTrace({ distinctId, timestamp, traceId, sessionId, useCase, userMsg, assistantMsg, latency, isError }) {
    return {
        event: '$ai_trace',
        distinct_id: distinctId,
        timestamp,
        properties: {
            $ai_trace_id: traceId,
            $ai_session_id: sessionId,
            $ai_span_name: useCase.spanName,
            $ai_latency: latency,
            $ai_is_error: isError,
            $ai_input_state: [{ role: 'user', content: userMsg }],
            $ai_output_state: isError ? [] : [{ role: 'assistant', content: assistantMsg }],
            $ai_error: isError ? pick(ERROR_MESSAGES) : undefined,
            hogflix_use_case: useCase.name,
            $lib: 'posthog-node',
            $lib_version: '4.3.1',
        },
    };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🎬 HogFlix Synthetic LLM Analytics Generator');
    console.log('━'.repeat(50));
    console.log(`   Target: ${POSTHOG_HOST}`);
    console.log(`   Days: ${DAYS_BACK}`);
    console.log(`   Models: ${MODELS.map(m => m.model).join(', ')}`);
    console.log(`   Users: ${USERS.length}`);
    console.log(`   Use cases: ${USE_CASES.map(u => u.name).join(', ')}`);
    console.log('━'.repeat(50));

    let totalGenerations = 0;
    let totalTraces = 0;
    let totalErrors = 0;

    for (let day = 0; day < DAYS_BACK; day++) {
        const conversationsToday = randInt(CONVERSATIONS_PER_DAY.min, CONVERSATIONS_PER_DAY.max);

        // Weekend boost
        const dayOfWeek = new Date(Date.now() - day * 86400000).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const adjustedConversations = isWeekend
            ? Math.round(conversationsToday * 1.4)
            : conversationsToday;

        console.log(`\n📅 Day -${day} (${isWeekend ? '🎉 weekend' : 'weekday'}): ${adjustedConversations} conversations`);

        for (let c = 0; c < adjustedConversations; c++) {
            const user = pick(USERS);
            const useCase = pick(USE_CASES);
            const modelConfig = pickWeighted(MODELS);
            const traceId = uuid();
            const sessionId = `session-${uuid().substring(0, 8)}`;
            const msgCount = randInt(MESSAGES_PER_CONVERSATION.min, MESSAGES_PER_CONVERSATION.max);

            // Base timestamp for this conversation
            const baseTimestamp = generateTimestamp(day + Math.random());
            const baseTime = new Date(baseTimestamp).getTime();

            let totalLatency = 0;
            let conversationIsError = false;
            let parentSpanId = null;

            for (let m = 0; m < msgCount; m++) {
                const isError = Math.random() < ERROR_RATE;
                if (isError) {
                    conversationIsError = true;
                    totalErrors++;
                }

                const spanId = uuid();
                const userMsg = pick(useCase.userMessages);
                const assistantMsg = isError ? '' : pick(useCase.assistantResponses);

                // Each message comes a bit later in the conversation
                const msgTimestamp = new Date(baseTime + m * randInt(5000, 30000)).toISOString();

                const gen = buildGeneration({
                    distinctId: user,
                    timestamp: msgTimestamp,
                    modelConfig,
                    useCase,
                    userMsg,
                    assistantMsg,
                    traceId,
                    sessionId,
                    spanId,
                    parentId: parentSpanId,
                    isError,
                });

                await queueEvent(gen);
                totalGenerations++;

                totalLatency += gen.properties.$ai_latency;
                parentSpanId = spanId;  // Chain spans

                if (isError) break;  // Stop conversation on error
            }

            // Send trace event for the conversation
            const firstUserMsg = pick(useCase.userMessages);
            const lastAssistantMsg = conversationIsError ? '' : pick(useCase.assistantResponses);

            const trace = buildTrace({
                distinctId: user,
                timestamp: baseTimestamp,
                traceId,
                sessionId,
                useCase,
                userMsg: firstUserMsg,
                assistantMsg: lastAssistantMsg,
                latency: Math.round(totalLatency * 1000) / 1000,
                isError: conversationIsError,
            });

            await queueEvent(trace);
            totalTraces++;
        }
    }

    // Final flush
    while (batchQueue.length > 0) {
        await flushBatch();
    }

    console.log('\n' + '━'.repeat(50));
    console.log('✅ Generation complete!');
    console.log(`   📊 Generations: ${totalGenerations}`);
    console.log(`   🔗 Traces: ${totalTraces}`);
    console.log(`   ❌ Errors: ${totalErrors} (${(totalErrors / totalGenerations * 100).toFixed(1)}%)`);
    console.log(`   📨 Total events sent: ${eventCount}`);
    console.log('\n⏳ Wait ~2 minutes for PostHog to ingest, then check:');
    console.log('   https://eu.posthog.com/project/85924/llm-analytics/dashboard');
}

main().catch(console.error);
