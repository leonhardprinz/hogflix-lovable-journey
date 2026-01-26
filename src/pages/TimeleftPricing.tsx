import React from 'react';

const TimeleftPricing: React.FC = () => {
    return (
        <div style={{ backgroundColor: '#1a1a2e', minHeight: '100vh', padding: '24px', maxWidth: '420px', margin: '0 auto', fontFamily: 'system-ui', color: '#fff' }}>

            <h1 id="headline" data-attr="headline" style={{ fontSize: '32px', textAlign: 'center', fontWeight: '300', marginBottom: '20px' }}>
                Your future awaits
            </h1>

            <img
                id="hero-image"
                data-attr="hero-image"
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=200&fit=crop"
                alt="People"
                style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '16px', marginBottom: '20px' }}
            />

            <p id="value-prop" data-attr="value-prop" style={{ textAlign: 'center', color: '#aaa', fontSize: '15px', marginBottom: '32px', lineHeight: '1.5' }}>
                Members are up to 93% more likely to find long lasting connections
            </p>

            {/* Plan cards as simple sections */}
            <div style={{ backgroundColor: '#252542', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                <p id="plan1-label" data-attr="plan1-label" style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                    ONE-TIME EXPLORER
                </p>
                <p id="plan1-name" data-attr="plan1-name" style={{ fontSize: '22px', fontWeight: '600', marginBottom: '8px' }}>
                    1 Month
                </p>
                <p id="plan1-price" data-attr="plan1-price" style={{ fontSize: '18px', color: '#ccc' }}>
                    €16.99 — €4.25/week
                </p>
            </div>

            <div style={{ backgroundColor: '#252542', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '2px solid #4CAF50' }}>
                <p id="plan2-label" data-attr="plan2-label" style={{ fontSize: '12px', color: '#4CAF50', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                    MOST POPULAR
                </p>
                <p id="plan2-name" data-attr="plan2-name" style={{ fontSize: '22px', fontWeight: '600', marginBottom: '8px' }}>
                    3 Months
                </p>
                <p id="plan2-price" data-attr="plan2-price" style={{ fontSize: '18px', color: '#ccc', marginBottom: '12px' }}>
                    €39.99 — €3.33/week
                </p>
                <span id="plan2-savings" data-attr="plan2-savings" style={{ backgroundColor: '#4CAF50', color: '#000', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                    Save 22%
                </span>
            </div>

            <div style={{ backgroundColor: '#252542', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                <p id="plan3-label" data-attr="plan3-label" style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                    LONG-TERM COMMITMENT
                </p>
                <p id="plan3-name" data-attr="plan3-name" style={{ fontSize: '22px', fontWeight: '600', marginBottom: '8px' }}>
                    6 Months
                </p>
                <p id="plan3-price" data-attr="plan3-price" style={{ fontSize: '18px', color: '#ccc', marginBottom: '12px' }}>
                    €54.99 — €2.29/week
                </p>
                <span id="plan3-savings" data-attr="plan3-savings" style={{ backgroundColor: '#4CAF50', color: '#000', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                    Save 46%
                </span>
            </div>

            <p id="promo" data-attr="promo" style={{ textAlign: 'center', color: '#888', marginBottom: '100px' }}>
                Got a promo code? <u style={{ color: '#fff' }}>Enter here</u>
            </p>

            <button id="cta" data-attr="cta" style={{
                position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff', border: 'none', borderRadius: '30px',
                height: '56px', width: '90%', maxWidth: '380px', fontSize: '18px', fontWeight: '600',
                cursor: 'pointer', boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)'
            }}>
                Continue
            </button>
        </div>
    );
};

export default TimeleftPricing;
