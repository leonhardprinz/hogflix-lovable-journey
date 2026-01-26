import React, { useState } from 'react';
import posthog from 'posthog-js';

interface PricingPlan {
    id: string;
    name: string;
    duration: string;
    originalPrice: number;
    price: number;
    weeklyPrice: string;
    savings?: string;
}

const TimeleftPricing: React.FC = () => {
    const [selectedPlan, setSelectedPlan] = useState<string>('3-months');

    const plans: PricingPlan[] = [
        {
            id: '1-month',
            name: '1 Month',
            duration: '1 month',
            originalPrice: 16.99,
            price: 16.99,
            weeklyPrice: '€4.25/week',
        },
        {
            id: '3-months',
            name: '3 Months',
            duration: '3 months',
            originalPrice: 50.97,
            price: 39.99,
            weeklyPrice: '€3.33/week',
            savings: 'Save 22%',
        },
        {
            id: '6-months',
            name: '6 Months',
            duration: '6 months',
            originalPrice: 101.94,
            price: 54.99,
            weeklyPrice: '€2.29/week',
            savings: 'Save 46%',
        },
    ];

    const selectedPlanData = plans.find((p) => p.id === selectedPlan);

    const handlePlanSelect = (planId: string) => {
        setSelectedPlan(planId);
        posthog.capture('subscription_plan_selected', {
            plan_id: planId,
            plan_name: plans.find((p) => p.id === planId)?.name,
        });
    };

    const handleContinue = () => {
        posthog.capture('checkout_started', {
            plan_id: selectedPlan,
            plan_name: selectedPlanData?.name,
            price: selectedPlanData?.price,
        });
    };

    return (
        <div style={styles.container}>
            <button style={styles.closeButton} onClick={() => window.history.back()}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                </svg>
            </button>

            <h1 style={styles.title}>Our plans</h1>

            <div style={styles.emoticonContainer}>
                <div style={{ ...styles.emoticon, ...styles.emoticonPink, top: '0%', left: '25%' }}>😊</div>
                <div style={{ ...styles.emoticon, ...styles.emoticonYellow, top: '10%', right: '20%' }}>😉</div>
                <div style={{ ...styles.emoticon, ...styles.emoticonBlue, top: '30%', left: '15%' }}>😌</div>
                <div style={{ ...styles.emoticon, ...styles.emoticonGreen, bottom: '10%', left: '35%' }}>😊</div>
                <div style={{ ...styles.emoticon, ...styles.emoticonPeach, top: '25%', right: '15%' }}>🙂</div>
                <div style={styles.diamond}>💎</div>
            </div>

            <p style={styles.valueProp}>
                Members are up to 93% more likely to find long lasting connections
            </p>

            <div style={styles.cardsContainer}>
                {plans.map((plan) => (
                    <div
                        key={plan.id}
                        style={{
                            ...styles.card,
                            ...(selectedPlan === plan.id ? styles.cardSelected : {}),
                        }}
                        onClick={() => handlePlanSelect(plan.id)}
                    >
                        <div style={styles.cardLeft}>
                            <div
                                style={{
                                    ...styles.radioButton,
                                    ...(selectedPlan === plan.id ? styles.radioButtonSelected : {}),
                                }}
                            >
                                {selectedPlan === plan.id && <div style={styles.radioButtonInner} />}
                            </div>
                            <div style={styles.planInfo}>
                                <div style={styles.planName}>{plan.name}</div>
                                <div style={styles.priceRow}>
                                    {plan.originalPrice !== plan.price && (
                                        <span style={styles.originalPrice}>€{plan.originalPrice.toFixed(2)}</span>
                                    )}
                                    <span style={styles.currentPrice}>€{plan.price.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        <div style={styles.cardRight}>
                            {plan.savings && <div style={styles.savingsBadge}>{plan.savings}</div>}
                            <div style={styles.weeklyPrice}>{plan.weeklyPrice}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={styles.promoSection}>
                <span style={styles.promoText}>Got a promo code?</span>
                <button style={styles.promoLink}>Enter here</button>
            </div>

            <div style={styles.bottomSection}>
                <p style={styles.summaryText}>
                    €{selectedPlanData?.price.toFixed(2)} every {selectedPlanData?.duration}
                </p>
                <button style={styles.continueButton} onClick={handleContinue}>
                    Continue
                </button>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        backgroundColor: '#f7f3ed',
        minHeight: '100vh',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'relative',
        maxWidth: '400px',
        margin: '0 auto',
    },
    closeButton: {
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
    },
    title: {
        fontSize: '32px',
        fontWeight: '400',
        color: '#111',
        marginBottom: '20px',
        fontFamily: 'Georgia, serif',
    },
    emoticonContainer: {
        position: 'relative',
        height: '140px',
        marginBottom: '20px',
    },
    emoticon: {
        position: 'absolute',
        fontSize: '28px',
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emoticonPink: { backgroundColor: '#ffc0cb' },
    emoticonYellow: { backgroundColor: '#ffe4b5' },
    emoticonBlue: { backgroundColor: '#b0e0e6' },
    emoticonGreen: { backgroundColor: '#98d8c8' },
    emoticonPeach: { backgroundColor: '#ffdab9' },
    diamond: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '48px',
    },
    valueProp: {
        textAlign: 'center',
        color: '#666',
        fontSize: '16px',
        marginBottom: '24px',
        lineHeight: '1.4',
    },
    cardsContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '20px',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: '20px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        border: '1.5px solid transparent',
        transition: 'border-color 0.2s',
    },
    cardSelected: { border: '1.5px solid #111' },
    cardLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
    radioButton: {
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        border: '1.5px solid #111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioButtonSelected: { backgroundColor: '#111' },
    radioButtonInner: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#fff',
    },
    planInfo: { display: 'flex', flexDirection: 'column', gap: '4px' },
    planName: { fontSize: '16px', fontWeight: '600', color: '#111' },
    priceRow: { display: 'flex', gap: '8px', alignItems: 'center' },
    originalPrice: { fontSize: '14px', color: '#999', textDecoration: 'line-through' },
    currentPrice: { fontSize: '14px', color: '#666' },
    cardRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' },
    savingsBadge: {
        backgroundColor: '#aceec1',
        color: '#111',
        borderRadius: '12px',
        padding: '4px 8px',
        fontSize: '12px',
        fontWeight: '500',
    },
    weeklyPrice: { fontSize: '16px', fontWeight: '600', color: '#111' },
    promoSection: { textAlign: 'center', marginBottom: '80px' },
    promoText: { color: '#666', fontSize: '14px' },
    promoLink: {
        background: 'none',
        border: 'none',
        color: '#111',
        fontSize: '14px',
        textDecoration: 'underline',
        cursor: 'pointer',
        display: 'block',
        margin: '4px auto 0',
    },
    bottomSection: {
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        padding: '16px 20px 32px',
        background: 'linear-gradient(to top, #f7f3ed 80%, transparent)',
        textAlign: 'center',
    },
    summaryText: { color: '#111', fontSize: '14px', marginBottom: '12px' },
    continueButton: {
        backgroundColor: '#111',
        color: '#fff',
        border: 'none',
        borderRadius: '65px',
        height: '52px',
        width: '100%',
        maxWidth: '360px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
    },
};

export default TimeleftPricing;
