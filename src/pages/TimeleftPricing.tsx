import React, { useState } from 'react';
import posthog from 'posthog-js';

interface PricingPlan {
    id: string;
    name: string;
    planType: string;
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
            planType: 'One-time Explorer',
            duration: '1 month',
            originalPrice: 16.99,
            price: 16.99,
            weeklyPrice: '€4.25/week',
        },
        {
            id: '3-months',
            name: '3 Months',
            planType: 'Most Popular',
            duration: '3 months',
            originalPrice: 50.97,
            price: 39.99,
            weeklyPrice: '€3.33/week',
            savings: 'Save 22%',
        },
        {
            id: '6-months',
            name: '6 Months',
            planType: 'Long-term Commitment',
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

            {/* Editable headline */}
            <h1 id="pricing-headline" data-ph-capture-attribute-text="headline" style={styles.title}>
                Your future awaits
            </h1>

            {/* Hero image - easily swappable in experiments */}
            <div style={styles.heroImageContainer}>
                <img
                    id="pricing-hero-image"
                    data-ph-capture-attribute-image="hero"
                    src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=200&fit=crop"
                    alt="Happy people connecting"
                    style={styles.heroImage}
                />
            </div>

            {/* Editable value proposition */}
            <p id="pricing-value-prop" data-ph-capture-attribute-text="value-prop" style={styles.valueProp}>
                Members are up to 93% more likely to find long lasting connections
            </p>

            {/* Pricing cards */}
            <div style={styles.cardsContainer}>
                {plans.map((plan) => (
                    <div
                        key={plan.id}
                        id={`plan-card-${plan.id}`}
                        data-ph-capture-attribute-plan={plan.id}
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
                                {/* Plan type label - editable */}
                                <span
                                    id={`plan-type-${plan.id}`}
                                    data-ph-capture-attribute-text={`plan-type-${plan.id}`}
                                    style={styles.planType}
                                >
                                    {plan.planType}
                                </span>
                                {/* Plan name - editable */}
                                <span
                                    id={`plan-name-${plan.id}`}
                                    data-ph-capture-attribute-text={`plan-name-${plan.id}`}
                                    style={styles.planName}
                                >
                                    {plan.name}
                                </span>
                                {/* Price display */}
                                <div style={styles.priceRow}>
                                    {plan.originalPrice !== plan.price && (
                                        <span
                                            id={`plan-original-price-${plan.id}`}
                                            style={styles.originalPrice}
                                        >
                                            €{plan.originalPrice.toFixed(2)}
                                        </span>
                                    )}
                                    <span
                                        id={`plan-price-${plan.id}`}
                                        data-ph-capture-attribute-text={`price-${plan.id}`}
                                        style={styles.currentPrice}
                                    >
                                        €{plan.price.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div style={styles.cardRight}>
                            {plan.savings && (
                                <span
                                    id={`plan-savings-${plan.id}`}
                                    data-ph-capture-attribute-text={`savings-${plan.id}`}
                                    style={styles.savingsBadge}
                                >
                                    {plan.savings}
                                </span>
                            )}
                            <span
                                id={`plan-weekly-${plan.id}`}
                                data-ph-capture-attribute-text={`weekly-${plan.id}`}
                                style={styles.weeklyPrice}
                            >
                                {plan.weeklyPrice}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Promo section */}
            <div style={styles.promoSection}>
                <span id="promo-text" style={styles.promoText}>Got a promo code?</span>
                <button id="promo-link" style={styles.promoLink}>Enter here</button>
            </div>

            {/* Bottom CTA section */}
            <div style={styles.bottomSection}>
                <p id="pricing-summary" style={styles.summaryText}>
                    €{selectedPlanData?.price.toFixed(2)} every {selectedPlanData?.duration}
                </p>
                <button
                    id="cta-button"
                    data-ph-capture-attribute-text="cta-button"
                    style={styles.continueButton}
                    onClick={handleContinue}
                >
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
        fontSize: '28px',
        fontWeight: '400',
        color: '#111',
        marginBottom: '16px',
        fontFamily: 'Georgia, serif',
        textAlign: 'center',
    },
    heroImageContainer: {
        width: '100%',
        height: '140px',
        marginBottom: '16px',
        borderRadius: '16px',
        overflow: 'hidden',
    },
    heroImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    valueProp: {
        textAlign: 'center',
        color: '#666',
        fontSize: '15px',
        marginBottom: '20px',
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
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        border: '2px solid transparent',
        transition: 'border-color 0.2s',
    },
    cardSelected: {
        border: '2px solid #111',
    },
    cardLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    radioButton: {
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        border: '2px solid #111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    radioButtonSelected: {
        backgroundColor: '#111',
    },
    radioButtonInner: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#fff',
    },
    planInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    planType: {
        fontSize: '11px',
        fontWeight: '500',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    planName: {
        fontSize: '17px',
        fontWeight: '600',
        color: '#111',
    },
    priceRow: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
    },
    originalPrice: {
        fontSize: '14px',
        color: '#999',
        textDecoration: 'line-through',
    },
    currentPrice: {
        fontSize: '14px',
        color: '#666',
    },
    cardRight: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '4px',
    },
    savingsBadge: {
        backgroundColor: '#aceec1',
        color: '#111',
        borderRadius: '12px',
        padding: '4px 10px',
        fontSize: '12px',
        fontWeight: '600',
    },
    weeklyPrice: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#111',
    },
    promoSection: {
        textAlign: 'center',
        marginBottom: '100px',
    },
    promoText: {
        color: '#666',
        fontSize: '14px',
    },
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
    summaryText: {
        color: '#111',
        fontSize: '14px',
        marginBottom: '12px',
    },
    continueButton: {
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
