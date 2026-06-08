import { describe, it, expect } from "vitest";
import { parseBhecResults } from "../texasBhec";
import { parseHealthgradesProfile } from "../healthgrades";

/**
 * Lock down the HTML parsers for the two new license/directory enrichment
 * sources. Both upstreams render server-side HTML with no public JSON API,
 * so the parsers are the only thing standing between us and silent
 * regressions when the markup shifts.
 *
 * Fixtures are inline (small) and represent the structural shape we care
 * about, not the live page byte-for-byte. If the live page changes, the
 * parser may degrade — these tests verify that *given* the current shape
 * we extract every documented field.
 */
describe("parseBhecResults", () => {
  it("extracts license rows with name, number, type, status, dates", () => {
    const html = `
      <html><body>
        <table id="results">
          <tr><th>Name</th><th>License Number</th><th>License Type</th><th>Status</th><th>Issued</th><th>Expires</th></tr>
          <tr>
            <td>Jane M. Doe</td>
            <td>LPC-12345</td>
            <td>Licensed Professional Counselor</td>
            <td>Active</td>
            <td>06/15/2018</td>
            <td>02/28/2027</td>
          </tr>
          <tr>
            <td>John Q. Public</td>
            <td>LMFT-67890</td>
            <td>Licensed Marriage Family Therapist</td>
            <td>Expired</td>
            <td>01/01/2010</td>
            <td>12/31/2020</td>
          </tr>
        </table>
      </body></html>
    `;
    const out = parseBhecResults(html);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      licenseNumber: "LPC-12345",
      licenseType: "Licensed Professional Counselor",
      status: "Active",
      issuedDate: "2018-06-15",
      expirationDate: "2027-02-28",
      fullName: "Jane M. Doe",
    });
    expect(out[1]).toMatchObject({
      licenseNumber: "LMFT-67890",
      status: "Expired",
      expirationDate: "2020-12-31",
    });
  });

  it("returns an empty list when no results table is present", () => {
    expect(parseBhecResults("<html><body>No matches found.</body></html>")).toEqual([]);
  });

  it("skips header rows and malformed license numbers", () => {
    const html = `
      <table id="results">
        <tr><th>Name</th><th>License Number</th><th>Type</th><th>Status</th></tr>
        <tr><td>Junk</td><td></td><td>X</td><td>Y</td></tr>
        <tr><td>Real Provider</td><td>LCSW-11111</td><td>LCSW</td><td>Active</td><td>01/01/2020</td><td>06/30/2025</td></tr>
      </table>
    `;
    const out = parseBhecResults(html);
    expect(out).toHaveLength(1);
    expect(out[0].licenseNumber).toBe("LCSW-11111");
  });
});

describe("parseHealthgradesProfile", () => {
  it("extracts name, photo, bio, rating, specialties from JSON-LD", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          ${JSON.stringify({
            "@type": "Physician",
            name: "Dr. Sarah Johnson",
            image: { url: "https://hg.example.com/photo.jpg" },
            description: "Board-certified psychiatrist with 15 years of clinical experience treating mood and anxiety disorders.",
            medicalSpecialty: ["Psychiatry", "Addiction Medicine"],
            alumniOf: [{ name: "UT Southwestern Medical School" }],
            aggregateRating: { ratingValue: 4.7, reviewCount: 132 },
          })}
        </script>
      </head><body><div>15+ years experience</div></body></html>
    `;
    const profile = parseHealthgradesProfile(
      html,
      "https://www.healthgrades.com/provider/sarah-johnson-xyz",
    );
    expect(profile).not.toBeNull();
    expect(profile!).toMatchObject({
      name: "Dr. Sarah Johnson",
      photoUrl: "https://hg.example.com/photo.jpg",
      rating: 4.7,
      reviewCount: 132,
      yearsExperience: 15,
    });
    expect(profile!.bio).toMatch(/Board-certified psychiatrist/);
    expect(profile!.specialties).toEqual(["Psychiatry", "Addiction Medicine"]);
    expect(profile!.education).toEqual(["UT Southwestern Medical School"]);
  });

  it("falls back to <section> bio when JSON-LD lacks description", () => {
    const html = `
      <html><body>
        <section class="about-section">
          ${"This is a long-form bio extracted from the about section. ".repeat(5)}
        </section>
      </body></html>
    `;
    const profile = parseHealthgradesProfile(
      html,
      "https://www.healthgrades.com/provider/jane-doe",
    );
    expect(profile).not.toBeNull();
    expect(profile!.bio).toMatch(/long-form bio/);
  });

  it("returns a profile with only profileUrl populated when nothing parses", () => {
    const profile = parseHealthgradesProfile(
      "<html><body>Empty page</body></html>",
      "https://www.healthgrades.com/provider/empty",
    );
    expect(profile).not.toBeNull();
    expect(profile!.profileUrl).toBe(
      "https://www.healthgrades.com/provider/empty",
    );
    expect(profile!.name).toBeNull();
    expect(profile!.bio).toBeNull();
  });
});
