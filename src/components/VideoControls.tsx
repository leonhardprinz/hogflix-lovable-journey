import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, PictureInPicture } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  isPiPSupported: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onPiPToggle: () => void;
  onFullscreenToggle: () => void;
}

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const VideoControls = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackRate,
  isFullscreen,
  isPiPSupported,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onPlaybackRateChange,
  onSkipBackward,
  onSkipForward,
  onPiPToggle,
  onFullscreenToggle,
}: VideoControlsProps) => {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeTimeoutRef = useRef<NodeJS.Timeout>();

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVolumeHover = (show: boolean) => {
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }
    
    if (show) {
      setShowVolumeSlider(true);
    } else {
      volumeTimeoutRef.current = setTimeout(() => {
        setShowVolumeSlider(false);
      }, 300);
    }
  };

  useEffect(() => {
    return () => {
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-opacity duration-300">
      {/* Progress Bar */}
      <div className="mb-3">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={(value) => onSeek(value[0])}
          className="cursor-pointer group"
        />
        <div className="flex justify-between text-xs text-white/80 mt-1.5 font-medium">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        {/* Play/Pause */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onPlayPause}
          className="text-white hover:bg-white/20 h-9 w-9"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>

        {/* Skip Controls */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSkipBackward}
          className="text-white hover:bg-white/20 h-9 w-9"
          title="Skip backward 10s"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onSkipForward}
          className="text-white hover:bg-white/20 h-9 w-9"
          title="Skip forward 10s"
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        {/* Volume Controls */}
        <div 
          className="flex items-center gap-2 relative"
          onMouseEnter={() => handleVolumeHover(true)}
          onMouseLeave={() => handleVolumeHover(false)}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onMuteToggle}
            className="text-white hover:bg-white/20 h-9 w-9"
          >
            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          
          <div 
            className={`transition-all duration-200 overflow-hidden ${
              showVolumeSlider ? 'w-24 opacity-100' : 'w-0 opacity-0'
            }`}
          >
            <Slider
              value={[volume]}
              max={1}
              step={0.01}
              onValueChange={(value) => onVolumeChange(value[0])}
              className="cursor-pointer"
            />
          </div>
        </div>

        <div className="flex-1" />

        {/* Playback Speed */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/20 h-9 px-3 text-sm font-medium"
            >
              {playbackRate === 1 ? 'Speed' : `${playbackRate}x`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-2 bg-black/95 border-white/20 backdrop-blur-sm">
            <div className="space-y-1">
              {PLAYBACK_RATES.map((rate) => (
                <button
                  key={rate}
                  onClick={() => onPlaybackRateChange(rate)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    playbackRate === rate
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {rate === 1 ? 'Normal' : `${rate}x`}
                  {playbackRate === rate && ' ✓'}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Picture-in-Picture */}
        {isPiPSupported && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onPiPToggle}
            className="text-white hover:bg-white/20 h-9 w-9"
            title="Picture-in-Picture"
          >
            <PictureInPicture className="h-4 w-4" />
          </Button>
        )}

        {/* Fullscreen */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onFullscreenToggle}
          className="text-white hover:bg-white/20 h-9 w-9"
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
