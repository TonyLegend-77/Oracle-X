import { SOCIAL_LINKS, TwitterIcon, GithubIcon } from "./SocialLinks";

export default function Nav() {
  return (
    <nav className="nav">
      <div className="nav-logo">
        <span>🩷</span>
        <span>MHC</span>
      </div>
      <div className="nav-links">
        <a href="#how-it-works">How it works</a>
        <a href="#demo">Try the demo</a>
        <a href="#predictions">Live predictions</a>
        <a href={SOCIAL_LINKS.okxListing} className="nav-cta">
          Agent Hub on OKX AI
        </a>
        <a href={SOCIAL_LINKS.twitter} aria-label="X / Twitter">
          <TwitterIcon className="nav-icon" />
        </a>
        <a href={SOCIAL_LINKS.github} aria-label="GitHub">
          <GithubIcon className="nav-icon" />
        </a>
      </div>
    </nav>
  );
}
