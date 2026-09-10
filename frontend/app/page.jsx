import Image from "next/image";
import DemoBox from "../components/DemoBox";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import StatsStrip from "../components/StatsStrip";
import PredictionsStrip from "../components/PredictionsStrip";
import { SOCIAL_LINKS } from "../components/SocialLinks";

export default function Home() {
  return (
    <>
      <Nav />

      <section className="hero">
        <div className="hero-image-wrap">
          <Image
            src="/hero-pregnancy.jpg"
            alt="Pregnant woman resting comfortably at home"
            fill
            priority
            className="hero-image"
            style={{ objectFit: "cover" }}
          />
          <div className="hero-image-scrim" />
        </div>

        <div className="container hero-content">
          <span className="eyebrow">Built for mothers, not paperwork</span>
          <h1 className="display">
            You're carrying enough. Let this carry the paperwork.
          </h1>
          <p className="sub">
            Visit summaries, symptoms you didn't write down anywhere, notes
            scribbled between appointments. This turns it into a clear
            report, an appointment prep sheet, or a draft letter for work
            or insurance, in the time it takes to boil water.
          </p>

          <div className="flow-steps">
            <span className="flow-step"><span className="num">1</span> Tell it what's going on</span>
            <span className="flow-arrow">&rarr;</span>
            <span className="flow-step"><span className="num">2</span> Get a clear summary</span>
            <span className="flow-arrow">&rarr;</span>
            <span className="flow-step"><span className="num">3</span> Advocate with confidence</span>
          </div>

          <div className="cta-row">
            <a href="#demo"><button className="btn-primary">Try it free, no account needed</button></a>
            <a href={SOCIAL_LINKS.okxListing}><button className="btn-secondary">View on OKX.AI</button></a>
          </div>

          <StatsStrip />
        </div>
      </section>

      <main className="container" style={{ paddingBottom: 20 }}>
        <DemoBox />

        <div className="live-banner">
          <span className="live-dot"><span className="dot" /> Live on OKX.AI</span>
          <p style={{ margin: "10px 0 0", fontSize: 15 }}>
            Maternal Health Companion runs 24/7 as an Agent Service Provider
            on OKX AI Marketplace. Every report, prep sheet, and letter you
            get here is the same service other agents can hire on the
            marketplace, pay-per-call. The demo above is a capped preview —
            the full-length version runs through the OKX listing.
          </p>
          <a href={SOCIAL_LINKS.okxListing}>
            <button className="btn-primary" style={{ marginTop: 14 }}>View on OKX.AI</button>
          </a>
        </div>

        <div id="how-it-works" style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>What it does</h2>
          <div className="how-it-works-grid">
            <div style={{ display: "grid", gap: 12 }}>
              <div className="card">
                <strong>Reports</strong>
                <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                  Turns your notes into a plain-language summary, with anything
                  worth flagging to your provider called out clearly.
                </p>
              </div>
              <div className="card">
                <strong>Appointment prep</strong>
                <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                  Key points to mention and questions worth asking, built from
                  what you've actually reported.
                </p>
              </div>
              <div className="card">
                <strong>Advocacy letters</strong>
                <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
                  Draft letters for leave requests, accommodations, or
                  insurance appeals. Always a draft, always yours to review
                  first.
                </p>
              </div>
            </div>
            <div className="how-it-works-image-wrap">
              <Image
                src="/mother-baby.jpg"
                alt="Mother kissing her smiling baby"
                fill
                className="how-it-works-image"
                style={{ objectFit: "cover" }}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>Live predictions</h2>
          <PredictionsStrip />
        </div>

        <p className="disclaimer" style={{ marginTop: 32 }}>
          This is an informational and productivity tool. It is not a
          medical device, does not diagnose, and does not replace your
          healthcare provider. Letters are drafts only and not legal advice.
        </p>
      </main>

      <Footer />
    </>
  );
}
