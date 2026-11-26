"""
tests/integration/test_zone_gesture_pipeline.py
Automated Python Integration Test Suite for Smart Lab Zone Gesture Control Pipeline.

Validates:
1. 3x3 Grid zone boundaries and point-to-zone resolution (Z1-Z9).
2. Landmark geometric normal & 2D cross-product orientation detection.
3. Multi-person tracking and persistent ID assignment.
4. Consecutive-frame stability filter and debounce cooldown.
5. Independent zone-to-appliance logic and physical relay arbitration (GPIO22 & GPIO23).
6. Non-blocking 10-second vacancy countdown and cancellation.
7. Hand gesture manual overrides (Palm = Fan OFF, Back = Light OFF).
"""

import sys
import os
import time
import math
import json

# Add hardware directory to sys.path
HARDWARE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "hardware"))
if HARDWARE_DIR not in sys.path:
    sys.path.insert(0, HARDWARE_DIR)

from zone_gesture_controller import (
    ZoneManager,
    PersonTracker,
    HandOrientationDetector,
    OccupancyAutomationEngine,
    ORIENTATION_NONE,
    ORIENTATION_PALM,
    ORIENTATION_BACK,
    ORIENTATION_UNCERTAIN,
    GESTURE_ACTION_NONE,
    GESTURE_ACTION_FAN_OFF,
    GESTURE_ACTION_LIGHT_OFF,
    DEFAULT_CONFIG_PATH
)


def mock_landmarks(is_palm_facing=True, is_edge_on=False, is_right_hand=True):
    """Generates synthetic 21 hand landmarks."""
    landmarks = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(21)]
    # Wrist
    landmarks[0] = {"x": 0.5, "y": 0.8, "z": 0.0}
    # Middle MCP (pointing up)
    landmarks[9] = {"x": 0.5, "y": 0.4, "z": 0.0}

    if is_edge_on:
        # Edge on / profile view
        landmarks[5] = {"x": 0.5, "y": 0.45, "z": -0.1}
        landmarks[17] = {"x": 0.5, "y": 0.45, "z": 0.1}
    elif is_right_hand:
        if is_palm_facing:
            # Right palm facing: Index on left, pinky on right
            landmarks[5] = {"x": 0.4, "y": 0.45, "z": -0.05}
            landmarks[17] = {"x": 0.6, "y": 0.45, "z": -0.05}
        else:
            # Right back facing: Index on right, pinky on left
            landmarks[5] = {"x": 0.6, "y": 0.45, "z": 0.05}
            landmarks[17] = {"x": 0.4, "y": 0.45, "z": 0.05}
    else:
        # Left hand
        if is_palm_facing:
            landmarks[5] = {"x": 0.6, "y": 0.45, "z": -0.05}
            landmarks[17] = {"x": 0.4, "y": 0.45, "z": -0.05}
        else:
            landmarks[5] = {"x": 0.4, "y": 0.45, "z": 0.05}
            landmarks[17] = {"x": 0.6, "y": 0.45, "z": 0.05}

    return landmarks


def main():
    print("===================================================================")
    print("🧪 EXECUTING PYTHON ZONE GESTURE PIPELINE INTEGRATION TEST SUITE")
    print("===================================================================\n")

    # 1. Test 3x3 Grid Partitioning
    print("[Test 1] Testing 3x3 Zone Grid Boundary Resolution...")
    zm = ZoneManager(rows=3, cols=3)
    bounds = zm.get_zone_boundaries(640, 480)
    assert len(bounds) == 9, f"Must have 9 zone boundaries, got {len(bounds)}"
    assert zm.get_zone_for_point(100, 100, 640, 480) == "Z1"
    assert zm.get_zone_for_point(320, 100, 640, 480) == "Z2"
    assert zm.get_zone_for_point(550, 100, 640, 480) == "Z3"
    assert zm.get_zone_for_point(320, 240, 640, 480) == "Z5"
    assert zm.get_zone_for_point(550, 400, 640, 480) == "Z9"
    print("  ✓ 3x3 Zone Grid successfully resolved Z1 through Z9.\n")

    # 2. Test Hand Orientation Landmark Geometry
    print("[Test 2] Testing Hand Orientation Landmark Detection Geometry...")
    detector = HandOrientationDetector(stability_frames=5, cooldown_sec=2.0)

    # Right Hand Palm
    res_rp = detector.compute_orientation_geometry(mock_landmarks(True, False, True), "Right")
    assert res_rp == ORIENTATION_PALM, f"Expected PALM_FACING, got {res_rp}"

    # Right Hand Back
    res_rb = detector.compute_orientation_geometry(mock_landmarks(False, False, True), "Right")
    assert res_rb == ORIENTATION_BACK, f"Expected BACK_OF_HAND, got {res_rb}"

    # Left Hand Palm
    res_lp = detector.compute_orientation_geometry(mock_landmarks(True, False, False), "Left")
    assert res_lp == ORIENTATION_PALM, f"Expected PALM_FACING, got {res_lp}"

    # Left Hand Back
    res_lb = detector.compute_orientation_geometry(mock_landmarks(False, False, False), "Left")
    assert res_lb == ORIENTATION_BACK, f"Expected BACK_OF_HAND, got {res_lb}"

    # Edge-on / Profile view -> UNCERTAIN
    res_edge = detector.compute_orientation_geometry(mock_landmarks(False, True, True), "Right")
    assert res_edge == ORIENTATION_UNCERTAIN, f"Expected UNCERTAIN for edge-on, got {res_edge}"
    print("  ✓ Hand Orientation correctly detected palm, back, and edge-on rejection for both hands.\n")

    # 3. Test Multi-Person Tracking
    print("[Test 3] Testing Multi-Person Tracking & Zone Spatial Mapping...")
    tracker = PersonTracker(max_distance=150.0)

    # Frame 1: Two persons detected (one in Z1, one in Z3)
    bbox1 = (50, 50, 150, 150)    # Z1
    bbox2 = (450, 50, 550, 150)  # Z3
    tracks1 = tracker.update([bbox1, bbox2], zm, 640, 480)
    assert len(tracks1) == 2, f"Expected 2 tracks, got {len(tracks1)}"
    assert tracks1[0].person_id == "P-1"
    assert tracks1[1].person_id == "P-2"
    assert tracks1[0].zone == "Z1"
    assert tracks1[1].zone == "Z3"

    # Frame 2: Persons slightly move but IDs persist
    bbox1_moved = (55, 55, 155, 155)
    bbox2_moved = (455, 55, 555, 155)
    tracks2 = tracker.update([bbox1_moved, bbox2_moved], zm, 640, 480)
    id_map = {t.person_id: t.zone for t in tracks2}
    assert "P-1" in id_map and id_map["P-1"] == "Z1", "P-1 ID must persist"
    assert "P-2" in id_map and id_map["P-2"] == "Z3", "P-2 ID must persist"
    print("  ✓ Multi-person tracking maintains stable persistent IDs across consecutive frames.\n")

    # 4. Test 5-Frame Stability & Debounce Cooldown
    print("[Test 4] Testing 5-Frame Stability & Debounce Cooldown...")
    p_test = tracks2[0]

    # Feed 4 consecutive frames -> must not trigger
    for _ in range(4):
        ori, action = detector.process_person_hand(p_test, ORIENTATION_PALM)
        assert action == GESTURE_ACTION_NONE, "Must not trigger before 5 frames"

    # 5th frame -> triggers FAN_OFF
    ori, action = detector.process_person_hand(p_test, ORIENTATION_PALM)
    assert action == GESTURE_ACTION_FAN_OFF, "5th frame must trigger GESTURE_ACTION_FAN_OFF"

    # Rapid consecutive frame must be debounced
    ori, action = detector.process_person_hand(p_test, ORIENTATION_PALM)
    assert action == GESTURE_ACTION_NONE, "Consecutive frame within cooldown must be debounced"
    print("  ✓ Stability requirement (5 frames) and debounce cooldown verified.\n")

    # 5. Test Independent Occupancy & 10s Non-Blocking Vacancy Timer
    print("[Test 5] Testing Independent Occupancy & Relay Arbitration...")
    with open(DEFAULT_CONFIG_PATH, "r") as f:
        config = json.load(f)

    engine = OccupancyAutomationEngine(config)
    p1 = tracks2[0]
    p2 = tracks2[1]

    # Simulate P-1 entering Z1 ONLY
    p1.zone = "Z1"
    res1 = engine.update_occupancy_frame([p1])

    # Z1 independent status
    assert res1["zones"]["Z1"]["is_occupied"] == True
    assert res1["zones"]["Z1"]["light_requested"] == "ON"
    assert res1["zones"]["Z1"]["fan_requested"] == "ON"
    assert res1["zones"]["Z1"]["device_type"] == "physical"
    assert res1["zones"]["Z1"]["physical_pin"] == 22

    # Physical relay for Light 1 (GPIO 22) must be ON
    assert res1["device_states"]["DEV-LIGHT-01"] == "ON", "Occupied Z1 must turn Physical Light 1 ON"

    # Physical relay for Light 2 (GPIO 23) must remain OFF
    assert res1["device_states"]["DEV-LIGHT-02"] == "OFF", "Vacant Z3 must leave Physical Light 2 OFF"

    # Other zones must be independently OFF
    for z_id in ["Z2", "Z3", "Z4", "Z5", "Z6", "Z7", "Z8", "Z9"]:
        assert res1["zones"][z_id]["is_occupied"] == False
        assert res1["zones"][z_id]["light_requested"] == "OFF", f"{z_id} must independently remain OFF"

    # P-1 leaves Z1 -> vacancy countdown begins for Z1
    res2 = engine.update_occupancy_frame([])
    assert engine.zones["Z1"]["vacancy_started"] is not None, "Vacancy timer must start upon zone exit"
    assert res2["zones"]["Z1"]["vacancy_remaining"] > 0
    assert res2["zones"]["Z1"]["light_requested"] == "ON", "Light 1 must remain ON during grace period"
    assert res2["device_states"]["DEV-LIGHT-01"] == "ON"

    # P-1 returns before 10s -> vacancy timer cancelled
    res3 = engine.update_occupancy_frame([p1])
    assert engine.zones["Z1"]["vacancy_started"] is None, "Vacancy timer must cancel upon person return"
    assert res3["zones"]["Z1"]["vacancy_remaining"] == 0

    # P-1 leaves again and timer expires
    engine.update_occupancy_frame([])
    engine.zones["Z1"]["vacancy_started"] = time.time() - 10.5
    res4 = engine.update_occupancy_frame([])
    assert res4["zones"]["Z1"]["light_requested"] == "OFF", "Z1 light request must be OFF after 10s vacancy"
    assert res4["device_states"]["DEV-LIGHT-01"] == "OFF", "Physical Light 1 must turn OFF after 10s continuous vacancy"
    print("  ✓ Independent occupancy, 10s vacancy countdown, and physical relay arbitration verified.\n")

    # 6. Test Gesture Manual Overrides (Palm = Fan OFF, Back = Light OFF)
    print("[Test 6] Testing Zone-Scoped Hand Gesture Overrides...")
    p1.zone = "Z1"
    p2.zone = "Z3"
    engine.update_occupancy_frame([p1, p2])

    assert engine.device_states["DEV-LIGHT-01"] == "ON"
    assert engine.device_states["DEV-LIGHT-02"] == "ON"

    # Gesture A: P-1 shows Palm in Z1 -> Turn OFF Fan in Z1 ONLY
    engine.apply_gesture_override(p1, GESTURE_ACTION_FAN_OFF)
    res_g1 = engine.update_occupancy_frame([p1, p2])
    assert res_g1["zones"]["Z1"]["fan_requested"] == "OFF", "Fan in Z1 must be overridden to OFF"
    assert res_g1["zones"]["Z1"]["fan_mode"] == "gesture_override"
    assert res_g1["zones"]["Z3"]["fan_requested"] == "ON", "Fan in Z3 must remain unaffected (ON)"
    assert res_g1["zones"]["Z1"]["light_requested"] == "ON", "Light in Z1 must remain unaffected (ON)"

    # Gesture B: P-2 shows Back of Hand in Z3 -> Turn OFF Light in Z3 ONLY
    engine.apply_gesture_override(p2, GESTURE_ACTION_LIGHT_OFF)
    res_g2 = engine.update_occupancy_frame([p1, p2])
    assert res_g2["zones"]["Z3"]["light_requested"] == "OFF", "Light in Z3 must be overridden to OFF"
    assert res_g2["zones"]["Z3"]["light_mode"] == "gesture_override"
    assert res_g2["device_states"]["DEV-LIGHT-02"] == "OFF", "Physical Light 2 must switch OFF"
    assert res_g2["zones"]["Z1"]["light_requested"] == "ON", "Light in Z1 must remain unaffected (ON)"
    assert res_g2["device_states"]["DEV-LIGHT-01"] == "ON", "Physical Light 1 must remain ON"
    print("  ✓ Gesture manual overrides strictly isolate actions to the person's occupied zone.\n")

    print("===================================================================")
    print("🎉 ALL 6 PYTHON INTEGRATION TEST WORKSTREAMS COMPLETED SUCCESSFULLY!")
    print("===================================================================\n")


if __name__ == "__main__":
    main()
