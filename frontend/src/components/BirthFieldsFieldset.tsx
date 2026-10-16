"use client";

import { useState } from "react";

import { Field } from "@/components/Field";
import type { BirthData, BirthTimeConfidence } from "@/lib/types";

const TIME_CONFIDENCE_OPTIONS: { value: BirthTimeConfidence; label: string }[] = [
  { value: "EXACT", label: "Exact - I know the time" },
  { value: "ESTIMATED", label: "Estimated - approximately" },
  { value: "UNKNOWN", label: "Unknown - I don't know it" },
];

/**
 * The six birth-data inputs, shared between the calculation form
 * (`BirthDataForm`) and the saved-profile form (`ProfileForm`) - both post
 * the same `BirthData` shape to the backend, so the fields themselves (and
 * their validation error keys, `birth.<field>`) are identical. `defaults`
 * pre-fills from an existing saved profile when editing one.
 */
export function BirthFieldsFieldset({
  fieldErrors,
  defaults,
}: {
  fieldErrors: Record<string, string>;
  defaults?: BirthData;
}) {
  const [timeConfidence, setTimeConfidence] = useState<BirthTimeConfidence>(
    defaults?.time_confidence ?? "EXACT",
  );
  const timeIsUsable = timeConfidence !== "UNKNOWN";

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Field label="Birth date" error={fieldErrors["birth.birth_date"]}>
        <input
          type="date"
          name="birth_date"
          required
          defaultValue={defaults?.birth_date}
          className="input"
        />
      </Field>

      <Field label="Time confidence">
        <select
          name="time_confidence"
          value={timeConfidence}
          onChange={(event) =>
            setTimeConfidence(event.target.value as BirthTimeConfidence)
          }
          className="input"
        >
          {TIME_CONFIDENCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Birth time"
        error={fieldErrors["birth.birth_time"]}
        hint={!timeIsUsable ? "Not needed - time is unknown" : undefined}
      >
        <input
          type="time"
          name="birth_time"
          step={1}
          disabled={!timeIsUsable}
          required={timeIsUsable}
          defaultValue={defaults?.birth_time?.slice(0, 5)}
          className="input disabled:opacity-40"
        />
      </Field>

      <Field label="Timezone" hint="Leave blank to detect from coordinates">
        <input
          type="text"
          name="timezone_name"
          placeholder="e.g. Asia/Kolkata"
          defaultValue={defaults?.timezone_name ?? ""}
          className="input"
        />
      </Field>

      <Field label="Latitude" error={fieldErrors["birth.latitude"]}>
        <input
          type="number"
          name="latitude"
          step="any"
          min={-90}
          max={90}
          required
          placeholder="18.9756"
          defaultValue={defaults?.latitude}
          className="input"
        />
      </Field>

      <Field label="Longitude" error={fieldErrors["birth.longitude"]}>
        <input
          type="number"
          name="longitude"
          step="any"
          min={-180}
          max={180}
          required
          placeholder="72.8258"
          defaultValue={defaults?.longitude}
          className="input"
        />
      </Field>
    </div>
  );
}
