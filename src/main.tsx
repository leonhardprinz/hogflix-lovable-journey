import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

// Initialize PostHog BEFORE creating the provider
// This creates window.posthog which the Playwright script needs
if (typeof window !== 'undefined') {
  posthog.init(
    import.meta.env.VITE_POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh',
    {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
      ui_host: 'https://eu.posthog.com',

      // ─────────────────────────────────────────────────────────────────────
      // ⚡ COST + VOLUME CONTROL — the "configure-it" patterns to walk through
      //    on an anonymous-marketing-site call. Each one trades event
      //    fidelity for ingestion cost. Pick the ones that fit your traffic shape.
      // ─────────────────────────────────────────────────────────────────────

      // ─────────────────────────────────────────────────────────────
      // 1. person_profiles — controls when PostHog creates a Person row.
      //
      //   Modes:
      //     'always'           default. Every distinct_id (incl. anon
      //                        cookies) gets a Person row. Person-property
      //                        writes work for everyone. Most expensive.
      //     'identified_only'  no Person row until posthog.identify() runs.
      //                        Anonymous traffic still emits $pageview /
      //                        $autocapture / etc. — those events are
      //                        captured and counted. They just don't have
      //                        a Person, so $set / $set_once are no-ops
      //                        and you can't filter insights by person
      //                        properties for anonymous visitors.
      //     'never'            no Person rows, ever.
      //
      //   What this means for THIS marketing site:
      //     - 90%+ of /, /pricing, /get-started traffic is anonymous and
      //       never signs up. No reason to pay for a Person row each.
      //     - Web Analytics still works: visitor / session counts use
      //       distinct_id, not person_id.
      //     - The experiment still works: flag evaluation buckets by
      //       distinct_id. No Person needed.
      //     - When a user signs up, posthog.identify(email) creates the
      //       Person and back-fills it with the anonymous events via
      //       $anon_distinct_id merge — so funnels and experiments stay
      //       intact across the anon→identified boundary.
      //
      //   This is exactly the lever for a bank's marketing site:
      //   it is anonymous-heavy; flipping this to
      //   'identified_only' keeps storage cost proportional to actual
      //   customers, not curious visitors.
      // ─────────────────────────────────────────────────────────────
      person_profiles: 'identified_only',

      // Wide-open autocapture for this demo. In a cost-conscious deployment
      // you'd pass an object here instead — see DEMO BLOCK below for the
      // patterns to walk through with customers.
      autocapture: true,

      // ───────────────────────────────────────────────────────────────
      // 📚 DEMO TALKING POINTS — autocapture volume control patterns.
      //    These are illustrative; uncomment to actually enforce them.
      //
      //    autocapture: {
      //      // (a) Only capture click / submit / change. Drops hover/focus/scroll noise.
      //      dom_event_allowlist: ['click', 'submit', 'change'],
      //
      //      // (b) Only treat these element tags as click targets — no <div> click spam.
      //      element_allowlist: ['a', 'button', 'input', 'select', 'textarea', 'label'],
      //
      //      // (c) The single most effective lever on a marketing site —
      //      //     allow autocapture only on elements matching these selectors.
      //      //     Tag your primary CTAs and nothing else gets through.
      //      css_selector_allowlist: [
      //        '[data-attr]',
      //        'button.cta-primary',
      //        'a.nav-link',
      //        'form button[type="submit"]',
      //      ],
      //
      //      // (d) Only autocapture on specific URLs — typically the
      //      //     marketing surface, while the in-app routes use explicit
      //      //     `posthog.capture(...)` calls only.
      //      url_allowlist: [
      //        'https://hogflix-project.vercel.app/',
      //        'https://hogflix-project.vercel.app/pricing',
      //        'https://hogflix-project.vercel.app/get-started',
      //      ],
      //    }
      //
      // (e) `ph-no-capture` CSS class is honored automatically — no SDK
      //     change needed. Designers/content editors can toggle from markup:
      //
      //       <div class="ph-no-capture"><button>Sensitive CTA</button></div>
      //
      // (f) Feature-flag-gated autocapture — disable remotely without a deploy:
      //
      //       posthog.onFeatureFlags((flags) => {
      //         if (flags.includes('autocapture_off')) {
      //           posthog.config.autocapture = false
      //         }
      //       })
      //
      // (g) Nuclear option — "Filter Out" CDP Transformation in the PostHog
      //     UI (Settings → Data pipelines → Transformations). Drops events at
      //     ingestion based on event properties. Useful when you can't kill
      //     traffic at the SDK (shipped mobile clients, third-party iframes).
      //
      // ───────────────────────────────────────────────────────────────

      capture_pageview: true,
      capture_pageleave: true,
      capture_performance: {
        web_vitals: true,
        web_vitals_allowed_metrics: ['LCP', 'INP', 'CLS', 'FCP'],
      },
      capture_exceptions: true,
      disable_web_experiments: false,

      debug: import.meta.env.DEV, // Enable debug logging in dev
      
      // Enable session recording (session replay)
      session_recording: {
        recordCrossOriginIframes: false,
        maskAllInputs: import.meta.env.VITE_REDACT_LLM_CONTENT === 'true',
        maskTextSelector: '.sensitive',
      } as any,
      
      // Log request errors (helps debug /flags failures)
      on_request_error: (error: any) => {
        console.error('🚨 PostHog request error:', error);
      },
      
      loaded: (posthog) => {
        console.log('==========================================')
        console.log('📊 PostHog Initialization Debug Info:')
        console.log('✅ PostHog loaded successfully')
        console.log('🔑 API Key:', import.meta.env.VITE_POSTHOG_KEY?.substring(0, 15) + '...')
        console.log('🌐 API Host:', import.meta.env.VITE_POSTHOG_HOST)
        console.log('🆔 Session ID:', posthog.get_session_id())
        console.log('📹 sessionRecording object exists:', !!posthog.sessionRecording)
        console.log('📹 sessionRecording status:', posthog.sessionRecording?.status)
        console.log('🪟 window.posthog exists:', !!(window as any).posthog)
        
        // Log autocapture status
        const ac = (posthog as any).autocapture;
        console.log('🖱️ Autocapture object exists:', !!ac);
        console.log('🖱️ Autocapture._initialized:', ac?._initialized);
        console.log('🖱️ Autocapture.isEnabled:', typeof ac?.isEnabled === 'function' ? ac.isEnabled() : 'N/A');
        console.log('🚩 featureFlags.hasLoadedFlags:', (posthog as any).featureFlags?.hasLoadedFlags);
        console.log('==========================================')
        
        // Register session-level super properties
        posthog.register({
          app_version: '1.0.0',
          environment: import.meta.env.MODE,
          platform: 'web',
          device_type: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
        });

        // Set browser language as person property for survey targeting
        // This enables language-based survey targeting (e.g., show Japanese surveys to Japanese users)
        const browserLanguage = navigator.language || navigator.languages?.[0] || 'en';
        const languageCode = browserLanguage.split('-')[0]; // e.g., "ja" from "ja-JP"

        // Set as person property (survives across sessions)
        posthog.setPersonProperties({
          locale: browserLanguage,        // e.g., "ja-JP", "en-US"
          language: languageCode,         // e.g., "ja", "en"
          browser_languages: navigator.languages // Full list of user's preferred languages
        });

        console.log('🌍 Language properties set:', {
          locale: browserLanguage,
          language: languageCode,
          browser_languages: navigator.languages
        });
        
        // FORCE start session recording
        if (posthog.sessionRecording) {
          posthog.startSessionRecording()
          console.log('✅ Session recording FORCE STARTED')
          console.log('📹 Recording status after start:', posthog.sessionRecording.status)
        } else {
          console.error('❌ Session recording object is NULL')
        }
        
        // Fallback: Force-start autocapture if /flags didn't enable it after 3s
        setTimeout(() => {
          const autocapture = (posthog as any).autocapture;
          if (autocapture && !autocapture._initialized) {
            console.warn('⚠️ Autocapture not initialized after 3s - forcing start');
            // Override the server-side disable flag
            if (typeof autocapture._isDisabledServerSide !== 'undefined') {
              autocapture._isDisabledServerSide = false;
            }
            // Start autocapture manually
            if (typeof autocapture.startIfEnabled === 'function') {
              autocapture.startIfEnabled();
              console.log('✅ Autocapture FORCE STARTED');
              posthog.capture('autocapture_forced_start', { reason: 'flags_timeout' });
            }
          } else if (autocapture?._initialized) {
            console.log('✅ Autocapture already initialized normally');
          }
        }, 3000);
      },
      
      // Drop ONLY synthetic demo VIDEO events (not all synthetic traffic)
      // AND enrich every $exception with business context so error tracking
      // can be used as a proactive support signal (Razorpay-style use case).
      before_send: (event) => {
        const props = event?.properties || {};

        const isSynthetic =
          props?.synthetic === true ||
          props?.is_synthetic === true;

        const isDemoVideo =
          props?.video_id === '6f4d68aa-3d28-43eb-a16d-31848741832b' ||
          props?.category === 'PostHog Demo';

        if (isSynthetic && isDemoVideo) {
          if (import.meta.env.DEV) {
            console.log('🚫 Blocked synthetic demo video event:', event.event);
          }
          return null;
        }

        if (event?.event === '$exception') {
          const enriched = {
            ...event.properties,
            app_surface: window.location.pathname,
            current_plan: (() => {
              try { return localStorage.getItem('hogflix_current_plan') || 'unknown'; }
              catch { return 'unknown'; }
            })(),
            signup_step: (() => {
              try { return localStorage.getItem('hogflix_signup_step') || 'n/a'; }
              catch { return 'n/a'; }
            })(),
            is_authenticated: (() => {
              try { return !!localStorage.getItem('sb-auth-token'); }
              catch { return false; }
            })(),
          };
          event.properties = enriched;
        }

        return event;
      },
    }
  );
  
  // Explicitly expose posthog on window for toolbar
  (window as any).posthog = posthog;

  // React Router can strip the #__posthog hash before posthog-js reads it
  try {
    const hash = window.location.hash.substring(1);
    const toolbarJSON = new URLSearchParams(hash).get('__posthog');
    if (toolbarJSON) {
      posthog.loadToolbar(JSON.parse(toolbarJSON));
    }
  } catch (e) {
    console.warn('PostHog toolbar hash parsing failed:', e);
  }

  // Allow toolbar loading via ?toolbar for demos
  try {
    if (new URLSearchParams(window.location.search).has('toolbar')) {
      posthog.loadToolbar({ token: import.meta.env.VITE_POSTHOG_KEY || 'phc_lyblwxejUR7pNow3wE9WgaBMrNs2zgqq4rumaFwInPh' });
    }
  } catch (e) {
    console.warn('PostHog toolbar fallback failed:', e);
  }
}

// Pass the initialized posthog instance via client prop
createRoot(document.getElementById("root")!).render(
  <PostHogProvider client={posthog}>
    <App />
  </PostHogProvider>
);
