import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { FileText } from "lucide-react";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background-dark flex flex-col">
      <Header />
      
      <main className="flex-1 container-netflix py-12">
        <div className="max-w-4xl mx-auto">
          {/* Demo Warning Banner */}
          <div className="mb-8 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-200 text-sm text-center">
              🎭 <strong>Demo Environment:</strong> This is NOT a real streaming service. This is an educational demonstration of PostHog analytics.
            </p>
          </div>

          <div className="flex items-center justify-center mb-8">
            <FileText className="h-12 w-12 text-primary-red mr-4" />
            <h1 className="text-4xl font-bold text-text-primary">Terms of Service</h1>
          </div>

          <div className="bg-card-background rounded-lg border border-gray-800 p-8 space-y-6 text-text-secondary">
            <p className="text-sm text-text-tertiary">
              <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using HogFlix ("the Demo"), you accept and agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use this Demo.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">2. Nature of This Service</h2>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                <p className="text-red-200 font-semibold">⚠️ CRITICAL DISCLAIMER:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-red-200">
                  <li>HogFlix is a <strong>DEMONSTRATION APPLICATION ONLY</strong></li>
                  <li>This is NOT a real streaming service</li>
                  <li><strong>NO REAL PAYMENTS</strong> are processed (Stripe test mode only)</li>
                  <li>Content is provided for educational and analytics demonstration purposes only</li>
                  <li>Videos featured are PostHog product demos and related content</li>
                </ul>
              </div>
              <p>
                This application exists solely to demonstrate PostHog analytics capabilities including:
                event tracking, feature flags, A/B testing, session recordings, and user analytics.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">3. User Accounts</h2>
              <h3 className="text-xl font-semibold text-text-primary mb-2">Account Registration</h3>
              <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                <li>You may create a demo account to test features</li>
                <li><strong>DO NOT</strong> use real personal information or sensitive data</li>
                <li>Use test emails (e.g., test@example.com) for registration</li>
                <li>Accounts may be deleted periodically for maintenance</li>
              </ul>

              <h3 className="text-xl font-semibold text-text-primary mb-2">Account Security</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You are responsible for maintaining account confidentiality</li>
                <li>Use strong, unique passwords (even for test accounts)</li>
                <li>Do not share your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">4. Acceptable Use Policy</h2>
              <p className="mb-3">You agree NOT to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Attempt to hack, exploit, or compromise the Demo's security</li>
                <li>Use automated tools to spam or abuse the service</li>
                <li>Upload malicious content or attempt code injection</li>
                <li>Impersonate other users or provide false information</li>
                <li>Scrape, data mine, or extract data without permission</li>
                <li>Use the Demo for any commercial purposes</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">5. Intellectual Property</h2>
              
              <h3 className="text-xl font-semibold text-text-primary mb-2">Content Ownership</h3>
              <p className="mb-3">
                All content on HogFlix, including videos, text, graphics, logos, and software, is owned by:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                <li><strong>PostHog Inc.</strong> (product demo videos and branding)</li>
                <li><strong>Respective content creators</strong> (hedgehog mascot designs)</li>
                <li><strong>Open-source contributors</strong> (where applicable)</li>
              </ul>

              <h3 className="text-xl font-semibold text-text-primary mb-2">License to Use</h3>
              <p>
                You are granted a limited, non-exclusive, non-transferable license to access and use this Demo 
                for personal, educational, and non-commercial purposes only.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">6. Payment & Subscriptions (DEMO ONLY)</h2>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <p className="text-yellow-200 font-semibold">💳 PAYMENT DISCLAIMER:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-yellow-200">
                  <li><strong>NO REAL CHARGES</strong> will ever occur</li>
                  <li>Stripe is in <strong>TEST MODE</strong> only</li>
                  <li>Use test card: 4242 4242 4242 4242</li>
                  <li>Any subscription features are for demonstration purposes only</li>
                  <li>You will never be billed for using this Demo</li>
                </ul>
              </div>
              <p>
                The checkout process exists solely to demonstrate payment flow tracking and conversion analytics.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">7. Privacy & Data Collection</h2>
              <p className="mb-3">
                By using this Demo, you acknowledge that:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your interactions are tracked by PostHog analytics</li>
                <li>Session recordings may be captured for demonstration purposes</li>
                <li>Usage data may be shared in educational presentations</li>
                <li>All data collection is outlined in our <Link to="/privacy" className="text-primary-red hover:underline">Privacy Policy</Link></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">8. Disclaimer of Warranties</h2>
              <p className="mb-3">
                THIS DEMO IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. We do not guarantee:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Uninterrupted or error-free operation</li>
                <li>Accuracy or reliability of content or data</li>
                <li>Security against unauthorized access</li>
                <li>Compatibility with all devices or browsers</li>
                <li>Preservation of user data or accounts</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">9. Limitation of Liability</h2>
              <p className="mb-3">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, POSTHOG AND THE DEMO CREATORS SHALL NOT BE LIABLE FOR:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Any direct, indirect, incidental, or consequential damages</li>
                <li>Loss of data, profits, or business opportunities</li>
                <li>Unauthorized access to or alteration of your data</li>
                <li>Statements or conduct of any third party on the Demo</li>
                <li>Any other matter relating to the Demo</li>
              </ul>
              <p className="mt-3">
                <strong>Your sole remedy</strong> for dissatisfaction with the Demo is to stop using it.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">10. Service Modifications & Termination</h2>
              <p className="mb-3">We reserve the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Modify or discontinue the Demo at any time without notice</li>
                <li>Remove or modify content, features, or functionality</li>
                <li>Suspend or terminate user accounts for violations</li>
                <li>Delete test data periodically for maintenance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">11. Third-Party Services</h2>
              <p className="mb-3">This Demo integrates with:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>PostHog:</strong> Analytics and feature flags (governed by PostHog's terms)</li>
                <li><strong>Supabase:</strong> Backend services (governed by Supabase's terms)</li>
                <li><strong>Stripe:</strong> Payment processing demo (test mode, governed by Stripe's terms)</li>
              </ul>
              <p className="mt-3">
                Your use of these services is subject to their respective terms and conditions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">12. Indemnification</h2>
              <p>
                You agree to indemnify and hold harmless PostHog, its affiliates, and the Demo creators from any claims, 
                damages, or expenses arising from your use of the Demo or violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">13. Governing Law</h2>
              <p>
                These Terms shall be governed by the laws of the State of Delaware, United States, 
                without regard to conflict of law principles.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">14. Changes to Terms</h2>
              <p>
                We may update these Terms at any time. Continued use of the Demo after changes constitutes 
                acceptance of the new Terms. The "Last Updated" date at the top indicates when these Terms were last modified.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-text-primary mb-4">15. Contact Information</h2>
              <p className="mb-3">For questions about these Terms:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Visit our <Link to="/support" className="text-primary-red hover:underline">Support page</Link></li>
                <li>PostHog Website: <a href="https://posthog.com" target="_blank" rel="noopener noreferrer" className="text-primary-red hover:underline">https://posthog.com</a></li>
                <li>PostHog Contact: <a href="https://posthog.com/contact" target="_blank" rel="noopener noreferrer" className="text-primary-red hover:underline">https://posthog.com/contact</a></li>
              </ul>
            </section>

            <div className="mt-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-200 text-sm font-semibold mb-2">
                🎭 FINAL REMINDER
              </p>
              <p className="text-red-200 text-sm">
                HogFlix is a demonstration application for educational purposes only. It is not a real streaming service. 
                No actual payments are processed. Use only for testing PostHog analytics features.
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Terms;