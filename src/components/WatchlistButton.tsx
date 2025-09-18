import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { cn } from '@/lib/utils';

interface WatchlistButtonProps {
  videoId: string;
  variant?: 'default' | 'icon';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export const WatchlistButton = ({ 
  videoId, 
  variant = 'default',
  size = 'default',
  className
}: WatchlistButtonProps) => {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const [isLoading, setIsLoading] = useState(false);
  
  const inWatchlist = isInWatchlist(videoId);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsLoading(true);
    try {
      if (inWatchlist) {
        await removeFromWatchlist(videoId);
      } else {
        await addToWatchlist(videoId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <Button
        size={size}
        variant="ghost"
        className={cn(
          "p-2 hover:bg-black/20 transition-colors",
          className
        )}
        onClick={handleToggle}
        disabled={isLoading}
      >
        <Heart 
          className={cn(
            "w-5 h-5 transition-colors",
            inWatchlist ? "fill-red-500 text-red-500" : "text-white hover:text-red-500"
          )} 
        />
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={inWatchlist ? "destructive" : "outline"}
      className={className}
      onClick={handleToggle}
      disabled={isLoading}
    >
      <Heart 
        className={cn(
          "w-4 h-4 mr-2",
          inWatchlist && "fill-current"
        )} 
      />
      {inWatchlist ? "Remove from List" : "Add to My List"}
    </Button>
  );
};