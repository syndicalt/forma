import { expect, it } from "vitest";
import { calculateTotal } from "./billing.js";

it("applies discounts", () => {
  expect(calculateTotal(100, 15)).toBe(85);
});
