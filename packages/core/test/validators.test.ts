import { describe, expect, it } from "vitest";
import { birthDateFromCnp, isValidCnp, isValidDocNumber } from "../src/validators";

describe("validări act de identitate", () => {
  it("acceptă CNP-uri cu cifra de control corectă", () => {
    expect(isValidCnp("1980521130011")).toBe(true);
    expect(isValidCnp("2851104400122")).toBe(true);
    expect(isValidCnp("6010101012349")).toBe(true);
  });

  it("respinge CNP-uri greșite", () => {
    expect(isValidCnp("1980521130012")).toBe(false); // cifra de control
    expect(isValidCnp("198052113001")).toBe(false); // 12 cifre
    expect(isValidCnp("1981321130011")).toBe(false); // luna 13
    expect(isValidCnp("abcdefghijklm")).toBe(false);
  });

  it("extrage data nașterii din CNP", () => {
    expect(birthDateFromCnp("1980521130011").toISOString().slice(0, 10)).toBe("1998-05-21");
    expect(birthDateFromCnp("6010101012349").toISOString().slice(0, 10)).toBe("2001-01-01");
  });

  it("verifică seria și numărul actului", () => {
    expect(isValidDocNumber("CI", "CT 123456")).toBe(true);
    expect(isValidDocNumber("CI", "ct123456")).toBe(true);
    expect(isValidDocNumber("CI", "CT12345")).toBe(false);
    expect(isValidDocNumber("pasaport", "053123456")).toBe(true);
    expect(isValidDocNumber("pasaport", "12")).toBe(false);
  });
});
