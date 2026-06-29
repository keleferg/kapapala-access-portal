export function generateAccessId(sequenceNumber: number, year = new Date().getFullYear()) {
  return `KAP-${year}-${String(sequenceNumber).padStart(5, '0')}`;
}
