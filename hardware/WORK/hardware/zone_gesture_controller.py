#!/usr/bin/env python3
"""
Smart Lab - Zone & Hand Gesture Calibration and Automation Controller.
Entrypoint used by start_zone_monitor.bat and direct invocation.
"""

import os
import sys

# Ensure hardware directory is on PYTHONPATH
HARDWARE_DIR = os.path.dirname(os.path.abspath(__file__))
if HARDWARE_DIR not in sys.path:
    sys.path.insert(0, HARDWARE_DIR)

from run_smart_lab import main

if __name__ == "__main__":
    main()
