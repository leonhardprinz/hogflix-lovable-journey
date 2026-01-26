import React, { useState } from 'react';
import posthog from 'posthog-js';

const TimeleftPricing: React.FC = () => {
    const [selectedPlan, setSelectedPlan] = useState<string>('3-months');

    const handlePlanSelect = (planId: string) => {
        setSelectedPlan(planId);
        posthog.capture('subscription_plan_selected', { plan_id: planId });
    };

    const handleContinue = () => {
        posthog.capture('checkout_started', { plan_id: selectedPlan });
    };

    return (
        <div style={styles.container}>
            {/* Close button */}
            <button style={styles.closeButton} onClick={() => window.history.back()}>✕</button>

            {/* Headline */}
            <h1 id="pricing-headline" style={styles.title}>Your future awaits</h1>

            {/* Hero image */}
            <img
                id="pricing-hero-image"
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=200&fit=crop"
                alt="Happy people"
                style={styles.heroImage}
            />

            {/* Value prop */}
            <p id="pricing-value-prop" style={styles.valueProp}>
                Members are up to 93% more likely to find long lasting connections
            </p>

            {/* Plan 1 */}
            <div style={{ ...styles.card, ...(selectedPlan === '1-month' ? styles.cardSelected : {}) }} onClick={() => handlePlanSelect('1-month')}>
                <input type="radio" checked={selectedPlan === '1-month'} readOnly style={styles.radio} />
                <div style={styles.planContent}>
                    <span id="plan-1-type" style={styles.planType}>One-time Explorer</span>
                    <span id="plan-1-name" style={styles.planName}>1 Month</span>
                    <span id="plan-1-price" style={styles.planPrice}>€16.99</span>
                </div>
                <span id="plan-1-weekly" style={styles.weeklyPrice}>€4.25/week</span>
            </div>

            {/* Plan 2 */}
            <div style={{ ...styles.card, ...(selectedPlan === '3-months' ? styles.cardSelected : {}) }} onClick={() => handlePlanSelect('3-months')}>
                <input type="radio" checked={selectedPlan === '3-months'} readOnly style={styles.radio} />
                <div style={styles.planContent}>
                    <span id="plan-2-type" style={styles.planType}>Most Popular</span>
                    <span id="plan-2-name" style={styles.planName}>3 Months</span>
                    <span id="plan-2-price" style={styles.planPrice}><s style={styles.strikethrough}>€50.97</s> €39.99</span>
                </div>
                <div style={styles.rightSide}>
                    <span id="plan-2-savings" style={styles.savingsBadge}>Save 22%</span>
                    <span id="plan-2-weekly" style={styles.weeklyPrice}>€3.33/week</span>
                </div>
            </div>

            {/* Plan 3 */}
            <div style={{ ...styles.card, ...(selectedPlan === '6-months' ? styles.cardSelected : {}) }} onClick={() => handlePlanSelect('6-months')}>
                <input type="radio" checked={selectedPlan === '6-months'} readOnly style={styles.radio} />
                <div style={styles.planContent}>
                    <span id="plan-3-type" style={styles.planType}>Long-term Commitment</span>
                    <span id="plan-3-name" style={styles.planName}>6 Months</span>
                    <span id="plan-3-price" style={styles.planPrice}><s style={styles.strikethrough}>€101.94</s> €54.99</span>
                </div>
                <div style={styles.rightSide}>
                    <span id="plan-3-savings" style={styles.savingsBadge}>Save 46%</span>
                    <span id="plan-3-weekly" style={styles.weeklyPrice}>€2.29/week</span>
                </div>
            </div>

            {/* Promo */}
            <p id="promo-text" style={styles.promoText}>Got a promo code? <u>Enter here</u></p>

            {/* Footer */}
            <div style={styles.footer}>
                <p id="summary-text" style={styles.summaryText}>€39.99 every 3 months</p>
                <button id="cta-button" style={styles.ctaButton} onClick={handleContinue}>Continue</button>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        backgroundColor: '#f7f3ed',
        minHeight: '100vh',
        padding: '20px',
        maxWidth: '400px',
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
    },
    closeButton: {
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'none',
        border: 'none',
        fontSize: '20px',
        cursor: 'pointer',
        color: '#666',
    },
    title: {
        fontSize: '28px',
        fontWeight: '400',
        textAlign: 'center',
        fontFamily: 'Georgia, serif',
        marginBottom: '16px',
    },
    heroImage: {
        width: '100%',
        height: '120px',
        objectFit: 'cover',
        borderRadius: '12px',
        marginBottom: '16px',
    },
    valueProp: {
        textAlign: 'center',
        color: '#666',
        fontSize: '14px',
        marginBottom: '20px',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        border: '2px solid transparent',
    },
    cardSelected: {
        border: '2px solid #111',
    },
    radio: {
        width: '20px',
        height: '20px',
        marginRight: '12px',
        accentColor: '#111',
    },
    planContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    planType: {
        fontSize: '11px',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    planName: {
        fontSize: '17px',
        fontWeight: '600',
        color: '#111',
    },
    planPrice: {
        fontSize: '14px',
        color: '#666',
    },
    strikethrough: {
        color: '#999',
        marginRight: '4px',
    },
    rightSide: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '4px',
    },
    savingsBadge: {
        backgroundColor: '#aceec1',
        color: '#111',
        borderRadius: '10px',
        padding: '4px 8px',
        fontSize: '11px',
        fontWeight: '600',
    },
    weeklyPrice: {
        fontSize: '15px',
        fontWeight: '600',
        color: '#111',
    },
    promoText: {
        textAlign: 'center',
        color: '#666',
        fontSize: '14px',
        marginBottom: '80px',
    },
    footer: {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 20px 32px',
        textAlign: 'center',
        background: 'linear-gradient(to top, #f7f3ed 80%, transparent)',
    },
    summaryText: {
        fontSize: '14px',
        marginBottom: '12px',
    },
    ctaButton: {
        backgroundColor: '#111',
        color: '#fff',
        border: 'none',
        borderRadius: '30px',
        height: '52px',
        width: '100%',
        maxWidth: '360px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
    },
};

export default TimeleftPricing;
