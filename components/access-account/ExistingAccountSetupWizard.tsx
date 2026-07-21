"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "../ui/Card";
import { getSupabaseClient } from "../../lib/supabaseClient";
import {
  DEFAULT_ORGANIZATION,
  ORGANIZATION_OPTIONS,
} from "../../lib/organizationOptions";
import {
  DEVICE_TYPE_OPTIONS,
  formatDeviceType,
  type DeviceType,
} from "../../lib/deviceTypeOptions";

type GateName = "Wood Valley" | "Honanui" | "ʻĀinapō";

type ExistingAccount = {
  id: string;
  access_id: string | null;
  applicant_first_name: string | null;
  applicant_last_name: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  mailing_address: string | null;
  organization: string | null;
  device_type: DeviceType | null;
  default_gate: GateName | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  id_document_path: string | null;
  setup_version: number | null;
  setup_completed_at: string | null;
  id_is_valid: boolean;
  id_status_message: string;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mailingAddress: string;
  organization: string;
  deviceType: DeviceType | "";
  defaultGate: GateName;
  emergencyContactName: string;
  emergencyContactPhone: string;

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

const steps = [
  "Your Information",
  "Emergency Contact",
  "Rules",
  "Review",
];

export default function ExistingAccountSetupWizard({
  account,
}: {
  account: ExistingAccount;
}) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idType, setIdType] = useState("");
  const [replacementIdUploaded, setReplacementIdUploaded] =
    useState(false);

  const [form, setForm] = useState<FormState>({
    firstName: account.applicant_first_name ?? "",
    lastName: account.applicant_last_name ?? "",
    email: account.applicant_email ?? "",
    phone: account.applicant_phone ?? "",
    mailingAddress: account.mailing_address ?? "",
    organization: account.organization ?? DEFAULT_ORGANIZATION,
    deviceType: account.device_type ?? "",
    defaultGate: account.default_gate ?? "Wood Valley",
    emergencyContactName: account.emergency_contact_name ?? "",
    emergencyContactPhone: account.emergency_contact_phone ?? "",

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
  });

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

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

  function isStepComplete(stepIndex: number): boolean {
    const personalInformationComplete = Boolean(
      form.firstName.trim() &&
        form.lastName.trim() &&
        form.email.trim() &&
        form.phone.trim() &&
        form.organization.trim() &&
        form.deviceType &&
        form.defaultGate &&
        (
          account.id_is_valid ||
          replacementIdUploaded ||
          Boolean(idFile && idType)
        )
    );

    const emergencyContactComplete = Boolean(
      form.emergencyContactName.trim() &&
        form.emergencyContactPhone.trim()
    );

    switch (stepIndex) {
      case 0:
        return personalInformationComplete;

      case 1:
        return emergencyContactComplete;

      case 2:
        return allRulesAccepted;

      case 3:
        return (
          personalInformationComplete &&
          emergencyContactComplete &&
          allRulesAccepted
        );

      default:
        return false;
    }
  }

  function nextStep() {
    setErrorMessage("");

    if (!isStepComplete(step)) {
      if (step === 0) {
        setErrorMessage(
          "Please complete all required personal information fields."
        );
      } else if (step === 1) {
        setErrorMessage(
          "Please complete the emergency contact information."
        );
      } else if (step === 2) {
        setErrorMessage(
          "Please acknowledge all ten access rules before continuing."
        );
      }

      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function previousStep() {
    setErrorMessage("");
    setStep((current) => Math.max(current - 1, 0));
  }

  async function completeSetup() {
    setErrorMessage("");

    if (!isStepComplete(3)) {
      setErrorMessage(
        "Please complete all required setup steps before submitting."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();

      if (!account.id_is_valid && !replacementIdUploaded) {
        if (!idFile || !idType) {
          throw new Error(
            "Please select an ID type and upload a current government ID."
          );
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error(
            "Your session has expired. Please sign in again."
          );
        }

        const uploadForm = new FormData();
        uploadForm.append("file", idFile);
        uploadForm.append("documentType", idType);

        const uploadResponse = await fetch(
          "/api/my-access-account/id-document",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: uploadForm,
          }
        );

        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok || !uploadResult.success) {
          throw new Error(
            uploadResult.error ||
            "Unable to upload identification."
          );
        }

        setReplacementIdUploaded(true);
      }

      const rpcArguments = {
      p_access_account_id: account.id,
      p_first_name: form.firstName.trim(),
      p_last_name: form.lastName.trim(),
      p_email: form.email.trim(),
      p_phone: form.phone.trim(),
      p_mailing_address: form.mailingAddress.trim(),
      p_default_gate: form.defaultGate,
      p_emergency_contact_name: form.emergencyContactName.trim(),
      p_emergency_contact_phone: form.emergencyContactPhone.trim(),
      p_id_document_path: null,
      p_organization: form.organization.trim(),
      p_device_type: form.deviceType,
    };

    const { error } = await supabase.rpc(
      "complete_existing_account_setup",
      rpcArguments as never
    );

      if (error) {
        throw new Error(error.message);
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to complete account setup."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="account-wizard-layout">
      <Card title="Complete Your Account Setup">
        <div className="info-callout">
          <strong>
            Existing Access Account
            {account.access_id ? ` #${account.access_id}` : ""}
          </strong>

          <p>
            Please confirm your information and acknowledge the current
            Kapāpala Ranch access rules. This setup only needs to be
            completed once.
          </p>
        </div>

        <div className="wizard-steps">
          {steps.map((label, index) => {
            const complete =
              index < steps.length - 1 && isStepComplete(index);

            return (
              <button
                key={label}
                type="button"
                className={`wizard-step ${
                  index === step ? "active" : ""
                } ${complete ? "complete" : ""}`}
                onClick={() => {
                  setErrorMessage("");
                  setStep(index);
                }}
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
        {errorMessage && (
          <div className="error-callout">{errorMessage}</div>
        )}

        {step === 0 && (
          <div className="mobile-form-stack">
            <p className="muted-text">
              Review the information we already have and complete any
              missing fields.
            </p>

            <div className="form-grid">
              <label>
                First Name
                <input
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
                  value={form.email}
                  onChange={(event) =>
                    updateField("email", event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Mobile Phone
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    updateField("phone", event.target.value)
                  }
                  required
                />
              </label>
            </div>

            <label>
              Mailing Address
              <textarea
                rows={3}
                value={form.mailingAddress}
                onChange={(event) =>
                  updateField("mailingAddress", event.target.value)
                }
                placeholder="Mailing address"
              />
            </label>

            <label>
              Organization / Agency
              <select
                value={form.organization}
                onChange={(event) =>
                  updateField("organization", event.target.value)
                }
                required
              >
                {ORGANIZATION_OPTIONS.map((organization) => (
                  <option key={organization} value={organization}>
                    {organization}
                  </option>
                ))}
              </select>
            </label>

            <label>
              What device do you plan to use to retrieve gate codes?
              <select
                value={form.deviceType}
                onChange={(event) =>
                  updateField(
                    "deviceType",
                    event.target.value as DeviceType | ""
                  )
                }
                required
              >
                <option value="" disabled>
                  Select device
                </option>

                {DEVICE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <span className="muted-text">
                This determines how gate combinations will be delivered.
              </span>
            </label>

            {!account.id_is_valid && (
              <div className="error-callout">
                <strong>Current government ID required</strong>
                <p>{account.id_status_message}</p>

                <label>
                  ID Type
                  <select
                    value={idType}
                    onChange={(event) =>
                      setIdType(event.target.value)
                    }
                    required
                  >
                    <option value="" disabled>
                      Select ID type
                    </option>
                    <option value="Driver License">
                      Driver License
                    </option>
                    <option value="State ID">
                      State ID
                    </option>
                    <option value="Passport">
                      Passport
                    </option>
                    <option value="Other Government ID">
                      Other Government ID
                    </option>
                  </select>
                </label>

                <label>
                  Government ID Upload
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={(event) => {
                      setIdFile(
                        event.target.files?.[0] ?? null
                      );
                      setReplacementIdUploaded(false);
                    }}
                    required
                  />
                </label>

                <p className="muted-text">
                  {idFile
                    ? `Selected file: ${idFile.name}`
                    : "Upload a clear JPG, PNG, or PDF copy of your current government ID."}
                </p>
              </div>
            )}

            {account.id_is_valid && (
              <div className="success-callout">
                <strong>Valid government ID on file</strong>
                <p>{account.id_status_message}</p>
              </div>
            )}

            <label>
              Preferred Gate
              <select
                value={form.defaultGate}
                onChange={(event) =>
                  updateField(
                    "defaultGate",
                    event.target.value as GateName
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
        )}

        {step === 1 && (
          <div className="mobile-form-stack">
            <p className="muted-text">
              This person may be contacted in the event of an emergency
              during your access period.
            </p>

            <div className="form-grid">
              <label>
                Emergency Contact Name
                <input
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
          </div>
        )}

        {step === 2 && (
          <div className="mobile-form-stack">
            <div className="info-callout">
              <strong>Access Rules and Conditions</strong>
              <p>
                Read and acknowledge each rule. All ten checkboxes must
                be selected before continuing.
              </p>
            </div>

            <div className="rule-list access-rule-list">
              <RuleItem
                number={1}
                title="Daily access requests"
                checked={form.dailyRequestAccepted}
                onChange={(checked) =>
                  updateField("dailyRequestAccepted", checked)
                }
              >
                I understand that I must submit a separate access request
                for each day access is desired. Requests may be submitted
                up to 90 days in advance. Gate codes will be available
                through the Kapāpala Forest Access App only when I have an
                approved request for that day, the current time is within
                the authorized gate hours, and I am within the immediate
                vicinity of the gate.
              </RuleItem>

              <RuleItem
                number={2}
                title="Sign in and sign out"
                checked={form.signInOutAccepted}
                onChange={(checked) =>
                  updateField("signInOutAccepted", checked)
                }
              >
                I understand that everyone in my party must sign in and
                sign out at the registration box located at the Kapāpala
                Ranch gate.
              </RuleItem>

              <RuleItem
                number={3}
                title="Use the same gate"
                checked={form.sameGateAccepted}
                onChange={(checked) =>
                  updateField("sameGateAccepted", checked)
                }
              >
                I understand that each gate leads to a different part of
                the Forest Reserve and the roads do not connect. Entry and
                exit must be through the same gate.
              </RuleItem>

              <RuleItem
                number={4}
                title="Remain on marked access roads"
                checked={form.markedRoadsAccepted}
                onChange={(checked) =>
                  updateField("markedRoadsAccepted", checked)
                }
              >
                I understand that my party and I must remain on marked
                access roads at all times.
              </RuleItem>

              <RuleItem
                number={5}
                title="Dogs must remain secured"
                checked={form.dogsSecuredAccepted}
                onChange={(checked) =>
                  updateField("dogsSecuredAccepted", checked)
                }
              >
                I understand that all dogs must remain secured inside the
                vehicle until reaching the Forest Reserve.
              </RuleItem>

              <RuleItem
                number={6}
                title="Interior gates"
                checked={form.interiorGatesAccepted}
                onChange={(checked) =>
                  updateField("interiorGatesAccepted", checked)
                }
              >
                I understand that interior gates must be left in the
                position indicated by Kapāpala Ranch. Open gates must be
                left open and closed gates must be closed after passing
                through.
              </RuleItem>

              <RuleItem
                number={7}
                title="Vehicle parking"
                checked={form.parkingAccepted}
                onChange={(checked) =>
                  updateField("parkingAccepted", checked)
                }
              >
                I understand that vehicles may only be parked within the
                Forest Reserve unless permission is granted by Kapāpala
                Ranch.
              </RuleItem>

              <RuleItem
                number={8}
                title="No hunting within Kapāpala Ranch"
                checked={form.noHuntingAccepted}
                onChange={(checked) =>
                  updateField("noHuntingAccepted", checked)
                }
              >
                I understand that hunting is prohibited within Kapāpala
                Ranch.
              </RuleItem>

              <RuleItem
                number={9}
                title="Gate closing times and overnight stays"
                checked={form.closingTimeAccepted}
                onChange={(checked) =>
                  updateField("closingTimeAccepted", checked)
                }
              >
                I understand that my party and I must exit before the
                designated gate closing time. Gate codes may change at
                closing, and overnight stays within Kapāpala Ranch are
                prohibited.
              </RuleItem>

              <RuleItem
                number={10}
                title="Misuse of access privileges"
                checked={form.misuseAccepted}
                onChange={(checked) =>
                  updateField("misuseAccepted", checked)
                }
              >
                I understand that violating access rules or sharing gate
                combinations may result in suspension or revocation of my
                access privileges.
              </RuleItem>
            </div>

            {!allRulesAccepted && (
              <p className="muted-text">
                Please acknowledge all ten access rules to continue.
              </p>
            )}

            {allRulesAccepted && (
              <div className="success-callout">
                All access rules have been acknowledged.
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="mobile-form-stack">
            <div className="approval-preview">
              <div className="approval-icon">✓</div>

              <div>
                <h2>Ready to Complete Setup</h2>
                <p>
                  Review the information below before completing your
                  one-time account setup.
                </p>
              </div>
            </div>

            <div className="request-summary-grid">
              <SummaryItem
                label="Name"
                value={`${form.firstName} ${form.lastName}`}
              />
              <SummaryItem label="Email" value={form.email} />
              <SummaryItem label="Phone" value={form.phone} />
              <SummaryItem
                label="Mailing Address"
                value={form.mailingAddress || "Not provided"}
              />
              <SummaryItem
                label="Organization / Agency"
                value={form.organization}
              />
              <SummaryItem
                label="Gate Code Device"
                value={formatDeviceType(form.deviceType)}
              />
              <SummaryItem
                label="Preferred Gate"
                value={form.defaultGate}
              />
              <SummaryItem
                label="Emergency Contact"
                value={form.emergencyContactName}
              />
              <SummaryItem
                label="Emergency Phone"
                value={form.emergencyContactPhone}
              />
              <SummaryItem
                label="Access Rules"
                value="All 10 acknowledged"
              />
              <SummaryItem
                label="ID Document"
                value={
                  account.id_is_valid
                    ? "Valid ID on file"
                    : replacementIdUploaded
                      ? "Replacement uploaded"
                      : idFile
                        ? `Replacement selected: ${idFile.name}`
                        : "Replacement required"
                }
              />
            </div>
          </div>
        )}

        <div className="wizard-actions">
          <button
            type="button"
            className="button secondary"
            onClick={previousStep}
            disabled={step === 0 || isSubmitting}
          >
            Back
          </button>

          {step < steps.length - 1 ? (
            <button
              type="button"
              className="button primary"
              onClick={nextStep}
              disabled={!isStepComplete(step) || isSubmitting}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="button primary"
              onClick={completeSetup}
              disabled={!isStepComplete(3) || isSubmitting}
            >
              {isSubmitting
                ? "Completing Setup..."
                : "Complete Account Setup"}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

function RuleItem({
  number,
  title,
  checked,
  onChange,
  children,
}: {
  number: number;
  title: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="access-rule-item">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />

      <span className="access-rule-number">{number}</span>

      <span className="access-rule-text">
        <strong>{title}</strong>
        {children}
      </span>
    </label>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}
