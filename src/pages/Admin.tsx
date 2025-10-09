import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Users, CreditCard } from "lucide-react";

export default function Admin() {
  const { toast } = useToast();
  const [role, setRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
          setLoading(false);
        }
      }
    };

    if (!checkingRole) {
      fetchSubscriptions();
    }
  }, [role, checkingRole]);

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
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary font-manrope mb-6">Admin Panel</h1>

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
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-card-background border border-gray-700">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid md:grid-cols-4 gap-4">
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

              <Card className="p-6 bg-card-background border-gray-700">
                <div className="flex items-center gap-4">
                  <CreditCard className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-sm text-text-secondary">Mock Monthly Revenue</p>
                    <p className="text-3xl font-bold text-text-primary">${stats.revenue.toFixed(2)}</p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="subscriptions">
              {loading ? (
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
          </Tabs>
        )}
      </main>
    </div>
  );
}