import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../services/navigation", () => ({
  navigateToLogin: vi.fn(),
  navigateToForbidden: vi.fn(),
}));

import { api } from "../../services/api";
import { navigateToForbidden, navigateToLogin } from "../../services/navigation";

function mockFetchOnce(response: Response) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response));
}

describe("api request auth redirects", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects to /forbidden when API returns 403 and token exists", async () => {
    localStorage.setItem("logisim-auth", JSON.stringify({ token: "t", user: { id: "u" } }));
    mockFetchOnce(new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }));

    await expect(api.getVehicleMe()).rejects.toThrow();
    expect(navigateToForbidden).toHaveBeenCalledTimes(1);
    expect(navigateToLogin).toHaveBeenCalledTimes(0);
  });

  it("clears auth and redirects to /login when API returns 401 and token exists", async () => {
    localStorage.setItem("logisim-auth", JSON.stringify({ token: "t", user: { id: "u" } }));
    mockFetchOnce(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));

    await expect(api.getVehicleMe()).rejects.toThrow();
    expect(localStorage.getItem("logisim-auth")).toBeNull();
    expect(navigateToLogin).toHaveBeenCalledTimes(1);
    expect(navigateToForbidden).toHaveBeenCalledTimes(0);
  });

  it("does not redirect when no token exists", async () => {
    mockFetchOnce(new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }));

    await expect(api.getVehicleMe()).rejects.toThrow();
    expect(navigateToLogin).toHaveBeenCalledTimes(0);
    expect(navigateToForbidden).toHaveBeenCalledTimes(0);
  });
});

