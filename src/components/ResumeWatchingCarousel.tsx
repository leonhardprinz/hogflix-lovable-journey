import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { X, Play, Clock } from 'lucide-react';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { videoHrefFor } from '@/lib/videoRouting';

interface VideoWithProgress {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  video_url: string;
  duration: number;
  progress_seconds: number;
  progress_percentage: number;
  last_watched_at: string;
  category_name?: string;
}

export const ResumeWatchingCarousel = () => {
  const [videos, setVideos] = useState<VideoWithProgress[]>([]);
  const { getResumeWatchingVideos, removeFromResume, loading } = useWatchProgress();
  const posthog = usePostHog();

  const formatTimeRemaining = (totalDuration: number, watchedSeconds: number) => {
    const remaining = totalDuration - watchedSeconds;
    const minutes = Math.floor(remaining / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m left`;
    }
    return `${minutes}m left`;
  };

  const formatLastWatched = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    console.log('🔄 Loading resume watching videos...');
    const resumeVideos = await getResumeWatchingVideos();
    console.log('📺 Resume videos loaded:', resumeVideos.length);
    setVideos(resumeVideos);
    
    if (resumeVideos.length > 0) {
      posthog.capture('resume_watching:section_viewed', {
        videos_count: resumeVideos.length,
        profile_id: resumeVideos[0] ? 'profile_loaded' : null
      });
    }
  };

  const handleVideoClick = (video: VideoWithProgress) => {
    const daysSinceLastWatch = Math.floor(
      (Date.now() - new Date(video.last_watched_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    posthog.capture('resume_watching:video_clicked', {
      video_id: video.id,
      saved_progress_seconds: video.progress_seconds,
      progress_percentage: video.progress_percentage,
      days_since_last_watch: daysSinceLastWatch
    });
  };

  const handleRemoveVideo = async (e: React.MouseEvent, videoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    await removeFromResume(videoId);
    setVideos(prev => prev.filter(v => v.id !== videoId));
  };

  // Show loading state
  if (loading) {
    return (
      <div className="mb-12">
        <h3 className="text-xl font-bold text-text-primary mb-6 font-manrope flex items-center gap-2">
          <Play className="h-5 w-5 text-primary-red" />
          Continue Watching
        </h3>
        <div className="flex items-center justify-center py-8">
          <div className="text-text-secondary font-manrope">Loading your continue watching list...</div>
        </div>
      </div>
    );
  }

  // Don't show section if no videos
  if (videos.length === 0) {
    console.log('🚫 No resume videos to display');
    return null;
  }

  return (
    <div className="mb-12">
      <h3 className="text-xl font-bold text-text-primary mb-6 font-manrope flex items-center gap-2">
        <Play className="h-5 w-5 text-primary-red" />
        Continue Watching
      </h3>
      
      <Carousel 
        className="w-full"
        opts={{
          align: "start",
          loop: false,
        }}
      >
        <CarouselContent className="-ml-4">
          {videos.map((video) => (
            <CarouselItem key={video.id} className="pl-4 basis-80">
              <Link
                to={videoHrefFor(video.category_name, video.id)}
                onClick={() => handleVideoClick(video)}
                className="block"
              >
                <div className="w-full bg-card-background rounded card-hover cursor-pointer group relative">
                  {/* Remove button */}
                  <Button
                    onClick={(e) => handleRemoveVideo(e, video.id)}
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white border-0 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  <div className="aspect-video bg-gray-700 rounded-t overflow-hidden relative">
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                    
                    {/* Progress bar overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50">
                      <div 
                        className="h-1 bg-primary-red transition-all duration-300"
                        style={{ width: `${video.progress_percentage}%` }}
                      />
                    </div>

                    {/* Resume play indicator */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-white/20 rounded-full p-4">
                        <Play className="h-8 w-8 text-white ml-1" />
                      </div>
                    </div>

                    {/* Continue watching badge */}
                    <div className="absolute top-2 left-2 bg-primary-red text-white text-xs px-2 py-1 rounded font-medium">
                      CONTINUE WATCHING
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <h4 className="text-text-primary font-manrope font-medium mb-2 truncate">
                      {video.title}
                    </h4>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-text-tertiary">
                        <Clock className="h-3 w-3" />
                        <span className="font-manrope">
                          {formatTimeRemaining(video.duration, video.progress_seconds)}
                        </span>
                      </div>
                      <span className="text-text-tertiary font-manrope text-xs">
                        {formatLastWatched(video.last_watched_at)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-text-tertiary font-manrope">
                      {Math.round(video.progress_percentage)}% complete • {video.progress_seconds}s watched
                    </div>
                  </div>
                </div>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2" />
        <CarouselNext className="right-2" />
      </Carousel>
    </div>
  );
};