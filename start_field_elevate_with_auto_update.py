#!/usr/bin/env python3
"""
Startup script for Field-Elevate-Hub with auto-update enabled
This script starts the Field Elevate Hub application with automatic updates
"""

import os
import sys
import threading
import time
from pathlib import Path

def start_auto_updater():
    """Start the auto-updater in background"""
    try:
        from auto_updater import FieldElevateAutoUpdater
        
        updater = FieldElevateAutoUpdater()
        if updater._is_git_repo():
            updater.start_auto_update()
            print("🔄 Field Elevate auto-updater started successfully")
            return updater
        else:
            print("⚠️ Auto-updater disabled: Not a Git repository")
            return None
    except Exception as e:
        print(f"⚠️ Auto-updater failed to start: {e}")
        return None

def start_field_elevate_app():
    """Start the Field Elevate Hub application"""
    try:
        # Check if Node.js is available
        import subprocess
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode != 0:
            print("❌ Node.js not found. Please install Node.js to run Field-Elevate-Hub")
            return False
        
        print("📦 Installing dependencies...")
        subprocess.run(['npm', 'install'], check=True)
        
        print("🚀 Starting Field-Elevate-Hub server...")
        # Start the server (adjust the command based on your package.json scripts)
        subprocess.run(['npm', 'start'], check=True)
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error starting Field-Elevate-Hub: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def main():
    """Main startup function"""
    print("🚀 Starting Field-Elevate-Hub with Auto-Update")
    print("=" * 50)
    
    # Start auto-updater in background
    updater = start_auto_updater()
    
    # Start the Field Elevate Hub application
    print("🏗️ Starting Field-Elevate-Hub application...")
    
    try:
        # Start the application
        if start_field_elevate_app():
            print("✅ Field-Elevate-Hub application started successfully")
            print("🔄 Auto-updates are running in the background")
            print("\nPress Ctrl+C to stop the application")
            
            # Keep the application running
            while True:
                time.sleep(1)
        else:
            print("❌ Failed to start Field-Elevate-Hub application")
            if updater:
                updater.stop_auto_update()
            
    except KeyboardInterrupt:
        print("\n🛑 Shutting down Field-Elevate-Hub...")
        if updater:
            updater.stop_auto_update()
        print("✅ Application stopped")
    except Exception as e:
        print(f"❌ Application error: {e}")
        if updater:
            updater.stop_auto_update()

if __name__ == "__main__":
    main() 