import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Camera, FileSearch, CheckSquare, UserCheck, FileText, Image, ScanSearch, ListChecks, AlertTriangle, History, BarChart3, Users } from 'lucide-react';

export default function Landing() {
  return (
    <div>
      {/* Government Bar */}
      <div className="gov-bar">
        <span>Government of India — Ministry of Consumer Affairs, Food & Public Distribution</span>
        <span className="prototype-badge">Prototype</span>
      </div>

      {/* Navigation */}
      <div className="landing-header">
        <div className="landing-nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: 'auto' }}>
            <Shield size={24} />
            <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.05em' }}>PRAMAN</span>
          </div>
          <a href="#how-it-works">How It Works</a>
          <a href="#capabilities">Capabilities</a>
          <a href="#legal">Legal Framework</a>
          <Link to="/login" style={{ background: 'var(--saffron)', padding: '0.4rem 1.25rem', borderRadius: 'var(--border-radius)', color: 'white', fontWeight: 600 }}>Login</Link>
        </div>
      </div>

      {/* Hero */}
      <section className="hero">
        <h1>PRAMAN</h1>
        <div className="hero-subtitle">AI-Assisted Packaged Commodity Compliance & Inspection</div>
        <p>
          An intelligent inspection support platform that helps Legal Metrology authorities analyze
          packaged commodity labels, identify mandatory declarations and document potential compliance
          issues under the Legal Metrology (Packaged Commodities) Rules, 2011.
        </p>
        <div className="hero-buttons">
          <Link to="/login" className="btn btn-lg btn-saffron">Inspector Login</Link>
          <a href="#how-it-works" className="btn btn-lg btn-white-outline">Learn More</a>
        </div>
      </section>

      {/* How It Works */}
      <section className="landing-section" id="how-it-works">
        <h2>How PRAMAN Works</h2>
        <p className="section-sub">A streamlined digital inspection workflow in five steps</p>
        <div className="steps-grid">
          {[
            { num: '01', title: 'Scan', desc: 'Upload photographs of packaged commodities.', icon: Camera },
            { num: '02', title: 'Extract', desc: 'OCR extracts visible label information from images.', icon: ScanSearch },
            { num: '03', title: 'Validate', desc: 'Extracted declarations are evaluated against configured compliance rules.', icon: ListChecks },
            { num: '04', title: 'Verify', desc: 'Inspector reviews AI-assisted findings and supporting evidence.', icon: UserCheck },
            { num: '05', title: 'Report', desc: 'Generate and store a digital inspection report.', icon: FileText },
          ].map(s => (
            <div className="step-card" key={s.num}>
              <div className="step-num">{s.num}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section style={{ background: 'var(--gray-50)', padding: '4rem 2rem' }} id="capabilities">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.5rem', color: 'var(--navy)' }}>Key Capabilities</h2>
          <p className="section-sub" style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>Comprehensive tools for packaged commodity compliance inspection</p>
          <div className="capabilities-grid">
            {[
              { icon: Image, title: 'Image-Based Inspection', desc: 'Upload and analyze photographs of product packaging' },
              { icon: ScanSearch, title: 'OCR Text Extraction', desc: 'Automatic text recognition from product labels' },
              { icon: ListChecks, title: 'Mandatory Declaration Detection', desc: 'Identify required declarations per Legal Metrology rules' },
              { icon: CheckSquare, title: 'Compliance Screening', desc: 'Rule-based evaluation of extracted information' },
              { icon: FileSearch, title: 'Evidence Management', desc: 'Visual evidence linked to compliance findings' },
              { icon: History, title: 'Inspection History', desc: 'Permanent digital record of all inspections' },
              { icon: Users, title: 'Inspector Monitoring', desc: 'Track inspector activity and performance' },
              { icon: BarChart3, title: 'Administrative Analytics', desc: 'Organization-wide compliance statistics and trends' },
            ].map((c, i) => (
              <div className="capability-item" key={i}>
                <c.icon size={20} />
                <div>
                  <h4>{c.title}</h4>
                  <p>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Legal Framework */}
      <section className="landing-section" id="legal">
        <div className="legal-section">
          <h3>Legal Framework Reference</h3>
          <p><strong>Legal Metrology Act, 2009</strong></p>
          <p><strong>Legal Metrology (Packaged Commodities) Rules, 2011</strong></p>
          <p style={{ marginTop: '1rem', fontSize: '0.78rem' }}>
            Reference source: <a href="https://consumeraffairs.gov.in/pages/legal-metrology-act" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--navy)' }}>consumeraffairs.gov.in</a>
          </p>
          <div className="disclaimer" style={{ textAlign: 'left', marginTop: '1.5rem' }}>
            <AlertTriangle size={16} />
            <div>
              PRAMAN is a prototype AI-assisted inspection support tool developed for Smart India Hackathon 2026.
              Automated analysis results are indicative and require verification by authorized Legal Metrology officers.
              This is not an official Government of India application.
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div>Government of India — Ministry of Consumer Affairs, Food & Public Distribution</div>
        <div className="footer-links">
          <span>Legal Metrology</span>
          <span>Privacy</span>
          <span>Accessibility</span>
          <span>Contact</span>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', opacity: 0.6 }}>
          PRAMAN — SIH 2026 Prototype
        </div>
      </footer>
    </div>
  );
}
