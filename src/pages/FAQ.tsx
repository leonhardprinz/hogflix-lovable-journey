import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { HelpCircle, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ = () => {
  return (
    <div className="min-h-screen bg-background-dark flex flex-col">
      <Header />
      
      <main className="flex-1 container-netflix py-12">
        <div className="max-w-4xl mx-auto">
          {/* Demo Warning Banner */}
          <div className="mb-8 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-200 text-sm text-center">
              🎭 <strong>Demo Environment:</strong> This is an educational demonstration showcasing PostHog analytics capabilities.
            </p>
          </div>

          <div className="flex items-center justify-center mb-8">
            <HelpCircle className="h-12 w-12 text-primary-red mr-4" />
            <h1 className="text-4xl font-bold text-text-primary">Frequently Asked Questions</h1>
          </div>

          <div className="bg-card-background rounded-lg border border-gray-800 p-8">
            <Accordion type="single" collapsible className="w-full space-y-4">
              <AccordionItem value="item-1" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  What is HogFlix?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  HogFlix is a <strong>demonstration application</strong> that showcases PostHog analytics capabilities. 
                  It's designed to look like a streaming service to demonstrate real-world analytics use cases including 
                  event tracking, feature flags, A/B testing, and session recordings. This is NOT a real streaming platform.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  Is this a real streaming service?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  <strong>No.</strong> HogFlix is purely educational. The videos featured are PostHog product demonstrations 
                  and related content. The entire application exists to demonstrate analytics tracking and feature management.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  Will I be charged for using HogFlix?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  <strong>Absolutely not.</strong> No real payments are ever processed. The checkout flow uses Stripe in 
                  <strong> TEST MODE ONLY</strong> to demonstrate payment tracking and conversion analytics. 
                  You can use test card 4242 4242 4242 4242 to test the checkout flow safely.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  What data do you collect?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  We collect usage data via PostHog analytics to demonstrate tracking capabilities. This includes:
                  page views, button clicks, video watch progress, feature flag enrollments, and experiment variants.
                  See our <Link to="/privacy" className="text-primary-red hover:underline">Privacy Policy</Link> for full details.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  Should I use real personal information?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  <strong>No!</strong> Please use only test data when signing up. Use temporary email addresses 
                  (e.g., test@example.com) and fictitious information. Do not enter real personal information, 
                  payment details, or sensitive data.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  What is PostHog?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  PostHog is an open-source product analytics platform that helps teams understand user behavior, 
                  run experiments, and manage feature flags. Learn more at{" "}
                  <a href="https://posthog.com" target="_blank" rel="noopener noreferrer" className="text-primary-red hover:underline">
                    posthog.com
                  </a>.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  Can I use HogFlix to watch real movies or shows?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  No. The content library consists exclusively of PostHog product demos, tutorial videos, 
                  and related educational content. It's designed to simulate a content library for analytics demonstration purposes.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  What are the subscription plans?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  The subscription tiers (Basic, Premium, Ultimate) are <strong>demo features only</strong>. 
                  They exist to showcase subscription analytics, pricing experiments, and conversion tracking. 
                  No actual subscriptions are sold.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-9" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  How long will my account data be kept?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  Demo account data may be periodically cleared for maintenance purposes. 
                  Do not rely on HogFlix for long-term data storage. This is a testing environment.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-10" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  Can I delete my account?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  Yes. Contact us via the <Link to="/support" className="text-primary-red hover:underline">Support page</Link> to 
                  request account deletion. Your data will be removed from our systems in accordance with our 
                  <Link to="/privacy" className="text-primary-red hover:underline"> Privacy Policy</Link>.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-11" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  What are Feature Flags and Experiments?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  Feature flags allow controlled rollout of new features. Experiments (A/B tests) compare different 
                  versions to determine which performs better. HogFlix demonstrates these concepts using PostHog. 
                  You might see different versions of pricing pages, buttons, or layouts as part of active experiments.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-12" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  Why do I see "Beta Features" or "Early Access"?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  These demonstrate feature flag enrollment and progressive feature rollout. 
                  The "AI Summaries" feature, for example, showcases how teams can gradually release features 
                  to specific user segments and track adoption.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-13" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  Is my session being recorded?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  Session recordings may be enabled for certain users as part of analytics demonstrations. 
                  These recordings help demonstrate PostHog's session replay capabilities. 
                  Recordings may be used in educational presentations to showcase product analytics.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-14" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  Who built HogFlix?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  HogFlix was created as a demonstration project to showcase PostHog's analytics and 
                  feature management capabilities. It's built using React, TypeScript, Tailwind CSS, 
                  Supabase, and of course, PostHog.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-15" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  How can I learn more about building with PostHog?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  Visit the{" "}
                  <a href="https://posthog.com/docs" target="_blank" rel="noopener noreferrer" className="text-primary-red hover:underline">
                    PostHog documentation
                  </a>{" "}
                  to learn about implementing analytics, feature flags, experiments, and more in your own applications.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-16" className="border-gray-700">
                <AccordionTrigger className="text-text-primary hover:text-primary-red">
                  I found a bug or security issue. What should I do?
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary">
                  Please report it via our <Link to="/support" className="text-primary-red hover:underline">Support page</Link>. 
                  Since this is a demo environment, security vulnerabilities should be reported responsibly 
                  so we can address them and improve the demonstration.
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-blue-200 text-sm">
                <strong>Still have questions?</strong> Contact us through our{" "}
                <Link to="/support" className="text-primary-red hover:underline font-semibold">Support page</Link> or 
                reach out to PostHog at{" "}
                <a href="https://posthog.com/contact" target="_blank" rel="noopener noreferrer" className="text-primary-red hover:underline font-semibold">
                  posthog.com/contact
                </a>.
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default FAQ;