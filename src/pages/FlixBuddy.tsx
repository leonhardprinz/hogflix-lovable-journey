// FlixBuddy Chat Interface Page
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Play, Plus, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WatchlistButton } from '@/components/WatchlistButton';

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { selectedProfile } = useProfile();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const initialQuery = searchParams.get('q');

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

  useEffect(() => {
    // Only scroll to bottom if we have more than just the welcome message
    if (messages.length > 1) {
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
        
        // Track conversation start
        posthog.capture('flixbuddy:conversation_started', {
          initial_query: initialQuery,
          profile_id: selectedProfile.id
        });

        // If there's an initial query, send it automatically
        if (initialQuery) {
          await sendMessage(initialQuery);
        } else {
          // Add welcome message
          const welcomeMessage: ChatMessage = {
            id: 'welcome',
            role: 'assistant',
            content: "Hi! I'm FlixBuddy, your movie and series recommendation assistant! 🎬\n\nTell me what you're in the mood for - any genre, mood, or specific type of content you'd like to discover today?",
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
  }, [selectedProfile, initialQuery]);

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

    try {
      // Track message sent
      posthog.capture('flixbuddy:message_sent', {
        conversation_id: conversationId,
        message_length: message.length,
        profile_id: selectedProfile.id
      });

      const { data, error } = await supabase.functions.invoke('flixbuddy-chat', {
        body: {
          message,
          conversationId,
          userId: (await supabase.auth.getUser()).data.user?.id,
          profileId: selectedProfile.id
        }
      });

      if (error) throw error;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Extract and update recommended videos from response
      await updateRecommendedVideos(data.message);

      // Track assistant response
      posthog.capture('flixbuddy:response_received', {
        conversation_id: conversationId,
        response_length: data.message.length,
        profile_id: selectedProfile.id
      });

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error", 
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
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
    posthog.capture('flixbuddy:video_clicked', {
      video_id: videoId,
      conversation_id: conversationId
    });
    navigate(`/watch/${videoId}`);
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
    <div className="min-h-screen bg-background">
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

      <div className="container-netflix py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">

          {/* Chat Panel - Left Side */}
          <div className="lg:col-span-2 flex flex-col bg-card rounded-lg border border-border">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          <div className="bg-card rounded-lg border border-border p-4">
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