import { Link } from "react-router-dom";
import "./Homepage.css";

const features = [
  {
    number: "01",
    icon: "↗",
    tone: "blue",
    title: "A pipeline you can trust",
    description: "Track every opportunity from first conversation to signed proposal, with the next step always in view.",
  },
  {
    number: "02",
    icon: "◫",
    tone: "sun",
    title: "Clients, all connected",
    description: "Keep client details, conversations, deals, projects, and the work around them together.",
  },
  {
    number: "03",
    icon: "✳",
    tone: "moss",
    title: "Proposals without the chasing",
    description: "Prepare proposals, share them with clients, and see what is waiting for a response.",
  },
  {
    number: "04",
    icon: "◷",
    tone: "brick",
    title: "Work that stays visible",
    description: "Bring projects, time entries, and invoices into the same picture as your client work.",
  },
  {
    number: "05",
    icon: "↔",
    tone: "blue",
    title: "A clearer client experience",
    description: "Give clients a dedicated place to follow shared work and access the information meant for them.",
  },
  {
    number: "06",
    icon: "⌁",
    tone: "sun",
    title: "Useful signals, not more noise",
    description: "See the work that needs attention and understand the health of your agency at a glance.",
  },
];

function DashboardPreview() {
  return (
    <div className="landing-preview" aria-hidden="true">
      <div className="landing-preview-top">
        <div className="landing-preview-brand">
          <span className="landing-preview-mark">A</span>
          <span>Agency<b>OS</b></span>
        </div>
        <span className="landing-preview-workspace">WORKSPACE <span>⌄</span></span>
        <span className="landing-preview-avatar">FS</span>
      </div>

      <div className="landing-preview-layout">
        <aside className="landing-preview-sidebar">
          <span className="landing-preview-side-label">WORKSPACE</span>
          <span className="landing-preview-nav active"><i>▦</i> Overview</span>
          <span className="landing-preview-nav"><i>◎</i> Clients</span>
          <span className="landing-preview-nav"><i>↗</i> Pipeline</span>
          <span className="landing-preview-nav"><i>▤</i> Proposals</span>
          <span className="landing-preview-nav"><i>◷</i> Projects</span>
          <div className="landing-preview-sidebar-bottom">
            <span className="landing-preview-side-label">YOUR WORK</span>
            <span className="landing-preview-nav"><i>✓</i> My work</span>
            <span className="landing-preview-nav"><i>▧</i> Invoices</span>
          </div>
        </aside>

        <div className="landing-preview-content">
          <div className="landing-preview-heading">
            <div>
              <span className="landing-preview-kicker">AGENCY OVERVIEW · THIS WEEK</span>
              <h3>Your agency at a glance<span>.</span></h3>
              <p>A clearer view of what is moving forward.</p>
            </div>
            <span className="landing-preview-period">This month⌄</span>
          </div>

          <div className="landing-preview-stats">
            <div className="landing-preview-stat">
              <span>OPEN PIPELINE</span>
              <strong>86.4k</strong>
              <small><i>↗</i> Opportunities in progress</small>
            </div>
            <div className="landing-preview-stat">
              <span>ACTIVE DEALS</span>
              <strong>12</strong>
              <small>Across your pipeline</small>
            </div>
            <div className="landing-preview-stat">
              <span>TO FOLLOW UP</span>
              <strong>04</strong>
              <small className="landing-preview-attention"><i /> Needs your attention</small>
            </div>
          </div>

          <div className="landing-preview-lower">
            <div className="landing-preview-panel">
              <div className="landing-preview-panel-head">
                <span>Pipeline overview</span>
                <span>View all ↗</span>
              </div>
              <div className="landing-preview-chart">
                <div className="landing-preview-axis"><span>£60k</span><span>£40k</span><span>£20k</span><span>£0</span></div>
                <div className="landing-preview-bars">
                  <div><i style={{ height: "38%" }} /><small>Lead</small></div>
                  <div><i style={{ height: "62%" }} /><small>Qualified</small></div>
                  <div><i style={{ height: "80%" }} /><small>Proposal</small></div>
                  <div><i style={{ height: "52%" }} /><small>Review</small></div>
                  <div><i className="won" style={{ height: "94%" }} /><small>Won</small></div>
                </div>
              </div>
            </div>
            <div className="landing-preview-panel landing-preview-tasks">
              <div className="landing-preview-panel-head">
                <span>Needs attention</span>
                <span className="landing-preview-count">3</span>
              </div>
              <div className="landing-preview-task">
                <span className="landing-preview-task-dot yellow" />
                <div><b>Proposal follow-up</b><small>Northstar Studio · Today</small></div>
                <span className="landing-preview-task-arrow">↗</span>
              </div>
              <div className="landing-preview-task">
                <span className="landing-preview-task-dot red" />
                <div><b>Invoice reminder</b><small>Fieldwork Co. · Overdue</small></div>
                <span className="landing-preview-task-arrow">↗</span>
              </div>
              <div className="landing-preview-task">
                <span className="landing-preview-task-dot blue" />
                <div><b>Project check-in</b><small>Made North · Tomorrow</small></div>
                <span className="landing-preview-task-arrow">↗</span>
              </div>
            </div>
          </div>
          <div className="landing-preview-footnote"><span /> One connected view of your agency</div>
        </div>
      </div>
    </div>
  );
}

export default function Homepage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Link to="/" className="landing-brand" aria-label="AgencyOS home">
            Agency<b>OS</b><span className="landing-brand-period">.</span>
          </Link>
          <nav className="landing-navigation" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#workflow">How it works</a>
            <Link to="/login" className="landing-signin">Sign in</Link>
            <Link to="/signup" className="landing-nav-cta">Get started <span>↗</span></Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow"><span /> THE OPERATING SYSTEM FOR YOUR AGENCY</p>
              <h1>Good work deserves <em>a better system.</em></h1>
              <p className="landing-hero-subtitle">
                Keep clients, deals, proposals, projects, and invoices moving together — without spreading your agency across a dozen disconnected places.
              </p>
              <div className="landing-hero-actions">
                <Link to="/signup" className="landing-button-primary">Create your workspace <span>↗</span></Link>
                <Link to="/login" className="landing-button-secondary">Sign in <span>→</span></Link>
              </div>
              <div className="landing-hero-note">
                <span className="landing-note-check">✓</span>
                <span>One workspace for the work that keeps your agency moving.</span>
              </div>
            </div>
            <div className="landing-hero-visual">
              <div className="landing-visual-orbit landing-orbit-one" />
              <div className="landing-visual-orbit landing-orbit-two" />
              <div className="landing-visual-label"><span /> YOUR AGENCY, IN FOCUS</div>
              <DashboardPreview />
              <div className="landing-float-note">
                <span className="landing-float-icon">↗</span>
                <span><b>Keep momentum</b><small>From first call to signed proposal</small></span>
              </div>
              <span className="landing-visual-stamp">MAKE<br />ROOM<br /><b>FOR GOOD</b><br />WORK.</span>
            </div>
          </div>
          <div className="landing-hero-bottom-line">
            <div className="landing-container landing-hero-bottom-inner">
              <span>BUILT AROUND YOUR REAL WORKFLOW</span>
              <span className="landing-bottom-divider" />
              <span>CLIENTS</span><i>·</i><span>PIPELINE</span><i>·</i><span>PROPOSALS</span><i>·</i><span>PROJECTS</span><i>·</i><span>INVOICES</span>
            </div>
          </div>
        </section>

        <section className="landing-features" id="features">
          <div className="landing-container">
            <div className="landing-section-head">
              <div>
                <p className="landing-eyebrow"><span /> LESS ADMIN. MORE MOMENTUM.</p>
                <h2>Everything connected.<br /><em>Nothing lost in the shuffle.</em></h2>
              </div>
              <p className="landing-section-intro">
                The details matter. AgencyOS brings the everyday pieces of running an agency into one workspace, so your team can spend less time searching and more time doing.
              </p>
            </div>

            <div className="landing-feature-grid">
              {features.map((feature) => (
                <article className="landing-feature-card" key={feature.number}>
                  <div className="landing-feature-card-top">
                    <span className={`landing-feature-icon ${feature.tone}`}>{feature.icon}</span>
                    <span className="landing-feature-number">{feature.number}</span>
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <span className="landing-feature-line" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-workflow" id="workflow">
          <div className="landing-container landing-workflow-grid">
            <div className="landing-workflow-copy">
              <p className="landing-eyebrow"><span /> A BETTER WAY TO STAY ON TOP OF IT</p>
              <h2>See the next step.<br /><em>Then move it forward.</em></h2>
              <p className="landing-workflow-description">
                From the first client conversation to delivery and payment, keep the context close to the work. Know what is moving, what is waiting, and where your attention will make a difference.
              </p>
              <Link to="/signup" className="landing-text-link">Bring your work together <span>↗</span></Link>
            </div>
            <div className="landing-workflow-steps">
              <div className="landing-workflow-step">
                <span className="landing-step-number">01</span>
                <div><h3>Capture the opportunity</h3><p>Keep client details and deal progress in one place from the start.</p></div>
                <span className="landing-step-symbol">↗</span>
              </div>
              <div className="landing-workflow-step">
                <span className="landing-step-number">02</span>
                <div><h3>Keep delivery in view</h3><p>Connect proposals, projects, tasks, and time to the client work.</p></div>
                <span className="landing-step-symbol">▦</span>
              </div>
              <div className="landing-workflow-step">
                <span className="landing-step-number">03</span>
                <div><h3>Close the loop</h3><p>Stay aware of invoices, replies, and the things that need a follow-up.</p></div>
                <span className="landing-step-symbol">✓</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-cta-section">
          <div className="landing-container">
            <div className="landing-cta-panel">
              <div className="landing-cta-graphic" aria-hidden="true"><span>A</span><i>+</i></div>
              <div className="landing-cta-copy">
                <p className="landing-eyebrow"><span /> YOUR WORK, WORKING TOGETHER</p>
                <h2>Make room for<br /><em>your best work.</em></h2>
                <p>Start with a clearer view of your clients, your pipeline, and what comes next.</p>
              </div>
              <div className="landing-cta-actions">
                <Link to="/signup" className="landing-button-primary">Create your workspace <span>↗</span></Link>
                <Link to="/login" className="landing-cta-login">Already have an account? Sign in <span>→</span></Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <Link to="/" className="landing-brand">Agency<b>OS</b><span className="landing-brand-period">.</span></Link>
          <p>Less busywork. More good work.</p>
          <div className="landing-footer-links">
            <a href="#features">Features</a>
            <Link to="/login">Sign in</Link>
            <Link to="/signup">Get started <span>↗</span></Link>
          </div>
          <span className="landing-copyright">© {new Date().getFullYear()} AgencyOS</span>
        </div>
      </footer>
    </div>
  );
}
