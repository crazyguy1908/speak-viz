
"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, Target, Users, BarChart3, PlayCircle, CheckCircle, Star, ArrowRight } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation";
import './home.css';

export default function SpeakVizLanding() {
  const router = useRouter();
  return (
    <div className="svz-home-root">
      {/* Header with Login/Signup */}
      <header className="svz-home-header">
        <div className="svz-home-header-left">
          <div className="svz-home-logo">
            <Mic className="svz-home-logo-icon" />
          </div>
          <span className="svz-home-title">
            SpeakViz
          </span>
        </div>
        <div className="svz-home-header-right">
          <Button variant="ghost" className="svz-home-login-btn" onClick={() => router.push('/signin')}>
            Log In
          </Button>
          <Button className="svz-home-signup-btn" onClick={() => router.push('/signin')}>
            Sign Up Free
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="svz-home-hero">
        <Badge className="svz-home-hero-badge">
          🎯 Trusted by 10,000+ Speech Therapists
        </Badge>

        <h1 className="svz-home-hero-title">
          Transform Speech Therapy with{" "}
          <span className="svz-home-hero-title-highlight">
            Visual Intelligence
          </span>
        </h1>

        <p className="svz-home-hero-desc">
          Empower your clients with cutting-edge visualization tools that make speech therapy more engaging, effective,
          and measurable. See progress like never before.
        </p>

        <div className="svz-home-hero-cta">
          <Button
            size="lg"
            className="svz-home-hero-cta-btn"
            onClick={() => router.push('/signin')}
          >
            <PlayCircle className="svz-home-hero-cta-icon" />
            Start Free Trial
          </Button>
          <Button size="lg" variant="outline" className="svz-home-hero-cta-btn-outline" onClick={() => router.push('/signin')}>
            <BarChart3 className="svz-home-hero-cta-icon" />
            View Demo
          </Button>
        </div>

        {/* Hero Image */}
        <div className="svz-home-hero-img-wrap">
          <div className="svz-home-hero-img-border">
            <div className="svz-home-hero-img-inner">
              <Image
                src="/placeholder.svg?height=400&width=800"
                alt="SpeakViz Dashboard Preview"
                width={800}
                height={400}
                className="svz-home-hero-img"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="svz-home-features">
        <div className="svz-home-features-header">
          <h2 className="svz-home-features-title">Why Therapists Choose SpeakViz</h2>
          <p className="svz-home-features-desc">
            Powerful tools designed specifically for speech-language pathologists to deliver better outcomes for their
            clients.
          </p>
        </div>

        <div className="svz-home-features-cards">
          <Card className="svz-home-feature-card">
            <CardContent className="svz-home-feature-card-content">
              <div className="svz-home-feature-icon svz-home-feature-icon-blue">
                <Target className="svz-home-feature-icon-svg" />
              </div>
              <h3 className="svz-home-feature-title">Real-Time Feedback</h3>
              <p className="svz-home-feature-desc">
                Instant visual feedback helps clients understand their speech patterns and make corrections in
                real-time, accelerating progress.
              </p>
            </CardContent>
          </Card>

          <Card className="svz-home-feature-card">
            <CardContent className="svz-home-feature-card-content">
              <div className="svz-home-feature-icon svz-home-feature-icon-purple">
                <BarChart3 className="svz-home-feature-icon-svg" />
              </div>
              <h3 className="svz-home-feature-title">Progress Tracking</h3>
              <p className="svz-home-feature-desc">
                Comprehensive analytics and reporting tools that make it easy to track client progress and share results
                with families.
              </p>
            </CardContent>
          </Card>

          <Card className="svz-home-feature-card">
            <CardContent className="svz-home-feature-card-content">
              <div className="svz-home-feature-icon svz-home-feature-icon-green">
                <Users className="svz-home-feature-icon-svg" />
              </div>
              <h3 className="svz-home-feature-title">Client Engagement</h3>
              <p className="svz-home-feature-desc">
                Gamified exercises and interactive visualizations keep clients motivated and engaged throughout their
                therapy journey.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="svz-home-benefits">
        <div className="svz-home-benefits-inner">
          <div className="svz-home-benefits-content">
            <h2 className="svz-home-benefits-title">Proven Results That Matter</h2>
            <p className="svz-home-benefits-desc">
              Join thousands of speech therapists who have transformed their practice with SpeakViz's innovative
              approach to therapy.
            </p>

            <div className="svz-home-benefits-list">
              <div className="svz-home-benefit-item">
                <CheckCircle className="svz-home-benefit-icon" />
                <span className="svz-home-benefit-text">40% faster client progress on average</span>
              </div>
              <div className="svz-home-benefit-item">
                <CheckCircle className="svz-home-benefit-icon" />
                <span className="svz-home-benefit-text">95% client satisfaction rate</span>
              </div>
              <div className="svz-home-benefit-item">
                <CheckCircle className="svz-home-benefit-icon" />
                <span className="svz-home-benefit-text">Save 3+ hours per week on documentation</span>
              </div>
              <div className="svz-home-benefit-item">
                <CheckCircle className="svz-home-benefit-icon" />
                <span className="svz-home-benefit-text">HIPAA compliant and secure</span>
              </div>
            </div>

            <Button size="lg" className="svz-home-benefits-cta" onClick={() => router.push('/signin')}>
              Get Started Today
              <ArrowRight className="svz-home-benefits-cta-icon" />
            </Button>
          </div>

          <div className="svz-home-benefits-img-wrap">
            <Image
              src="/placeholder.svg?height=500&width=600"
              alt="Speech therapist using SpeakViz with client"
              width={600}
              height={500}
              className="svz-home-benefits-img"
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="svz-home-testimonials">
        <div className="svz-home-testimonials-header">
          <h2 className="svz-home-testimonials-title">Loved by Speech Therapists Everywhere</h2>
          <p className="svz-home-testimonials-desc">See what professionals are saying about SpeakViz</p>
        </div>

        <div className="svz-home-testimonials-cards">
          <Card className="svz-home-testimonial-card">
            <CardContent className="svz-home-testimonial-card-content">
              <div className="svz-home-testimonial-stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="svz-home-testimonial-star" />
                ))}
              </div>
              <p className="svz-home-testimonial-quote">
                "SpeakViz has completely transformed how I work with my clients. The visual feedback is incredible and
                my clients are more engaged than ever."
              </p>
              <div className="svz-home-testimonial-user">
                <div className="svz-home-testimonial-avatar svz-home-testimonial-avatar-blue">
                  <span className="svz-home-testimonial-avatar-text">SM</span>
                </div>
                <div>
                  <p className="svz-home-testimonial-user-name">Sarah Martinez</p>
                  <p className="svz-home-testimonial-user-title">Pediatric SLP, Austin TX</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="svz-home-testimonial-card">
            <CardContent className="svz-home-testimonial-card-content">
              <div className="svz-home-testimonial-stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="svz-home-testimonial-star" />
                ))}
              </div>
              <p className="svz-home-testimonial-quote">
                "The progress tracking features are amazing. Parents love seeing the detailed reports, and it's made my
                documentation so much easier."
              </p>
              <div className="svz-home-testimonial-user">
                <div className="svz-home-testimonial-avatar svz-home-testimonial-avatar-green">
                  <span className="svz-home-testimonial-avatar-text">DJ</span>
                </div>
                <div>
                  <p className="svz-home-testimonial-user-name">Dr. James Wilson</p>
                  <p className="svz-home-testimonial-user-title">Clinical SLP, Seattle WA</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="svz-home-testimonial-card">
            <CardContent className="svz-home-testimonial-card-content">
              <div className="svz-home-testimonial-stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="svz-home-testimonial-star" />
                ))}
              </div>
              <p className="svz-home-testimonial-quote">
                "I've tried many therapy apps, but SpeakViz is in a league of its own. The visual components make
                complex concepts so much easier to understand."
              </p>
              <div className="svz-home-testimonial-user">
                <div className="svz-home-testimonial-avatar svz-home-testimonial-avatar-purple">
                  <span className="svz-home-testimonial-avatar-text">LR</span>
                </div>
                <div>
                  <p className="svz-home-testimonial-user-name">Lisa Rodriguez</p>
                  <p className="svz-home-testimonial-user-title">School SLP, Miami FL</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="svz-home-cta">
        <div className="svz-home-cta-inner">
          <div className="svz-home-cta-content">
            <h2 className="svz-home-cta-title">Ready to Transform Your Speech Therapy Practice?</h2>
            <p className="svz-home-cta-desc">
              Join thousands of speech therapists who are already seeing better outcomes with SpeakViz. Start your free
              trial today - no credit card required.
            </p>

            <div className="svz-home-cta-btns">
              <Button
                size="lg"
                className="svz-home-cta-btn"
                onClick={() => router.push('/signin')}
              >
                Start Free 14-Day Trial
              </Button>
              <Button size="lg" variant="outline" className="svz-home-cta-btn-outline" onClick={() => router.push('/signin')}>
                Schedule a Demo
              </Button>
            </div>

            <p className="svz-home-cta-footnote">✓ No setup fees ✓ Cancel anytime ✓ Full support included</p>
          </div>
        </div>
      </section>
    </div>
  )
}
