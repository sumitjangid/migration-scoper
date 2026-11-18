import { describe, expect, it, vi } from "vitest";
import { assertPublicHttpUrl, isPublicIpAddress } from "./url-safety";

describe("public URL validation", () => {
  it("allows public IP addresses and blocks local or reserved ranges", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("2001:4860:4860::8888")).toBe(true);
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("169.254.169.254")).toBe(false);
    expect(isPublicIpAddress("::ffff:192.168.1.1")).toBe(false);
    expect(isPublicIpAddress("2001:db8::1")).toBe(false);
  });

  it("rejects local hosts and non-standard ports", async () => {
    const resolveAddresses = vi.fn();
    await expect(assertPublicHttpUrl("http://localhost/", resolveAddresses)).rejects.toThrow(/Local and intranet/);
    await expect(assertPublicHttpUrl("https://store.example.com:8443/", resolveAddresses)).rejects.toThrow(/standard HTTP/);
    expect(resolveAddresses).not.toHaveBeenCalled();
  });

  it("rejects hostnames with any private DNS answer", async () => {
    const resolveAddresses = async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.4", family: 4 },
    ];

    await expect(assertPublicHttpUrl("https://store.example.com/", resolveAddresses))
      .rejects.toThrow(/only to public IP addresses/);
  });

  it("returns public DNS answers for the browser to pin", async () => {
    const resolveAddresses = async () => [{ address: "8.8.8.8", family: 4 }];

    const result = await assertPublicHttpUrl("https://store.example.com/", resolveAddresses);
    expect(result.addresses).toEqual([{ address: "8.8.8.8", family: 4 }]);
  });
});
