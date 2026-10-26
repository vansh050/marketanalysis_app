#!/usr/bin/env python3
"""Submit a VALID TestFlight build for App Store review (App Store Connect API).

Run by .github/workflows/ios-submit.yml with the same secrets as ios-build.yml.

Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (the .p8), ASC_BUNDLE_ID.
Args: --build N (default: newest VALID build), --notes "What's new",
      --replace-waiting (cancel a submission already waiting for review and put
      this build in its place), --manual-release, --age-rating-social-media
      true|false (answers Apple's age-rating "social media" question when it is
      still blank; the answer is the app owner's declaration, so it is never
      guessed).

Refuses unless the build is VALID. The App Store version string is the build's
marketing version: an editable version with that string is reused, otherwise a
new one is created. What's New is skipped on an app's first version (Apple
rejects it there).
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

import jwt

BASE = "https://api.appstoreconnect.apple.com"
EDITABLE = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"}
OPEN_SUBMISSION = {"READY_FOR_REVIEW", "WAITING_FOR_REVIEW", "IN_REVIEW", "UNRESOLVED_ISSUES"}


def die(msg):
    print(f"REFUSED: {msg}", file=sys.stderr)
    sys.exit(2)


def token():
    now = int(time.time())
    return jwt.encode({"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 1100,
                       "aud": "appstoreconnect-v1"}, open(os.environ["ASC_KEY_PATH"]).read(),
                      algorithm="ES256", headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"})


def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {token()}",
                                          "Content-Type": "application/json"})
    try:
        raw = urllib.request.urlopen(req, timeout=60).read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ASC {e.code} on {method} {path}: {e.read().decode()[:800]}")
    return json.loads(raw) if raw else {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--build")
    ap.add_argument("--notes", default="")
    ap.add_argument("--replace-waiting", action="store_true")
    ap.add_argument("--manual-release", action="store_true")
    ap.add_argument("--age-rating-social-media", choices=["true", "false"])
    a = ap.parse_args()

    apps = call("GET", f"/v1/apps?filter[bundleId]={os.environ['ASC_BUNDLE_ID']}")["data"]
    if not apps:
        die(f"no app with bundle id {os.environ['ASC_BUNDLE_ID']}")
    app_id = apps[0]["id"]

    q = f"/v1/builds?filter[app]={app_id}&sort=-uploadedDate&limit=10&include=preReleaseVersion"
    if a.build:
        q += f"&filter[version]={a.build}"
    b = call("GET", q)
    pre = {i["id"]: i["attributes"]["version"] for i in b.get("included", [])}
    cands = [d for d in b["data"] if d["attributes"]["processingState"] == "VALID"]
    if not cands:
        die(f"no VALID build{' ' + a.build if a.build else ''} yet")
    build = cands[0]
    num = build["attributes"]["version"]
    mv = pre[build["relationships"]["preReleaseVersion"]["data"]["id"]]
    print(f"build {mv} ({num})")
    if build["attributes"].get("usesNonExemptEncryption") is None:
        call("PATCH", f"/v1/builds/{build['id']}", {"data": {
            "type": "builds", "id": build["id"], "attributes": {"usesNonExemptEncryption": False}}})

    subs = call("GET", f"/v1/reviewSubmissions?filter[app]={app_id}&filter[platform]=IOS&limit=20")["data"]
    waiting = [s for s in subs if s["attributes"].get("state") in OPEN_SUBMISSION]
    if waiting:
        if not a.replace_waiting:
            die(f"a submission is already {waiting[0]['attributes']['state']}; "
                "re-run with replace_waiting to put this build in its place")
        for s in waiting:
            if s["attributes"]["state"] == "IN_REVIEW":
                die("a submission is IN_REVIEW; Apple is reviewing it now, not replacing it")
            print(f"cancelling submission {s['id']} ({s['attributes']['state']})")
            call("PATCH", f"/v1/reviewSubmissions/{s['id']}", {"data": {
                "type": "reviewSubmissions", "id": s["id"], "attributes": {"canceled": True}}})

    def versions():
        return call("GET", f"/v1/apps/{app_id}/appStoreVersions?filter[platform]=IOS&limit=20")["data"]

    vs = versions()
    first_version = not any(v["attributes"]["appStoreState"] == "READY_FOR_SALE" for v in vs)
    ver = next((v for v in vs if v["attributes"]["appStoreState"] not in
                {"READY_FOR_SALE", "REPLACED_WITH_NEW_VERSION", "REMOVED_FROM_SALE"}), None)
    for _ in range(40):
        if not ver or ver["attributes"]["appStoreState"] in EDITABLE:
            break
        print(f"waiting for version {ver['attributes']['versionString']} to become editable "
              f"({ver['attributes']['appStoreState']})")
        time.sleep(15)
        ver = next(v for v in versions() if v["id"] == ver["id"])
    else:
        die("the open App Store version never became editable")

    release = "MANUAL" if a.manual_release else "AFTER_APPROVAL"
    if not ver:
        ver = call("POST", "/v1/appStoreVersions", {"data": {
            "type": "appStoreVersions",
            "attributes": {"platform": "IOS", "versionString": mv, "releaseType": release},
            "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})["data"]
        print(f"created App Store version {mv}")
    elif ver["attributes"]["versionString"] != mv and not first_version:
        call("PATCH", f"/v1/appStoreVersions/{ver['id']}", {"data": {
            "type": "appStoreVersions", "id": ver["id"], "attributes": {"versionString": mv}}})
        print(f"version {ver['attributes']['versionString']} renamed to {mv}")

    call("PATCH", f"/v1/appStoreVersions/{ver['id']}/relationships/build",
         {"data": {"type": "builds", "id": build["id"]}})
    print(f"attached build {num} to version {ver['attributes'].get('versionString', mv)}")

    if a.notes and not first_version:
        for loc in call("GET", f"/v1/appStoreVersions/{ver['id']}/appStoreVersionLocalizations")["data"]:
            if loc["attributes"]["locale"].startswith("en"):
                call("PATCH", f"/v1/appStoreVersionLocalizations/{loc['id']}", {"data": {
                    "type": "appStoreVersionLocalizations", "id": loc["id"],
                    "attributes": {"whatsNew": a.notes[:4000]}}})

    decl = call("GET", f"/v1/appStoreVersions/{ver['id']}/ageRatingDeclaration")["data"]
    if decl["attributes"].get("socialMedia") is None:
        if a.age_rating_social_media is None:
            die("Apple's age rating has no answer for 'social media'; re-run with "
                "age_rating_social_media true or false (the app owner's declaration)")
        call("PATCH", f"/v1/ageRatingDeclarations/{decl['id']}", {"data": {
            "type": "ageRatingDeclarations", "id": decl["id"],
            "attributes": {"socialMedia": a.age_rating_social_media == "true"}}})
        print(f"age rating: social media = {a.age_rating_social_media}")

    sub = call("POST", "/v1/reviewSubmissions", {"data": {
        "type": "reviewSubmissions", "attributes": {"platform": "IOS"},
        "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})["data"]
    call("POST", "/v1/reviewSubmissionItems", {"data": {
        "type": "reviewSubmissionItems",
        "relationships": {"reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub["id"]}},
                          "appStoreVersion": {"data": {"type": "appStoreVersions", "id": ver["id"]}}}}})
    r = call("PATCH", f"/v1/reviewSubmissions/{sub['id']}", {"data": {
        "type": "reviewSubmissions", "id": sub["id"], "attributes": {"submitted": True}}})
    print(f"submitted {mv} ({num}) for review: {r['data']['attributes']['state']}")


if __name__ == "__main__":
    main()
