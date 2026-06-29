import StatusBadge from "../ui/StatusBadge";

export default function HeroBanner() {
  return (
    <section className="hero-banner">
      <div className="hero-content">
        <p className="hero-subtitle">Kapāpala Ranch</p>
        <h1>Public Access Portal</h1>
        <p className="hero-text">
          Welcome to Kapāpala Ranch. Please kōkua in protecting Hawaiʻi's natural
          resources by respecting the land, wildlife, gates, roads, and fellow visitors.
        </p>
        <div className="hero-status">
          <span>Today&apos;s Access Status</span>
          <StatusBadge label="OPEN" tone="green" />
        </div>
      </div>
    </section>
  );
}
