"use client";

import { useState } from "react";
import Card from "../../ui/Card";
import StatusBadge from "../../ui/StatusBadge";

export default function VehicleManager({
  accountId,
  vehicles,
  refresh,
  refreshTimeline,
}: {
  accountId: string;
  vehicles: any[];
  refresh: () => Promise<void>;
  refreshTimeline: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    label: "",
    licensePlate: "",
    state: "HI",
    make: "",
    model: "",
    color: "",
    isDefault: false,
  });

  async function addVehicle() {
    setSaving(true);

    try {
      const response = await fetch(`/api/access-accounts/${accountId}/vehicles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || "Unable to add vehicle.");
        return;
      }

      setForm({
        label: "",
        licensePlate: "",
        state: "HI",
        make: "",
        model: "",
        color: "",
        isDefault: false,
      });

      setShowForm(false);
      await refresh();
      await refreshTimeline();
    } finally {
      setSaving(false);
    }
  }

  async function deleteVehicle(vehicleId: string) {
    if (!confirm("Remove this vehicle?")) return;

    const response = await fetch(`/api/vehicles/${vehicleId}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      alert(result.error || "Unable to remove vehicle.");
      return;
    }

    await refresh();
    await refreshTimeline();
  }

  return (
    <Card title="Registered Vehicles">
      <div className="saved-item-list">
        {vehicles?.length ? (
          vehicles.map((vehicle) => (
            <div key={vehicle.id}>
              <strong>{vehicle.label}</strong>
              <span>
                {vehicle.state} {vehicle.license_plate}
              </span>

              {vehicle.is_default && <StatusBadge label="Primary" tone="green" />}

              <button
                className="button danger"
                type="button"
                onClick={() => deleteVehicle(vehicle.id)}
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <p className="muted-text">No vehicles registered.</p>
        )}
      </div>

      {!showForm ? (
        <button
          className="button secondary full-width"
          type="button"
          onClick={() => setShowForm(true)}
        >
          + Add Vehicle
        </button>
      ) : (
        <div className="mobile-form-stack" style={{ marginTop: 16 }}>
          <div className="form-grid">
            <label>
              Vehicle Description
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="White Ford F-150"
              />
            </label>

            <label>
              License Plate
              <input
                value={form.licensePlate}
                onChange={(e) =>
                  setForm({ ...form, licensePlate: e.target.value.toUpperCase() })
                }
                placeholder="ABC123"
              />
            </label>

            <label>
              State
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </label>

            <label>
              Color
              <input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </label>
          </div>

          <label>
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            Primary vehicle
          </label>

          <button
            className="button primary"
            type="button"
            onClick={addVehicle}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Vehicle"}
          </button>
        </div>
      )}
    </Card>
  );
}