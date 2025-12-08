import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useVideoAnalytics } from "@/hooks/useVideoAnalytics";
import { DashboardCharts } from "@/components/admin/DashboardCharts";
import { VideoPerformanceTable } from "@/components/admin/VideoPerformanceTable";
import { VideoAnalyticsModal } from "@/components/admin/VideoAnalyticsModal";
import { VideoManagementGrid } from "@/components/admin/VideoManagementGrid";
import { TagManagementSection } from "@/components/admin/TagManagementSection";
import { RefreshCw, Video, Clock, TrendingUp, Users, Award, Loader2, CreditCard, Sparkles, Database } from "lucide-react";
import { CDPDemoControls } from "@/components/admin/CDPDemoControls";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function Admin() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [generatingSummaries, setGeneratingSummaries] = useState(false);
  const [summaryProgress, setSummaryProgress] = useState({ current: 0, total: 0, status: '' });

  const { data: dashboardStats, isLoading: statsLoading } = useDashboardStats();
  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics } = useVideoAnalytics();

  useEffect(() => {
    document.title = "Admin Panel – HogFlix";
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

  // Fetch subscriptions
  useEffect(() => {
    const fetchSubscriptions = async () => {
      if (role === 'admin' || role === 'moderator') {
        setLoadingSubscriptions(true);
        try {
          const { data, error } = await supabase
            .from('user_subscriptions')
            .select(`
              *,
              subscription_plans(*)
            `)
            .order('created_at', { ascending: false });

          if (error) throw error;
          setSubscriptions(data || []);
        } catch (error) {
          console.error('Error fetching subscriptions:', error);
        } finally {
          setLoadingSubscriptions(false);
        }
      }
    };

    if (!checkingRole) {
      fetchSubscriptions();
    }
  }, [role, checkingRole]);

  const handleRefreshAnalytics = async () => {
    try {
      toast.info("Refreshing analytics...");
      const { error } = await supabase.rpc('refresh_video_analytics');
      if (error) throw error;
      await refetchAnalytics();
      toast.success("Analytics refreshed successfully!");
    } catch (error) {
      console.error('Error refreshing analytics:', error);
      toast.error("Failed to refresh analytics");
    }
  };

  const handleGenerateAllSummaries = async () => {
    try {
      setGeneratingSummaries(true);
      setSummaryProgress({ current: 0, total: 0, status: 'Fetching videos...' });
      
      // Fetch all videos without summaries
      const { data: videos, error: fetchError } = await supabase
        .from('videos')
        .select('id, title, description, ai_summary')
        .is('ai_summary', null)
        .limit(50); // Limit to prevent overwhelming the API
      
      if (fetchError) throw fetchError;
      
      if (!videos || videos.length === 0) {
        toast.info("All videos already have AI summaries!");
        setGeneratingSummaries(false);
        return;
      }
      
      setSummaryProgress({ current: 0, total: videos.length, status: 'Generating summaries...' });
      
      let successCount = 0;
      let failCount = 0;
      
      // Generate summaries one by one
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        setSummaryProgress({
          current: i + 1,
          total: videos.length,
          status: `Processing: ${video.title}`
        });
        
        try {
          const { error: summaryError } = await supabase.functions.invoke('generate-video-summary', {
            body: {
              videoId: video.id,
              videoTitle: video.title,
              videoDescription: video.description || ''
            }
          });
          
          if (summaryError) {
            console.error(`Failed to generate summary for ${video.title}:`, summaryError);
            failCount++;
          } else {
            successCount++;
          }
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error generating summary for ${video.title}:`, error);
          failCount++;
        }
      }
      
      setSummaryProgress({ current: 0, total: 0, status: '' });
      
      if (successCount > 0) {
        toast.success(`Generated ${successCount} AI summaries!${failCount > 0 ? ` (${failCount} failed)` : ''}`);
      } else {
        toast.error(`Failed to generate summaries. Check console for details.`);
      }
      
    } catch (error) {
      console.error('Error generating summaries:', error);
      toast.error("Failed to generate summaries");
    } finally {
      setGeneratingSummaries(false);
      setSummaryProgress({ current: 0, total: 0, status: '' });
    }
  };

  const notAllowed = !checkingRole && role !== "admin" && role !== "moderator";

  const stats = {
    total: subscriptions.length,
    basic: subscriptions.filter(s => s.subscription_plans?.name === 'basic').length,
    standard: subscriptions.filter(s => s.subscription_plans?.name === 'standard').length,
    premium: subscriptions.filter(s => s.subscription_plans?.name === 'premium').length,
    revenue: subscriptions.reduce((sum, s) => sum + (Number(s.subscription_plans?.price_monthly) || 0), 0)
  };

  return (
    <div className="min-h-screen bg-background-dark">
      <Header />

      <main className="container-netflix py-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary font-manrope">Admin Dashboard</h1>
          {!notAllowed && !checkingRole && (
            <Button onClick={handleRefreshAnalytics} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh Analytics
            </Button>
          )}
        </div>

        {checkingRole ? (
          <div className="flex items-center gap-2 text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking access…
          </div>
        ) : notAllowed ? (
          <div className="max-w-2xl bg-card-background border border-gray-700 rounded p-6">
            <p className="text-text-primary font-manrope mb-2">You don't have access to the Admin Panel.</p>
            <p className="text-text-secondary font-manrope mb-4">
              This area is restricted to administrators and moderators only.
            </p>
            <a href="/submit-content">
              <Button variant="outline">Go to Submit Content</Button>
            </a>
          </div>
        ) : (
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="bg-card-background border border-gray-700">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="content-analytics">Content Analytics</TabsTrigger>
              <TabsTrigger value="video-management">Video Management</TabsTrigger>
              <TabsTrigger value="subscriptions">Users & Subscriptions</TabsTrigger>
              <TabsTrigger value="demo-controls" className="gap-1">
                <Database className="h-3 w-3" />
                Demo Controls
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-6">
              {statsLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                    <Card className="bg-card-background border-gray-700">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-text-secondary">Total Videos</CardTitle>
                        <Video className="h-4 w-4 text-text-secondary" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-text-primary">{dashboardStats?.totalVideos || 0}</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-card-background border-gray-700">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-text-secondary">Total Watch Time</CardTitle>
                        <Clock className="h-4 w-4 text-text-secondary" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-text-primary">{dashboardStats?.totalWatchTimeHours || 0}h</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-card-background border-gray-700">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-text-secondary">Avg Completion</CardTitle>
                        <TrendingUp className="h-4 w-4 text-text-secondary" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-text-primary">{dashboardStats?.avgCompletionRate || 0}%</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-card-background border-gray-700">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-text-secondary">Active Today</CardTitle>
                        <Users className="h-4 w-4 text-text-secondary" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-text-primary">{dashboardStats?.activeUsersToday || 0}</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-card-background border-gray-700">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-text-secondary">Top Category</CardTitle>
                        <Award className="h-4 w-4 text-text-secondary" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-lg font-bold text-text-primary truncate">{dashboardStats?.topCategory?.name || 'N/A'}</div>
                        <p className="text-xs text-text-secondary">{dashboardStats?.topCategory?.views || 0} views</p>
                      </CardContent>
                    </Card>
                  </div>

                  {analyticsData && analyticsData.length > 0 && (
                    <DashboardCharts analyticsData={analyticsData} />
                  )}
                </>
              )}
            </TabsContent>

            {/* Content Analytics Tab */}
            <TabsContent value="content-analytics" className="space-y-6">
              <Card className="bg-card-background border-gray-700">
                <CardHeader>
                  <CardTitle className="text-text-primary">Video Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : analyticsData && analyticsData.length > 0 ? (
                    <VideoPerformanceTable
                      data={analyticsData}
                      onVideoClick={setSelectedVideoId}
                    />
                  ) : (
                    <p className="text-center text-text-secondary py-8">
                      No analytics data available. Videos will appear here once users start watching.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Video Management Tab */}
            <TabsContent value="video-management" className="space-y-6">
              {/* AI Summary Generation Tool */}
              <Card className="bg-card-background border-gray-700">
                <CardHeader>
                  <CardTitle className="text-text-primary flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary-red" />
                    AI Summary Generation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-text-secondary text-sm">
                    Generate AI-powered summaries for all videos that don't have one yet. This will use the Lovable AI Gateway.
                  </p>
                  
                  {generatingSummaries && summaryProgress.total > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">
                          Progress: {summaryProgress.current} / {summaryProgress.total}
                        </span>
                        <span className="text-text-secondary">
                          {Math.round((summaryProgress.current / summaryProgress.total) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary-red transition-all duration-300"
                          style={{ width: `${(summaryProgress.current / summaryProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-text-secondary italic truncate">
                        {summaryProgress.status}
                      </p>
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleGenerateAllSummaries}
                    disabled={generatingSummaries}
                    className="gap-2"
                  >
                    {generatingSummaries ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Summaries...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate All AI Summaries
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
              
              <VideoManagementGrid />
              <Separator />
              <TagManagementSection />
            </TabsContent>

            {/* Users & Subscriptions Tab */}
            <TabsContent value="subscriptions" className="space-y-6">
              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <Card className="p-6 bg-card-background border-gray-700">
                  <div className="flex items-center gap-4">
                    <Users className="w-8 h-8 text-primary-red" />
                    <div>
                      <p className="text-sm text-text-secondary">Total Users</p>
                      <p className="text-2xl font-bold text-text-primary">{stats.total}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-card-background border-gray-700">
                  <div>
                    <p className="text-sm text-text-secondary mb-2">Basic</p>
                    <p className="text-2xl font-bold text-text-primary">{stats.basic}</p>
                  </div>
                </Card>

                <Card className="p-6 bg-card-background border-gray-700">
                  <div>
                    <p className="text-sm text-text-secondary mb-2">Standard</p>
                    <p className="text-2xl font-bold text-text-primary">{stats.standard}</p>
                  </div>
                </Card>

                <Card className="p-6 bg-card-background border-gray-700">
                  <div>
                    <p className="text-sm text-text-secondary mb-2">Premium</p>
                    <p className="text-2xl font-bold text-text-primary">{stats.premium}</p>
                  </div>
                </Card>
              </div>

              <Card className="p-6 bg-card-background border-gray-700 mb-6">
                <div className="flex items-center gap-4">
                  <CreditCard className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-sm text-text-secondary">Mock Monthly Revenue</p>
                    <p className="text-3xl font-bold text-text-primary">${stats.revenue.toFixed(2)}</p>
                  </div>
                </div>
              </Card>

              {loadingSubscriptions ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-red" />
                </div>
              ) : (
                <Card className="p-6 bg-card-background border-gray-700">
                  <h2 className="text-xl font-semibold text-text-primary font-manrope mb-4">User Subscriptions</h2>
                  <div className="space-y-4">
                    {subscriptions.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-4 border border-gray-700 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-text-primary">{sub.user_id.slice(0, 8)}...</p>
                          <p className="text-sm text-text-secondary">
                            Started: {new Date(sub.started_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                            {sub.subscription_plans?.display_name || 'Unknown'}
                          </Badge>
                          <Badge variant="outline">
                            ${sub.subscription_plans?.price_monthly || 0}/mo
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* Demo Controls Tab */}
            <TabsContent value="demo-controls" className="space-y-6">
              <CDPDemoControls userEmail={user?.email || null} />
              
              <Card className="bg-card-background border-gray-700">
                <CardHeader>
                  <CardTitle className="text-text-primary">Demo Flow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-text-secondary">
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Click <strong className="text-text-primary">"Sync CDP Data"</strong> to write R2 customer properties to PostHog</li>
                    <li>Go to <strong className="text-text-primary">Pricing page</strong> and click any Downgrade button to see the VIP retention modal</li>
                    <li>Go to <strong className="text-text-primary">Browse page</strong> to see the Power User badge</li>
                    <li>Return here and click <strong className="text-text-primary">"Clear CDP Data"</strong> to reset for another demo</li>
                  </ol>
                  <div className="pt-4 border-t border-gray-700">
                    <p className="text-xs">
                      <strong className="text-text-primary">Feature Flags Required:</strong>
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-xs font-mono">
                      <li><code className="text-primary-red">vip_retention_offer</code> → is_vip = true AND customer_health_score &lt; 50</li>
                      <li><code className="text-primary-red">power_user_early_access</code> → power_user_tier in [gold, platinum] AND videos_watched_external &gt; 100</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Video Analytics Modal */}
      <VideoAnalyticsModal
        videoId={selectedVideoId}
        onClose={() => setSelectedVideoId(null)}
      />
    </div>
  );
}
