import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload, Plus } from "lucide-react";

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export default function Admin() {
  const { toast } = useToast();
  const [role, setRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

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

  const videoProbeRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    document.title = "Admin – HogFlix Content Manager";
  }, []);

  // Fetch role
  useEffect(() => {
    const run = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.user) {
          setCheckingRole(false);
          return;
        }
        const { data, error } = await (supabase as any).rpc("get_user_role");
        if (error) {
          console.error("get_user_role error", error);
        } else {
          setRole((data as string) || null);
        }
      } finally {
        setCheckingRole(false);
      }
    };
    run();
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

  const canSubmit = useMemo(() => {
    return (
      !!title.trim() &&
      (!!categoryId || !!newCategoryName.trim()) &&
      !!thumbnailFile &&
      !!videoFile
    );
  }, [title, categoryId, newCategoryName, thumbnailFile, videoFile]);

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
    toast({ title: "Category created", description: `Added “${data.name}”.` });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      let chosenCategoryId = categoryId;
      if (!chosenCategoryId && newCategoryName.trim()) {
        // Create category inline if not already created via button
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

      // 1) Upload thumbnail to public bucket
      const thumbPath = `thumbnails/${id}-${thumbnailFile.name}`;
      const { error: thumbErr } = await supabase.storage
        .from("video-thumbnails")
        .upload(thumbPath, thumbnailFile, { upsert: true, cacheControl: "3600" });
      if (thumbErr) throw thumbErr;
      const { data: pubThumb } = supabase.storage
        .from("video-thumbnails")
        .getPublicUrl(thumbPath);
      const thumbnailUrl = pubThumb.publicUrl;

      // 2) Upload original video to private bucket
      const videoPath = `originals/${id}-${videoFile.name}`;
      const { error: videoErr } = await supabase.storage
        .from("videos")
        .upload(videoPath, videoFile, { upsert: true });
      if (videoErr) throw videoErr;

      // 3) Insert into videos table
      const { error: insertErr } = await supabase.from("videos").insert({
        title: title.trim(),
        description: description.trim() || null,
        category_id: chosenCategoryId,
        duration: duration || 0,
        thumbnail_url: thumbnailUrl,
        video_url: videoPath,
      });
      if (insertErr) throw insertErr;

      toast({ title: "Movie added", description: `${title} uploaded successfully.` });
      // reset form
      setTitle("");
      setDescription("");
      setCategoryId("");
      setNewCategoryName("");
      setThumbnailFile(null);
      setVideoFile(null);
      setDuration(0);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Failed to add movie", description: err.message || "Unexpected error" });
    } finally {
      setSubmitting(false);
    }
  };

  const notAllowed = !checkingRole && role !== "admin" && role !== "moderator";

  return (
    <div className="min-h-screen bg-background-dark">
      <Header />

      <main className="container-netflix py-10">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary font-manrope mb-6">Admin: Add Movies</h1>

        {checkingRole ? (
          <div className="flex items-center gap-2 text-text-secondary"><Loader2 className="h-4 w-4 animate-spin" /> Checking access…</div>
        ) : notAllowed ? (
          <div className="max-w-2xl bg-card-background border border-gray-700 rounded p-6">
            <p className="text-text-primary font-manrope mb-2">You don’t have access to the Admin area.</p>
            <p className="text-text-secondary font-manrope mb-4">Ask an admin to grant you moderator/admin role, or use Support to submit content ideas.</p>
            <a href="/support"><Button variant="outline">Go to Support</Button></a>
          </div>
        ) : (
          <section aria-labelledby="upload-movie" className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 bg-card-background border border-gray-700 rounded p-6">
              <h2 id="upload-movie" className="text-xl font-semibold text-text-primary font-manrope mb-4">Upload Movie</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Movie title" />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" rows={4} />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <div className="flex gap-2">
                      <Select value={categoryId} onValueChange={setCategoryId}>
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
                    <Label htmlFor="newCat">Or create new</Label>
                    <div className="flex gap-2">
                      <Input id="newCat" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" />
                      <Button type="button" onClick={handleCreateCategory} disabled={!newCategoryName.trim() || creatingCategory}>
                        {creatingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="thumb">Thumbnail (JPG/PNG)</Label>
                    <Input id="thumb" type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)} />
                  </div>
                  <div>
                    <Label htmlFor="video">Video (MP4/HLS)</Label>
                    <Input id="video" type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-text-secondary">
                  <video ref={videoProbeRef} className="hidden" />
                  <span>Detected duration: {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, "0")}</span>
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={!canSubmit || submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" /> Add Movie
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>

            <aside className="bg-card-background border border-gray-700 rounded p-6">
              <h2 className="text-xl font-semibold text-text-primary font-manrope mb-2">Tips</h2>
              <ul className="list-disc list-inside text-text-secondary space-y-2">
                <li>Thumbnails are public; videos are private and streamed via signed URLs.</li>
                <li>You can organize content by categories; drag/drop sorting coming soon.</li>
                <li>For HLS, upload an HLS playlist to Storage and link as a video asset later.</li>
              </ul>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}
