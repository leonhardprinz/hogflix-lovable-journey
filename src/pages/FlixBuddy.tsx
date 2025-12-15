// FlixBuddy Chat Interface Page
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePostHog, useFeatureFlagVariantKey } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Play, Plus, ArrowLeft, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WatchlistButton } from '@/components/WatchlistButton';

// Experiment prompt suggestions for 'suggested-prompts' variant
const PROMPT_SUGGESTIONS = [
  { emoji: '🎬', text: "What's trending?" },
  { emoji: '😂', text: 'Something funny' },
  { emoji: '🎭', text: 'Hidden gems' },
  { emoji: '🍿', text: 'New releases' }
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Video {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  duration: number;
}

const FlixBuddy = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [recommendedVideos, setRecommendedVideos] = useState<Video[]>([]);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'positive' | 'negative'>>({});
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { selectedProfile } = useProfile();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<Date>(new Date());
  
  const initialQuery = searchParams.get('q');
  
  // Feature flag for welcome message experiment
  const welcomeVariant = useFeatureFlagVariantKey('flixbuddy_welcome_experiment') as string | undefined;
  
  // Get welcome message based on experiment variant
  const getWelcomeMessage = (): string => {
    switch (welcomeVariant) {
      case 'personalized':
        const profileName = selectedProfile?.display_name || 'there';
        return `Hey ${profileName}! 👋 I'm FlixBuddy, your personal movie companion.\n\nBased on what others with similar tastes are loving right now, I've got some great recommendations. What are you in the mood for?`;
      case 'suggested-prompts':
        return "Hi! I'm FlixBuddy, your movie and series recommendation assistant! 🎬\n\nTap a suggestion below to get started, or tell me what you're in the mood for:";
      default: // 'control' or undefined
        return "Hi! I'm FlixBuddy, your movie and series recommendation assistant! 🎬\n\nTell me what you're in the mood for - any genre, mood, or specific type of content you'd like to discover today?";
    }
  };

  // Format duration helper
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Auto-scroll to bottom only during active conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Check if user is near the bottom of the chat
  const shouldAutoScroll = () => {
    const element = messagesContainerRef.current;
    if (!element) return true; // Auto-scroll if ref not available yet
    
    const threshold = 100; // pixels from bottom
    const isNearBottom = 
      element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    
    return isNearBottom;
  };

  useEffect(() => {
    // Only auto-scroll if:
    // 1. We have messages beyond the welcome message
    // 2. User is already near the bottom (actively chatting)
    if (messages.length > 1 && shouldAutoScroll()) {
      scrollToBottom();
    }
  }, [messages]);

  // Initialize conversation
  useEffect(() => {
    const initConversation = async () => {
      if (!selectedProfile) return;

      try {
        // Create new conversation
        const { data: conversation, error } = await supabase
          .from('chat_conversations')
          .insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            profile_id: selectedProfile.id,
            title: initialQuery ? `Chat about "${initialQuery}"` : 'New FlixBuddy Chat'
          })
          .select()
          .single();

        if (error) throw error;
        
        setConversationId(conversation.id);
        
        // Track conversation start with experiment variant
        posthog.capture('flixbuddy:opened', {
          initial_query: initialQuery,
          profile_id: selectedProfile.id,
          experiment_variant: welcomeVariant || 'control'
        });
        
        // Track feature flag exposure for experiment
        posthog.capture('$feature_flag_called', {
          $feature_flag: 'flixbuddy_welcome_experiment',
          $feature_flag_response: welcomeVariant || 'control'
        });

        // Track AI trace for new conversation (PostHog LLM Analytics)
        try {
          posthog.capture('$ai_trace', {
            $ai_trace_id: conversation.id,
            $ai_provider: 'google',
            $ai_model: 'gemini-2.0-flash',
            profile_id: selectedProfile.id
          });
        } catch (e) {
          console.error('PostHog tracking error:', e);
        }

        // If there's an initial query, send it automatically
        if (initialQuery) {
          await sendMessage(initialQuery);
        } else {
          // Add welcome message based on experiment variant
          const welcomeMessage: ChatMessage = {
            id: 'welcome',
            role: 'assistant',
            content: getWelcomeMessage(),
            timestamp: new Date()
          };
          setMessages([welcomeMessage]);
        }
      } catch (error) {
        console.error('Error initializing conversation:', error);
        toast({
          title: "Error",
          description: "Failed to start conversation. Please try again.",
          variant: "destructive",
        });
      }
    };

    initConversation();
  }, [selectedProfile, initialQuery, welcomeVariant]);

  // Track session end, abandonment, and conversation length on unmount
  useEffect(() => {
    return () => {
      if (!conversationId) return;
      
      const sessionDuration = Math.round(
        (Date.now() - sessionStartRef.current.getTime()) / 1000
      );
      
      // Count only user messages (excluding welcome message)
      const userMessageCount = messages.filter(m => m.role === 'user').length;
      
      if (userMessageCount === 0) {
        // User opened FlixBuddy but never sent a message = abandoned
        posthog.capture('flixbuddy:abandoned', {
          conversation_id: conversationId,
          time_on_page_seconds: sessionDuration,
          profile_id: selectedProfile?.id
        });
      } else {
        // Normal session end with engagement data
        posthog.capture('flixbuddy:session_ended', {
          conversation_id: conversationId,
          message_count: userMessageCount,
          total_messages: messages.length,
          session_duration_seconds: sessionDuration,
          videos_recommended: recommendedVideos.length,
          profile_id: selectedProfile?.id
        });
      }
    };
  }, [messages, conversationId, recommendedVideos, selectedProfile, posthog]);

  // Send message function
  const sendMessage = async (message: string) => {
    if (!message.trim() || !conversationId || !selectedProfile) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Track message sent with experiment variant
    posthog.capture('flixbuddy:message_sent', {
      conversation_id: conversationId,
      message_length: message.length,
      message_number: messages.filter(m => m.role === 'user').length + 1,
      profile_id: selectedProfile.id,
      experiment_variant: welcomeVariant || 'control'
    });

    try {
      const { data, error } = await supabase.functions.invoke('flixbuddy-chat', {
        body: {
          message,
          conversationId,
          userId: (await supabase.auth.getUser()).data.user?.id,
          profileId: selectedProfile.id
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!data || !data.message) {
        console.error('Invalid response data:', data);
        throw new Error('Invalid response from FlixBuddy');
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Extract and update recommended videos from response
      await updateRecommendedVideos(data.message);

      // Track LLM generation (PostHog LLM Analytics) - with cost data
      try {
        posthog.capture('$ai_generation', {
          $ai_provider: 'google',
          $ai_model: 'gemini-2.0-flash',
          $ai_input: message,
          $ai_output: data.message,
          $ai_input_tokens: data.metadata?.tokens?.input || 0,
          $ai_output_tokens: data.metadata?.tokens?.output || 0,
          $ai_total_tokens: data.metadata?.tokens?.total || 0,
          $ai_input_cost_usd: data.metadata?.cost?.input || 0,
          $ai_output_cost_usd: data.metadata?.cost?.output || 0,
          $ai_total_cost_usd: data.metadata?.cost?.total || 0,
          $ai_latency: data.metadata?.latency || 0,
          $ai_conversation_id: conversationId,
          $ai_trace_id: conversationId,
          profile_id: selectedProfile.id
        });
      } catch (e) {
        console.error('PostHog tracking error:', e);
      }

      // Track LLM generation complete (PostHog LLM Analytics)
      try {
        posthog.capture('$ai_generation_complete', {
          $ai_provider: 'google',
          $ai_model: 'gemini-2.0-flash',
          $ai_output: data.message,
          $ai_input_tokens: data.metadata?.tokens?.input || 0,
          $ai_output_tokens: data.metadata?.tokens?.output || 0,
          $ai_total_tokens: data.metadata?.tokens?.total || 0,
          $ai_input_cost_usd: data.metadata?.cost?.input || 0,
          $ai_output_cost_usd: data.metadata?.cost?.output || 0,
          $ai_total_cost_usd: data.metadata?.cost?.total || 0,
          $ai_latency: data.metadata?.latency || 0,
          $ai_conversation_id: conversationId,
          $ai_trace_id: conversationId,
          profile_id: selectedProfile.id
        });
      } catch (e) {
        console.error('PostHog tracking error:', e);
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Detailed error:', errorMessage);
      
      // Check if it's a rate limit error
      const isRateLimit = error?.status === 429 || 
                          error?.message?.includes('rate limit') || 
                          error?.message?.includes('429');
      
      // Track LLM generation error (PostHog LLM Analytics)
      try {
        posthog.capture('$ai_generation_error', {
          $ai_error: errorMessage,
          $ai_is_rate_limit: isRateLimit,
          $ai_provider: 'google',
          $ai_model: 'gemini-2.0-flash',
          $ai_conversation_id: conversationId,
          $ai_trace_id: conversationId,
          profile_id: selectedProfile.id
        });
      } catch (e) {
        console.error('PostHog tracking error:', e);
      }
      
      // Show user-friendly error message
      if (isRateLimit) {
        toast({
          title: "FlixBuddy is Busy", 
          description: "FlixBuddy is experiencing high demand right now. Please wait a moment and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "FlixBuddy Error", 
          description: `Failed to get response: ${errorMessage}. Please try again.`,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Update recommended videos based on assistant response
  const updateRecommendedVideos = async (response: string) => {
    try {
      // Extract video titles mentioned in the response
      const { data: allVideos } = await supabase
        .from('videos')
        .select('*');

      if (!allVideos) return;

      const mentionedVideos = allVideos.filter(video => 
        response.toLowerCase().includes(video.title.toLowerCase())
      ).slice(0, 6);

      setRecommendedVideos(mentionedVideos);

      // Track AI recommendations (PostHog LLM Analytics)
      if (mentionedVideos.length > 0) {
        try {
          posthog.capture('$ai_recommendation', {
            $ai_recommended_videos: mentionedVideos.map(v => v.id),
            $ai_recommendation_count: mentionedVideos.length,
            $ai_conversation_id: conversationId
          });
        } catch (e) {
          console.error('PostHog tracking error:', e);
        }
      }
    } catch (error) {
      console.error('Error updating recommended videos:', error);
    }
  };

  const handleSend = () => {
    sendMessage(inputMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVideoClick = (videoId: string) => {
    posthog.capture('flixbuddy:clicked', {
      video_id: videoId,
      conversation_id: conversationId,
      experiment_variant: welcomeVariant || 'control'
    });
    navigate(`/watch/${videoId}`);
  };
  
  // Handle clicking a suggested prompt (for 'suggested-prompts' variant)
  const handlePromptSuggestionClick = (promptText: string) => {
    posthog.capture('flixbuddy:prompt_suggestion_clicked', {
      prompt: promptText,
      experiment_variant: 'suggested-prompts',
      conversation_id: conversationId
    });
    sendMessage(promptText);
  };

  const handleFeedback = (messageId: string, feedback: 'positive' | 'negative') => {
    setMessageFeedback(prev => ({ ...prev, [messageId]: feedback }));
    
    posthog.capture('flixbuddy:feedback', {
      conversation_id: conversationId,
      message_id: messageId,
      feedback,
      $ai_feedback: feedback === 'positive' ? 1 : -1,
      profile_id: selectedProfile?.id,
      experiment_variant: welcomeVariant || 'control'
    });

    toast({
      title: "Thanks for your feedback!",
      description: feedback === 'positive' ? "Glad FlixBuddy helped! 🎬" : "We'll work on improving.",
    });
  };

  if (!selectedProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Profile Required</h2>
          <p className="text-muted-foreground mb-6">Please select a profile to use FlixBuddy.</p>
          <Button onClick={() => navigate('/profiles')}>Select Profile</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="container-netflix py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/browse')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Browse
            </Button>
            <div className="flex items-center space-x-2">
              <Bot className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">FlixBuddy</h1>
              <Badge variant="secondary" className="text-xs">AI Powered</Badge>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Chatting as {selectedProfile.display_name}
          </div>
        </div>
      </div>

      <div className="container-netflix flex-1 flex flex-col overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full py-6">

          {/* Chat Panel - Left Side */}
          <div className="lg:col-span-2 flex flex-col bg-card rounded-lg border border-border h-full overflow-hidden">
            {/* Messages Area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-[80%] ${
                    message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-secondary text-secondary-foreground'
                    }`}>
                      {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className="flex flex-col space-y-1">
                      <div className={`rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground'
                      }`}>
                        <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                        <div className={`text-xs mt-1 opacity-70`}>
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                      {/* Feedback buttons for assistant messages (skip welcome message) */}
                      {message.role === 'assistant' && message.id !== 'welcome' && (
                        <div className="flex items-center space-x-1 px-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFeedback(message.id, 'positive')}
                            disabled={messageFeedback[message.id] !== undefined}
                            className={`h-6 px-2 ${
                              messageFeedback[message.id] === 'positive'
                                ? 'text-green-500'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFeedback(message.id, 'negative')}
                            disabled={messageFeedback[message.id] !== undefined}
                            className={`h-6 px-2 ${
                              messageFeedback[message.id] === 'negative'
                                ? 'text-red-500'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-secondary rounded-lg p-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Prompt Suggestions for 'suggested-prompts' variant */}
            {welcomeVariant === 'suggested-prompts' && messages.length === 1 && messages[0].id === 'welcome' && (
              <div className="border-t border-border p-3 bg-muted/30">
                <div className="flex flex-wrap gap-2">
                  {PROMPT_SUGGESTIONS.map((suggestion) => (
                    <Button
                      key={suggestion.text}
                      variant="outline"
                      size="sm"
                      onClick={() => handlePromptSuggestionClick(suggestion.text)}
                      className="text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
                      disabled={isLoading}
                    >
                      <Sparkles className="h-3 w-3 mr-1.5" />
                      {suggestion.emoji} {suggestion.text}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="border-t border-border p-4">
              <div className="flex space-x-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask FlixBuddy for movie recommendations..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSend}
                  disabled={!inputMessage.trim() || isLoading}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Recommendations Panel - Right Side */}
          <div className="bg-card rounded-lg border border-border p-4 overflow-y-auto h-full">
            <h3 className="font-semibold text-foreground mb-4 flex items-center">
              <Play className="h-4 w-4 mr-2 text-primary" />
              Recommended for You
            </h3>
            
            {recommendedVideos.length > 0 ? (
              <div className="space-y-3">
                {recommendedVideos.map((video) => (
                  <Card key={video.id} className="overflow-hidden hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="p-3" onClick={() => handleVideoClick(video.id)}>
                      <div className="flex space-x-3">
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-16 h-12 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm text-card-foreground truncate">
                            {video.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDuration(video.duration)}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="text-xs h-6 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVideoClick(video.id);
                              }}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Watch
                            </Button>
                            <WatchlistButton videoId={video.id} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Start chatting to get personalized recommendations!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlixBuddy;