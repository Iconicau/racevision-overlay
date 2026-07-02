"""
Probe script — tests iRacing auth directly, bypassing iracingdataapi library.
"""
import getpass
import hashlib
import json
import sys
import urllib3

urllib3.disable_warnings()
import requests

session = requests.Session()
session.verify = False

print("iRacing API probe")
print("-" * 40)
print("Credentials are entered here and sent only to iRacing's servers.\n")

email    = input("iRacing email: ").strip()
password = getpass.getpass("iRacing password: ")

# iRacing hashes the password before sending (same as their website)
pw_hash   = hashlib.sha256(password.encode("utf-8")).hexdigest()
final_hash = hashlib.sha256(f"{pw_hash}{email.lower()}".encode("utf-8")).hexdigest()

print("\nSending auth request to iRacing...")
r = session.post(
    "https://members-ng.iracing.com/auth",
    headers={"Content-Type": "application/json"},
    json={"email": email, "password": final_hash},
)

print(f"Status code : {r.status_code}")
print(f"Body length : {len(r.text)} chars")
print(f"Body preview: {r.text[:300]!r}")
