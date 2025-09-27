import { CheckCircle, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadStep = 
  | 'validation' 
  | 'thumbnail-upload' 
  | 'video-upload' 
  | 'processing' 
  | 'complete';

interface UploadProgressProps {
  currentStep: UploadStep;
  progress: number;
  error?: string;
}

const steps: { key: UploadStep; label: string; description: string }[] = [
  { key: 'validation', label: 'Validation', description: 'Checking files and form data' },
  { key: 'thumbnail-upload', label: 'Thumbnail Upload', description: 'Uploading thumbnail image' },
  { key: 'video-upload', label: 'Video Upload', description: 'Uploading video file' },
  { key: 'processing', label: 'Processing', description: 'Finalizing your content' },
  { key: 'complete', label: 'Complete', description: 'Content is now live!' }
];

export default function UploadProgress({ currentStep, progress, error }: UploadProgressProps) {
  const currentStepIndex = steps.findIndex(step => step.key === currentStep);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-text-secondary">
        <span>Upload Progress</span>
        <span>{Math.round(progress)}%</span>
      </div>

      <div className="w-full bg-secondary rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => {
          const isComplete = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div 
              key={step.key}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all",
                isComplete && "bg-green-500/10 border border-green-500/20",
                isCurrent && "bg-primary/10 border border-primary/20",
                isPending && "bg-muted/50 border border-muted"
              )}
            >
              <div className="flex-shrink-0">
                {isComplete ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : isCurrent ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "font-medium text-sm",
                  isComplete && "text-green-500",
                  isCurrent && "text-primary",
                  isPending && "text-muted-foreground"
                )}>
                  {step.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {step.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="text-sm text-destructive font-medium">Upload Error</div>
          <div className="text-xs text-destructive/80 mt-1">{error}</div>
        </div>
      )}
    </div>
  );
}