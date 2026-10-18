// Validări pure (fără bază de date) — folosite și în browser, în formularul de check-in.

/** CNP românesc: 13 cifre, cifră de control conform algoritmului oficial. */
export function isValidCnp(cnp: string) {
  if (!/^[1-9]\d{12}$/.test(cnp)) return false;
  const w = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
  const sum = w.reduce((s, x, i) => s + x * Number(cnp[i]), 0);
  const c = sum % 11 === 10 ? 1 : sum % 11;
  if (c !== Number(cnp[12])) return false;
  const month = Number(cnp.slice(3, 5));
  const dayN = Number(cnp.slice(5, 7));
  return month >= 1 && month <= 12 && dayN >= 1 && dayN <= 31;
}

export function birthDateFromCnp(cnp: string) {
  const s = Number(cnp[0]);
  const century = s === 1 || s === 2 ? 1900 : s === 3 || s === 4 ? 1800 : s === 5 || s === 6 ? 2000 : 1900;
  return new Date(Date.UTC(century + Number(cnp.slice(1, 3)), Number(cnp.slice(3, 5)) - 1, Number(cnp.slice(5, 7))));
}

/** Seria și numărul actului: CI românesc (2 litere + 6 cifre) sau pașaport (6–9 caractere alfanumerice). */
export function isValidDocNumber(type: string, value: string) {
  const v = value.replace(/\s/g, "").toUpperCase();
  if (type === "CI") return /^[A-Z]{2}\d{6}$/.test(v);
  if (type === "pasaport") return /^[A-Z0-9]{6,9}$/.test(v);
  return false;
}

