import { describe, it, expect } from "vitest";
import { detectBookingWidget } from "../bookingWidgetDetect";

describe("detectBookingWidget", () => {
  it("detects an embedded Calendly iframe", () => {
    const html = `<iframe src="https://calendly.com/dr-tara-langston/intro-call?embed_domain=acmetherapy.com"></iframe>`;
    const got = detectBookingWidget(html);
    expect(got?.provider).toBe("calendly");
    expect(got?.via).toBe("iframe");
    expect(got?.url).toContain("calendly.com/dr-tara-langston");
  });

  it("detects Calendly via the script + anchor combo", () => {
    const html = `
      <script src="https://assets.calendly.com/assets/external/widget.js"></script>
      <a href="https://calendly.com/dr-tara-langston/30min">Book a 30-minute consult</a>
    `;
    const got = detectBookingWidget(html);
    expect(got?.provider).toBe("calendly");
    expect(["script", "anchor"]).toContain(got?.via);
  });

  it("detects an IntakeQ booking link", () => {
    const html = `<a href="https://intakeq.com/booking/abc123">Book now</a>`;
    const got = detectBookingWidget(html);
    expect(got?.provider).toBe("intakeq");
    expect(got?.via).toBe("anchor");
  });

  it("detects a SimplePractice client-portal link", () => {
    const html = `<a href="https://acmetherapy.simplepractice.com/client_portal/sign_in">Patient Portal</a>`;
    const got = detectBookingWidget(html);
    expect(got?.provider).toBe("simplepractice");
  });

  it("detects an Acuity (Squarespace Scheduling) iframe", () => {
    const html = `<iframe src="https://app.squarespacescheduling.com/schedule.php?owner=12345"></iframe>`;
    const got = detectBookingWidget(html);
    expect(got?.provider).toBe("acuity");
  });

  it("detects a Headway link as a booking handoff", () => {
    const html = `<a href="https://care.headway.co/providers/tara-langston-2">Book through Headway</a>`;
    const got = detectBookingWidget(html);
    expect(got?.provider).toBe("headway");
  });

  it("detects a TidyCal iframe", () => {
    const html = `<iframe src="https://tidycal.com/dr-tara/30min"></iframe>`;
    const got = detectBookingWidget(html);
    expect(got?.provider).toBe("tidycal");
  });

  it("detects via data-url attribute", () => {
    const html = `<a data-url="https://calendly.com/dr-tara/intro" class="btn">Book Now</a>`;
    const got = detectBookingWidget(html);
    expect(got?.provider).toBe("calendly");
    expect(got?.via).toBe("data-url");
  });

  it("returns null when no booking widget present", () => {
    const html = `<p>We are not currently accepting new patients.</p>`;
    expect(detectBookingWidget(html)).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(detectBookingWidget("")).toBeNull();
  });
});
