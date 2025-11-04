import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useToast } from '@/hooks/use-toast';
import { usePostHog } from 'posthog-js/react';

interface HedgehogRatingProps {
  videoId: string;
  currentRating?: number | null;
  averageRating?: number;
  totalRatings?: number;
  size?: 'small' | 'large';
  showStats?: boolean;
  readOnly?: boolean;
}

export const HedgehogRating = ({ 
  videoId, 
  currentRating, 
  averageRating = 0,
  totalRatings = 0,
  size = 'large',
  showStats = true,
  readOnly = false
}: HedgehogRatingProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localRating, setLocalRating] = useState(currentRating || 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const { user } = useAuth();
  const { selectedProfile } = useProfile();
  const { toast } = useToast();
  const posthog = usePostHog();

  const hedgehogSize = size === 'large' ? 'text-2xl' : 'text-lg';
  const isInteractive = user && selectedProfile && !readOnly;

  const handleRatingSubmit = async (rating: number) => {
    if (!user || !selectedProfile || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('video_ratings')
        .upsert({
          video_id: videoId,
          user_id: user.id,
          profile_id: selectedProfile.id,
          rating
        });

      if (error) throw error;

      setLocalRating(rating);
      
      // Track rating event
      posthog?.capture('video:rated', {
        video_id: videoId,
        profile_id: selectedProfile.id,
        rating: rating,
        previous_rating: localRating || null
      });
      
      toast({
        title: "Rating saved!",
        description: `You rated this video ${rating} hedgehog${rating !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast({
        title: "Error",
        description: "Failed to save rating. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoveredRating || localRating || averageRating;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className={`${hedgehogSize} transition-all duration-200 ${
              isInteractive 
                ? 'hover:scale-110 cursor-pointer' 
                : 'cursor-default'
            } ${
              star <= Math.round(displayRating) 
                ? 'opacity-100' 
                : 'opacity-30'
            }`}
            onMouseEnter={() => isInteractive && setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            onClick={() => isInteractive && handleRatingSubmit(star)}
            disabled={isSubmitting || !isInteractive}
            title={isInteractive ? `Rate ${star} hedgehog${star !== 1 ? 's' : ''}` : undefined}
          >
            🦔
          </button>
        ))}
      </div>
      
      {showStats && (
        <div className="text-center">
          <div className="text-sm text-muted-foreground">
            {averageRating > 0 ? (
              <>
                {averageRating.toFixed(1)} hedgehog{averageRating !== 1 ? 's' : ''} 
                {totalRatings > 0 && ` (${totalRatings} rating${totalRatings !== 1 ? 's' : ''})`}
              </>
            ) : (
              'No ratings yet'
            )}
          </div>
          {isInteractive && localRating === 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              Click hedgehogs to rate this video
            </div>
          )}
        </div>
      )}
    </div>
  );
};