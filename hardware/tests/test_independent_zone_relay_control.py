"""
Comprehensive verification test suite for Independent Zone-wise Light & Fan Control,
Real Relay Mapping (GPIO 22 & 23), Gesture Control, and 10s Non-blocking Vacancy Timers.
"""

import numpy as np
import pytest
from vision.zone_manager import ZoneManager
from vision.occupancy_manager import OccupancyManager
from vision.esp32_relay_bridge import ESP32RelayBridge
from backend.app import create_app


def make_keypoints(cx: float, cy: float, left_up: bool = False, right_up: bool = False) -> np.ndarray:
    """Generates standard 17 COCO keypoints centered at floor position (cx, cy)."""
    k = np.zeros((17, 3), dtype=np.float32)
    k[:, 2] = 0.95
    k[5] = [cx - 25, cy - 60, 0.95]
    k[6] = [cx + 25, cy - 60, 0.95]
    k[11] = [cx - 20, cy - 20, 0.95]
    k[12] = [cx + 20, cy - 20, 0.95]
    k[15] = [cx - 15, cy, 0.95]
    k[16] = [cx + 15, cy, 0.95]
    if left_up:
        k[7] = [cx - 30, cy - 90, 0.95]
        k[9] = [cx - 35, cy - 130, 0.95]
    else:
        k[7] = [cx - 30, cy - 40, 0.95]
        k[9] = [cx - 30, cy - 15, 0.95]
    if right_up:
        k[8] = [cx + 30, cy - 90, 0.95]
        k[10] = [cx + 35, cy - 130, 0.95]
    else:
        k[8] = [cx + 30, cy - 40, 0.95]
        k[10] = [cx + 30, cy - 15, 0.95]
    return k


@pytest.fixture
def test_setup():
    zm = ZoneManager("config/zones.json")
    om = OccupancyManager(zone_manager=zm, leave_timeout_sec=10.0, gesture_stability_sec=0.8)
    bridge = ESP32RelayBridge(config_path="config/relay_mapping.json", strict_hardware=False)
    w, h = 1200, 900
    # Centers for Z1 (top-left) and Z2 (top-middle) and Z9 (bottom-right)
    z1_pos = (200.0, 150.0)
    z2_pos = (600.0, 150.0)
    z9_pos = (1000.0, 750.0)
    return zm, om, bridge, w, h, z1_pos, z2_pos, z9_pos


def test_scenario_1_both_zones_vacant_both_lights_off(test_setup):
    """When all zones are vacant, all lights/fans are OFF, and physical relays remain OFF."""
    zm, om, bridge, w, h, _, _, _ = test_setup
    t0 = 1000.0

    om.process_frame_detections([], w, h, current_time=t0)
    bridge.sync_zone_states(om.zones)

    assert om.zones["Z1"].occupied is False
    assert om.zones["Z1"].light_state is False
    assert om.zones["Z1"].fan_state is False
    assert om.zones["Z2"].occupied is False
    assert om.zones["Z9"].occupied is False

    assert bridge.relay_states["1"] is False
    assert bridge.relay_states["2"] is False


def test_scenario_2_person_enters_z1_only_light1_on(test_setup):
    """Person enters Z1 -> Light 1 (Relay 1, GPIO 22) turns ON. Light 2 (Relay 2, GPIO 23) remains OFF."""
    zm, om, bridge, w, h, z1_pos, _, _ = test_setup
    t0 = 1000.0

    kpts = make_keypoints(z1_pos[0], z1_pos[1])
    det = [{"tracking_id": 1, "bbox": (z1_pos[0]-40, z1_pos[1]-150, z1_pos[0]+40, z1_pos[1]), "keypoints": kpts}]

    om.process_frame_detections(det, w, h, current_time=t0)
    bridge.sync_zone_states(om.zones)

    assert om.zones["Z1"].occupied is True
    assert om.zones["Z1"].light_state is True
    assert om.zones["Z1"].fan_state is True
    assert om.zones["Z2"].light_state is False
    assert om.zones["Z9"].light_state is False

    # Crucial hardware verification: ONLY Relay 1 (GPIO 22) is ON
    assert bridge.relay_states["1"] is True
    assert bridge.relay_states["2"] is False


def test_scenario_3_person_leaves_z1_10s_vacancy_timer(test_setup):
    """When person leaves Z1, 10s timer starts; after 10s Light 1 turns OFF."""
    zm, om, bridge, w, h, z1_pos, _, _ = test_setup
    t0 = 1000.0

    # Enter Z1
    kpts = make_keypoints(z1_pos[0], z1_pos[1])
    det = [{"tracking_id": 1, "bbox": (z1_pos[0]-40, z1_pos[1]-150, z1_pos[0]+40, z1_pos[1]), "keypoints": kpts}]
    om.process_frame_detections(det, w, h, current_time=t0)

    # Leaves at t0 + 1.0s
    t_leave = t0 + 1.0
    om.process_frame_detections([], w, h, current_time=t_leave)
    bridge.sync_zone_states(om.zones)

    assert om.zones["Z1"].occupied is False
    assert om.zones["Z1"].vacancy_timer_active is True
    assert om.zones["Z1"].light_state is True
    assert bridge.relay_states["1"] is True

    # After 5s (still within 10s grace period)
    om.process_frame_detections([], w, h, current_time=t_leave + 5.0)
    bridge.sync_zone_states(om.zones)
    assert om.zones["Z1"].vacancy_timer_active is True
    assert om.zones["Z1"].light_state is True
    assert bridge.relay_states["1"] is True

    # After 10.1s -> Turns OFF
    om.process_frame_detections([], w, h, current_time=t_leave + 10.1)
    bridge.sync_zone_states(om.zones)
    assert om.zones["Z1"].vacancy_timer_active is False
    assert om.zones["Z1"].light_state is False
    assert om.zones["Z1"].fan_state is False
    assert bridge.relay_states["1"] is False


def test_scenario_4_person_enters_z2_or_z9_only_light2_on(test_setup):
    """Person enters Z2/Z9 -> Light 2 (Relay 2, GPIO 23) turns ON. Light 1 (Relay 1, GPIO 22) remains OFF."""
    zm, om, bridge, w, h, _, z2_pos, _ = test_setup
    t0 = 1000.0

    kpts = make_keypoints(z2_pos[0], z2_pos[1])
    det = [{"tracking_id": 1, "bbox": (z2_pos[0]-40, z2_pos[1]-150, z2_pos[0]+40, z2_pos[1]), "keypoints": kpts}]

    om.process_frame_detections(det, w, h, current_time=t0)
    bridge.sync_zone_states(om.zones)

    assert om.zones["Z2"].occupied is True
    assert om.zones["Z2"].light_state is True
    assert om.zones["Z1"].light_state is False

    assert bridge.relay_states["1"] is False
    assert bridge.relay_states["2"] is True


def test_scenario_5_multi_person_independent_zones(test_setup):
    """Person 1 in Z1 and Person 2 in Z9: both lights ON. Person 1 leaves Z1, Light 1 turns OFF after 10s, Light 2 stays ON."""
    zm, om, bridge, w, h, z1_pos, _, z9_pos = test_setup
    t0 = 1000.0

    kpts1 = make_keypoints(z1_pos[0], z1_pos[1])
    kpts2 = make_keypoints(z9_pos[0], z9_pos[1])
    dets = [
        {"tracking_id": 1, "bbox": (z1_pos[0]-40, z1_pos[1]-150, z1_pos[0]+40, z1_pos[1]), "keypoints": kpts1},
        {"tracking_id": 2, "bbox": (z9_pos[0]-40, z9_pos[1]-150, z9_pos[0]+40, z9_pos[1]), "keypoints": kpts2}
    ]

    om.process_frame_detections(dets, w, h, current_time=t0)
    bridge.sync_zone_states(om.zones)

    assert bridge.relay_states["1"] is True
    assert bridge.relay_states["2"] is True

    # Person 1 leaves Z1, Person 2 remains in Z9 (after 11s)
    t_after_11s = t0 + 11.0
    dets_p2_only = [
        {"tracking_id": 2, "bbox": (z9_pos[0]-40, z9_pos[1]-150, z9_pos[0]+40, z9_pos[1]), "keypoints": kpts2}
    ]
    om.process_frame_detections(dets_p2_only, w, h, current_time=t_after_11s)
    bridge.sync_zone_states(om.zones)

    assert om.zones["Z1"].occupied is False
    assert om.zones["Z1"].light_state is False
    assert bridge.relay_states["1"] is False

    # Z9 still occupied and ON
    assert om.zones["Z9"].occupied is True
    assert om.zones["Z9"].light_state is True
    assert bridge.relay_states["2"] is True


def test_scenario_6_gesture_override_and_cross_zone_reset(test_setup):
    """1 hand raised in Z1 -> MANUAL_OFF. Moving from Z1 to Z2 resets mode to AUTO in new zone."""
    zm, om, bridge, w, h, z1_pos, z2_pos, _ = test_setup
    t0 = 1000.0

    # Person in Z1 with 1 hand raised
    kpts_1hand = make_keypoints(z1_pos[0], z1_pos[1], left_up=True, right_up=False)
    det1 = [{"tracking_id": 1, "bbox": (z1_pos[0]-40, z1_pos[1]-150, z1_pos[0]+40, z1_pos[1]), "keypoints": kpts_1hand}]

    om.process_frame_detections(det1, w, h, current_time=t0)
    om.process_frame_detections(det1, w, h, current_time=t0 + 0.9)
    bridge.sync_zone_states(om.zones)

    assert om.zones["Z1"].mode == "MANUAL_OFF"
    assert om.zones["Z1"].light_state is False
    assert bridge.relay_states["1"] is False

    # Moving to Z2 resets mode to AUTO
    kpts_z2 = make_keypoints(z2_pos[0], z2_pos[1], left_up=False, right_up=False)
    det_z2 = [{"tracking_id": 1, "bbox": (z2_pos[0]-40, z2_pos[1]-150, z2_pos[0]+40, z2_pos[1]), "keypoints": kpts_z2}]

    om.process_frame_detections(det_z2, w, h, current_time=t0 + 1.0)
    bridge.sync_zone_states(om.zones)

    assert om.zones["Z2"].mode == "AUTO"
    assert om.zones["Z2"].light_state is True
    assert bridge.relay_states["2"] is True


def test_scenario_7_dashboard_api_reflects_independent_states():
    """Verify Flask backend API correctly reflects independent zone states."""
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        # Check initial states
        res = client.get("/api/lab/status")
        assert res.status_code == 200
        data = res.get_json()
        assert "zones" in data
        assert len(data["zones"]) == 9
        assert data["appliances"]["light1"] == "OFF"
        assert data["appliances"]["light2"] == "OFF"

        # Turn ON Z1
        res = client.post("/api/zones/Z1/light/on")
        assert res.status_code == 200
        assert res.get_json()["light_state"] == "ON"

        # Check Z2 is still OFF
        res = client.get("/api/zones/Z2")
        assert res.status_code == 200
        assert res.get_json()["zone"]["light_state"] == "OFF"
