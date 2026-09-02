"""
RiskSūtra — Seed Data Script

Generates synthetic merchants and events, persists them to the database,
and optionally injects ATO scenarios for testing.

Usage:
    cd backend
    python -m scripts.seed_data
"""

import sys
import os

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import database as db
from services.synthetic_generator import (
    generate_merchants,
    generate_normal_events,
    inject_ato_credential_theft,
    inject_legitimate_spike,
)


def main():
    print("=" * 60)
    print("RiskSutra - Seed Data Generator")
    print("=" * 60)

    # Initialize database
    print("\n[1/5] Initializing database...")
    db.init_db()
    print("  ✓ Database initialized")

    # Generate merchants
    print("\n[2/5] Generating merchants...")
    merchants = generate_merchants()
    for m in merchants:
        db.save_merchant(m)
        print(f"  ✓ {m.merchant_id} — {m.merchant_name} ({m.merchant_type.value})")

    # Generate normal events
    print("\n[3/5] Generating normal events (14 days of history)...")
    total_events = 0
    for m in merchants:
        events = generate_normal_events(m, days=14)
        inserted = db.save_events_bulk(events)
        total_events += inserted
        print(f"  ✓ {m.merchant_id}: {inserted} events")
    print(f"  Total: {total_events} normal events")

    # Inject ATO scenario on first merchant
    print("\n[4/5] Injecting ATO scenario (credential theft)...")
    target_merchant = merchants[0]
    ato_events, ato_scenario = inject_ato_credential_theft(target_merchant)
    inserted = db.save_events_bulk(ato_events)
    print(f"  ✓ Scenario: {ato_scenario.scenario_type}")
    print(f"  ✓ Target: {target_merchant.merchant_id}")
    print(f"  ✓ Events injected: {inserted}")
    print(f"  ✓ Attack window: {ato_scenario.attack_start_time} → {ato_scenario.attack_end_time}")

    # Inject legitimate spike on second merchant
    print("\n[5/5] Injecting legitimate spike (false-positive control)...")
    spike_merchant = merchants[1]
    spike_events, spike_scenario = inject_legitimate_spike(spike_merchant)
    inserted = db.save_events_bulk(spike_events)
    print(f"  ✓ Scenario: {spike_scenario.scenario_type}")
    print(f"  ✓ Target: {spike_merchant.merchant_id}")
    print(f"  ✓ Events injected: {inserted}")

    print("\n" + "=" * 60)
    print("Seed data generation complete!")
    print(f"Database: {os.path.abspath(db.DB_PATH).encode('ascii', errors='replace').decode()}")
    print("=" * 60)


if __name__ == "__main__":
    main()
