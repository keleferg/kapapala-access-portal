"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

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
  closeGatesAccepted: boolean;
  stayOnRoadsAccepted: boolean;
  noShareCombosAccepted: boolean;
  packOutAccepted: boolean;
  certifyAccepted: boolean;
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
  closeGatesAccepted: false,
  stayOnRoadsAccepted: false,
  noShareCombosAccepted: false,
  packOutAccepted: false,
  certifyAccepted: false,
};

export default function AccessAccountWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    async function loadUser() {
      const supabase = getSupabaseClient();

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("Unable to load signed-in user:", error);
      }

      setUserId(user?.id ?? null);

      if (user?.email) {
        setForm((current) => ({
          ...current,
          email: current.email || user.email || "",
        }));
      }

      setLoadingUser(false);
    }

    void loadUser();
  }, []);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function isStepComplete(stepIndex: number): boolean {
    switch (stepIndex) {
      case 0:
        return Boolean(
          form.firstName.trim() &&
            form.lastName.trim() &&
            form.email.trim() &&
            form.phone.trim()
        );

      case 1:
        return Boolean(form.idType.trim() && idFile);

      case 2:
        return true;

      case 3:
        return Boolean(
          form.emergencyContactName.trim() &&
            form.emergencyContactPhone.trim() &&
            form.primaryPurpose.trim()
        );

      case 4:
        return Boolean(
          form.closeGatesAccepted &&
            form.stayOnRoadsAccepted &&
            form.noShareCombosAccepted &&
            form.packOutAccepted &&
            form.certifyAccepted
        );

      case 5:
        return areRequiredStepsComplete();

      default:
        return false;
    }
  }

  function areRequiredStepsComplete(): boolean {
    return (
      isStepComplete(0) &&
      isStepComplete(1) &&
      isStepComplete(2) &&
      isStepComplete(3) &&
      isStepComplete(4)
    );
  }

  function nextStep() {
    setSubmitMessage("");
    setSubmitError("");

    if (!isStepComplete(step)) {
      setSubmitError(getStepErrorMessage(step));
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function previousStep() {
    setSubmitError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  function getStepErrorMessage(stepIndex: number): string {
    switch (stepIndex) {
      case 0:
        return "Please complete all required About You fields.";

      case 1:
        return "Please upload a government ID and select the ID type.";

      case 3:
        return "Please complete the emergency contact and primary purpose fields.";

      case 4:
        return "Please review and check all access rules before continuing.";

      default:
        return "Please complete the required fields before continuing.";
    }
  }

  async function submitApplication() {
    setSubmitMessage("");
    setSubmitError("");

    if (!userId) {
      setSubmitError("Please log in before requesting an access account.");
      return;
    }

    if (!areRequiredStepsComplete()) {
      setSubmitError(
        "Please complete all required sections before submitting your application."
      );
      return;
    }

    if (!idFile) {
      setSubmitError("Please upload a copy of your government ID.");
      setStep(1);
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();

      const safeFileName = idFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const idDocumentPath = `${userId}/${crypto.randomUUID()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("access-account-ids")
        .upload(idDocumentPath, idFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`ID upload failed: ${uploadError.message}`);
      }

      const response = await fetch("/api/access-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: userId,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          idType: form.idType,
          idDocumentPath,
          organization: form.primaryPurpose,
          defaultGate: form.defaultGate,
          emergencyContactName: form.emergencyContactName.trim(),
          emergencyContactPhone: form.emergencyContactPhone.trim(),
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
      setIdFile(null);
      setStep(5);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadingUser) {
    return (
      <Card title="Request an Access Account">
        <p>Checking login status...</p>
      </Card>
    );
  }

  if (!userId) {
    return (
      <Card title="Request an Access Account">
        <p>Please log in or create an account before requesting access.</p>
        <a className="button primary" href="/">
          Log In / Create Account
        </a>
      </Card>
    );
  }

  return (
    <div className="account-wizard-layout">
      <Card title="Application Progress">
        <div className="wizard-steps">
          {steps.map((label, index) => {
            const complete = index < 5 && isStepComplete(index);

            return (
              <button
                key={label}
                className={`wizard-step ${index === step ? "active" : ""} ${
                  complete ? "complete" : ""
                }`}
                onClick={() => setStep(index)}
                type="button"
                disabled={isSubmitting}
              >
                <span>{index + 1}</span>
                <strong>{label}</strong>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title={steps[step]}>
        {submitError && <div className="error-callout">{submitError}</div>}
        {submitMessage && <div className="success-callout">{submitMessage}</div>}

        {step === 0 && <AboutYouStep form={form} updateField={updateField} />}

        {step === 1 && (
          <IdentificationStep
            form={form}
            updateField={updateField}
            idFile={idFile}
            setIdFile={setIdFile}
          />
        )}

        {step === 2 && <VehiclesStep form={form} updateField={updateField} />}

        {step === 3 && (
          <EmergencyContactStep form={form} updateField={updateField} />
        )}

        {step === 4 && <RulesStep form={form} updateField={updateField} />}

        {step === 5 && <ReviewStep form={form} idFile={idFile} />}

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
            <button
              className="button primary"
              onClick={nextStep}
              type="button"
              disabled={isSubmitting || !isStepComplete(step)}
            >
              Continue
            </button>
          ) : (
            <button
              className="button primary"
              type="button"
              onClick={submitApplication}
              disabled={isSubmitting || !areRequiredStepsComplete()}
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
            required
          />
        </label>

        <label>
          Last Name
          <input
            placeholder="Last name"
            value={form.lastName}
            onChange={(event) => updateField("lastName", event.target.value)}
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            placeholder="name@example.com"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            required
          />
        </label>

        <label>
          Mobile Phone
          <input
            placeholder="(808) 555-1234"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            required
          />
        </label>
      </div>
    </div>
  );
}

function IdentificationStep({
  form,
  updateField,
  idFile,
  setIdFile,
}: {
  form: FormState;
  updateField: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
  idFile: File | null;
  setIdFile: (file: File | null) => void;
}) {
  return (
    <div className="mobile-form-stack">
      <div className="info-callout">
        <strong>Identification Review</strong>
        <p>
          Upload a copy of your government ID. This file will be stored
          privately and reviewed only by authorized staff.
        </p>
      </div>

      <label>
        Government ID Upload
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(event) => setIdFile(event.target.files?.[0] ?? null)}
          required
        />
      </label>

      {idFile ? (
        <p className="muted-text">Selected file: {idFile.name}</p>
      ) : (
        <p className="muted-text">No file selected yet.</p>
      )}

      <label>
        ID Type
        <select
          value={form.idType}
          onChange={(event) => updateField("idType", event.target.value)}
          required
        >
          <option value="" disabled>
            Select ID type
          </option>
          <option value="Driver License">Driver License</option>
          <option value="State ID">State ID</option>
          <option value="Passport">Passport</option>
          <option value="Other Government ID">Other Government ID</option>
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
          <strong>
            {form.vehicleDescription ||
              "Vehicle not entered. Entering a vehicle here is optional, but you will be required to enter a vehicle for each daily access request you submit. To make your submission quicker, you can save your frequently used vehicle information here so you don't have to enter it for each request submitted."}
          </strong>
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
            required
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
            required
          />
        </label>
      </div>

      <label>
        Primary Purpose of Access
        <select
          value={form.primaryPurpose}
          onChange={(event) => updateField("primaryPurpose", event.target.value)}
          required
        >
          <option value="" disabled>
            Select purpose
          </option>
          <option value="Hunting">Hunting</option>
          <option value="Hiking">Hiking</option>
          <option value="Forest Reserve Access">Forest Reserve Access</option>
          <option value="Cultural Access">Cultural Access</option>
          <option value="Research">Research</option>
          <option value="Ranch Business">Ranch Business</option>
          <option value="Other">Other</option>
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
          required
        >
          <option value="Wood Valley">Wood Valley</option>
          <option value="Honanui">Honanui</option>
          <option value="ʻĀinapō">ʻĀinapō</option>
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
          <input
            type="checkbox"
            checked={form.closeGatesAccepted}
            onChange={(event) =>
              updateField("closeGatesAccepted", event.target.checked)
            }
            required
          />
          <span>I agree to close and secure all gates after passing through.</span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.stayOnRoadsAccepted}
            onChange={(event) =>
              updateField("stayOnRoadsAccepted", event.target.checked)
            }
            required
          />
          <span>I agree to stay on approved roads and access areas.</span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.noShareCombosAccepted}
            onChange={(event) =>
              updateField("noShareCombosAccepted", event.target.checked)
            }
            required
          />
          <span>I agree not to share gate combinations with others.</span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.packOutAccepted}
            onChange={(event) =>
              updateField("packOutAccepted", event.target.checked)
            }
            required
          />
          <span>I agree to pack out everything I bring in.</span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.certifyAccepted}
            onChange={(event) =>
              updateField("certifyAccepted", event.target.checked)
            }
            required
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

function ReviewStep({
  form,
  idFile,
}: {
  form: FormState;
  idFile: File | null;
}) {
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
          <span>Phone</span>
          <strong>{form.phone || "—"}</strong>
        </div>

        <div className="summary-item">
          <span>ID Type</span>
          <strong>{form.idType || "—"}</strong>
        </div>

        <div className="summary-item">
          <span>ID Upload</span>
          <strong>{idFile?.name || "—"}</strong>
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
          <span>License Plate</span>
          <strong>{form.licensePlate || "—"}</strong>
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