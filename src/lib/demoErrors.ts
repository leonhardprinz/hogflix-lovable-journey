/**
 * Demo error classes and structured logging for PostHog Error Tracking + Logs demos.
 *
 * Each error class produces a realistic, named stack trace when thrown through
 * its corresponding call-chain function. PostHog Error Tracking groups them as
 * separate issues, and the structured console output is captured by Session Replay.
 */

// ─── Error Classes ──────────────────────────────────────────────────────────

export class ContentDeliveryError extends Error {
    public details: Record<string, any>;
    public cause?: unknown;
    constructor(message: string, details: Record<string, any>, cause?: unknown) {
        super(message);
        this.name = 'ContentDeliveryError';
        this.details = details;
        if (cause) this.cause = cause;
    }
}

export class SearchServiceError extends Error {
    public details: Record<string, any>;
    public cause?: unknown;
    constructor(message: string, details: Record<string, any>, cause?: unknown) {
        super(message);
        this.name = 'SearchServiceError';
        this.details = details;
        if (cause) this.cause = cause;
    }
}

export class APIRateLimitError extends Error {
    public details: Record<string, any>;
    constructor(message: string, details: Record<string, any>) {
        super(message);
        this.name = 'APIRateLimitError';
        this.details = details;
    }
}

// ─── Call-chain generators (each produces a multi-frame stack trace) ─────────

/**
 * CDN / streaming failure chain:
 * loadVideoStream → resolveStreamingManifest → fetchCDNSegment → [throws]
 */
export function throwCDNError(videoId: string, videoTitle: string): never {
    function fetchCDNSegment(segmentUrl: string, region: string): never {
        throw new Error(
            `ECONNREFUSED: CDN node ${region}.cdn.hogflix.io refused connection ` +
            `for segment ${segmentUrl}. Status: 503 Service Unavailable. ` +
            `X-Cache: MISS, X-Edge-Location: ${region}`
        );
    }

    function resolveStreamingManifest(videoId: string, quality: string): never {
        const segmentUrl = `/streams/${videoId}/seg-003-${quality}.ts`;
        try {
            fetchCDNSegment(segmentUrl, 'eu-west-1');
        } catch (cdnErr) {
            throw new ContentDeliveryError(
                `Streaming manifest resolution failed for video ${videoId}: ` +
                `Unable to fetch segment seg-003 at quality ${quality}. ` +
                `CDN returned 503 after 3 retries (regions: eu-west-1, us-east-1, ap-south-1)`,
                {
                    video_id: videoId,
                    video_title: videoTitle,
                    quality,
                    segment: 'seg-003',
                    retries: 3,
                    regions_tried: ['eu-west-1', 'us-east-1', 'ap-south-1'],
                    stage: 'manifest_resolution',
                },
                cdnErr
            );
        }
        throw new Error('unreachable');
    }

    function loadVideoStream(videoId: string, title: string): never {
        slog('CDN', 'info', `Loading stream for "${title}" (${videoId})`);
        slog('CDN', 'info', `Resolving manifest — quality: auto, protocol: HLS`);
        resolveStreamingManifest(videoId, '1080p');
        throw new Error('unreachable');
    }

    loadVideoStream(videoId, videoTitle);
    throw new Error('unreachable');
}

/**
 * Search timeout chain:
 * querySearchIndex → executeElasticQuery → [throws]
 */
export function throwSearchError(query: string): never {
    function executeElasticQuery(index: string, queryBody: object): never {
        throw new Error(
            `ETIMEDOUT: Elasticsearch cluster search-prod.hogflix.internal:9200 ` +
            `did not respond within 5000ms. Index: ${index}, ` +
            `Query size: ${JSON.stringify(queryBody).length} bytes`
        );
    }

    function querySearchIndex(query: string, filters: Record<string, any>): never {
        const queryBody = {
            multi_match: { query, fields: ['title^3', 'description', 'tags'] },
            filters,
        };
        slog('SEARCH', 'info', `Querying index "videos" — query: "${query}"`);
        try {
            executeElasticQuery('videos', queryBody);
        } catch (esErr) {
            throw new SearchServiceError(
                `Search service timeout: Query "${query}" against index "videos" ` +
                `timed out after 5000ms. Elasticsearch cluster may be under load. ` +
                `Cluster: search-prod, nodes: 3/3 responsive at last health check`,
                {
                    query,
                    index: 'videos',
                    timeout_ms: 5000,
                    cluster: 'search-prod',
                    filters,
                    stage: 'query_execution',
                },
                esErr
            );
        }
        throw new Error('unreachable');
    }

    querySearchIndex(query, { status: 'published', visibility: 'public' });
    throw new Error('unreachable');
}

/**
 * API rate limit chain:
 * validateAPIQuota → enforceRateLimit → [throws]
 */
export function throwRateLimitError(endpoint: string, requestCount: number): never {
    function enforceRateLimit(clientId: string, window: string, limit: number, current: number): never {
        throw new APIRateLimitError(
            `HTTP 429 Too Many Requests: Rate limit exceeded for client ${clientId}. ` +
            `${current}/${limit} requests in ${window} window. ` +
            `Retry-After: 30s. Endpoint: ${endpoint}`,
            {
                endpoint,
                client_id: clientId,
                rate_limit: limit,
                current_count: current,
                window,
                retry_after_seconds: 30,
                stage: 'rate_enforcement',
            }
        );
    }

    function validateAPIQuota(endpoint: string, requestCount: number): never {
        const clientId = `cli_${Math.random().toString(36).slice(2, 8)}`;
        slog('API', 'warn', `Quota check — endpoint: ${endpoint}, requests: ${requestCount}/10 in 5s window`);
        enforceRateLimit(clientId, '5s', 10, requestCount);
        throw new Error('unreachable');
    }

    validateAPIQuota(endpoint, requestCount);
    throw new Error('unreachable');
}

// ─── Structured Logging Utility ─────────────────────────────────────────────

type LogLevel = 'info' | 'warn' | 'error';

/**
 * Structured log helper. Outputs tagged messages to the browser console
 * which are captured by PostHog Session Replay's console log recording.
 *
 * Format: `[TAG] message` with optional metadata object.
 *
 * Usage:
 *   slog('API', 'info', 'GET /api/videos — 200 OK (145ms)')
 *   slog('CDN', 'warn', 'Cache MISS — region: eu-west-1', { fallback: 'us-east-1' })
 */
export function slog(tag: string, level: LogLevel, message: string, meta?: Record<string, any>): void {
    const prefix = `[${tag}]`;
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;

    if (meta) {
        fn(prefix, message, meta);
    } else {
        fn(prefix, message);
    }
}

// ─── Landmark Props (always enabled) ────────────────────────────────────────

interface LandmarkContext {
    /** HTTP status code (their `apiErrorCode`) */
    statusCode: number;
    /** Full API URL (their `apiName`) */
    apiUrl: string;
    /** Screen where error occurred (their `failedInScreen`) */
    screen: string;
}

/**
 * Returns extra exception properties aligned to Landmark Group's naming
 * convention.
 *
 * Their custom event `API Error` uses: apiErrorCode, apiErrorMessage, apiName,
 * conceptName, failedInScreen, codeBundleId, userTerritory, capturedInBlock.
 */
export function landmarkProps(
    ctx: LandmarkContext
): Record<string, any> {
    return {
        apiErrorCode: ctx.statusCode,
        apiErrorMessage: `Request failed with status code ${ctx.statusCode}`,
        apiName: ctx.apiUrl,
        conceptName: 'hogflix',
        failedInScreen: ctx.screen,
        codeBundleId: '1024',
        userTerritory: 'eu',
        capturedInBlock: 'try',
    };
}
