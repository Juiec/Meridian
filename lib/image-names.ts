/** Local YYMMDDHHmmss stamp shared by every image created in one batch. */
export function batchFileStamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    String(date.getFullYear()).slice(-2),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

/** `meridian_2611261414220` — batch stamp with the image index appended. */
export function batchImageBaseName(stamp: string, index: number): string {
  if (!/^\d{12}$/.test(stamp) || !Number.isInteger(index) || index < 0 || index > 99) {
    throw new Error("Invalid batch image name.");
  }
  return `meridian_${stamp}${index}`;
}
