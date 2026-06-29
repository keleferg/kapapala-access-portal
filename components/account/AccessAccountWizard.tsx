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

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idType: string;
  vehicleDescription: string;
  licensePlate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  primaryPurpose: string;
  defaultGate: "Wood Valley" | "Honanui" | "ʻĀinapō";
  rulesAccepted: boolean;
};

const initialForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  idType: "",
  vehicleDescription: "",
  licensePlate: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  primaryPurpose: "",
  defaultGate: "Wood Valley",
  rulesAccepted: false,
};

export default function AccessAccountWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function nextStep() {
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function previousStep() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submitApplication() {
    setSubmitMessage("");
    setSubmitError("");

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setSubmitError("First name and last name are required.");
      setStep(0);
      return;
    }

    if (!form.email.trim()) {
      setSubmitError("Email is required.");
      setStep(0);
      return;
    }

    if (!form.rulesAccepted) {
      setSubmitError("Please accept the access rules before submitting.");
      setStep(4);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/access-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          organization: form.primaryPurpose,
          defaultGate: form.defaultGate,
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: form.emergencyContactPhone,
          vehicles: form.licensePlate
            ? [
                {
                  label: form.vehicleDescription || "Vehicle",
                  licensePlate: form.licensePlate,
                  state: "HI",
                  make: "",
                  model: "",
                  color: "",
                  isDefault: true,
                },
              ]
            : [],
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to submit application.");
      }

      setSubmitMessage(
        "Application submitted successfully. Your request is now pending admin review."
      );
      setForm(initialForm);
      setStep(5);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setIsSubmitting(false);
    }
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
        {submitError && <div className="error-callout">{submitError}</div>}
        {submitMessage && <div className="success-callout">{submitMessage}</div>}

        {step === 0 && <AboutYouStep form={form} updateField={updateField} />}
        {step === 1 && (
          <IdentificationStep form={form} updateField={updateField} />
        )}
        {step === 2 && <VehiclesStep form={form} updateField={updateField} />}
        {step === 3 && (
          <EmergencyContactStep form={form} updateField={updateField} />
        )}
        {step === 4 && <RulesStep form={form} updateField={updateField} />}
        {step === 5 && <ReviewStep form={form} />}

        <div className="wizard-actions">
          <button
            className="button secondary"
            onClick={previousStep}
            type="button"
            disabled={step === 0 || isSubmitting}
          >
            Back
          </button>

          {step < steps.length - 1 ? (
            <button className="button primary" onClick={nextStep} type="button">
              Continue
            </button>
          ) : (
            <button
              className="button primary"
              type="button"
              onClick={submitApplication}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

function AboutYouStep({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
}) {
  return (
    <div className="mobile-form-stack">
      <p className="muted-text">
        This information will be used to create your Kapāpala Ranch public
        access account.
      </p>
      <div className="form-grid">
        <label>
          First Name
          <input
            placeholder="First name"
            value={form.firstName}
            onChange={(event) => updateField("firstName", event.target.value)}
          />
        </label>
        <label>
          Last Name
          <input
            placeholder="Last name"
            value={form.lastName}
            onChange={(event) => updateField("lastName", event.target.value)}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            placeholder="name@example.com"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </label>
        <label>
          Mobile Phone
          <input
            placeholder="(808) 555-1234"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

function IdentificationStep({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
}) {
  return (
    <div className="mobile-form-stack">
      <div className="info-callout">
        <strong>Identification Review</strong>
        <p>
          Upload support will be wired next. For now, the application stores the
          request and ID type for admin review.
        </p>
      </div>
      <label>
        Government ID Upload
        <input type="file" disabled />
      </label>
      <label>
        ID Type
        <select
          value={form.idType}
          onChange={(event) => updateField("idType", event.target.value)}
        >
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

function VehiclesStep({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
}) {
  return (
    <div className="mobile-form-stack">
      <p className="muted-text">
        Frequent users can save vehicles so daily access requests are faster.
      </p>
      <div className="saved-item-list">
        <div>
          <strong>{form.vehicleDescription || "Vehicle not entered"}</strong>
          <span>{form.licensePlate || "License plate not entered"}</span>
          {form.licensePlate && <StatusBadge label="Primary" tone="green" />}
        </div>
      </div>
      <div className="form-grid">
        <label>
          Vehicle Description
          <input
            placeholder="White Toyota Tacoma"
            value={form.vehicleDescription}
            onChange={(event) =>
              updateField("vehicleDescription", event.target.value)
            }
          />
        </label>
        <label>
          License Plate
          <input
            placeholder="ABC 123"
            value={form.licensePlate}
            onChange={(event) =>
              updateField("licensePlate", event.target.value.toUpperCase())
            }
          />
        </label>
      </div>
    </div>
  );
}

function EmergencyContactStep({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
}) {
  return (
    <div className="mobile-form-stack">
      <div className="form-grid">
        <label>
          Emergency Contact Name
          <input
            placeholder="Contact name"
            value={form.emergencyContactName}
            onChange={(event) =>
              updateField("emergencyContactName", event.target.value)
            }
          />
        </label>
        <label>
          Emergency Contact Phone
          <input
            placeholder="(808) 555-1234"
            value={form.emergencyContactPhone}
            onChange={(event) =>
              updateField("emergencyContactPhone", event.target.value)
            }
          />
        </label>
      </div>
      <label>
        Primary Purpose of Access
        <select
          value={form.primaryPurpose}
          onChange={(event) => updateField("primaryPurpose", event.target.value)}
        >
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
      <label>
        Preferred Gate
        <select
          value={form.defaultGate}
          onChange={(event) =>
            updateField(
              "defaultGate",
              event.target.value as "Wood Valley" | "Honanui" | "ʻĀinapō"
            )
          }
        >
          <option>Wood Valley</option>
          <option>Honanui</option>
          <option>ʻĀinapō</option>
        </select>
      </label>
    </div>
  );
}

function RulesStep({
  form,
  updateField,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
}) {
  return (
    <div className="mobile-form-stack">
      <div className="rule-list">
        <label>
          <input type="checkbox" checked readOnly />
          <span>I agree to close and secure all gates after passing through.</span>
        </label>
        <label>
          <input type="checkbox" checked readOnly />
          <span>I agree to stay on approved roads and access areas.</span>
        </label>
        <label>
          <input type="checkbox" checked readOnly />
          <span>I agree not to share gate combinations with others.</span>
        </label>
        <label>
          <input type="checkbox" checked readOnly />
          <span>I agree to pack out everything I bring in.</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.rulesAccepted}
            onChange={(event) =>
              updateField("rulesAccepted", event.target.checked)
            }
          />
          <span>
            I certify that the information provided is accurate and I agree to
            the Kapāpala Ranch public access rules.
          </span>
        </label>
      </div>
    </div>
  );
}

function ReviewStep({ form }: { form: FormState }) {
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
          <span>Name</span>
          <strong>
            {form.firstName || "—"} {form.lastName || ""}
          </strong>
        </div>
        <div className="summary-item">
          <span>Email</span>
          <strong>{form.email || "—"}</strong>
        </div>
        <div className="summary-item">
          <span>Status</span>
          <strong>Pending Admin Review</strong>
        </div>
        <div className="summary-item">
          <span>Saved Vehicle</span>
          <strong>{form.vehicleDescription || "—"}</strong>
        </div>
        <div className="summary-item">
          <span>Preferred Gate</span>
          <strong>{form.defaultGate}</strong>
        </div>
        <div className="summary-item">
          <span>Next Step</span>
          <strong>Access ID Issuance</strong>
        </div>
      </div>
    </div>
  );
}