import { SOCIAL_LINKS, TwitterIcon, GithubIcon } from "./SocialLinks";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h4>Product</h4>
            <a href="#how-it-works">How it works</a>
            <a href="#demo">Try the demo</a>
            <a href="#predictions">Live predictions</a>
            <a href={SOCIAL_LINKS.okxListing}>View on OKX.AI</a>
          </div>
          <div>
            <h4>Resources</h4>
            <a href={SOCIAL_LINKS.github}>GitHub</a>
            <a href={SOCIAL_LINKS.twitter}>Updates on X</a>
          </div>
        </div>
        <div className="social-row">
          <a href={SOCIAL_LINKS.twitter} aria-label="X / Twitter"><TwitterIcon /></a>
          <a href={SOCIAL_LINKS.github} aria-label="GitHub"><GithubIcon /></a>
        </div>
        <p className="disclaimer" style={{ marginTop: 20 }}>
          Maternal Health Companion is an informational and productivity tool.
          It is not a medical device, does not diagnose, and does not replace
          your healthcare provider. Letters are drafts only and not legal advice.
        </p>
      </div>
    </footer>
  );
}
