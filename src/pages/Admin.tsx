import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

export default function Admin() {
  const { toast } = useToast();
  const [role, setRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

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

  const notAllowed = !checkingRole && role !== "admin" && role !== "moderator";

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
          <div className="bg-card-background border border-gray-700 rounded p-6">
            <h2 className="text-xl font-semibold text-text-primary font-manrope mb-4">
              Administration Tools
            </h2>
            <p className="text-text-secondary font-manrope mb-4">
              Administrative features will be added here. For now, you can manage content through the database directly.
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-text-primary font-manrope mb-2">Quick Actions</h3>
                <p className="text-text-secondary text-sm">
                  More admin features like user management, content moderation, and analytics will be added in future updates.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}