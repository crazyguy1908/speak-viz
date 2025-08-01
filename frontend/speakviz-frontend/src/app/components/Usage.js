"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, AlertCircle, CheckCircle, Infinity } from "lucide-react";
import "./Usage.css";

export default function Usage() {
  const [usageInfo, setUsageInfo] = useState({
    current: 0,
    limit: 10,
    bypassed: false,
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const checkUsageLimits = async (user) => {
    if (!user) return;

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("usage_limit_bypassed")
        .eq("id", user.id)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        console.error("Error fetching profile:", profileError);
      }

      const bypassed = profile?.usage_limit_bypassed || false;

      const { count, error: countError } = await supabase
        .from("videos")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (countError) {
        console.error("Error counting videos:", countError);
        return;
      }

      const current = count || 0;
      setUsageInfo({ current, limit: 10, bypassed });
      setLoading(false);
    } catch (error) {
      console.error("Error checking usage limits:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        checkUsageLimits(user);
      } else {
        setLoading(false);
      }
    };
    getUser();
  }, []);

  if (loading) return <div>Loading...</div>;

  const usagePercentage = (usageInfo.current / usageInfo.limit) * 100;
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = usagePercentage >= 100;

  return (
    <div className="svz-usage-container">
      <div className="svz-usage-header">
        <h1 className="svz-usage-title">Usage & Limits</h1>
        <p className="svz-usage-subtitle">
          Track your video recording usage and account limits
        </p>
      </div>

      <div className="svz-usage-content">
        <Card className="svz-usage-card">
          <CardContent className="svz-usage-card-content">
            <div className="svz-usage-stats">
              <div className="svz-usage-stat">
                <div className="svz-usage-stat-icon">
                  <BarChart3 className="svz-usage-icon" />
                </div>
                <div className="svz-usage-stat-info">
                  <h3 className="svz-usage-stat-title">Videos Created</h3>
                  <p className="svz-usage-stat-value">
                    {usageInfo.current} / {usageInfo.limit}
                    {usageInfo.bypassed && (
                      <span className="svz-usage-unlimited-badge">
                        <Infinity className="svz-usage-infinity-icon" />
                        Unlimited
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="svz-usage-progress">
                <div className="svz-usage-progress-bar">
                  <div
                    className={`svz-usage-progress-fill ${
                      isNearLimit ? "svz-usage-progress-warning" : ""
                    } ${isAtLimit ? "svz-usage-progress-danger" : ""}`}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  ></div>
                </div>
                <p className="svz-usage-progress-text">
                  {Math.round(usagePercentage)}% used
                </p>
              </div>

              {usageInfo.bypassed ? (
                <div className="svz-usage-status svz-usage-status-unlimited">
                  <CheckCircle className="svz-usage-status-icon" />
                  <span>Unlimited Access</span>
                </div>
              ) : isAtLimit ? (
                <div className="svz-usage-status svz-usage-status-limit">
                  <AlertCircle className="svz-usage-status-icon" />
                  <span>Limit Reached</span>
                </div>
              ) : isNearLimit ? (
                <div className="svz-usage-status svz-usage-status-warning">
                  <AlertCircle className="svz-usage-status-icon" />
                  <span>Near Limit</span>
                </div>
              ) : (
                <div className="svz-usage-status svz-usage-status-ok">
                  <CheckCircle className="svz-usage-status-icon" />
                  <span>Within Limits</span>
                </div>
              )}
            </div>

            <div className="svz-usage-actions">
              <Button
                onClick={() => router.push("/recorder")}
                className="svz-usage-record-btn"
                disabled={!usageInfo.bypassed && isAtLimit}
              >
                New Recording
              </Button>
              <Button
                onClick={() => router.push("/recordings")}
                variant="outline"
                className="svz-usage-view-btn"
              >
                View Recordings
              </Button>
            </div>

            {!usageInfo.bypassed && isAtLimit && (
              <div className="svz-usage-limit-notice">
                <AlertCircle className="svz-usage-notice-icon" />
                <div>
                  <h4>Limit Reached</h4>
                  <p>
                    You've reached your limit of {usageInfo.limit} videos.
                    Contact support to upgrade your account for unlimited
                    access.
                  </p>
                </div>
              </div>
            )}

            {!usageInfo.bypassed && isNearLimit && !isAtLimit && (
              <div className="svz-usage-warning-notice">
                <AlertCircle className="svz-usage-notice-icon" />
                <div>
                  <h4>Approaching Limit</h4>
                  <p>
                    You're close to your limit. Consider deleting old recordings
                    or contact support to upgrade your account.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
