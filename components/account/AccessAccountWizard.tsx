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

  dailyRequestAccepted: boolean;
  signInOutAccepted: boolean;
  sameGateAccepted: boolean;
  markedRoadsAccepted: boolean;
  dogsSecuredAccepted: boolean;
  interiorGatesAccepted: boolean;
  parkingAccepted: boolean;
  noHuntingAccepted: boolean;
  closingTimeAccepted: boolean;
  misuseAccepted: boolean;
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

  dailyRequestAccepted: false,
  signInOutAccepted: false,
  sameGateAccepted: false,
  markedRoadsAccepted: false,
  dogsSecuredAccepted: false,
  interiorGatesAccepted: false,
  parkingAccepted: false,
  noHuntingAccepted: false,
  closingTimeAccepted: false,
  misuseAccepted: false,
};

export default function AccessAccountWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    async function loadOptionalUser() {
      const supabase = getSupabaseClient();

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.warn("No signed-in user found for public application:", error);
      }

      setUserId(user?.id ?? null);

      if (user?.email) {
        setForm((current) => ({
          ...current,
          email: current.email || user.email || "",
        }));
      }
    }

    void loadOptionalUser();
  }, []);

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function areAllRulesAccepted(): boolean {
    return Boolean(
      form.dailyRequestAccepted &&
        form.signInOutAccepted &&
        form.sameGateAccepted &&
        form.markedRoadsAccepted &&
        form.dogsSecuredAccepted &&
        form.interiorGatesAccepted &&
        form.parkingAccepted &&
        form.noHuntingAccepted &&
        form.closingTimeAccepted &&
        form.misuseAccepted
    );
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
        return areAllRulesAccepted();

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

  function getStepErrorMessage(stepIndex: number): string {
    switch (stepIndex) {
      case 0:
        return "Please complete all required About You fields.";

      case 1:
        return "Please upload a government ID and select the ID type.";

      case 3:
        return "Please complete the emergency contact and primary purpose fields.";

      case 4:
        return "Please read and acknowledge all ten access rules before continuing.";

      default:
        return "Please complete the required fields before continuing.";
    }
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
    setSubmitMessage("");
    setStep((current) => Math.max(current - 1, 0));
  }

  function goToStep(stepIndex: number) {
    if (isSubmitting) {
      return;
    }

    setSubmitError("");
    setSubmitMessage("");
    setStep(stepIndex);
  }

  async function submitApplication() {
    setSubmitMessage("");
    setSubmitError("");

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

      const applicationId = crypto.randomUUID();
      const safeFileName = idFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const idDocumentPath = `pending/${applicationId}-${safeFileName}`;

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
          applicationId,
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
          vehicles: form.licensePlate.trim()
            ? [
                {
                  label: form.vehicleDescription.trim() || "Vehicle",
                  licensePlate: form.licensePlate.trim(),
                  state: "HI",
                  make: "",
                  model: "",
                  color: "",
                  isDefault: true,
                },
              ]
            : [],
          rulesAccepted: {
            dailyRequest: form.dailyRequestAccepted,
            signInOut: form.signInOutAccepted,
            sameGate: form.sameGateAccepted,
            markedRoads: form.markedRoadsAccepted,
            dogsSecured: form.dogsSecuredAccepted,
            interiorGates: form.interiorGatesAccepted,
            parking: form.parkingAccepted,
            noHunting: form.noHuntingAccepted,
            closingTime: form.closingTimeAccepted,
            misuse: form.misuseAccepted,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to submit application.");
      }

      setSubmitMessage("submitted");
      setForm(initialForm);
      setIdFile(null);
      setStep(5);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "An unknown error occurred."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitMessage) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "720px" }}>
          <Card title="Account Request Submitted">
            <div
              className="mobile-form-stack"
              style={{
                textAlign: "center",
                padding: "28px 12px",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  fontSize: "52px",
                  lineHeight: 1,
                  marginBottom: "8px",
                }}
              >
                ✓
              </div>

              <h1 style={{ marginBottom: "8px" }}>
                Mahalo!
              </h1>

              <p style={{ fontSize: "1.1rem" }}>
                Your Kapāpala Access account request has been successfully
                submitted.
              </p>

              <div
                className="success-callout"
                style={{
                  marginTop: "20px",
                  textAlign: "left",
                }}
              >
                <p>
                  Accounts will be reviewed within the next 72 hours. Once
                  approved, you will receive a confirmation email and will be
                  able to submit access requests.
                </p>

                <p style={{ marginTop: "14px" }}>
                  In the meantime, download the Kapāpala Access App from the
                  App Store.
                </p>
              </div>

              <p
                style={{
                  marginTop: "24px",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                }}
              >
                Mahalo!
              </p>
            </div>
          </Card>
        </div>
      </main>
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
                onClick={() => goToStep(index)}
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

        {submitMessage && (
          <div className="success-callout">{submitMessage}</div>
        )}

        {step === 0 && (
          <AboutYouStep form={form} updateField={updateField} />
        )}

        {step === 1 && (
          <IdentificationStep
            form={form}
            updateField={updateField}
            idFile={idFile}
            setIdFile={setIdFile}
          />
        )}

        {step === 2 && (
          <VehiclesStep form={form} updateField={updateField} />
        )}

        {step === 3 && (
          <EmergencyContactStep form={form} updateField={updateField} />
        )}

        {step === 4 && (
          <RulesStep form={form} updateField={updateField} />
        )}

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
              aria-disabled={isSubmitting || !isStepComplete(step)}
              title={
                step === 4 && !areAllRulesAccepted()
                  ? "Please acknowledge all ten access rules to continue."
                  : undefined
              }
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
  updateField: <K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) => void;
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
            onChange={(event) =>
              updateField("firstName", event.target.value)
            }
            required
          />
        </label>

        <label>
          Last Name
          <input
            placeholder="Last name"
            value={form.lastName}
            onChange={(event) =>
              updateField("lastName", event.target.value)
            }
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
            type="tel"
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
  updateField: <K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) => void;
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
          onChange={(event) =>
            setIdFile(event.target.files?.[0] ?? null)
          }
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
          onChange={(event) =>
            updateField("idType", event.target.value)
          }
          required
        >
          <option value="" disabled>
            Select ID type
          </option>
          <option value="Driver License">Driver License</option>
          <option value="State ID">State ID</option>
          <option value="Passport">Passport</option>
          <option value="Other Government ID">
            Other Government ID
          </option>
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
  updateField: <K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) => void;
}) {
  return (
    <div className="mobile-form-stack">
      <p className="muted-text">
        Frequent users can save a vehicle so daily access requests are faster.
        Adding a vehicle during account registration is optional.
      </p>

      <div className="saved-item-list">
        <div>
          <strong>
            {form.vehicleDescription ||
              "No vehicle has been entered. You may add one now or provide vehicle information with each daily access request."}
          </strong>

          <span>{form.licensePlate || "License plate not entered"}</span>

          {form.licensePlate && (
            <StatusBadge label="Primary" tone="green" />
          )}
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
              updateField(
                "licensePlate",
                event.target.value.toUpperCase()
              )
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
  updateField: <K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) => void;
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
              updateField(
                "emergencyContactName",
                event.target.value
              )
            }
            required
          />
        </label>

        <label>
          Emergency Contact Phone
          <input
            type="tel"
            placeholder="(808) 555-1234"
            value={form.emergencyContactPhone}
            onChange={(event) =>
              updateField(
                "emergencyContactPhone",
                event.target.value
              )
            }
            required
          />
        </label>
      </div>

      <label>
        Primary Purpose of Access
        <select
          value={form.primaryPurpose}
          onChange={(event) =>
            updateField("primaryPurpose", event.target.value)
          }
          required
        >
          <option value="" disabled>
            Select purpose
          </option>
          <option value="Hunting">Hunting</option>
          <option value="Hiking">Hiking</option>
          <option value="Forest Reserve Access">
            Forest Reserve Access
          </option>
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
              event.target.value as
                | "Wood Valley"
                | "Honanui"
                | "ʻĀinapō"
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
  updateField: <K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) => void;
}) {
  const allRulesAccepted =
    form.dailyRequestAccepted &&
    form.signInOutAccepted &&
    form.sameGateAccepted &&
    form.markedRoadsAccepted &&
    form.dogsSecuredAccepted &&
    form.interiorGatesAccepted &&
    form.parkingAccepted &&
    form.noHuntingAccepted &&
    form.closingTimeAccepted &&
    form.misuseAccepted;

  return (
    <div className="mobile-form-stack">
      <div className="info-callout">
        <strong>Access Rules and Conditions</strong>
        <p>
          Please read and acknowledge each rule. All ten checkboxes must be
          selected before you can continue.
        </p>
      </div>

      <div className="rule-list access-rule-list">
        <label className="access-rule-item">
          <input
            type="checkbox"
            checked={form.dailyRequestAccepted}
            onChange={(event) =>
              updateField(
                "dailyRequestAccepted",
                event.target.checked
              )
            }
            required
          />

          <span className="access-rule-number">1</span>

          <span className="access-rule-text">
            <strong>Daily access requests</strong>
            I understand that I must submit a separate access request for each
            day access is desired. Requests may be submitted up to 90 days in
            advance. Gate codes will be available through the Kapāpala Forest
            Access App only when I have an approved access request for that
            day, the current time is within the authorized access hours for the
            selected gate, and I am within the immediate vicinity of the gate.
          </span>
        </label>

        <label className="access-rule-item">
          <input
            type="checkbox"
            checked={form.signInOutAccepted}
            onChange={(event) =>
              updateField("signInOutAccepted", event.target.checked)
            }
            required
          />

          <span className="access-rule-number">2</span>

          <span className="access-rule-text">
            <strong>Sign in and sign out</strong>
            I understand that everyone in my party must sign in and sign out
            at the registration box located at the Kapāpala Ranch gate.
          </span>
        </label>

        <label className="access-rule-item">
          <input
            type="checkbox"
            checked={form.sameGateAccepted}
            onChange={(event) =>
              updateField("sameGateAccepted", event.target.checked)
            }
            required
          />

          <span className="access-rule-number">3</span>

          <span className="access-rule-text">
            <strong>Enter and exit through the same gate</strong>
            I understand that each access gate leads to a different area of
            the Forest Reserve and that the access roads do not connect. Entry
            and exit must be through the same gate.
          </span>
        </label>

        <label className="access-rule-item">
          <input
            type="checkbox"
            checked={form.markedRoadsAccepted}
            onChange={(event) =>
              updateField(
                "markedRoadsAccepted",
                event.target.checked
              )
            }
            required
          />

          <span className="access-rule-number">4</span>

          <span className="access-rule-text">
            <strong>Remain on marked access roads</strong>
            I understand that my party and I must remain on marked access roads
            at all times while traveling through Kapāpala Ranch.
          </span>
        </label>

        <label className="access-rule-item">
          <input
            type="checkbox"
            checked={form.dogsSecuredAccepted}
            onChange={(event) =>
              updateField(
                "dogsSecuredAccepted",
                event.target.checked
              )
            }
            required
          />

          <span className="access-rule-number">5</span>

          <span className="access-rule-text">
            <strong>Dogs must remain secured</strong>
            I understand that all dogs must remain secured inside the vehicle
            until reaching the Forest Reserve.
          </span>
        </label>

        <label className="access-rule-item">
          <input
            type="checkbox"
            checked={form.interiorGatesAccepted}
            onChange={(event) =>
              updateField(
                "interiorGatesAccepted",
                event.target.checked
              )
            }
            required
          />

          <span className="access-rule-number">6</span>

          <span className="access-rule-text">
            <strong>Interior gates</strong>
            I understand that interior gates within Kapāpala Ranch must be
            left in the position indicated by Kapāpala Ranch. Gates found open
            must be left open, and gates found closed must be closed after
            passing through.
          </span>
        </label>

        <label className="access-rule-item">
          <input
            type="checkbox"
            checked={form.parkingAccepted}
            onChange={(event) =>
              updateField("parkingAccepted", event.target.checked)
            }
            required
          />

          <span className="access-rule-number">7</span>

          <span className="access-rule-text">
            <strong>Vehicle parking</strong>
            I understand that vehicles may only be parked within the Forest
            Reserve unless specific permission to park elsewhere has been
            granted by Kapāpala Ranch.
          </span>
        </label>

        <label className="access-rule-item">
          <input
            type="checkbox"
            checked={form.noHuntingAccepted}
            onChange={(event) =>
              updateField("noHuntingAccepted", event.target.checked)
            }
            required
          />

          <span className="access-rule-number">8</span>

          <span className="access-rule-text">
            <strong>No hunting within Kapāpala Ranch</strong>
            I understand that hunting is prohibited within Kapāpala Ranch.
          </span>
        </label>

        <label className="access-rule-item">
          <input
            type="checkbox"
            checked={form.closingTimeAccepted}
            onChange={(event) =>
              updateField(
                "closingTimeAccepted",
                event.target.checked
              )
            }
            required
          />

          <span className="access-rule-number">9</span>

          <span className="access-rule-text">
            <strong>Gate closing times and overnight stays</strong>
            I understand that my party and I must exit through the designated
            gate before its scheduled closing time. Gate closing times vary,
            and gate combinations may be changed at or immediately after
            closing. Overnight stays within Kapāpala Ranch are prohibited.
          </span>
        </label>

        <label className="access-rule-item">
          <input
            type="checkbox"
            checked={form.misuseAccepted}
            onChange={(event) =>
              updateField("misuseAccepted", event.target.checked)
            }
            required
          />

          <span className="access-rule-number">10</span>

          <span className="access-rule-text">
            <strong>Misuse of access privileges</strong>
            I understand that intentionally violating access rules, misusing
            access privileges, or sharing gate combinations with unauthorized
            persons may result in the suspension or revocation of my access
            privileges.
          </span>
        </label>
      </div>

      {!allRulesAccepted && (
        <p className="muted-text" role="status">
          Please acknowledge all ten access rules to continue.
        </p>
      )}

      {allRulesAccepted && (
        <div className="success-callout">
          All access rules have been acknowledged.
        </div>
      )}
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
          <span>Primary Purpose</span>
          <strong>{form.primaryPurpose || "—"}</strong>
        </div>

        <div className="summary-item">
          <span>Preferred Gate</span>
          <strong>{form.defaultGate}</strong>
        </div>

        <div className="summary-item">
          <span>Access Rules</span>
          <strong>All 10 Acknowledged</strong>
        </div>

        <div className="summary-item">
          <span>Next Step</span>
          <strong>Access ID Issuance</strong>
        </div>
      </div>
    </div>
  );
}