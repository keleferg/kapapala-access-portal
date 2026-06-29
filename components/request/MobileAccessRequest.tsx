"use client";

import { useMemo, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

const today = new Date().toISOString().slice(0, 10);
const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

type Gate = "Wood Valley" | "Honanui" | "ʻĀinapō";
type Purpose =
  | "Hunting"
  | "Forest Reserve Access"
  | "Cultural Access"
  | "Research"
  | "Ranch / Authorized Work"
  | "Other Approved Purpose";

type PartyOption = "Just me" | "2 people" | "3 people" | "4+ people";
type TripLength = "Day Use" | "Overnight";

type Favorite = {
  name: string;
  icon: string;
  gate: Gate;
  purpose: Purpose;
  vehicle: string;
  party: PartyOption;
  organization: string;
  emergencyContact: string;
  note: string;
};

const favorites: Favorite[] = [
  {
    name: "Morning Hunt",
    icon: "🌄",
    gate: "Wood Valley",
    purpose: "Hunting",
    vehicle: "White Tacoma / ABC 123",
    party: "Just me",
    organization: "",
    emergencyContact: "Default emergency contact",
    note: "Most common early access request",
  },
  {
    name: "Forest Access",
    icon: "🌿",
    gate: "Honanui",
    purpose: "Forest Reserve Access",
    vehicle: "White Tacoma / ABC 123",
    party: "2 people",
    organization: "",
    emergencyContact: "Default emergency contact",
    note: "Saved visitor profile",
  },
  {
    name: "ʻĀinapō Access",
    icon: "⛰️",
    gate: "ʻĀinapō",
    purpose: "Ranch / Authorized Work",
    vehicle: "Polaris Ranger",
    party: "Just me",
    organization: "Kapāpala Ranch",
    emergencyContact: "Default emergency contact",
    note: "4WD recommended",
  },
];

const gates: Gate[] = ["Wood Valley", "Honanui", "ʻĀinapō"];
const purposes: Purpose[] = [
  "Hunting",
  "Forest Reserve Access",
  "Cultural Access",
  "Research",
  "Ranch / Authorized Work",
  "Other Approved Purpose",
];

const savedVehicles = [
  "White Tacoma / ABC 123",
  "Polaris Ranger",
  "Ford F-150 / XYZ 789",
  "Other vehicle",
];

export default function MobileAccessRequest() {
  const [mode, setMode] = useState<"quick" | "favorites" | "plan">("quick");
  const [selectedFavorite, setSelectedFavorite] = useState<Favorite>(favorites[0]);
  const [date, setDate] = useState(today);
  const [gate, setGate] = useState<Gate>(favorites[0].gate);
  const [purpose, setPurpose] = useState<Purpose>(favorites[0].purpose);
  const [vehicle, setVehicle] = useState(favorites[0].vehicle);
  const [party, setParty] = useState<PartyOption>(favorites[0].party);
  const [tripLength, setTripLength] = useState<TripLength>("Day Use");
  const [useDefaultEmergency, setUseDefaultEmergency] = useState(true);
  const [emergencyContact, setEmergencyContact] = useState(favorites[0].emergencyContact);
  const [hasOrganization, setHasOrganization] = useState(false);
  const [organization, setOrganization] = useState(favorites[0].organization);
  const [summitPermit, setSummitPermit] = useState("");
  const [otherPurposeDetails, setOtherPurposeDetails] = useState("");
  const [otherVehicleDetails, setOtherVehicleDetails] = useState("");
  const [partyDetails, setPartyDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const showSummitPermit = tripLength === "Overnight" || gate === "ʻĀinapō";
  const showOrganization = hasOrganization || purpose === "Research" || purpose === "Ranch / Authorized Work";
  const showOtherPurpose = purpose === "Other Approved Purpose";
  const showOtherVehicle = vehicle === "Other vehicle";
  const showPartyDetails = party !== "Just me";
  const showEmergencyOverride = !useDefaultEmergency;

  const summary = useMemo(
    () => ({
      date,
      gate,
      purpose: showOtherPurpose && otherPurposeDetails ? otherPurposeDetails : purpose,
      vehicle: showOtherVehicle && otherVehicleDetails ? otherVehicleDetails : vehicle,
      party: showPartyDetails && partyDetails ? `${party} — ${partyDetails}` : party,
      tripLength,
      emergencyContact: useDefaultEmergency ? "Default emergency contact" : emergencyContact,
      organization: showOrganization ? organization || "Not entered" : "Not applicable",
      summitPermit: showSummitPermit ? summitPermit || "Required if applicable" : "Not required",
    }),
    [
      date,
      gate,
      purpose,
      vehicle,
      party,
      tripLength,
      emergencyContact,
      useDefaultEmergency,
      organization,
      summitPermit,
      showOrganization,
      showSummitPermit,
      showOtherPurpose,
      showOtherVehicle,
      showPartyDetails,
      otherPurposeDetails,
      otherVehicleDetails,
      partyDetails,
    ]
  );

  function applyFavorite(favorite: Favorite) {
    setSelectedFavorite(favorite);
    setGate(favorite.gate);
    setPurpose(favorite.purpose);
    setVehicle(favorite.vehicle);
    setParty(favorite.party);
    setOrganization(favorite.organization);
    setHasOrganization(Boolean(favorite.organization));
    setEmergencyContact(favorite.emergencyContact);
    setUseDefaultEmergency(true);
    setTripLength("Day Use");
    setSummitPermit("");
    setOtherPurposeDetails("");
    setOtherVehicleDetails("");
    setPartyDetails("");
    setDate(today);
    setSubmitted(false);
    setMode("quick");
  }

  function submitRequest() {
    setSubmitted(true);
  }

  return (
    <div className="mobile-request-page">
      <section className="request-hero-card">
        <div>
          <p className="eyebrow">Daily Gate Access</p>
          <h2>Request access in seconds.</h2>
          <p>
            Frequent users can repeat saved details. Occasional visitors get a
            simple guided flow with questions that only appear when needed.
          </p>
        </div>
        <StatusBadge label="Open" tone="green" />
      </section>

      <div className="request-mode-tabs" aria-label="Request type selector">
        <button className={mode === "quick" ? "active" : ""} onClick={() => setMode("quick")}>
          Quick Request
        </button>
        <button className={mode === "favorites" ? "active" : ""} onClick={() => setMode("favorites")}>
          Favorites
        </button>
        <button className={mode === "plan" ? "active" : ""} onClick={() => setMode("plan")}>
          Plan a Visit
        </button>
      </div>

      {submitted && (
        <Card title="Request Ready to Submit">
          <div className="approval-preview">
            <div className="approval-icon">✅</div>
            <div>
              <h2>Approved Preview</h2>
              <p>
                The real system will validate the user’s Access ID, check the
                requested gate and date, then send the gate code by SMS.
              </p>
            </div>
          </div>

          <div className="request-summary-grid">
            <SummaryItem label="Date" value={summary.date} />
            <SummaryItem label="Gate" value={summary.gate} />
            <SummaryItem label="Purpose" value={summary.purpose} />
            <SummaryItem label="Visit Type" value={summary.tripLength} />
            <SummaryItem label="Vehicle" value={summary.vehicle} />
            <SummaryItem label="Party" value={summary.party} />
            <SummaryItem label="Emergency Contact" value={summary.emergencyContact} />
            <SummaryItem label="Organization" value={summary.organization} />
            <SummaryItem label="Summit Permit" value={summary.summitPermit} />
            <SummaryItem label="Gate Code" value="Sent by SMS after approval" />
          </div>
        </Card>
      )}

      {mode === "quick" && (
        <div className="request-layout">
          <Card title="Request Today’s Access">
            <div className="big-request-button" onClick={submitRequest} role="button" tabIndex={0}>
              <span>🚙</span>
              <strong>Request Today’s Access</strong>
              <small>Uses your saved settings below</small>
            </div>

            <div className="quick-summary-card">
              <div>
                <span>Gate</span>
                <strong>{gate}</strong>
              </div>
              <div>
                <span>Purpose</span>
                <strong>{purpose}</strong>
              </div>
              <div>
                <span>Vehicle</span>
                <strong>{vehicle}</strong>
              </div>
              <div>
                <span>Party</span>
                <strong>{party}</strong>
              </div>
            </div>

            <button className="button secondary full-width" onClick={() => setMode("plan")}>
              Change Details
            </button>
          </Card>

          <Card title="Last Request">
            <p className="muted-text">Saved profile</p>
            <div className="saved-request-card">
              <div className="favorite-icon">{selectedFavorite.icon}</div>
              <div>
                <h3>{selectedFavorite.name}</h3>
                <p>{selectedFavorite.note}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {mode === "favorites" && (
        <Card title="Choose a Saved Favorite">
          <div className="favorite-grid">
            {favorites.map((favorite) => (
              <button key={favorite.name} className="favorite-card" onClick={() => applyFavorite(favorite)}>
                <div className="favorite-icon">{favorite.icon}</div>
                <div>
                  <h3>{favorite.name}</h3>
                  <p>
                    {favorite.gate} • {favorite.purpose}
                  </p>
                  <span>{favorite.note}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {mode === "plan" && (
        <div className="request-layout">
          <Card title="Plan a Different Visit">
            <div className="conditional-note">
              <strong>Smart form:</strong> questions appear only when they apply.
            </div>

            <div className="mobile-form-stack">
              <div>
                <span className="field-label">Visit Date</span>
                <div className="choice-grid two">
                  <button className={date === today ? "choice-card selected" : "choice-card"} onClick={() => setDate(today)}>
                    Today
                  </button>
                  <button className={date === tomorrowDate ? "choice-card selected" : "choice-card"} onClick={() => setDate(tomorrowDate)}>
                    Tomorrow
                  </button>
                </div>
                <input value={date} onChange={(e) => setDate(e.target.value)} type="date" />
              </div>

              <div>
                <span className="field-label">Entry Point</span>
                <div className="choice-grid three">
                  {gates.map((gateOption) => (
                    <button
                      key={gateOption}
                      className={gate === gateOption ? "choice-card selected" : "choice-card"}
                      onClick={() => setGate(gateOption)}
                    >
                      {gateOption}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="field-label">Purpose</span>
                <div className="choice-grid two">
                  {purposes.map((purposeOption) => (
                    <button
                      key={purposeOption}
                      className={purpose === purposeOption ? "choice-card selected" : "choice-card"}
                      onClick={() => setPurpose(purposeOption)}
                    >
                      {purposeIcon(purposeOption)} {purposeOption}
                    </button>
                  ))}
                </div>
              </div>

              {showOtherPurpose && (
                <label className="conditional-field">
                  Please describe the purpose
                  <textarea
                    value={otherPurposeDetails}
                    onChange={(e) => setOtherPurposeDetails(e.target.value)}
                    placeholder="Briefly describe the reason for access."
                  />
                </label>
              )}

              <div>
                <span className="field-label">Visit Type</span>
                <div className="choice-grid two">
                  <button className={tripLength === "Day Use" ? "choice-card selected" : "choice-card"} onClick={() => setTripLength("Day Use")}>
                    Day Use
                  </button>
                  <button className={tripLength === "Overnight" ? "choice-card selected" : "choice-card"} onClick={() => setTripLength("Overnight")}>
                    Overnight
                  </button>
                </div>
              </div>

              {showSummitPermit && (
                <label className="conditional-field">
                  State and/or NPS Summit Permit Number
                  <input
                    value={summitPermit}
                    onChange={(e) => setSummitPermit(e.target.value)}
                    placeholder="Required for overnight or summit-related access"
                  />
                </label>
              )}

              <label>
                Vehicle
                <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                  {savedVehicles.map((vehicleOption) => (
                    <option key={vehicleOption}>{vehicleOption}</option>
                  ))}
                </select>
              </label>

              {showOtherVehicle && (
                <label className="conditional-field">
                  License plates of all vehicles
                  <textarea
                    value={otherVehicleDetails}
                    onChange={(e) => setOtherVehicleDetails(e.target.value)}
                    placeholder="Example: White Toyota Tacoma, ABC 123; Silver F-150, XYZ 789"
                  />
                </label>
              )}

              <div>
                <span className="field-label">Number of Persons in Your Party</span>
                <div className="choice-grid two">
                  {(["Just me", "2 people", "3 people", "4+ people"] as PartyOption[]).map((partyOption) => (
                    <button
                      key={partyOption}
                      className={party === partyOption ? "choice-card selected" : "choice-card"}
                      onClick={() => setParty(partyOption)}
                    >
                      {partyOption}
                    </button>
                  ))}
                </div>
              </div>

              {showPartyDetails && (
                <label className="conditional-field">
                  Party details
                  <textarea
                    value={partyDetails}
                    onChange={(e) => setPartyDetails(e.target.value)}
                    placeholder="Optional: names or notes for people in your party"
                  />
                </label>
              )}

              <div>
                <span className="field-label">Emergency Contact</span>
                <div className="choice-grid two">
                  <button
                    className={useDefaultEmergency ? "choice-card selected" : "choice-card"}
                    onClick={() => setUseDefaultEmergency(true)}
                  >
                    Use saved contact
                  </button>
                  <button
                    className={!useDefaultEmergency ? "choice-card selected" : "choice-card"}
                    onClick={() => setUseDefaultEmergency(false)}
                  >
                    Use different phone
                  </button>
                </div>
              </div>

              {showEmergencyOverride && (
                <label className="conditional-field">
                  Emergency Contact Phone Number
                  <input
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="808-555-1234"
                  />
                </label>
              )}

              <div>
                <span className="field-label">Organization</span>
                <div className="choice-grid two">
                  <button className={!hasOrganization ? "choice-card selected" : "choice-card"} onClick={() => setHasOrganization(false)}>
                    Not applicable
                  </button>
                  <button className={hasOrganization ? "choice-card selected" : "choice-card"} onClick={() => setHasOrganization(true)}>
                    Add organization
                  </button>
                </div>
              </div>

              {showOrganization && (
                <label className="conditional-field">
                  Organization Name
                  <input
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Organization, agency, company, or group"
                  />
                </label>
              )}
            </div>

            <button className="button primary full-width sticky-submit" onClick={submitRequest}>
              Review & Submit Request
            </button>
          </Card>

          <Card title="Gate Status">
            <div className="compact-list">
              <div>
                <span>Wood Valley</span>
                <StatusBadge label="Open" tone="green" />
              </div>
              <div>
                <span>Honanui</span>
                <StatusBadge label="Open" tone="green" />
              </div>
              <div>
                <span>ʻĀinapō</span>
                <StatusBadge label="Restricted" tone="yellow" />
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function purposeIcon(purpose: Purpose) {
  switch (purpose) {
    case "Hunting":
      return "🏹";
    case "Forest Reserve Access":
      return "🌿";
    case "Cultural Access":
      return "🌺";
    case "Research":
      return "🔬";
    case "Ranch / Authorized Work":
      return "🔧";
    default:
      return "➕";
  }
}
