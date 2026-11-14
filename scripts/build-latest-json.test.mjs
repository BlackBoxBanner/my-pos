import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  artifactNameFromSig,
  buildLatestJson,
  buildPlatforms,
  platformKeyForArtifact,
  versionFromTag,
} from "./build-latest-json.mjs";

describe("versionFromTag", () => {
  it("strips leading v", () => {
    assert.equal(versionFromTag("v0.1.2"), "0.1.2");
  });
  it("keeps bare semver", () => {
    assert.equal(versionFromTag("0.1.2"), "0.1.2");
  });
});

describe("platformKeyForArtifact", () => {
  it("maps macOS aarch64 updater bundle", () => {
    assert.equal(
      platformKeyForArtifact("My.POS_0.1.2_aarch64.app.tar.gz"),
      "darwin-aarch64",
    );
  });
  it("maps macOS x64 updater bundle", () => {
    assert.equal(
      platformKeyForArtifact("My.POS_0.1.2_x64.app.tar.gz"),
      "darwin-x86_64",
    );
  });
  it("maps Windows NSIS setup", () => {
    assert.equal(
      platformKeyForArtifact("My.POS_0.1.2_x64-setup.exe"),
      "windows-x86_64",
    );
  });
  it("maps Linux AppImage", () => {
    assert.equal(
      platformKeyForArtifact("My.POS_0.1.2_amd64.AppImage"),
      "linux-x86_64",
    );
  });
  it("maps Windows MSI as a windows platform", () => {
    assert.equal(
      platformKeyForArtifact("My.POS_0.1.2_x64_en-US.msi"),
      "windows-x86_64",
    );
  });
});

describe("buildPlatforms", () => {
  const base = [
    {
      name: "My.POS_0.1.2_aarch64.app.tar.gz.sig",
      signature: "sig-aarch64\r\n",
    },
    {
      name: "My.POS_0.1.2_x64.app.tar.gz.sig",
      signature: "sig-x64",
    },
    {
      name: "My.POS_0.1.2_x64-setup.exe.sig",
      signature: "sig-nsis",
    },
    {
      name: "My.POS_0.1.2_amd64.AppImage.sig",
      signature: "sig-appimage",
    },
  ];

  it("builds all four platforms and strips CR", () => {
    const platforms = buildPlatforms(base, "v0.1.2");
    assert.deepEqual(Object.keys(platforms).sort(), [
      "darwin-aarch64",
      "darwin-x86_64",
      "linux-x86_64",
      "windows-x86_64",
    ]);
    assert.equal(platforms["darwin-aarch64"].signature, "sig-aarch64");
    assert.equal(
      platforms["windows-x86_64"].url,
      "https://github.com/BlackBoxBanner/my-pos/releases/download/v0.1.2/My.POS_0.1.2_x64-setup.exe",
    );
  });

  it("prefers NSIS over MSI", () => {
    const platforms = buildPlatforms(
      [
        ...base,
        {
          name: "My.POS_0.1.2_x64_en-US.msi.sig",
          signature: "sig-msi",
        },
      ],
      "v0.1.2",
    );
    assert.equal(platforms["windows-x86_64"].signature, "sig-nsis");
    assert.match(platforms["windows-x86_64"].url, /-setup\.exe$/);
  });

  it("fails when a platform is missing", () => {
    assert.throws(
      () => buildPlatforms(base.slice(0, 3), "v0.1.2"),
      /missing updater platforms: linux-x86_64/,
    );
  });
});

describe("buildLatestJson", () => {
  it("returns version and platforms", () => {
    const json = buildLatestJson({
      tag: "v0.1.2",
      notes: "test",
      pubDate: "2026-11-13T00:00:00.000Z",
      assets: [
        {
          name: "My.POS_0.1.2_aarch64.app.tar.gz.sig",
          signature: "a",
        },
        { name: "My.POS_0.1.2_x64.app.tar.gz.sig", signature: "b" },
        { name: "My.POS_0.1.2_x64-setup.exe.sig", signature: "c" },
        { name: "My.POS_0.1.2_amd64.AppImage.sig", signature: "d" },
      ],
    });
    assert.equal(json.version, "0.1.2");
    assert.equal(json.notes, "test");
    assert.equal(json.pub_date, "2026-11-13T00:00:00.000Z");
    assert.equal(artifactNameFromSig("x.sig"), "x");
  });
});
