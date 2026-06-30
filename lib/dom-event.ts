/** Read `.value` from input/textarea change events (strict builds where HTMLInputElement.value is missing). */
export function inputValueFromEvent(e: { target: EventTarget }): string {
  return (e.target as unknown as { value: string }).value;
}

/** Read `.value` from a select change event. */
export function selectValueFromEvent(e: { target: EventTarget }): string {
  return (e.target as unknown as { value: string }).value;
}
