import { CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValidationResult {
  isValid: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface FileValidationProps {
  thumbnailFile?: File | null;
  videoFile?: File | null;
  title: string;
  category: string;
}

export default function FileValidation({ thumbnailFile, videoFile, title, category }: FileValidationProps) {
  const validations: ValidationResult[] = [];

  // Title validation
  if (title.trim()) {
    validations.push({
      isValid: true,
      message: "Title is provided",
      type: 'success'
    });
  } else {
    validations.push({
      isValid: false,
      message: "Title is required",
      type: 'error'
    });
  }

  // Category validation
  if (category) {
    validations.push({
      isValid: true,
      message: "Category is selected",
      type: 'success'
    });
  } else {
    validations.push({
      isValid: false,
      message: "Category is required",
      type: 'error'
    });
  }

  // Thumbnail validation
  if (thumbnailFile) {
    const maxThumbnailSize = 5 * 1024 * 1024; // 5MB
    if (thumbnailFile.size > maxThumbnailSize) {
      validations.push({
        isValid: false,
        message: "Thumbnail must be less than 5MB",
        type: 'error'
      });
    } else if (!thumbnailFile.type.startsWith('image/')) {
      validations.push({
        isValid: false,
        message: "Thumbnail must be an image file",
        type: 'error'
      });
    } else {
      validations.push({
        isValid: true,
        message: `Thumbnail ready (${(thumbnailFile.size / 1024 / 1024).toFixed(1)}MB)`,
        type: 'success'
      });
    }
  } else {
    validations.push({
      isValid: false,
      message: "Thumbnail image is required",
      type: 'error'
    });
  }

  // Video validation
  if (videoFile) {
    const maxVideoSize = 2 * 1024 * 1024 * 1024; // 2GB
    if (videoFile.size > maxVideoSize) {
      validations.push({
        isValid: false,
        message: "Video must be less than 2GB",
        type: 'error'
      });
    } else if (!videoFile.type.startsWith('video/')) {
      validations.push({
        isValid: false,
        message: "Video must be a video file",
        type: 'error'
      });
    } else {
      const sizeMB = videoFile.size / 1024 / 1024;
      const estimatedUploadTime = Math.ceil(sizeMB / 10); // Rough estimate: 10MB/min
      validations.push({
        isValid: true,
        message: `Video ready (${sizeMB.toFixed(1)}MB, ~${estimatedUploadTime}min upload)`,
        type: 'success'
      });
    }
  } else {
    validations.push({
      isValid: false,
      message: "Video file is required",
      type: 'error'
    });
  }

  const allValid = validations.every(v => v.isValid);
  const errorCount = validations.filter(v => !v.isValid).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-text-primary">Pre-upload Validation</h3>
        <div className={cn(
          "text-sm font-medium",
          allValid ? "text-green-500" : "text-destructive"
        )}>
          {allValid ? "All checks passed" : `${errorCount} issue${errorCount > 1 ? 's' : ''} found`}
        </div>
      </div>

      <div className="space-y-2">
        {validations.map((validation, index) => (
          <div 
            key={index}
            className={cn(
              "flex items-center gap-3 p-2 rounded text-sm",
              validation.type === 'success' && "text-green-600 bg-green-500/10",
              validation.type === 'error' && "text-destructive bg-destructive/10",
              validation.type === 'info' && "text-blue-600 bg-blue-500/10"
            )}
          >
            {validation.type === 'success' && <CheckCircle className="h-4 w-4 flex-shrink-0" />}
            {validation.type === 'error' && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
            {validation.type === 'info' && <Info className="h-4 w-4 flex-shrink-0" />}
            <span>{validation.message}</span>
          </div>
        ))}
      </div>

      {allValid && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="text-sm text-green-600 font-medium">✓ Ready to upload!</div>
          <div className="text-xs text-green-600/80 mt-1">
            All validation checks have passed. Your content is ready to be submitted.
          </div>
        </div>
      )}
    </div>
  );
}