import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Shield } from "lucide-react";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background-dark flex flex-col">
      <Header />
      
      <main className="flex-1 container-netflix py-12">
        <div className="max-w-4xl mx-auto">
          {/* Demo Warning Banner */}
          <div className="mb-8 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-200 text-sm text-center">
              🎭 <strong>Demo Environment:</strong> This is an educational demonstration application showcasing PostHog analytics. No real user data or services are provided.
            </p>
          </div>

          <div className="flex items-center justify-center mb-8">
            <Shield className="h-12 w-12 text-primary-red mr-4" />
            <h1 className="text-4xl font-bold text-text-primary">Privacy Policy</h1>
          </div>

          <div className="bg-card-background rounded-lg border border-gray-800 p-8 space-y-6 text-text-secondary">
            <p className="text-sm text-text-tertiary">
              <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">1. About This Demo</h2>
              <p className="mb-3">
                HogFlix is a <strong>demonstration application</strong> created solely to showcase PostHog analytics capabilities. 
                This is NOT a real streaming service. This application is used for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Educational purposes and analytics demonstrations</li>
                <li>Showcasing PostHog feature flags, experiments, and tracking</li>
                <li>Testing and development of analytics implementations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">2. Data We Collect</h2>
              <p className="mb-3">When you use this demo application, we may collect:</p>
              
              <h3 className="text-xl font-semibold text-text-primary mb-2">Account Information</h3>
              <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                <li>Email address (for authentication)</li>
                <li>Display name (optional)</li>
                <li>Profile preferences (kids profile, early access features)</li>
              </ul>

              <h3 className="text-xl font-semibold text-text-primary mb-2">Usage Data (via PostHog Analytics)</h3>
              <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                <li>Pages viewed and actions taken</li>
                <li>Video watch progress and completion rates</li>
                <li>Feature flag enrollments and experiment variants</li>
                <li>Device information and browser type</li>
                <li>IP address (anonymized)</li>
                <li>Session recordings (if enabled in experiments)</li>
              </ul>

              <h3 className="text-xl font-semibold text-text-primary mb-2">Application Data</h3>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Video ratings and watchlist items</li>
                <li>Watch progress and history</li>
                <li>Support tickets submitted</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">3. How We Use Your Data</h2>
              <p className="mb-3">Your data is used exclusively for:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Authentication:</strong> Providing secure access to demo features</li>
                <li><strong>Analytics Demonstration:</strong> Showcasing PostHog tracking capabilities</li>
                <li><strong>Feature Testing:</strong> A/B testing and feature flag demonstrations</li>
                <li><strong>Educational Purposes:</strong> Teaching analytics implementation best practices</li>
                <li><strong>Newsletter (Optional):</strong> Sending product updates if you opt-in</li>
              </ul>
              <p className="mt-3 text-yellow-200">
                ⚠️ <strong>Important:</strong> Do NOT enter real personal information or sensitive data. Use test emails and fictitious information only.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">4. Third-Party Services</h2>
              <p className="mb-3">This demo application uses the following third-party services:</p>
              
              <div className="space-y-4 ml-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">PostHog (Analytics)</h3>
                  <p>Tracks user interactions, feature usage, and experiments.</p>
                  <p className="text-sm text-text-tertiary">Privacy Policy: <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-red hover:underline">https://posthog.com/privacy</a></p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Supabase (Backend & Database)</h3>
                  <p>Provides authentication, database, and storage services.</p>
                  <p className="text-sm text-text-tertiary">Privacy Policy: <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-red hover:underline">https://supabase.com/privacy</a></p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Stripe (Demo Checkout)</h3>
                  <p><strong>Test Mode Only:</strong> No real payments are processed. Demonstration purposes only.</p>
                  <p className="text-sm text-text-tertiary">Privacy Policy: <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-red hover:underline">https://stripe.com/privacy</a></p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">5. Data Storage & Security</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Data is stored on Supabase servers (hosted on AWS)</li>
                <li>All connections use SSL/TLS encryption</li>
                <li>Database access is protected by Row-Level Security (RLS) policies</li>
                <li>Passwords are hashed and never stored in plaintext</li>
                <li>Demo data may be periodically cleared for maintenance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">6. Your Rights (GDPR/CCPA)</h2>
              <p className="mb-3">You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Access:</strong> Request a copy of your data</li>
                <li><strong>Deletion:</strong> Request deletion of your account and data</li>
                <li><strong>Correction:</strong> Update or correct your information</li>
                <li><strong>Opt-Out:</strong> Unsubscribe from marketing emails at any time</li>
                <li><strong>Data Portability:</strong> Receive your data in a structured format</li>
              </ul>
              <p className="mt-3">
                To exercise these rights, contact us via the <Link to="/support" className="text-primary-red hover:underline">Support page</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">7. Cookies</h2>
              <p className="mb-3">This demo uses the following cookies:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Authentication Cookies:</strong> Supabase session tokens (essential)</li>
                <li><strong>Analytics Cookies:</strong> PostHog tracking (can be opted out via browser settings)</li>
                <li><strong>Preference Cookies:</strong> UI state (sidebar visibility, etc.)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">8. Children's Privacy</h2>
              <p>
                This demo is not directed at children under 13. We do not knowingly collect data from children. 
                If you believe a child has provided data to this demo, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Changes will be posted on this page with 
                an updated "Last Updated" date. Continued use of the demo constitutes acceptance of any changes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">10. Contact Us</h2>
              <p className="mb-3">For privacy-related questions or requests:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Visit our <Link to="/support" className="text-primary-red hover:underline">Support page</Link></li>
                <li>PostHog Company: <a href="https://posthog.com/contact" target="_blank" rel="noopener noreferrer" className="text-primary-red hover:underline">https://posthog.com/contact</a></li>
              </ul>
            </section>

            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-200 text-sm">
                <strong>Reminder:</strong> This is a demonstration environment. Do not enter real personal information, 
                payment details, or sensitive data. Use only for testing and educational purposes.
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Privacy;