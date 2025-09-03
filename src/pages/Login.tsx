import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const posthog = usePostHog();

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

        // Redirect to profiles page
        navigate('/profiles');
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
      }
    } catch (e) {
      setResendMessage('Failed to resend confirmation email. Please try again later.');
    } finally {
      setResending(false);
    }
  };
 
   return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">HogFlix</h1>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Sign In</h2>
          <p className="text-text-secondary">Welcome back to your streaming experience</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="email" className="text-text-primary">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-netflix mt-2"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-text-primary">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-netflix mt-2"
              placeholder="Enter your password"
              required
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
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'SIGNING IN...' : 'LOG IN'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-text-secondary">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-primary-red hover:underline"
            >
              Sign Up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;