"use client";

/** Hidden field that carries the browser's IANA timezone when the form is saved. */
export function TimezoneField({ fallback }: { fallback: string }) {
  return (
    <input
      type="hidden"
      name="timezone"
      defaultValue={fallback}
      ref={(el) => {
        if (el) el.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }}
    />
  );
}
