import React, { useState } from 'react';
import posthog from 'posthog-js';

const TimeleftPricing: React.FC = () => {
    const [selectedPlan, setSelectedPlan] = useState<string>('3-months');

    const handlePlanSelect = (planId: string) => {
        setSelectedPlan(planId);
        posthog.capture('subscription_plan_selected', { plan_id: planId });
    };

    // Stop propagation so text elements are selectable in visual editor
    const stopProp = (e: React.MouseEvent) => e.stopPropagation();

    return (
        <div style={styles.container}>
            <button style={styles.closeButton} onClick={() => window.history.back()}>✕</button>

            <h1 id="pricing-headline" onClick={stopProp} style={styles.title}>Your future awaits</h1>

            <img
                id="pricing-hero-image"
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=200&fit=crop"
                alt="Happy people"
                style={styles.heroImage}
            />

            <p id="pricing-value-prop" onClick={stopProp} style={styles.valueProp}>
                Members are up to 93% more likely to find long lasting connections
            </p>

            {/* Plan 1 - One-time Explorer */}
            <div style={{ ...styles.card, ...(selectedPlan === '1-month' ? styles.cardSelected : {}) }} onClick={() => handlePlanSelect('1-month')}>
                <input type="radio" checked={selectedPlan === '1-month'} readOnly style={styles.radio} />
                <div style={styles.planContent}>
                    <button id="plan-1-type" onClick={stopProp} style={styles.planTypeBtn}>One-time Explorer</button>
                    <button id="plan-1-name" onClick={stopProp} style={styles.planNameBtn}>1 Month</button>
                    <button id="plan-1-price" onClick={stopProp} style={styles.planPriceBtn}>€16.99</button>
                </div>
                <button id="plan-1-weekly" onClick={stopProp} style={styles.weeklyPriceBtn}>€4.25/week</button>
            </div>

            {/* Plan 2 - Most Popular */}
            <div style={{ ...styles.card, ...(selectedPlan === '3-months' ? styles.cardSelected : {}) }} onClick={() => handlePlanSelect('3-months')}>
                <input type="radio" checked={selectedPlan === '3-months'} readOnly style={styles.radio} />
                <div style={styles.planContent}>
                    <button id="plan-2-type" onClick={stopProp} style={styles.planTypeBtn}>Most Popular</button>
                    <button id="plan-2-name" onClick={stopProp} style={styles.planNameBtn}>3 Months</button>
                    <button id="plan-2-price" onClick={stopProp} style={styles.planPriceBtn}>€39.99</button>
                </div>
                <div style={styles.rightSide}>
                    <button id="plan-2-savings" onClick={stopProp} style={styles.savingsBtn}>Save 22%</button>
                    <button id="plan-2-weekly" onClick={stopProp} style={styles.weeklyPriceBtn}>€3.33/week</button>
                </div>
            </div>

            {/* Plan 3 - Long-term */}
            <div style={{ ...styles.card, ...(selectedPlan === '6-months' ? styles.cardSelected : {}) }} onClick={() => handlePlanSelect('6-months')}>
                <input type="radio" checked={selectedPlan === '6-months'} readOnly style={styles.radio} />
                <div style={styles.planContent}>
                    <button id="plan-3-type" onClick={stopProp} style={styles.planTypeBtn}>Long-term Commitment</button>
                    <button id="plan-3-name" onClick={stopProp} style={styles.planNameBtn}>6 Months</button>
                    <button id="plan-3-price" onClick={stopProp} style={styles.planPriceBtn}>€54.99</button>
                </div>
                <div style={styles.rightSide}>
                    <button id="plan-3-savings" onClick={stopProp} style={styles.savingsBtn}>Save 46%</button>
                    <button id="plan-3-weekly" onClick={stopProp} style={styles.weeklyPriceBtn}>€2.29/week</button>
                </div>
            </div>

            <p id="promo-text" onClick={stopProp} style={styles.promoText}>Got a promo code? <u>Enter here</u></p>

            <div style={styles.footer}>
                <p id="summary-text" style={styles.summaryText}>€39.99 every 3 months</p>
                <button id="cta-button" style={styles.ctaButton}>Continue</button>
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
    },
    title: {
        fontSize: '28px',
        fontWeight: '400',
        textAlign: 'center',
        fontFamily: 'Georgia, serif',
        marginBottom: '16px',
        cursor: 'pointer',
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
        cursor: 'pointer',
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
    },
    planContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '2px',
    },
    // Button styles that look like text but are independently selectable
    planTypeBtn: {
        background: 'none',
        border: 'none',
        padding: 0,
        fontSize: '11px',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        cursor: 'pointer',
        textAlign: 'left',
    },
    planNameBtn: {
        background: 'none',
        border: 'none',
        padding: 0,
        fontSize: '17px',
        fontWeight: '600',
        color: '#111',
        cursor: 'pointer',
        textAlign: 'left',
    },
    planPriceBtn: {
        background: 'none',
        border: 'none',
        padding: 0,
        fontSize: '14px',
        color: '#666',
        cursor: 'pointer',
        textAlign: 'left',
    },
    rightSide: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '4px',
    },
    savingsBtn: {
        backgroundColor: '#aceec1',
        color: '#111',
        borderRadius: '10px',
        padding: '4px 8px',
        fontSize: '11px',
        fontWeight: '600',
        border: 'none',
        cursor: 'pointer',
    },
    weeklyPriceBtn: {
        background: 'none',
        border: 'none',
        padding: 0,
        fontSize: '15px',
        fontWeight: '600',
        color: '#111',
        cursor: 'pointer',
    },
    promoText: {
        textAlign: 'center',
        color: '#666',
        fontSize: '14px',
        marginBottom: '80px',
        cursor: 'pointer',
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
