import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, CheckCircle, Mail, Lock, ArrowRight } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (loginError) {
        const userFriendly = loginError.message.includes('Invalid login credentials')
          ? 'Invalid login credentials. If you just signed up, please confirm your email before logging in.'
          : loginError.message;
        setError(userFriendly);
        setResendMessage('');
        
        // PostHog analytics for failed login
        posthog.capture('user:login_failed', {
          reason: userFriendly
        });
        return;
      }

      if (data.user) {
        // PostHog analytics for successful login
        posthog.identify(data.user.id);
        posthog.capture('user:logged_in');

        // Show success state briefly
        setSuccess(true);
        
        // Show success toast
        toast({
          title: "Welcome back!",
          description: "You've successfully signed in. Redirecting to your profiles...",
        });

        // Redirect after a brief delay to show success state
        setTimeout(() => {
          navigate('/profiles');
        }, 1500);
      }
    } catch (err) {
      const errorMessage = 'An unexpected error occurred';
      setError(errorMessage);
      
      posthog.capture('user:login_failed', {
        reason: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResendMessage('');
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) {
        setResendMessage(error.message);
        posthog.capture('user:resend_confirmation_failed', { reason: error.message });
      } else {
        setResendMessage('Confirmation email sent. Please check your inbox.');
        posthog.capture('user:resend_confirmation_sent');
        toast({
          title: "Email sent!",
          description: "We've sent a new confirmation email. Please check your inbox and spam folder.",
        });
      }
    } catch (e) {
      setResendMessage('Failed to resend confirmation email. Please try again later.');
    } finally {
      setResending(false);
    }
  };
 
   return (
    <div className="min-h-screen bg-gradient-to-br from-background-dark via-background-dark to-background-dark/90 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-red/10 rounded-full mb-4">
            <Shield className="w-8 h-8 text-primary-red" />
          </div>
          <h1 className="text-4xl font-bold text-text-primary mb-2">HogFlix</h1>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Secure Sign In</h2>
          <p className="text-text-secondary">Your entertainment awaits - sign in securely</p>
        </div>

        <div className="bg-background-dark/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-text-primary font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-netflix h-12 text-lg transition-all duration-200 focus:ring-2 focus:ring-primary-red/20"
                placeholder="Enter your email"
                required
                disabled={loading || success}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-text-primary font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-netflix h-12 text-lg transition-all duration-200 focus:ring-2 focus:ring-primary-red/20"
                placeholder="Enter your password"
                required
                disabled={loading || success}
              />
            </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-600 rounded text-red-400 text-sm" role="alert" aria-live="assertive">
              {error}
              {email && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="text-primary-red hover:underline"
                  >
                    {resending ? 'Resending...' : 'Resend confirmation email'}
                  </button>
                </div>
              )}
            </div>
          )}
          {resendMessage && (
            <div className="p-3 bg-emerald-900/20 border border-emerald-600 rounded text-emerald-400 text-sm" role="status" aria-live="polite">
              {resendMessage}
            </div>
          )}

            <Button
              type="submit"
              disabled={loading || success}
              className={`w-full h-12 text-lg font-semibold transition-all duration-300 ${
                success 
                  ? 'bg-green-600 hover:bg-green-600 text-white' 
                  : loading 
                    ? 'bg-primary-red/70 text-white' 
                    : 'btn-primary hover:bg-primary-red/90 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Success! Redirecting...
                </div>
              ) : loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing you in...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Sign In Securely
                  <ArrowRight className="w-5 h-5" />
                </div>
              )}
            </Button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <div className="flex items-center gap-2 justify-center text-sm text-text-tertiary mb-4">
            <Shield className="w-4 h-4" />
            Your data is protected with enterprise-grade security
          </div>
          <p className="text-text-secondary">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-primary-red hover:underline font-semibold transition-colors"
            >
              Create Account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;