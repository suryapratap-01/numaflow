import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { OptInBanner } from "./OptInBanner";

it("offers the new Pod View without replacing classic content", () => {
  const onTryNext = jest.fn();
  render(<OptInBanner onTryNext={onTryNext} />);

  expect(
    screen.getByText(
      "A lighter, API v2-backed Pod View is available for preview."
    )
  ).toBeVisible();
  fireEvent.click(screen.getByTestId("try-pod-view-next"));
  expect(onTryNext).toHaveBeenCalledTimes(1);
});
