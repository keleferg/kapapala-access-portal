"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "../ui/Card";
import StatusBadge from "../ui/StatusBadge";
import { getSupabaseClient } from "../../lib/supabaseClient";

type Vehicle = {
  id: string;
  access_account_id: string;
  label: string;
  license_plate: string | null;
  state: string | null;
  make: string | null;
  model: string | null;
  color: string | null;
  is_default: boolean;
  is_unlicensed_vehicle: boolean;
};

type VehicleForm = {
  label: string;
  make: string;
  model: string;
  color: string;
  licensePlate: string;
  state: string;
  isDefault: boolean;
  isUnlicensedVehicle: boolean;
};

const emptyForm: VehicleForm = {
  label: "",
  make: "",
  model: "",
  color: "",
  licensePlate: "",
  state: "HI",
  isDefault: false,
  isUnlicensedVehicle: false,
};

function vehicleDescription(vehicle: Vehicle) {
  const details = [vehicle.color, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(" ");

  return details || vehicle.label;
}

function vehicleRegistration(vehicle: Vehicle) {
  if (vehicle.is_unlicensed_vehicle) {
    return "Unlicensed ATV/UTV";
  }

  return [vehicle.state, vehicle.license_plate]
    .filter(Boolean)
    .join(" ");
}

export default function ManageMyVehicles({
  accountId,
}: {
  accountId: string;
}) {
  const supabase = getSupabaseClient();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await (supabase as any)
      .from("vehicles")
      .select(`
        id,
        access_account_id,
        label,
        license_plate,
        state,
        make,
        model,
        color,
        is_default,
        is_unlicensed_vehicle
      `)
      .eq("access_account_id", accountId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Unable to load vehicles:", error);
      setErrorMessage(error.message || "Unable to load vehicles.");
      setVehicles([]);
      setLoading(false);
      return;
    }

    setVehicles((data || []) as Vehicle[]);
    setLoading(false);
  }, [accountId, supabase]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  function resetForm() {
    setForm(emptyForm);
    setEditingVehicleId(null);
    setShowForm(false);
  }

  function startAdd() {
    setEditingVehicleId(null);
    setForm({
      ...emptyForm,
      isDefault: vehicles.length === 0,
    });
    setShowForm(true);
  }

  function startEdit(vehicle: Vehicle) {
    setEditingVehicleId(vehicle.id);
    setForm({
      label: vehicle.label || "",
      make: vehicle.make || "",
      model: vehicle.model || "",
      color: vehicle.color || "",
      licensePlate: vehicle.license_plate || "",
      state: vehicle.state || "HI",
      isDefault: vehicle.is_default,
      isUnlicensedVehicle: vehicle.is_unlicensed_vehicle,
    });
    setShowForm(true);
  }

  function setUnlicensedVehicle(checked: boolean) {
    setForm((current) => ({
      ...current,
      isUnlicensedVehicle: checked,
      licensePlate: checked ? "" : current.licensePlate,
      state: checked ? "" : current.state || "HI",
    }));
  }

  async function saveVehicle() {
    const label =
      form.label.trim() ||
      [form.color.trim(), form.make.trim(), form.model.trim()]
        .filter(Boolean)
        .join(" ");

    if (!label) {
      alert("Enter a vehicle description, make, model, or color.");
      return;
    }

    if (!form.isUnlicensedVehicle && !form.licensePlate.trim()) {
      alert("License plate is required for a licensed vehicle.");
      return;
    }

    if (!form.isUnlicensedVehicle && !form.state.trim()) {
      alert("State is required for a licensed vehicle.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        access_account_id: accountId,
        label,
        make: form.make.trim() || null,
        model: form.model.trim() || null,
        color: form.color.trim() || null,
        license_plate: form.isUnlicensedVehicle
          ? null
          : form.licensePlate.trim().toUpperCase(),
        state: form.isUnlicensedVehicle
          ? null
          : form.state.trim().toUpperCase(),
        is_default: form.isDefault || vehicles.length === 0,
        is_unlicensed_vehicle: form.isUnlicensedVehicle,
      };

      let savedVehicleId = editingVehicleId;

      if (editingVehicleId) {
        const { error } = await (supabase as any)
          .from("vehicles")
          .update(payload)
          .eq("id", editingVehicleId)
          .eq("access_account_id", accountId);

        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await (supabase as any)
          .from("vehicles")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        savedVehicleId = data.id;
      }

      if (payload.is_default && savedVehicleId) {
        const { error: defaultError } = await (supabase as any)
          .from("vehicles")
          .update({ is_default: false })
          .eq("access_account_id", accountId)
          .neq("id", savedVehicleId);

        if (defaultError) {
          throw defaultError;
        }
      }

      await loadVehicles();
      resetForm();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to save vehicle."
      );
    } finally {
      setSaving(false);
    }
  }

  async function makePrimary(vehicleId: string) {
    setSaving(true);

    try {
      const { error: selectedError } = await (supabase as any)
        .from("vehicles")
        .update({ is_default: true })
        .eq("id", vehicleId)
        .eq("access_account_id", accountId);

      if (selectedError) throw selectedError;

      const { error: othersError } = await (supabase as any)
        .from("vehicles")
        .update({ is_default: false })
        .eq("access_account_id", accountId)
        .neq("id", vehicleId);

      if (othersError) throw othersError;

      await loadVehicles();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to set primary vehicle."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeVehicle(vehicle: Vehicle) {
    if (
      !confirm(
        `Remove "${vehicle.label}" from your saved vehicles?`
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await (supabase as any)
        .from("vehicles")
        .delete()
        .eq("id", vehicle.id)
        .eq("access_account_id", accountId);

      if (error) throw error;

      const remainingVehicles = vehicles.filter(
        (item) => item.id !== vehicle.id
      );

      if (
        vehicle.is_default &&
        remainingVehicles.length > 0
      ) {
        const { error: primaryError } = await (supabase as any)
          .from("vehicles")
          .update({ is_default: true })
          .eq("id", remainingVehicles[0].id)
          .eq("access_account_id", accountId);

        if (primaryError) throw primaryError;
      }

      await loadVehicles();

      if (editingVehicleId === vehicle.id) {
        resetForm();
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to remove vehicle."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Manage My Vehicles">
      <p className="muted-text">
        Add the vehicles you normally use for Kapāpala access. Saved vehicles
        can be selected when you submit an access request.
      </p>

      {loading ? (
        <p className="muted-text">Loading saved vehicles...</p>
      ) : errorMessage ? (
        <div className="error-callout">
          <strong>Unable to load vehicles</strong>
          <p>{errorMessage}</p>
        </div>
      ) : (
        <div className="vehicle-card-list" style={{ marginTop: 14 }}>
          {vehicles.length ? (
            vehicles.map((vehicle) => (
              <div className="vehicle-card" key={vehicle.id}>
                <div>
                  <strong>{vehicle.label}</strong>

                  <span>{vehicleRegistration(vehicle)}</span>

                  {vehicleDescription(vehicle) !== vehicle.label && (
                    <span>{vehicleDescription(vehicle)}</span>
                  )}

                  {vehicle.is_default && (
                    <StatusBadge
                      label="Primary Vehicle"
                      tone="green"
                    />
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  {!vehicle.is_default && (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={saving}
                      onClick={() => void makePrimary(vehicle.id)}
                    >
                      Make Primary
                    </button>
                  )}

                  <button
                    type="button"
                    className="button secondary"
                    disabled={saving}
                    onClick={() => startEdit(vehicle)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="button danger"
                    disabled={saving}
                    onClick={() => void removeVehicle(vehicle)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="muted-text">
              You do not have any saved vehicles yet.
            </p>
          )}
        </div>
      )}

      {!showForm ? (
        <button
          type="button"
          className="button primary full-width"
          style={{ marginTop: 16 }}
          onClick={startAdd}
        >
          + Add Vehicle
        </button>
      ) : (
        <div className="mobile-form-stack" style={{ marginTop: 20 }}>
          <h3 style={{ marginBottom: 0 }}>
            {editingVehicleId ? "Edit Vehicle" : "Add Vehicle"}
          </h3>

          <label>
            Vehicle Description
            <input
              value={form.label}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              placeholder="Primary Truck"
            />
          </label>

          <div className="form-grid">
            <label>
              Make
              <input
                value={form.make}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    make: event.target.value,
                  }))
                }
                placeholder="Toyota"
              />
            </label>

            <label>
              Model
              <input
                value={form.model}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    model: event.target.value,
                  }))
                }
                placeholder="Tacoma"
              />
            </label>

            <label>
              Color
              <input
                value={form.color}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    color: event.target.value,
                  }))
                }
                placeholder="White"
              />
            </label>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <input
              type="checkbox"
              checked={form.isUnlicensedVehicle}
              onChange={(event) =>
                setUnlicensedVehicle(event.target.checked)
              }
            />
            Unlicensed Vehicle (ATV/UTV)
          </label>

          {form.isUnlicensedVehicle ? (
            <div className="info-callout">
              <strong>Unlicensed ATV/UTV</strong>
              <p>
                License plate and registration state are not required for this
                vehicle.
              </p>
            </div>
          ) : (
            <div className="form-grid">
              <label>
                License Plate
                <input
                  value={form.licensePlate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      licensePlate:
                        event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="ABC123"
                  required
                />
              </label>

              <label>
                State
                <input
                  value={form.state}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      state:
                        event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="HI"
                  maxLength={2}
                  required
                />
              </label>
            </div>
          )}

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isDefault: event.target.checked,
                }))
              }
            />
            Make this my primary vehicle
          </label>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <button
              type="button"
              className="button primary"
              disabled={saving}
              onClick={() => void saveVehicle()}
            >
              {saving ? "Saving..." : "Save Vehicle"}
            </button>

            <button
              type="button"
              className="button secondary"
              disabled={saving}
              onClick={resetForm}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
