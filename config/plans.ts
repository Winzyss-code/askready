// What each plan is, in one place, so the copy can't drift from what the code enforces.
// The free limit is enforced in SQL: FREE_SESSIONS_PER_DAY must match the count check
// in create_practice (supabase/schema.sql). Changing it here alone changes nothing.
export const FREE_SESSIONS_PER_DAY = 1;

// Planned, not charged. Pro is a waitlist; nothing in the app takes a payment.
export const PRO_PLANNED_PRICE = "$12.99";

const inWords = ["no", "one", "two", "three", "four", "five"];
/** The free limit as copy: "one session a day". */
export const freeAllowance = `${inWords[FREE_SESSIONS_PER_DAY] ?? FREE_SESSIONS_PER_DAY} session${FREE_SESSIONS_PER_DAY === 1 ? "" : "s"} a day`;
export const FreeAllowance = freeAllowance[0].toUpperCase() + freeAllowance.slice(1);
