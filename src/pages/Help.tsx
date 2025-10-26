import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { LifeBuoy, Book, MessageCircle, Mail, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";

const Help = () => {
  return (
    <div className="min-h-screen bg-background-dark flex flex-col">
      <Header />
      
      <main className="flex-1 container-netflix py-12">
        <div className="max-w-5xl mx-auto">
          {/* Demo Warning Banner */}
          <div className="mb-8 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-200 text-sm text-center">
              🎭 <strong>Demo Environment:</strong> This is a demonstration application for educational purposes. Not a real streaming service.
            </p>
          </div>

          <div className="flex items-center justify-center mb-8">
            <LifeBuoy className="h-12 w-12 text-primary-red mr-4" />
            <h1 className="text-4xl font-bold text-text-primary">Help Center</h1>
          </div>

          <p className="text-center text-text-secondary mb-12 text-lg">
            Welcome to the HogFlix Help Center. Find answers to common questions and learn how to use our demo analytics platform.
          </p>

          {/* Quick Links Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <Link to="/faq">
              <Card className="bg-card-background border-gray-800 p-6 hover:border-primary-red transition-colors cursor-pointer h-full">
                <Book className="h-10 w-10 text-primary-red mb-4" />
                <h3 className="text-xl font-semibold text-text-primary mb-2">FAQ</h3>
                <p className="text-text-secondary text-sm">
                  Browse frequently asked questions about HogFlix and how it demonstrates PostHog analytics.
                </p>
              </Card>
            </Link>

            <Link to="/support">
              <Card className="bg-card-background border-gray-800 p-6 hover:border-primary-red transition-colors cursor-pointer h-full">
                <MessageCircle className="h-10 w-10 text-primary-red mb-4" />
                <h3 className="text-xl font-semibold text-text-primary mb-2">Contact Support</h3>
                <p className="text-text-secondary text-sm">
                  Submit a support ticket and our team will help you with any issues or questions.
                </p>
              </Card>
            </Link>

            <a href="https://posthog.com/docs" target="_blank" rel="noopener noreferrer">
              <Card className="bg-card-background border-gray-800 p-6 hover:border-primary-red transition-colors cursor-pointer h-full">
                <ExternalLink className="h-10 w-10 text-primary-red mb-4" />
                <h3 className="text-xl font-semibold text-text-primary mb-2">PostHog Docs</h3>
                <p className="text-text-secondary text-sm">
                  Learn how to implement analytics, feature flags, and experiments in your own apps.
                </p>
              </Card>
            </a>
          </div>

          {/* Common Topics */}
          <div className="bg-card-background rounded-lg border border-gray-800 p-8 mb-8">
            <h2 className="text-2xl font-bold text-text-primary mb-6">Common Topics</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-text-primary mb-3">Getting Started</h3>
                <ul className="space-y-2 text-text-secondary ml-6">
                  <li className="list-disc">
                    <Link to="/faq" className="hover:text-primary-red">What is HogFlix?</Link>
                  </li>
                  <li className="list-disc">
                    <Link to="/faq" className="hover:text-primary-red">How do I create an account?</Link>
                  </li>
                  <li className="list-disc">
                    <Link to="/faq" className="hover:text-primary-red">Is this a real streaming service?</Link>
                  </li>
                  <li className="list-disc">
                    <Link to="/faq" className="hover:text-primary-red">Should I use real personal information?</Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-text-primary mb-3">Account & Billing</h3>
                <ul className="space-y-2 text-text-secondary ml-6">
                  <li className="list-disc">
                    <Link to="/faq" className="hover:text-primary-red">Will I be charged for using HogFlix?</Link>
                  </li>
                  <li className="list-disc">
                    <Link to="/faq" className="hover:text-primary-red">What are the subscription plans?</Link>
                  </li>
                  <li className="list-disc">
                    <Link to="/faq" className="hover:text-primary-red">How do I delete my account?</Link>
                  </li>
                  <li className="list-disc">
                    <Link to="/faq" className="hover:text-primary-red">How long is my data kept?</Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-text-primary mb-3">Privacy & Security</h3>
                <ul className="space-y-2 text-text-secondary ml-6">
                  <li className="list-disc">
                    <Link to="/privacy" className="hover:text-primary-red">Privacy Policy</Link>
                  </li>
                  <li className="list-disc">
                    <Link to="/terms" className="hover:text-primary-red">Terms of Service</Link>
                  </li>
                  <li className="list-disc">
                    <Link to="/faq" className="hover:text-primary-red">What data do you collect?</Link>
                  </li>
                  <li className="list-disc">
                    <Link to="/faq" className="hover:text-primary-red">Is my session being recorded?</Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-text-primary mb-3">Features & Analytics</h3>
                <ul className="space-y-2 text-text-secondary ml-6">
                  <li className="list-disc">
                    <Link to="/faq" className="hover:text-primary-red">What are Feature Flags and Experiments?</Link>
                  </li>
                  <li className="list-disc">
                    <Link to="/beta-features" className="hover:text-primary-red">Beta Features & Early Access</Link>
                  </li>
                  <li className="list-disc">
                    <Link to="/faq" className="hover:text-primary-red">What is PostHog?</Link>
                  </li>
                  <li className="list-disc">
                    <a href="https://posthog.com/docs" target="_blank" rel="noopener noreferrer" className="hover:text-primary-red">
                      How can I build with PostHog?
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="bg-card-background rounded-lg border border-gray-800 p-8">
            <h2 className="text-2xl font-bold text-text-primary mb-4">Need More Help?</h2>
            <p className="text-text-secondary mb-6">
              Can't find what you're looking for? We're here to help!
            </p>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start">
                <Mail className="h-6 w-6 text-primary-red mr-3 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">Submit a Ticket</h3>
                  <p className="text-text-secondary text-sm mb-2">
                    For technical issues or account questions, submit a support ticket.
                  </p>
                  <Link to="/support" className="text-primary-red hover:underline text-sm font-medium">
                    Go to Support →
                  </Link>
                </div>
              </div>

              <div className="flex items-start">
                <ExternalLink className="h-6 w-6 text-primary-red mr-3 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">PostHog Community</h3>
                  <p className="text-text-secondary text-sm mb-2">
                    Connect with the PostHog team and community for analytics questions.
                  </p>
                  <a 
                    href="https://posthog.com/contact" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary-red hover:underline text-sm font-medium"
                  >
                    Visit PostHog →
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-200 text-sm text-center">
              💡 <strong>Tip:</strong> Remember, HogFlix is a demo environment. Use test data only and explore freely to learn about analytics!
            </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Help;