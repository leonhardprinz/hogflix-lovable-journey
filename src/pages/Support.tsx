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

// Validation schema
const supportTicketSchema = z.object({
  issueCategory: z.string().min(1, 'Please select an issue category'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must not exceed 500 characters')
    .trim(),
});

const Support = () => {
  const [issueCategory, setIssueCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  
  const { toast } = useToast();
  const posthog = usePostHog();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Validate form data
    const result = supportTicketSchema.safeParse({
      issueCategory: issueCategory as any,
      description: description,
    });

    if (!result.success) {
      const errors: { [key: string]: string } = {};
      result.error.issues.forEach((issue) => {
        if (issue.path.length > 0) {
          errors[issue.path[0] as string] = issue.message;
        }
      });
      setValidationErrors(errors);
      toast({
        title: "Validation Error",
        description: "Please fix the errors below and try again.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Store the ticket in Supabase (user_id will be auto-populated by trigger)
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          issue_category: result.data.issueCategory,
          description: result.data.description,
          status: 'open'
        });

      if (error) {
        // Handle specific error cases
        if (error.message.includes('rate limit exceeded')) {
          toast({
            title: "Too Many Requests",
            description: "You've submitted too many tickets recently. Please wait and try again later.",
            variant: "destructive"
          });
          return;
        }
        throw error;
      }
      
      // Track support ticket submission
      posthog.capture('support:ticket_submitted', {
        source: 'hogflix_support_form',
        issue_category: result.data.issueCategory
      });

      toast({
        title: "Ticket Submitted Successfully",
        description: "We've received your support request and will get back to you within 24 hours."
      });

      // Reset form
      setIssueCategory('');
      setDescription('');
      setValidationErrors({});
      
    } catch (error) {
      console.error('Error submitting ticket:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your ticket. Please try again.",
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
                  <SelectTrigger className={`bg-background/20 border-gray-700 text-text-primary ${validationErrors.issueCategory ? 'border-red-500' : ''}`}>
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
                {validationErrors.issueCategory && (
                  <p className="text-red-500 text-sm font-manrope">{validationErrors.issueCategory}</p>
                )}
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
                  className={`min-h-32 bg-background/20 border-gray-700 text-text-primary placeholder:text-muted-foreground resize-none ${validationErrors.description ? 'border-red-500' : ''}`}
                  rows={6}
                  maxLength={500}
                />
                <div className="flex justify-between items-center">
                  <p className="text-text-tertiary text-sm font-manrope">
                    {description.length}/500 characters
                  </p>
                  {validationErrors.description && (
                    <p className="text-red-500 text-sm font-manrope">{validationErrors.description}</p>
                  )}
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary-red hover:bg-primary-red/90 text-white font-manrope font-medium disabled:opacity-50"
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