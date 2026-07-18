export const DEFAULT_ORGANIZATION = "Public Access User";

export const ORGANIZATION_OPTIONS = [
  DEFAULT_ORGANIZATION,
  "National Park Service",
  "State of Hawaii - DLNR",
  "State of Hawaii - Other",
  "Kapāpala Ranch",
] as const;

export function organizationOptionsWithCurrent(
  currentValue: string | null | undefined
): string[] {
  const cleanedValue = currentValue?.trim() || "";

  if (
    cleanedValue &&
    !ORGANIZATION_OPTIONS.includes(
      cleanedValue as (typeof ORGANIZATION_OPTIONS)[number]
    )
  ) {
    return [...ORGANIZATION_OPTIONS, cleanedValue];
  }

  return [...ORGANIZATION_OPTIONS];
}
