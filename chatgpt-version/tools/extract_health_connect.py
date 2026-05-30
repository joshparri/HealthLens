#!/usr/bin/env python3
"""
Extract a daily health metrics CSV from a Health Connect SQLite .db export.

Usage:
  python tools/extract_health_connect.py /path/to/health_connect_export.db daily_metrics.csv

This script keeps data local and uses only Python's standard library.
"""
import csv
import sqlite3
import sys
from datetime import date, timedelta
from pathlib import Path

METRICS = [
    "steps",
    "distance_km",
    "sleep_hours",
    "hrv_rmssd_ms",
    "resting_hr_bpm",
    "respiratory_rate_bpm",
    "weight_kg",
    "exercise_minutes",
    "active_intensity_minutes",
    "systolic_bp",
    "diastolic_bp",
    "glucose_mmol_l",
]

def epoch_day_to_iso(day):
    return (date(1970, 1, 1) + timedelta(days=int(day))).isoformat()

def table_exists(cur, table):
    cur.execute("select 1 from sqlite_master where type='table' and name=?", (table,))
    return cur.fetchone() is not None

def add(rows, local_date, metric, value):
    if value is None:
        return
    try:
        value = float(value)
    except (TypeError, ValueError):
        return
    if local_date is None:
        return
    iso = epoch_day_to_iso(local_date)
    rows.setdefault(iso, {})[metric] = value

def aggregate(cur, rows, table, sql, mapper):
    if not table_exists(cur, table):
        return
    for row in cur.execute(sql):
        mapper(row)

def main():
    if len(sys.argv) < 3:
        print(__doc__.strip())
        raise SystemExit(2)
    db_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")

    con = sqlite3.connect(str(db_path))
    cur = con.cursor()
    rows = {}

    aggregate(cur, rows, "steps_record_table",
              "select local_date, max(value) from (select app_info_id, local_date, sum(count) as value from steps_record_table group by app_info_id, local_date) group by local_date",
              lambda r: add(rows, r[0], "steps", r[1]))
    aggregate(cur, rows, "distance_record_table",
              "select local_date, max(value) from (select app_info_id, local_date, sum(distance)/1000.0 as value from distance_record_table group by app_info_id, local_date) group by local_date",
              lambda r: add(rows, r[0], "distance_km", r[1]))
    aggregate(cur, rows, "sleep_session_record_table",
              "select local_date, max(duration) from (select local_date, (end_time-start_time)/3600000.0 as duration from sleep_session_record_table where (end_time-start_time)/3600000.0 between 3 and 14) group by local_date",
              lambda r: add(rows, r[0], "sleep_hours", r[1]))
    aggregate(cur, rows, "heart_rate_variability_rmssd_record_table",
              "select local_date, avg(heart_rate_variability_millis) from heart_rate_variability_rmssd_record_table group by local_date",
              lambda r: add(rows, r[0], "hrv_rmssd_ms", r[1]))
    aggregate(cur, rows, "resting_heart_rate_record_table",
              "select local_date, avg(beats_per_minute) from resting_heart_rate_record_table group by local_date",
              lambda r: add(rows, r[0], "resting_hr_bpm", r[1]))
    aggregate(cur, rows, "respiratory_rate_record_table",
              "select local_date, avg(rate) from respiratory_rate_record_table group by local_date",
              lambda r: add(rows, r[0], "respiratory_rate_bpm", r[1]))
    aggregate(cur, rows, "weight_record_table",
              "select local_date, case when avg(weight) > 300 then avg(weight)/1000.0 else avg(weight) end from weight_record_table group by local_date",
              lambda r: add(rows, r[0], "weight_kg", r[1]))
    aggregate(cur, rows, "exercise_session_record_table",
              "select local_date, max(value) from (select app_info_id, local_date, sum((end_time-start_time)/60000.0) as value from exercise_session_record_table group by app_info_id, local_date) group by local_date",
              lambda r: add(rows, r[0], "exercise_minutes", r[1]))
    aggregate(cur, rows, "activity_intensity_record_table",
              "select local_date, sum((end_time-start_time)/60000.0) from activity_intensity_record_table group by local_date",
              lambda r: add(rows, r[0], "active_intensity_minutes", r[1]))
    aggregate(cur, rows, "blood_pressure_record_table",
              "select local_date, avg(systolic), avg(diastolic) from blood_pressure_record_table group by local_date",
              lambda r: (add(rows, r[0], "systolic_bp", r[1]), add(rows, r[0], "diastolic_bp", r[2])))
    aggregate(cur, rows, "blood_glucose_record_table",
              "select local_date, avg(level) from blood_glucose_record_table group by local_date",
              lambda r: add(rows, r[0], "glucose_mmol_l", r[1]))

    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["date"] + METRICS)
        writer.writeheader()
        for iso in sorted(rows):
            writer.writerow({"date": iso, **rows[iso]})
    print(f"Wrote {len(rows)} days to {out_path}")

if __name__ == "__main__":
    main()
