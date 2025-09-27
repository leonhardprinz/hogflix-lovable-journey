import { useCallback, useState } from "react";
import { Upload, FileImage, FileVideo, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DragDropUploadProps {
  accept: string;
  onFileSelect: (file: File) => void;
  currentFile?: File | null;
  label: string;
  description: string;
  maxSize?: number; // in MB
  previewUrl?: string;
}

export default function DragDropUpload({ 
  accept, 
  onFileSelect, 
  currentFile, 
  label, 
  description,
  maxSize = 100,
  previewUrl
}: DragDropUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string>("");

  const validateFile = useCallback((file: File) => {
    const maxSizeBytes = maxSize * 1024 * 1024;
    
    if (file.size > maxSizeBytes) {
      setError(`File size must be less than ${maxSize}MB`);
      return false;
    }
    
    const acceptedTypes = accept.split(',').map(t => t.trim());
    const isValidType = acceptedTypes.some(type => {
      if (type === 'image/*') return file.type.startsWith('image/');
      if (type === 'video/*') return file.type.startsWith('video/');
      return file.type === type;
    });
    
    if (!isValidType) {
      setError(`File type not supported. Accepted: ${accept}`);
      return false;
    }
    
    setError("");
    return true;
  }, [accept, maxSize]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect, validateFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      onFileSelect(file);
    }
  }, [onFileSelect, validateFile]);

  const clearFile = useCallback(() => {
    onFileSelect(null as any);
    setError("");
  }, [onFileSelect]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-text-primary">{label}</label>
      
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer",
          isDragOver && "border-primary bg-primary/5",
          !isDragOver && !currentFile && "border-border hover:border-primary/50",
          currentFile && "border-green-500/50 bg-green-500/5",
          error && "border-destructive/50 bg-destructive/5"
        )}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onClick={() => !currentFile && document.getElementById(`file-input-${label}`)?.click()}
      >
        <input
          id={`file-input-${label}`}
          type="file"
          accept={accept}
          onChange={handleFileInput}
          className="hidden"
        />

        {currentFile ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentFile.type.startsWith('image/') ? (
                  <FileImage className="h-8 w-8 text-green-500" />
                ) : (
                  <FileVideo className="h-8 w-8 text-green-500" />
                )}
                <div>
                  <div className="font-medium text-text-primary text-sm">
                    {currentFile.name}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {formatFileSize(currentFile.size)}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {previewUrl && currentFile.type.startsWith('image/') && (
              <div className="mt-3">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-h-32 rounded border object-cover"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-3">
            <Upload className={cn(
              "h-12 w-12 mx-auto",
              isDragOver ? "text-primary" : "text-muted-foreground"
            )} />
            <div>
              <div className="font-medium text-text-primary">
                {isDragOver ? "Drop file here" : "Choose file or drag & drop"}
              </div>
              <div className="text-sm text-text-secondary mt-1">
                {description}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Max size: {maxSize}MB
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}