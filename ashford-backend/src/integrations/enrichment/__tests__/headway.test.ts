import { describe, it, expect } from "vitest";
import { upgradeHeadwayPhotoResolution } from "../headway";

describe("upgradeHeadwayPhotoResolution", () => {
  it("upgrades width=500 to 1200 on Headway cdn-cgi/image URLs", () => {
    const raw =
      "https://care.headway.co/cdn-cgi/image/width=500,quality=100,format=auto,fit=contain/https%3A%2F%2Fassets.headway.co%2Fprovider_photos%2F174284%2Fae30628a-c342-11f0-b636-0a58a9feac02-174284-1763335160393.jpeg";
    const upgraded = upgradeHeadwayPhotoResolution(raw);
    expect(upgraded).toContain("width=1200");
    expect(upgraded).not.toContain("width=500");
    expect(upgraded).toContain("quality=90");
  });

  it("leaves non-Headway URLs unchanged", () => {
    const raw = "https://cdn.psychologytoday.com/sites/default/files/photo.jpg";
    expect(upgradeHeadwayPhotoResolution(raw)).toBe(raw);
  });

  it("leaves Headway URLs without the cdn-cgi resize wrapper unchanged", () => {
    const raw =
      "https://assets.headway.co/provider_photos/174284/ae30628a-c342-11f0-b636-0a58a9feac02.jpeg";
    expect(upgradeHeadwayPhotoResolution(raw)).toBe(raw);
  });

  it("is idempotent — running it twice yields the same URL", () => {
    const raw =
      "https://care.headway.co/cdn-cgi/image/width=500,quality=100,format=auto/https%3A%2F%2Fassets.headway.co%2Fphoto.jpg";
    const once = upgradeHeadwayPhotoResolution(raw);
    const twice = upgradeHeadwayPhotoResolution(once);
    expect(twice).toBe(once);
  });
});
