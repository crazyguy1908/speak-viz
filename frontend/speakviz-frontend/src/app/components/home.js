"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
//comment
import {
  Mic,
  Target,
  Users,
  BarChart3,
  PlayCircle,
  CheckCircle,
  Star,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import "./home.css";

export default function SpeakVizLanding() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="svz-home-root">
      <header className="svz-home-header">
        <div className="svz-home-header-left">
          <div className="svz-home-logo">
            <Mic className="svz-home-logo-icon" />
          </div>
          <span className="svz-home-title">SpeakViz</span>
        </div>
        <div className="svz-home-header-right">
          {!loading &&
            (session ? (
              <Button
                className="svz-home-signup-btn"
                onClick={() => router.push("/recordings")}
              >
                My Recordings
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="svz-home-login-btn"
                  onClick={() => router.push("/signin")}
                >
                  Log In
                </Button>
                <Button
                  className="svz-home-signup-btn"
                  onClick={() => router.push("/signin")}
                >
                  Sign Up Free
                </Button>
              </>
            ))}
        </div>
      </header>

      <section className="svz-home-hero">
        <Badge className="svz-home-hero-badge">
          🎯 Advanced Speech Analytics for Everyone
        </Badge>

        <h1 className="svz-home-hero-title">
          Master Communication with{" "}
          <span className="svz-home-hero-title-highlight">
            AI-Powered Insights
          </span>
        </h1>

        <p className="svz-home-hero-desc">
          Real-time speech analysis, facial expression tracking, and
          personalized AI feedback to help you communicate with confidence.
          Perfect for speech therapy, communication coaching, and social skills
          development.
        </p>

        <div className="svz-home-hero-cta">
          {!loading &&
            (session ? (
              <>
                <Button
                  size="lg"
                  className="svz-home-hero-cta-btn"
                  onClick={() => router.push("/recorder")}
                >
                  <PlayCircle className="svz-home-hero-cta-icon" />
                  Start Recording
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="svz-home-hero-cta-btn-outline"
                  onClick={() => router.push("/recordings")}
                >
                  <BarChart3 className="svz-home-hero-cta-icon" />
                  View Recordings
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  className="svz-home-hero-cta-btn"
                  onClick={() => router.push("/signin")}
                >
                  <PlayCircle className="svz-home-hero-cta-icon" />
                  Start Free Trial
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="svz-home-hero-cta-btn-outline"
                  onClick={() => router.push("/signin")}
                >
                  <BarChart3 className="svz-home-hero-cta-icon" />
                  View Demo
                </Button>
              </>
            ))}
        </div>

        <div className="svz-home-hero-img-wrap">
          <div className="svz-home-hero-img-border">
            <div className="svz-home-hero-img-inner">
              <img
                src="/dashboard_picture.png"
                alt="SpeakViz Dashboard Preview"
                width={813}
                height={464}
                className="svz-home-hero-img"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="svz-home-features">
        <div className="svz-home-features-header">
          <h2 className="svz-home-features-title">
            Why Therapists Choose SpeakViz
          </h2>
          <p className="svz-home-features-desc">
            Powerful tools designed specifically for speech-language
            pathologists to deliver better outcomes for their clients.
          </p>
        </div>

        <div className="svz-home-features-cards">
          <Card className="svz-home-feature-card">
            <CardContent className="svz-home-feature-card-content">
              <div className="svz-home-feature-icon svz-home-feature-icon-blue">
                <Target className="svz-home-feature-icon-svg" />
              </div>
              <h3 className="svz-home-feature-title">Speech Analytics</h3>
              <p className="svz-home-feature-desc">
                Visualize your speech patterns with real-time line graphs
                tracking pitch, volume, and tempo. Get instant insights into
                your verbal communication style.
              </p>
            </CardContent>
          </Card>

          <Card className="svz-home-feature-card">
            <CardContent className="svz-home-feature-card-content">
              <div className="svz-home-feature-icon svz-home-feature-icon-purple">
                <BarChart3 className="svz-home-feature-icon-svg" />
              </div>
              <h3 className="svz-home-feature-title">Expression Analysis</h3>
              <p className="svz-home-feature-desc">
                Track facial expressions and gestures in real-time. Get feedback
                on emotional conveyance and body language to enhance your
                non-verbal communication.
              </p>
            </CardContent>
          </Card>

          <Card className="svz-home-feature-card">
            <CardContent className="svz-home-feature-card-content">
              <div className="svz-home-feature-icon svz-home-feature-icon-green">
                <Users className="svz-home-feature-icon-svg" />
              </div>
              <h3 className="svz-home-feature-title">AI Coaching</h3>
              <p className="svz-home-feature-desc">
                Receive personalized feedback and practice cues from our AI
                system. Practice with role-play scenarios and track your
                progress over time.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="svz-home-benefits">
        <div className="svz-home-benefits-inner">
          <div className="svz-home-benefits-content">
            <h2 className="svz-home-benefits-title">
              Proven Results That Matter
            </h2>
            <p className="svz-home-benefits-desc">
              Join thousands of speech therapists who have transformed their
              practice with SpeakViz's innovative approach to therapy.
            </p>

            <div className="svz-home-benefits-list">
              <div className="svz-home-benefit-item">
                <CheckCircle className="svz-home-benefit-icon" />
                <span className="svz-home-benefit-text">
                  Real-time speech visualization and analytics
                </span>
              </div>
              <div className="svz-home-benefit-item">
                <CheckCircle className="svz-home-benefit-icon" />
                <span className="svz-home-benefit-text">
                  Facial expression and gesture tracking
                </span>
              </div>
              <div className="svz-home-benefit-item">
                <CheckCircle className="svz-home-benefit-icon" />
                <span className="svz-home-benefit-text">
                  AI-powered feedback and practice scenarios
                </span>
              </div>
              <div className="svz-home-benefit-item">
                <CheckCircle className="svz-home-benefit-icon" />
                <span className="svz-home-benefit-text">
                  Comprehensive progress tracking and reporting
                </span>
              </div>
            </div>

            {!loading && (
              <Button
                size="lg"
                className="svz-home-benefits-cta"
                onClick={() =>
                  session ? router.push("/recorder") : router.push("/signin")
                }
              >
                {session ? "Start Recording" : "Get Started Today"}
                <ArrowRight className="svz-home-benefits-cta-icon" />
              </Button>
            )}
          </div>

          <div className="svz-home-benefits-img-wrap">
            <img
              src="/other_image.png"
              alt="Speech therapist using SpeakViz with client"
              width={750}
              height={383}
              className="svz-home-benefits-img"
            />
          </div>
        </div>
      </section>

      <section className="svz-home-features-grid">
        <div className="svz-home-features-grid-header">
          <h2 className="svz-home-features-grid-title">
            Powerful Features for Better Communication
          </h2>
          <p className="svz-home-features-grid-desc">
            Advanced analytics and real-time feedback to enhance your speaking
            skills
          </p>
        </div>

        <div className="svz-home-features-grid-cards">
          <Card className="svz-home-feature-grid-card">
            <CardContent className="svz-home-feature-grid-content">
              <div className="svz-home-feature-grid-icon svz-home-feature-icon-blue">
                <BarChart3 className="svz-home-feature-grid-icon-svg" />
              </div>
              <h3 className="svz-home-feature-grid-title">
                Speech Speed Analysis
              </h3>
              <p className="svz-home-feature-grid-desc">
                Real-time tracking of words per minute and speech pacing to help
                you maintain the perfect speaking tempo
              </p>
            </CardContent>
          </Card>

          <Card className="svz-home-feature-grid-card">
            <CardContent className="svz-home-feature-grid-content">
              <div className="svz-home-feature-grid-icon svz-home-feature-icon-purple">
                <Target className="svz-home-feature-grid-icon-svg" />
              </div>
              <h3 className="svz-home-feature-grid-title">Emotion Detection</h3>
              <p className="svz-home-feature-grid-desc">
                Advanced AI analysis of your emotional tone and delivery style
                during presentations
              </p>
            </CardContent>
          </Card>

          <Card className="svz-home-feature-grid-card">
            <CardContent className="svz-home-feature-grid-content">
              <div className="svz-home-feature-grid-icon svz-home-feature-icon-green">
                <Users className="svz-home-feature-grid-icon-svg" />
              </div>
              <h3 className="svz-home-feature-grid-title">Face Analysis</h3>
              <p className="svz-home-feature-grid-desc">
                Real-time tracking of facial expressions and head movements to
                improve your visual engagement
              </p>
            </CardContent>
          </Card>

          <Card className="svz-home-feature-grid-card">
            <CardContent className="svz-home-feature-grid-content">
              <div className="svz-home-feature-grid-icon svz-home-feature-icon-red">
                <PlayCircle className="svz-home-feature-grid-icon-svg" />
              </div>
              <h3 className="svz-home-feature-grid-title">Volume Metrics</h3>
              <p className="svz-home-feature-grid-desc">
                Precise measurement of voice loudness and emphasis patterns to
                perfect your vocal dynamics
              </p>
            </CardContent>
          </Card>

          <Card className="svz-home-feature-grid-card">
            <CardContent className="svz-home-feature-grid-content">
              <div className="svz-home-feature-grid-icon svz-home-feature-icon-yellow">
                <CheckCircle className="svz-home-feature-grid-icon-svg" />
              </div>
              <h3 className="svz-home-feature-grid-title">
                Smart Recommendations
              </h3>
              <p className="svz-home-feature-grid-desc">
                Context-aware AI feedback for different speaking scenarios like
                presentations, interviews, and lectures
              </p>
            </CardContent>
          </Card>

          <Card className="svz-home-feature-grid-card">
            <CardContent className="svz-home-feature-grid-content">
              <div className="svz-home-feature-grid-icon svz-home-feature-icon-teal">
                <Star className="svz-home-feature-grid-icon-svg" />
              </div>
              <h3 className="svz-home-feature-grid-title">Pause Analysis</h3>
              <p className="svz-home-feature-grid-desc">
                Detailed insights into your speech pauses and pacing to improve
                your natural flow and timing
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="svz-home-cta">
        <div className="svz-home-cta-inner">
          <div className="svz-home-cta-content">
            <h2 className="svz-home-cta-title">
              Ready to Transform Your Speaking?
            </h2>
            <p className="svz-home-cta-desc">
              Join thousands of users who are already seeing better outcomes
              with SpeakViz.
            </p>

            <p className="svz-home-cta-footnote">
              ✓ No hidden fees ✓ Cancel at anytime ✓ Full support included
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
