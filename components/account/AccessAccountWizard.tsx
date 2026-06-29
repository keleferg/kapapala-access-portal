"use client";

import { useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";

const steps = [
  "About You",
  "Identification",
  "Vehicles",
  "Emergency Contact",
  "Rules",
  "Review",
];

export default function AccessAccountWizard() {
  const [step, setStep] = useState(0);

  function nextStep() {
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function previousStep() {
    setStep((current) => Math.max(current - 1, 0));
  }

  return (
    <div className="account-wizard-layout">
      <Card title="Application Progress">
        <div className="wizard-steps">
          {steps.map((label, index) => (
            <button
              key={label}
              className={`wizard-step ${index === step ? "active" : ""} ${
                index < step ? "complete" : ""
              }`}
              onClick={() => setStep(index)}
              type="button"
            >
              <span>{index + 1}</span>
              <strong>{label}</strong>
            </button>
          ))}
        </div>
      </Card>

      <Card title={steps[step]}>
        {step === 0 && <AboutYouStep />}
        {step === 1 && <IdentificationStep />}
        {step === 2 && <VehiclesStep />}
        {step === 3 && <EmergencyContactStep />}
        {step === 4 && <RulesStep />}
        {step === 5 && <ReviewStep />}

        <div className="wizard-actions">
          <button
            className="button secondary"
            onClick={previousStep}
            type="button"
            disabled={step === 0}
          >
            Back
          </button>

          {step < steps.length - 1 ? (
            <button className="button primary" onClick={nextStep} type="button">
              Continue
            </button>
          ) : (
            <button className="button primary" type="button">
              Submit Application
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

function AboutYouStep() {
  return (
    <div className="mobile-form-stack">
      <p className="muted-text">
        This information will be used to create your Kapāpala Ranch public
        access account.
      </p>
      <div className="form-grid">
        <label>
          First Name
          <input placeholder="First name" />
        </label>
        <label>
          Last Name
          <input placeholder="Last name" />
        </label>
        <label>
          Email
          <input type="email" placeholder="name@example.com" />
        </label>
        <label>
          Mobile Phone
          <input placeholder="(808) 555-1234" />
        </label>
      </div>
    </div>
  );
}

function IdentificationStep() {
  return (
    <div className="mobile-form-stack">
      <div className="info-callout">
        <strong>Identification Review</strong>
        <p>
          Upload a clear photo of your government-issued identification. An
          administrator will review it before issuing an Access ID.
        </p>
      </div>
      <label>
        Government ID Upload
        <input type="file" />
      </label>
      <label>
        ID Type
        <select defaultValue="">
          <option value="" disabled>
            Select ID type
          </option>
          <option>Driver License</option>
          <option>State ID</option>
          <option>Passport</option>
          <option>Other Government ID</option>
        </select>
      </label>
    </div>
  );
}

function VehiclesStep() {
  return (
    <div className="mobile-form-stack">
      <p className="muted-text">
        Frequent users can save vehicles so daily access requests are faster.
      </p>
      <div className="saved-item-list">
        <div>
          <strong>White Toyota Tacoma</strong>
          <span>Hawaii ABC 123</span>
          <StatusBadge label="Primary" tone="green" />
        </div>
      </div>
      <div className="form-grid">
        <label>
          Vehicle Description
          <input placeholder="White Toyota Tacoma" />
        </label>
        <label>
          License Plate
          <input placeholder="ABC 123" />
        </label>
      </div>
      <button className="button secondary full-width" type="button">
        + Add Another Vehicle
      </button>
    </div>
  );
}

function EmergencyContactStep() {
  return (
    <div className="mobile-form-stack">
      <div className="form-grid">
        <label>
          Emergency Contact Name
          <input placeholder="Contact name" />
        </label>
        <label>
          Emergency Contact Phone
          <input placeholder="(808) 555-1234" />
        </label>
      </div>
      <label>
        Primary Purpose of Access
        <select defaultValue="">
          <option value="" disabled>
            Select purpose
          </option>
          <option>Hunting</option>
          <option>Hiking</option>
          <option>Forest Reserve Access</option>
          <option>Cultural Access</option>
          <option>Research</option>
          <option>Ranch Business</option>
          <option>Other</option>
        </select>
      </label>
    </div>
  );
}

function RulesStep() {
  return (
    <div className="mobile-form-stack">
      <div className="rule-list">
        <label>
          <input type="checkbox" />
          <span>I agree to close and secure all gates after passing through.</span>
        </label>
        <label>
          <input type="checkbox" />
          <span>I agree to stay on approved roads and access areas.</span>
        </label>
        <label>
          <input type="checkbox" />
          <span>I agree not to share gate combinations with others.</span>
        </label>
        <label>
          <input type="checkbox" />
          <span>I agree to pack out everything I bring in.</span>
        </label>
      </div>
    </div>
  );
}

function ReviewStep() {
  return (
    <div className="mobile-form-stack">
      <div className="approval-preview">
        <div className="approval-icon">🪪</div>
        <div>
          <h2>Ready for Review</h2>
          <p>
            Your application will be sent to the Kapāpala Ranch administrator.
            Once approved, you will receive an Access ID and may request daily
            gate access.
          </p>
        </div>
      </div>
      <div className="request-summary-grid">
        <div className="summary-item">
          <span>Status</span>
          <strong>Pending Admin Review</strong>
        </div>
        <div className="summary-item">
          <span>Saved Vehicle</span>
          <strong>White Toyota Tacoma</strong>
        </div>
        <div className="summary-item">
          <span>Next Step</span>
          <strong>Access ID Issuance</strong>
        </div>
      </div>
    </div>
  );
}
