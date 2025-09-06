import { useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { HelpCircle, Send } from 'lucide-react';

const TicketSchema = z.object({
  issueCategory: z.enum(['billing','technical-issue','content-request']),
  description: z.string().trim().min(10, 'Please provide at least 10 characters.').max(500, 'Maximum 500 characters.'),
});

const Support = () => {
  const [issueCategory, setIssueCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { toast } = useToast();
  const posthog = usePostHog();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = TicketSchema.safeParse({ issueCategory, description });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast({
        title: "Invalid input",
        description: first.message,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Store the ticket in Supabase
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user?.id,
          issue_category: issueCategory,
          description: description.trim(),
          status: 'open'
        });

      if (error) {
        throw error;
      }
      
      // Track support ticket submission
      posthog.capture('support:ticket_submitted', {
        source: 'hogflix_support_form',
        issue_category: issueCategory
      });

      toast({
        title: "Ticket Submitted Successfully",
        description: "We've received your support request and will get back to you within 24 hours."
      });

      // Reset form
      setIssueCategory('');
      setDescription('');
      
    } catch (error: any) {
      console.error('Error submitting ticket:', error);
      const message = String(error?.message ?? '').toLowerCase();
      const isRateLimit = message.includes('rate limit');
      toast({
        title: isRateLimit ? "Too many requests" : "Submission Failed",
        description: isRateLimit
          ? "You have reached the limit of support tickets per hour. Please try again later."
          : "There was an error submitting your ticket. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark">
      <Header />
      
      <main className="container-netflix py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-primary-red/10 rounded-full flex items-center justify-center">
                <HelpCircle className="h-10 w-10 text-primary-red" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-text-primary font-manrope mb-4">
              Contact Support
            </h1>
            <p className="text-text-secondary font-manrope text-lg">
              Having trouble with HogFlix? We're here to help. Submit a support ticket and our team will get back to you.
            </p>
          </div>

          <div className="bg-card-background rounded-lg border border-gray-800 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="issue-category" className="text-text-primary font-manrope">
                  Issue Category
                </Label>
                <Select value={issueCategory} onValueChange={setIssueCategory}>
                  <SelectTrigger className="bg-background/20 border-gray-700 text-text-primary">
                    <SelectValue placeholder="Select an issue category" />
                  </SelectTrigger>
                  <SelectContent className="bg-background-dark border-gray-700 z-50">
                    <SelectItem value="billing" className="text-text-primary hover:bg-white/10 focus:bg-white/10">
                      Billing
                    </SelectItem>
                    <SelectItem value="technical-issue" className="text-text-primary hover:bg-white/10 focus:bg-white/10">
                      Technical Issue
                    </SelectItem>
                    <SelectItem value="content-request" className="text-text-primary hover:bg-white/10 focus:bg-white/10">
                      Content Request
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-text-primary font-manrope">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please describe your issue in detail..."
                  className="min-h-32 bg-background/20 border-gray-700 text-text-primary placeholder:text-muted-foreground resize-none"
                  rows={6}
                  maxLength={500}
                />
                <p className="text-text-tertiary text-sm font-manrope">
                  {description.length}/500 characters
                </p>
              </div>

              <Button 
                type="submit" 
                disabled={loading || !issueCategory || !description.trim()}
                className="w-full bg-primary-red hover:bg-primary-red/90 text-white font-manrope font-medium"
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting Ticket...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Ticket
                  </>
                )}
              </Button>
            </form>
          </div>

          <div className="mt-8 text-center">
            <p className="text-text-tertiary font-manrope text-sm">
              Need immediate assistance? Our support team typically responds within 24 hours.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Support;