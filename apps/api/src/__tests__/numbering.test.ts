import { describe, it, expect } from "vitest";
import { formatMemoNumber, getRomanMonth } from "../services/numberingService.js";

describe("Memo Numbering Formatter", () => {
  it("should convert month index to Roman numerals correctly", () => {
    expect(getRomanMonth(1)).toBe("I");
    expect(getRomanMonth(8)).toBe("VIII");
    expect(getRomanMonth(12)).toBe("XII");
  });

  it("should replace placeholders in format pattern correctly", () => {
    const testDate = new Date(2026, 7, 19); // August 19, 2026
    const formatted = formatMemoNumber(
      "{SEQUENCE}/{DEPT}/{TYPE}/{ROMAN_MONTH}/{YEAR}",
      42,
      4,
      "HR",
      "MEMO",
      testDate
    );
    expect(formatted).toBe("0042/HR/MEMO/VIII/2026");
  });
});
