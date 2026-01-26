import { Link } from 'react-router-dom';

const DevLinks = () => {
    const routes = [
        { path: '/', name: 'Home', public: true },
        { path: '/pricing', name: 'Pricing', public: true },
        { path: '/timeleft-pricing', name: 'Timeleft Pricing (Demo)', public: true },
        { path: '/signup', name: 'Sign Up', public: true },
        { path: '/login', name: 'Login', public: true },
        { path: '/profiles', name: 'Profiles', protected: true },
        { path: '/browse', name: 'Browse', protected: true },
        { path: '/my-list', name: 'My List', protected: true },
        { path: '/checkout', name: 'Checkout', protected: true },
        { path: '/checkout/success', name: 'Checkout Success', protected: true },
        { path: '/support', name: 'Support', public: true },
        { path: '/submit-content', name: 'Submit Content', protected: true },
        { path: '/admin', name: 'Admin Panel', protected: true },
        { path: '/flixbuddy', name: 'FlixBuddy AI', protected: true },
        { path: '/newsletter-preferences', name: 'Newsletter Preferences', protected: true },
        { path: '/beta-features', name: 'Beta Features', protected: true },
        { path: '/privacy', name: 'Privacy Policy', public: true },
        { path: '/terms', name: 'Terms of Service', public: true },
        { path: '/faq', name: 'FAQ', public: true },
        { path: '/help', name: 'Help', public: true },
    ];

    return (
        <div style={{
            backgroundColor: '#141414',
            minHeight: '100vh',
            padding: '40px',
            color: '#fff',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
        }}>
            <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>🔧 Dev Links</h1>
            <p style={{ color: '#888', marginBottom: '32px' }}>
                Internal navigation for demo pages. Use these links to avoid Vercel 404 errors.
            </p>

            <div style={{ display: 'grid', gap: '24px', maxWidth: '600px' }}>
                <section>
                    <h2 style={{ fontSize: '18px', color: '#e50914', marginBottom: '12px' }}>
                        Public Pages
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {routes.filter(r => r.public).map(route => (
                            <Link
                                key={route.path}
                                to={route.path}
                                style={{
                                    color: '#fff',
                                    textDecoration: 'none',
                                    padding: '12px 16px',
                                    backgroundColor: '#222',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <span>{route.name}</span>
                                <code style={{ color: '#888', fontSize: '12px' }}>{route.path}</code>
                            </Link>
                        ))}
                    </div>
                </section>

                <section>
                    <h2 style={{ fontSize: '18px', color: '#e50914', marginBottom: '12px' }}>
                        Protected Pages (requires login)
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {routes.filter(r => r.protected).map(route => (
                            <Link
                                key={route.path}
                                to={route.path}
                                style={{
                                    color: '#fff',
                                    textDecoration: 'none',
                                    padding: '12px 16px',
                                    backgroundColor: '#222',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <span>{route.name}</span>
                                <code style={{ color: '#888', fontSize: '12px' }}>{route.path}</code>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default DevLinks;
