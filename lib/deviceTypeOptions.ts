export const DEVICE_TYPE_OPTIONS = [
  {
    value: "iphone",
    label: "iPhone",
  },
  {
    value: "android",
    label: "Android phone",
  },
  {
    value: "basic_phone",
    label: "Basic / Flip phone",
  },
] as const;

export type DeviceType =
  (typeof DEVICE_TYPE_OPTIONS)[number]["value"];

export function formatDeviceType(
  value: string | null | undefined
): string {
  switch (value) {
    case "iphone":
      return "iPhone";
    case "android":
      return "Android phone";
    case "basic_phone":
      return "Basic / Flip phone";
    default:
      return "Not provided";
  }
}
