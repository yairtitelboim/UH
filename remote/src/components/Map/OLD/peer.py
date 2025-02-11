import requests
import json
import re
from time import sleep
from datetime import datetime, timedelta
from typing import Dict, List

PEERINGDB_API_BASE = "https://peeringdb.com/api"
API_KEY = "YOUR_API_KEY_HERE"

# Which states to consider "DC area"
DC_STATES = ["DC", "VA", "MD"]

#########################
# Utility / Rate Limit
#########################
def extract_wait_time(error_message: str) -> int:
    """Extract wait time in minutes from PeeringDB error message."""
    match = re.search(r'Expected available in (\d+) minutes', error_message)
    if match:
        return int(match.group(1))
    return 0

def print_rate_limit_info(wait_minutes: int):
    """Print formatted rate limit information."""
    if wait_minutes > 0:
        now = datetime.now()
        available_at = now + timedelta(minutes=wait_minutes)
        print("\n=== Rate Limit Info ===")
        print(f"Currently rate limited. Need to wait {wait_minutes} minutes.")
        print(f"Requests will be available again at: {available_at.strftime('%I:%M %p')}")
        print("=" * 25)

#########################
# Fetching Data
#########################
def fetch_facilities_by_state(state: str) -> List[Dict]:
    """
    Fetch all facilities for a given US state.
    We'll combine DC, VA, and MD for a broader 'DC area'.
    """
    print(f"  Fetching facilities in {state} ...")
    headers = {"Authorization": f"Api-Key {API_KEY}"}
    params = {
        "country__iexact": "US",
        "state__iexact": state,
        "limit": 2000
    }
    url = f"{PEERINGDB_API_BASE}/fac"
    resp = requests.get(url, headers=headers, params=params)
    
    if resp.status_code == 200:
        data = resp.json().get("data", [])
        print(f"    => {len(data)} facilities in {state}")
        return data
    elif resp.status_code == 429:
        wait_minutes = extract_wait_time(resp.text)
        print_rate_limit_info(wait_minutes)
        return []
    else:
        print(f"    !! Error {resp.status_code} for {state} facilities")
        return []

def fetch_ixps_by_state(state: str) -> List[Dict]:
    """
    Fetch all IXPs for a given US state.
    We'll combine DC, VA, and MD for a broader 'DC area'.
    """
    print(f"  Fetching IXPs in {state} ...")
    headers = {"Authorization": f"Api-Key {API_KEY}"}
    params = {
        "country__iexact": "US",
        "state__iexact": state,
        "limit": 2000
    }
    url = f"{PEERINGDB_API_BASE}/ix"
    resp = requests.get(url, headers=headers, params=params)
    
    if resp.status_code == 200:
        data = resp.json().get("data", [])
        print(f"    => {len(data)} IXPs in {state}")
        return data
    elif resp.status_code == 429:
        wait_minutes = extract_wait_time(resp.text)
        print_rate_limit_info(wait_minutes)
        return []
    else:
        print(f"    !! Error {resp.status_code} for {state} IXPs")
        return []

def fetch_netixlan(limit=5000) -> List[Dict]:
    """
    Fetch netixlan data (up to 'limit' entries).
    netixlan links a network's port at an IXP (and potentially a facility).
    """
    print(f"  Fetching netixlan (limit={limit}) ...")
    headers = {"Authorization": f"Api-Key {API_KEY}"}
    params = {"limit": limit}
    url = f"{PEERINGDB_API_BASE}/netixlan"
    resp = requests.get(url, headers=headers, params=params)
    
    if resp.status_code == 200:
        data = resp.json().get("data", [])
        print(f"    => {len(data)} netixlan records fetched.")
        return data
    elif resp.status_code == 429:
        wait_minutes = extract_wait_time(resp.text)
        print_rate_limit_info(wait_minutes)
        return []
    else:
        print(f"    !! Error {resp.status_code} for netixlan.")
        return []

#########################
# Main Flow
#########################
def generate_dc_area_peering_json():
    """
    1. Fetch facilities for DC, VA, MD. Merge them.
    2. Fetch IXPs for DC, VA, MD. Merge them.
    3. Fetch netixlan (no filter), then filter only those referencing
       the facility/IXP IDs we actually have in the DC area set.
    4. Save raw data to 'dc_area_peering.json' or similar.
    """

    print("=== Starting DC-Area Peering Data Fetch (No Lat/Lon Filter) ===\n")
    
    # 1. Facilities
    all_facilities = []
    for st in DC_STATES:
        fac_list = fetch_facilities_by_state(st)
        all_facilities.extend(fac_list)
        sleep(1)  # small pause to reduce chance of rate-limit
    # Remove duplicates by 'id'
    facility_ids_seen = set()
    final_facilities = []
    for f in all_facilities:
        if f["id"] not in facility_ids_seen:
            facility_ids_seen.add(f["id"])
            final_facilities.append(f)
    
    print(f"\n>>> Total unique facilities (DC,VA,MD): {len(final_facilities)}\n")
    
    # 2. IXPs
    all_ixps = []
    for st in DC_STATES:
        ix_list = fetch_ixps_by_state(st)
        all_ixps.extend(ix_list)
        sleep(1)
    # Remove duplicates by 'id'
    ixp_ids_seen = set()
    final_ixps = []
    for ix in all_ixps:
        if ix["id"] not in ixp_ids_seen:
            ixp_ids_seen.add(ix["id"])
            final_ixps.append(ix)
    
    print(f"\n>>> Total unique IXPs (DC,VA,MD): {len(final_ixps)}\n")
    
    # 3. netixlan
    netixlan_data = fetch_netixlan(limit=10000)  # try bigger limit if needed
    sleep(1)
    
    # Build ID lookups
    facility_id_set = set(fac["id"] for fac in final_facilities)
    ixp_id_set = set(i["id"] for i in final_ixps)
    
    # Filter netixlan: keep if the netixlan references a facility or an ixp in our sets
    filtered_netixlan = []
    for nx in netixlan_data:
        fac_id = nx.get("fac_id")
        ix_id = nx.get("ix_id")
        
        if fac_id in facility_id_set or ix_id in ixp_id_set:
            filtered_netixlan.append(nx)
    
    print(f"\n>>> netixlan references to DC-area facilities/IXPs: {len(filtered_netixlan)}\n")
    
    # 4. Create final structure
    final_data = {
        "facilities": final_facilities,
        "ixps": final_ixps,
        "netixlan": filtered_netixlan
    }
    
    # Save to JSON
    out_filename = "dc_area_peering.json"
    with open(out_filename, "w") as f:
        json.dump(final_data, f, indent=2)
    
    print("=== Final Summary ===")
    print(f"  Facilities: {len(final_facilities)}")
    print(f"  IXPs:       {len(final_ixps)}")
    print(f"  netixlan:   {len(filtered_netixlan)}")
    print(f"Data saved to {out_filename}")
    print("=== Done ===")

if __name__ == "__main__":
    generate_dc_area_peering_json()
