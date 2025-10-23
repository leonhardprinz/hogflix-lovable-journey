import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePostHog } from 'posthog-js/react';

interface AiSummaryPanelProps {
  videoId: string;
  videoTitle?: string;
  existingSummary?: string | null;
  onGenerate: () => Promise<void>;
  isGenerating: boolean;
}

export const AiSummaryPanel = ({ 
  videoId,
  videoTitle,
  existingSummary, 
  onGenerate,
  isGenerating 
}: AiSummaryPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const posthog = usePostHog();

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    
    // Track expand/collapse
    posthog.capture(newState ? 'ai_summary:expanded' : 'ai_summary:collapsed', {
      video_id: videoId,
      video_title: videoTitle
    });
  };

  if (!existingSummary && !isGenerating) {
    return (
      <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <span className="text-white font-medium">AI Summary</span>
            <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 text-xs">
              Beta
            </Badge>
          </div>
          <Button 
            onClick={onGenerate}
            size="sm"
            variant="outline"
            className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
          >
            Generate Summary
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg mb-6 overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-400" />
          <span className="text-white font-medium">AI Summary</span>
          <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 text-xs">
            Beta
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isGenerating && <Loader2 className="h-4 w-4 animate-spin text-purple-400" />}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>
      
      {isExpanded && existingSummary && (
        <div className="px-4 pb-4 text-gray-300 leading-relaxed">
          {existingSummary}
        </div>
      )}
      
      {isExpanded && isGenerating && (
        <div className="px-4 pb-4 flex items-center gap-2 text-purple-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Generating summary...</span>
        </div>
      )}
    </div>
  );
};
