import React, { useState } from 'react';
import posthog from 'posthog-js';

const TimeleftPricing: React.FC = () => {
    const [selectedPlan, setSelectedPlan] = useState<string>('3-months');

    return (
        <div style={{ backgroundColor: '#f7f3ed', minHeight: '100vh', padding: '20px', maxWidth: '400px', margin: '0 auto', fontFamily: 'system-ui' }}>

            <h1 id="pricing-headline" style={{ fontSize: '28px', textAlign: 'center', fontFamily: 'Georgia', marginBottom: '16px' }}>
                Your future awaits
            </h1>

            <img
                id="pricing-hero-image"
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=200&fit=crop"
                style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '12px', marginBottom: '16px' }}
            />

            <p id="pricing-value-prop" style={{ textAlign: 'center', color: '#666', marginBottom: '24px' }}>
                Members are up to 93% more likely to find long lasting connections
            </p>

            {/* PLAN 1 - flat structure, no wrapper div */}
            <p id="plan-1-type" style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px', marginLeft: '40px' }}>
                One-time Explorer
            </p>
            <p id="plan-1-name" style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px', marginLeft: '40px' }}>
                1 Month
            </p>
            <p id="plan-1-price" style={{ fontSize: '14px', color: '#666', marginBottom: '20px', marginLeft: '40px' }}>
                €16.99 — €4.25/week
            </p>

            {/* PLAN 2 - flat structure */}
            <p id="plan-2-type" style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px', marginLeft: '40px' }}>
                Most Popular
            </p>
            <p id="plan-2-name" style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px', marginLeft: '40px' }}>
                3 Months
            </p>
            <p id="plan-2-price" style={{ fontSize: '14px', color: '#666', marginBottom: '4px', marginLeft: '40px' }}>
                €39.99 — €3.33/week
            </p>
            <p id="plan-2-savings" style={{ display: 'inline-block', backgroundColor: '#aceec1', padding: '4px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600', marginBottom: '20px', marginLeft: '40px' }}>
                Save 22%
            </p>

            {/* PLAN 3 - flat structure */}
            <p id="plan-3-type" style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px', marginLeft: '40px' }}>
                Long-term Commitment
            </p>
            <p id="plan-3-name" style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px', marginLeft: '40px' }}>
                6 Months
            </p>
            <p id="plan-3-price" style={{ fontSize: '14px', color: '#666', marginBottom: '4px', marginLeft: '40px' }}>
                €54.99 — €2.29/week
            </p>
            <p id="plan-3-savings" style={{ display: 'inline-block', backgroundColor: '#aceec1', padding: '4px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600', marginBottom: '40px', marginLeft: '40px' }}>
                Save 46%
            </p>

            <p id="promo-text" style={{ textAlign: 'center', color: '#666', marginBottom: '100px' }}>
                Got a promo code? <u>Enter here</u>
            </p>

            <button id="cta-button" style={{
                position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
                backgroundColor: '#111', color: '#fff', border: 'none', borderRadius: '30px',
                height: '52px', width: '90%', maxWidth: '360px', fontSize: '16px', fontWeight: '600'
            }}>
                Continue
            </button>
        </div>
    );
};

export default TimeleftPricing;
