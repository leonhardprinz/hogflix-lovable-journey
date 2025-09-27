import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Plus, Sparkles } from "lucide-react";
import UploadProgress, { UploadStep } from "@/components/upload/UploadProgress";
import DragDropUpload from "@/components/upload/DragDropUpload";
import FileValidation from "@/components/upload/FileValidation";

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export default function SubmitContent() {
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  
  // Enhanced upload state
  const [currentStep, setCurrentStep] = useState<UploadStep>('validation');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string>("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");

  const videoProbeRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.title = "Submit Content – HogFlix";
  }, []);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order");
      if (error) {
        console.error("Error loading categories", error);
        toast({ title: "Failed to load categories", description: error.message });
      } else {
        setCategories(data || []);
      }
      setLoadingCategories(false);
    };
    fetchCategories();
  }, [toast]);

  // Auto-detect duration from selected video file
  useEffect(() => {
    if (!videoFile || !videoProbeRef.current) return;
    const videoEl = videoProbeRef.current;
    const url = URL.createObjectURL(videoFile);
    videoEl.src = url;
    const onLoaded = () => {
      if (!isNaN(videoEl.duration)) {
        setDuration(Math.floor(videoEl.duration));
      }
      URL.revokeObjectURL(url);
    };
    videoEl.addEventListener("loadedmetadata", onLoaded);
    return () => {
      videoEl.removeEventListener("loadedmetadata", onLoaded);
      URL.revokeObjectURL(url);
    };
  }, [videoFile]);

  // Create thumbnail preview
  useEffect(() => {
    if (thumbnailFile) {
      const url = URL.createObjectURL(thumbnailFile);
      setThumbnailPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setThumbnailPreview("");
    }
  }, [thumbnailFile]);

  const canSubmit = useMemo(() => {
    return (
      !!title.trim() &&
      (!!categoryId || !!newCategoryName.trim()) &&
      !!thumbnailFile &&
      !!videoFile &&
      !submitting
    );
  }, [title, categoryId, newCategoryName, thumbnailFile, videoFile, submitting]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    // Simple sort order: after last
    const maxSort = categories.reduce((acc, c) => Math.max(acc, c.sort_order), 0);
    const { data, error } = await supabase
      .from("categories")
      .insert({ name: newCategoryName.trim(), sort_order: maxSort + 1 })
      .select("*")
      .single();
    setCreatingCategory(false);
    if (error) {
      toast({ title: "Failed to create category", description: error.message });
      return;
    }
    setCategories((prev) => [...prev, data]);
    setCategoryId(data.id);
    setNewCategoryName("");
    toast({ title: "Category created", description: `Added "${data.name}".` });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setUploadError("");
    setCurrentStep('validation');
    setUploadProgress(0);

    try {
      // Step 1: Validation
      setCurrentStep('validation');
      setUploadProgress(10);
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UX
      
      let chosenCategoryId = categoryId;
      if (!chosenCategoryId && newCategoryName.trim()) {
        const maxSort = categories.reduce((acc, c) => Math.max(acc, c.sort_order), 0);
        const { data: cat, error: catErr } = await supabase
          .from("categories")
          .insert({ name: newCategoryName.trim(), sort_order: maxSort + 1 })
          .select("*")
          .single();
        if (catErr) throw catErr;
        chosenCategoryId = cat.id;
        setCategories((prev) => [...prev, cat!]);
      }

      if (!thumbnailFile || !videoFile) throw new Error("Missing files");
      const id = crypto.randomUUID();

      // Step 2: Upload thumbnail
      setCurrentStep('thumbnail-upload');
      setUploadProgress(25);
      const thumbPath = `thumbnails/${id}-${thumbnailFile.name}`;
      const { error: thumbErr } = await supabase.storage
        .from("video-thumbnails")
        .upload(thumbPath, thumbnailFile, { 
          upsert: true, 
          cacheControl: "3600"
        });
      if (thumbErr) throw thumbErr;
      
      const { data: pubThumb } = supabase.storage
        .from("video-thumbnails")
        .getPublicUrl(thumbPath);
      const thumbnailUrl = pubThumb.publicUrl;
      setUploadProgress(40);

      // Step 3: Upload video with progress simulation
      setCurrentStep('video-upload');
      const videoPath = `originals/${id}-${videoFile.name}`;
      
      // Simulate progress during upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 2, 85));
      }, 200);
      
      const { error: videoErr } = await supabase.storage
        .from("videos")
        .upload(videoPath, videoFile, { upsert: true });
      
      clearInterval(progressInterval);
      if (videoErr) throw videoErr;

      // Step 4: Processing and database insertion
      setCurrentStep('processing');
      setUploadProgress(90);
      
      const { error: insertErr } = await supabase.from("videos").insert({
        title: title.trim(),
        description: description.trim() || null,
        category_id: chosenCategoryId,
        duration: duration || 0,
        thumbnail_url: thumbnailUrl,
        video_url: videoPath,
      });
      if (insertErr) throw insertErr;

      // Step 5: Complete
      setCurrentStep('complete');
      setUploadProgress(100);
      
      toast({ 
        title: "🎉 Content submitted successfully!", 
        description: `${title} is now live and available for streaming.` 
      });
      
      // Reset form after brief success display
      setTimeout(() => {
        setTitle("");
        setDescription("");
        setCategoryId("");
        setNewCategoryName("");
        setThumbnailFile(null);
        setVideoFile(null);
        setDuration(0);
        setCurrentStep('validation');
        setUploadProgress(0);
      }, 2000);
      
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Unexpected error occurred");
      toast({ 
        title: "Upload failed", 
        description: err.message || "Please try again or contact support if the issue persists." 
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark">
      <Header />

      <main className="container-netflix py-10">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary font-manrope mb-6">Submit Content</h1>
        <p className="text-text-secondary font-manrope mb-8 max-w-2xl">
          Share your favorite movies with the HogFlix community. Upload videos and help build our content library.
        </p>

        <section aria-labelledby="upload-movie" className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Main Upload Form */}
            <div className="bg-card-background border border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="h-6 w-6 text-primary" />
                <h2 id="upload-movie" className="text-xl font-semibold text-text-primary font-manrope">
                  Upload Content
                </h2>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input 
                      id="title" 
                      value={title} 
                      onChange={(e) => setTitle(e.target.value)} 
                      placeholder="Enter your content title"
                      className="mt-2"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea 
                      id="description" 
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)} 
                      placeholder="Describe your content (optional but recommended)"
                      rows={3}
                      className="mt-2"
                      disabled={submitting}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Category *</Label>
                      <div className="flex gap-2 mt-2">
                        <Select value={categoryId} onValueChange={setCategoryId} disabled={submitting}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={loadingCategories ? "Loading…" : "Select category"} />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="newCat">Or create new category</Label>
                      <div className="flex gap-2 mt-2">
                        <Input 
                          id="newCat" 
                          value={newCategoryName} 
                          onChange={(e) => setNewCategoryName(e.target.value)} 
                          placeholder="New category name"
                          disabled={submitting}
                        />
                        <Button 
                          type="button" 
                          onClick={handleCreateCategory} 
                          disabled={!newCategoryName.trim() || creatingCategory || submitting}
                          size="sm"
                        >
                          {creatingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced File Upload Areas */}
                <div className="grid md:grid-cols-2 gap-6">
                  <DragDropUpload
                    accept="image/*"
                    onFileSelect={setThumbnailFile}
                    currentFile={thumbnailFile}
                    label="Thumbnail Image *"
                    description="JPG, PNG up to 5MB"
                    maxSize={5}
                    previewUrl={thumbnailPreview}
                  />
                  
                  <DragDropUpload
                    accept="video/*"
                    onFileSelect={setVideoFile}
                    currentFile={videoFile}
                    label="Video File *"
                    description="MP4, MOV, AVI up to 2GB"
                    maxSize={2048}
                  />
                </div>

                {videoFile && (
                  <div className="flex items-center gap-3 text-text-secondary text-sm bg-muted/20 p-3 rounded">
                    <video ref={videoProbeRef} className="hidden" />
                    <span>⏱️ Detected duration: {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, "0")}</span>
                  </div>
                )}

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={!canSubmit}
                    className="w-full md:w-auto px-8"
                    size="lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 
                        {currentStep === 'validation' && "Validating..."}
                        {currentStep === 'thumbnail-upload' && "Uploading thumbnail..."}
                        {currentStep === 'video-upload' && "Uploading video..."}
                        {currentStep === 'processing' && "Processing..."}
                        {currentStep === 'complete' && "Complete!"}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" /> Submit Content
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Upload Progress (shown when uploading) */}
            {submitting && (
              <div className="bg-card-background border border-gray-700 rounded-lg p-6">
                <UploadProgress 
                  currentStep={currentStep}
                  progress={uploadProgress}
                  error={uploadError}
                />
              </div>
            )}

            {/* File Validation */}
            {!submitting && (
              <div className="bg-card-background border border-gray-700 rounded-lg p-6">
                <FileValidation
                  thumbnailFile={thumbnailFile}
                  videoFile={videoFile}
                  title={title}
                  category={categoryId || newCategoryName}
                />
              </div>
            )}
          </div>

          <aside className="bg-card-background border border-gray-700 rounded p-6">
            <h2 className="text-xl font-semibold text-text-primary font-manrope mb-2">Community Guidelines</h2>
            <ul className="list-disc list-inside text-text-secondary space-y-2">
              <li>Only upload content you have rights to share.</li>
              <li>Submitted content may be reviewed by moderators.</li>
              <li>Thumbnails are public; videos are private and streamed securely.</li>
              <li>Choose appropriate categories to help others discover your content.</li>
            </ul>
          </aside>
        </section>
      </main>
    </div>
  );
}