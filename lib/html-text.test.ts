import { describe, expect, it } from "vitest";

import { htmlToText } from "@/lib/html-text";

describe("html to text", () => {
  it("removes complete script blocks", () => {
    expect(htmlToText("<h1>Timetables</h1><script>window.__DATA__ = 'noise';</script><p>Search trains</p>"))
      .toBe("Timetables\n Search trains");
  });

  it("drops an unfinished script when the HTML input was truncated", () => {
    expect(
      htmlToText(
        '<h1>Timetables</h1><p>Search trains</p><script>self.__next_f.push([1,"hydration data cut off',
      ),
    ).toBe("Timetables\n Search trains");
  });
});
