import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Emblem from '../components/Emblem';
import parakhLogo from '../assets/parakh_logo.jpg';
import heroPackageImg from '../assets/hero_package.jpg';
import watermarkImg from '../assets/gov_building_watermark.jpg';
import {
  Camera,
  ShieldCheck,
  BarChart3,
  Users,
  Building2,
  Leaf,
  Compass,
  ArrowRight,
  Info,
  Check,
  Globe2,
  Menu,
  X
} from 'lucide-react';

export default function Landing() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="pl-wrapper">
      {/* 1. TOP GOVERNMENT UTILITY BAR */}
      <div className="pl-utility-bar">
        <div className="pl-utility-inner">
          <div className="pl-utility-left">
            <span>भारत सरकार</span>
            <span className="pl-util-divider">|</span>
            <span>Government of India</span>
          </div>
          <div className="pl-utility-right">
            <span>Ministry of Consumer Affairs, Food and Public Distribution</span>
            <span className="pl-util-divider">|</span>
            <span style={{ cursor: 'default', letterSpacing: '4px' }}>A- A+</span>
            <span className="pl-util-divider">|</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'default' }}>
              <Globe2 size={13} />
              <span>हिन्दी</span>
            </span>
            <span className="pl-util-divider">|</span>
            <span className="pl-tricolor-pill" title="Tricolor Indicator" />
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER */}
      <header className="pl-header">
        <div className="pl-header-inner">
          {/* Left: Official PARAKH Logo & Branding */}
          <Link to="/" className="pl-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={parakhLogo}
                alt="PARAKH Official Ministry Logo"
                style={{ height: '44px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }}
              />
              <div className="pl-brand-text">
                <div className="pl-logo-title-row">
                  <span className="pl-logo-accent" />
                  <span className="pl-logo-title">PARAKH</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e65100', marginLeft: '6px' }}>परख</span>
                </div>
                <span className="pl-logo-subtitle">
                  AI-Assisted Packaged Commodity Compliance & Inspection System
                </span>
              </div>
            </div>
          </Link>

          {/* Right: Navigation Links & Login */}
          <nav className="pl-nav">
            <a href="#home" className="pl-nav-link active">Home</a>
            <a href="#about" className="pl-nav-link">About</a>
            <a href="#features" className="pl-nav-link">Features</a>
            <a href="#impact" className="pl-nav-link">Impact</a>
            <a href="#contact" className="pl-nav-link">Contact</a>
            <Link to="/login" className="pl-login-btn">
              Login <ArrowRight size={15} />
            </Link>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="gov-hamburger-btn"
            style={{ display: 'none' }}
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Toggle Navigation"
          >
            {mobileNavOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* 3. HERO SECTION */}
      <section className="pl-hero" id="home">
        {/* Left Column: Headline, Description & CTAs */}
        <div className="pl-hero-left">
          <h1 className="pl-hero-h1">
            <span className="line-navy">Ensuring Fair Retail.</span>
            <span className="line-saffron">Empowering Consumers.</span>
          </h1>

          <p className="pl-hero-desc">
            PARAKH leverages AI to assist Legal Metrology officers in inspecting packaged commodities,
            ensuring compliance, consumer protection and a more transparent marketplace.
          </p>

          <div className="pl-hero-ctas">
            <Link to="/login" className="pl-btn-primary">
              Login to PARAKH <ArrowRight size={16} />
            </Link>
            <a href="#about" className="pl-btn-secondary">
              Learn More <Info size={16} style={{ color: '#0c2340' }} />
            </a>
          </div>

          <div className="pl-hero-foot-note">
            <span className="pl-tricolor-pill" />
            <span>A step towards a fairer, safer and more transparent India</span>
          </div>
        </div>

        {/* Right Column: Commodity Image & AI Analysis Overlay */}
        <div className="pl-hero-right">
          <div className="pl-product-image-wrap">
            <img
              src={heroPackageImg}
              alt="Indian Packaged Commodity with Statutory Declarations"
              className="pl-product-img"
            />
          </div>

          {/* Floating AI Analysis Card (matches reference design) */}
          <div className="pl-ai-card">
            <div className="pl-ai-card-title">AI Analysis</div>
            <div className="pl-ai-checklist">
              <div className="pl-ai-check-item">
                <span className="pl-ai-check-icon"><Check size={10} strokeWidth={3} /></span>
                <span>MRP Detected</span>
              </div>
              <div className="pl-ai-check-item">
                <span className="pl-ai-check-icon"><Check size={10} strokeWidth={3} /></span>
                <span>Net Quantity Detected</span>
              </div>
              <div className="pl-ai-check-item">
                <span className="pl-ai-check-icon"><Check size={10} strokeWidth={3} /></span>
                <span>Manufacturer Details Found</span>
              </div>
              <div className="pl-ai-check-item">
                <span className="pl-ai-check-icon"><Check size={10} strokeWidth={3} /></span>
                <span>Expiry Date Detected</span>
              </div>
              <div className="pl-ai-check-item">
                <span className="pl-ai-check-icon"><Check size={10} strokeWidth={3} /></span>
                <span>FSSAI Number Found</span>
              </div>
              <div className="pl-ai-check-item">
                <span className="pl-ai-check-icon"><Check size={10} strokeWidth={3} /></span>
                <span>Compliance Check Completed</span>
              </div>
            </div>

            <div className="pl-ai-status-pill">
              <span className="pl-ai-check-icon" style={{ width: 20, height: 20, fontSize: 11 }}>
                <Check size={13} strokeWidth={3} />
              </span>
              <div className="pl-ai-status-text">
                <span className="pl-ai-status-heading">Analysis Complete</span>
                <span className="pl-ai-status-sub">Ready for Officer Review</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supporting Viksit Bharat Tag under Hero */}
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 2rem 1.5rem 2rem' }}>
        <div className="pl-hero-bottom-tag">
          <span className="pl-tricolor-pill" />
          <span>Safer Products. Stronger Consumers. <strong>Viksit Bharat.</strong></span>
        </div>
      </div>

      {/* 4. FEATURE STRIP (4 COLUMNS) */}
      <section className="pl-features-strip" id="features">
        <div className="pl-features-inner">
          {/* Feature 1 */}
          <div className="pl-feature-item">
            <div className="pl-feature-icon-circle" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <Camera size={24} />
            </div>
            <div>
              <div className="pl-feature-title">AI-Powered Inspection</div>
              <p className="pl-feature-desc">
                Upload package images and extract key declarations using advanced AI.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="pl-feature-item">
            <div className="pl-feature-icon-circle" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="pl-feature-title">Legal Metrology Compliance</div>
              <p className="pl-feature-desc">
                Check compliance with applicable rules and identify potential violations.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="pl-feature-item">
            <div className="pl-feature-icon-circle" style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}>
              <BarChart3 size={24} />
            </div>
            <div>
              <div className="pl-feature-title">Transparent & Evidence-Based</div>
              <p className="pl-feature-desc">
                Every finding is linked to image evidence for accountability.
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="pl-feature-item">
            <div className="pl-feature-icon-circle" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
              <Users size={24} />
            </div>
            <div>
              <div className="pl-feature-title">Empowering Enforcement</div>
              <p className="pl-feature-desc">
                A digital platform for officers to ensure fair trade and protect consumer rights.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. IMPACT / STATISTICS SECTION WITH RASHTRAPATI BHAVAN WATERMARK */}
      <section className="pl-impact-section" id="impact">
        {/* Subtle Watermark Silhouette */}
        <img
          src={watermarkImg}
          alt="Government Architecture Silhouette"
          className="pl-impact-watermark"
        />

        <div className="pl-impact-inner">
          {/* Pillar 1 */}
          <div className="pl-impact-col">
            <div className="pl-impact-icon-wrap">
              <Building2 size={32} />
            </div>
            <div className="pl-impact-title">Better Compliance</div>
            <div className="pl-impact-sub">For a Fair Marketplace</div>
          </div>

          {/* Pillar 2 */}
          <div className="pl-impact-col">
            <div className="pl-impact-icon-wrap">
              <Users size={32} />
            </div>
            <div className="pl-impact-title">Stronger Consumer Protection</div>
            <div className="pl-impact-sub">Through Digital Enforcement</div>
          </div>

          {/* Pillar 3 */}
          <div className="pl-impact-col">
            <div className="pl-impact-icon-wrap">
              <Leaf size={32} style={{ color: '#16a34a' }} />
            </div>
            <div className="pl-impact-title">Safer Food & Essentials</div>
            <div className="pl-impact-sub">For Every Household</div>
          </div>

          {/* Pillar 4 */}
          <div className="pl-impact-col">
            <div className="pl-impact-icon-wrap">
              <Compass size={32} />
            </div>
            <div className="pl-impact-title">Towards a Viksit Bharat</div>
            <div className="pl-impact-sub">Through Responsible Governance</div>
          </div>
        </div>
      </section>

      {/* 6. GOVERNMENT QUOTE / MISSION SECTION WITH TRICOLOR CORNER SWOOSH */}
      <section className="pl-quote-section" id="about">
        <div className="pl-quote-inner">
          <p className="pl-quote-text">
            “Consumer protection is not just a policy, it is a commitment to a fair and just society.”
          </p>
          <div className="pl-quote-author">— Government of India</div>
        </div>

        {/* Elegant Indian Tricolor Corner Swoosh from Reference Design */}
        <svg
          className="pl-tricolor-swoosh"
          viewBox="0 0 260 90"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          {/* Green Lower Layer */}
          <path d="M40 90 C 120 90, 200 65, 260 0 L 260 90 Z" fill="#138808" />
          {/* White Middle Layer */}
          <path d="M20 90 C 100 90, 185 55, 260 -15 L 260 15 C 200 70, 120 90, 40 90 Z" fill="#ffffff" />
          {/* Saffron Top Layer */}
          <path d="M0 90 C 80 90, 170 45, 250 -30 L 260 -15 C 185 55, 100 90, 20 90 Z" fill="#ff9933" />
        </svg>
      </section>

      {/* 7. INSTITUTIONAL FOOTER */}
      <footer className="pl-footer" id="contact">
        <div className="pl-footer-inner">
          {/* Col 1: Official Logo & PARAKH Info */}
          <div className="pl-footer-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.85rem' }}>
              <img
                src={parakhLogo}
                alt="PARAKH Official Ministry Logo"
                style={{ height: '42px', width: 'auto', objectFit: 'contain', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)' }}
              />
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.5px' }}>
                  PARAKH <span style={{ color: '#ffb74d', fontSize: '1rem', fontWeight: 600 }}>परख</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  AI-Assisted Packaged Commodity Compliance & Inspection System
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
              An intelligent regulatory assistance platform developed to empower Legal Metrology
              authorities under the Legal Metrology Act, 2009 and the Legal Metrology (Packaged Commodities) Rules, 2011.
            </p>
          </div>

          {/* Col 2: Statutory Links */}
          <div className="pl-footer-col">
            <h4>Statutory Framework</h4>
            <ul>
              <li><a href="#about">Legal Metrology Act, 2009</a></li>
              <li><a href="#about">Packaged Commodities Rules, 2011</a></li>
              <li><a href="#about">Standard Units of Weight & Measure</a></li>
              <li><a href="#about">Unit Sale Price (USP) Guidelines</a></li>
            </ul>
          </div>

          {/* Col 3: Portal Services */}
          <div className="pl-footer-col">
            <h4>Portal Services</h4>
            <ul>
              <li><Link to="/login">Officer Secure Login</Link></li>
              <li><a href="#features">AI Inspection Pipeline</a></li>
              <li><a href="#impact">Regulatory Impact Metrics</a></li>
              <li><Link to="/login">Inspection Case Register</Link></li>
            </ul>
          </div>

          {/* Col 4: Ministry & Support */}
          <div className="pl-footer-col">
            <h4>Ministry Details</h4>
            <ul>
              <li>Department of Consumer Affairs</li>
              <li>Ministry of Consumer Affairs, Food and Public Distribution</li>
              <li>Krishi Bhawan, New Delhi - 110001</li>
              <li>Smart India Hackathon 2026</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pl-footer-bottom">
          <div>
            © 2026 Department of Consumer Affairs, Government of India. All Rights Reserved.
          </div>
          <div>
            PARAKH Prototype • Designed for Legal Metrology Enforcement
          </div>
        </div>

        {/* Tricolor Accent Line at the very bottom */}
        <div className="pl-bottom-tricolor-line" />
      </footer>
    </div>
  );
}

