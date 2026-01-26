import React from 'react';

/**
 * Timeleft-style pricing page optimized for PostHog Web Experiments
 * 
 * Key: Every editable element uses data-ph-capture for stable selector targeting
 * Reference: https://posthog.com/docs/toolbar
 */
const TimeleftPricing: React.FC = () => {
    return (
        <main style={styles.page}>

            {/* HEADLINE - editable */}
            <h1
                id="headline"
                data-ph-capture="headline"
                style={styles.headline}
            >
                Your future awaits
            </h1>

            {/* HERO IMAGE - editable */}
            <img
                id="hero-img"
                data-ph-capture="hero-image"
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=200&fit=crop"
                alt="People connecting"
                style={styles.heroImg}
            />

            {/* VALUE PROPOSITION - editable */}
            <p
                id="value-prop"
                data-ph-capture="value-proposition"
                style={styles.valueProp}
            >
                Members are up to 93% more likely to find long lasting connections
            </p>

            {/* PLAN 1 LABEL */}
            <h2
                id="plan1-label"
                data-ph-capture="plan1-label"
                style={styles.planLabel}
            >
                ONE-TIME EXPLORER
            </h2>

            {/* PLAN 1 NAME */}
            <h3
                id="plan1-name"
                data-ph-capture="plan1-name"
                style={styles.planName}
            >
                1 Month
            </h3>

            {/* PLAN 1 PRICE */}
            <p
                id="plan1-price"
                data-ph-capture="plan1-price"
                style={styles.planPrice}
            >
                €16.99 — €4.25/week
            </p>

            <hr style={styles.divider} />

            {/* PLAN 2 LABEL */}
            <h2
                id="plan2-label"
                data-ph-capture="plan2-label"
                style={{ ...styles.planLabel, color: '#4CAF50' }}
            >
                MOST POPULAR ⭐
            </h2>

            {/* PLAN 2 NAME */}
            <h3
                id="plan2-name"
                data-ph-capture="plan2-name"
                style={styles.planName}
            >
                3 Months
            </h3>

            {/* PLAN 2 PRICE */}
            <p
                id="plan2-price"
                data-ph-capture="plan2-price"
                style={styles.planPrice}
            >
                €39.99 — €3.33/week
            </p>

            {/* PLAN 2 SAVINGS BADGE */}
            <span
                id="plan2-savings"
                data-ph-capture="plan2-savings"
                style={styles.savingsBadge}
            >
                Save 22%
            </span>

            <hr style={styles.divider} />

            {/* PLAN 3 LABEL */}
            <h2
                id="plan3-label"
                data-ph-capture="plan3-label"
                style={styles.planLabel}
            >
                LONG-TERM COMMITMENT
            </h2>

            {/* PLAN 3 NAME */}
            <h3
                id="plan3-name"
                data-ph-capture="plan3-name"
                style={styles.planName}
            >
                6 Months
            </h3>

            {/* PLAN 3 PRICE */}
            <p
                id="plan3-price"
                data-ph-capture="plan3-price"
                style={styles.planPrice}
            >
                €54.99 — €2.29/week
            </p>

            {/* PLAN 3 SAVINGS BADGE */}
            <span
                id="plan3-savings"
                data-ph-capture="plan3-savings"
                style={styles.savingsBadge}
            >
                Save 46%
            </span>

            <hr style={styles.divider} />

            {/* PROMO TEXT */}
            <p
                id="promo"
                data-ph-capture="promo-text"
                style={styles.promoText}
            >
                Got a promo code? Enter here
            </p>

            {/* CTA BUTTON */}
            <button
                id="cta"
                data-ph-capture="cta-button"
                style={styles.ctaButton}
            >
                Continue
            </button>

        </main>
    );
};

const styles: Record<string, React.CSSProperties> = {
    page: {
        backgroundColor: '#1a1a2e',
        minHeight: '100vh',
        padding: '32px 24px 120px',
        maxWidth: '400px',
        margin: '0 auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#ffffff',
    },
    headline: {
        fontSize: '28px',
        fontWeight: 300,
        textAlign: 'center',
        marginBottom: '24px',
        cursor: 'pointer',
    },
    heroImg: {
        width: '100%',
        height: '140px',
        objectFit: 'cover',
        borderRadius: '12px',
        marginBottom: '24px',
        display: 'block',
    },
    valueProp: {
        textAlign: 'center',
        color: '#aaaaaa',
        fontSize: '15px',
        lineHeight: 1.5,
        marginBottom: '32px',
        cursor: 'pointer',
    },
    planLabel: {
        fontSize: '12px',
        fontWeight: 500,
        color: '#666666',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '8px',
        cursor: 'pointer',
    },
    planName: {
        fontSize: '24px',
        fontWeight: 600,
        marginBottom: '8px',
        cursor: 'pointer',
    },
    planPrice: {
        fontSize: '16px',
        color: '#aaaaaa',
        marginBottom: '12px',
        cursor: 'pointer',
    },
    savingsBadge: {
        display: 'inline-block',
        backgroundColor: '#4CAF50',
        color: '#000000',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '14px',
        fontWeight: 600,
        marginBottom: '16px',
        cursor: 'pointer',
    },
    divider: {
        border: 'none',
        borderTop: '1px solid #333',
        margin: '24px 0',
    },
    promoText: {
        textAlign: 'center',
        color: '#888888',
        fontSize: '14px',
        marginBottom: '32px',
        cursor: 'pointer',
    },
    ctaButton: {
        position: 'fixed',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#ffffff',
        border: 'none',
        borderRadius: '28px',
        height: '56px',
        width: 'calc(100% - 48px)',
        maxWidth: '352px',
        fontSize: '18px',
        fontWeight: 600,
        cursor: 'pointer',
    },
};

export default TimeleftPricing;
