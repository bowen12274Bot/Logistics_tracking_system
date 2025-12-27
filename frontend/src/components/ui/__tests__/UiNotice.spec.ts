import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import UiNotice from "../UiNotice.vue";

describe("UiNotice", () => {
  it("renders default info tone and status role", () => {
    const wrapper = mount(UiNotice, {
      slots: { default: "Hello" },
    });

    expect(wrapper.classes()).toContain("ui-notice");
    expect(wrapper.classes()).toContain("ui-notice--info");
    expect(wrapper.attributes("role")).toBe("status");
  });

  it("supports explicit alert role and error tone", () => {
    const wrapper = mount(UiNotice, {
      props: { tone: "error", role: "alert" },
      slots: { default: "Bad" },
    });

    expect(wrapper.classes()).toContain("ui-notice--error");
    expect(wrapper.attributes("role")).toBe("alert");
  });

  it("omits role attribute when role is none", () => {
    const wrapper = mount(UiNotice, {
      props: { role: "none" },
      slots: { default: "No role" },
    });

    expect(wrapper.attributes("role")).toBeUndefined();
  });
});

