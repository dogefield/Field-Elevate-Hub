#!/usr/bin/env python3
"""
Auto-updater for Field-Elevate-Hub Project
Handles automatic updates from GitHub repository for Field Elevate Hub
"""

import os
import sys
import subprocess
import logging
import time
import threading
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('field_elevate_auto_updater.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class FieldElevateAutoUpdater:
    """Handles automatic updates for Field-Elevate-Hub project"""
    
    def __init__(self, repo_path: Optional[str] = None, check_interval: int = 1800):
        """
        Initialize auto-updater
        
        Args:
            repo_path: Path to Git repository (defaults to current directory)
            check_interval: How often to check for updates in seconds (default: 30 minutes)
        """
        self.repo_path = Path(repo_path) if repo_path else Path(__file__).parent
        self.check_interval = check_interval
        self.last_check = None
        self.last_commit = None
        self.update_thread = None
        self.running = False
        self.config_file = self.repo_path / "field_elevate_auto_update_config.json"
        
        # Load or create configuration
        self.config = self.load_config()
        
        # Validate this is a Git repository
        if not self._is_git_repo():
            logger.warning(f"Not a Git repository: {self.repo_path}")
            return
        
        # Get initial commit hash
        self.last_commit = self._get_current_commit()
        logger.info(f"Field Elevate Auto-updater initialized. Current commit: {self.last_commit[:8]}")
    
    def load_config(self) -> Dict[str, Any]:
        """Load auto-update configuration"""
        default_config = {
            "enabled": True,
            "check_interval": 1800,  # 30 minutes
            "auto_restart": False,
            "notify_on_update": True,
            "backup_before_update": True,
            "last_update": None,
            "update_count": 0,
            "project_name": "Field-Elevate-Hub"
        }
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    # Merge with defaults for any missing keys
                    for key, value in default_config.items():
                        if key not in config:
                            config[key] = value
                    return config
            except Exception as e:
                logger.error(f"Error loading config: {e}")
        
        return default_config
    
    def save_config(self) -> None:
        """Save auto-update configuration"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving config: {e}")
    
    def _is_git_repo(self) -> bool:
        """Check if the current directory is a Git repository"""
        try:
            result = subprocess.run(
                ['git', 'rev-parse', '--git-dir'],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=10
            )
            return result.returncode == 0
        except Exception as e:
            logger.error(f"Error checking Git repository: {e}")
            return False
    
    def _get_current_commit(self) -> Optional[str]:
        """Get the current commit hash"""
        try:
            result = subprocess.run(
                ['git', 'rev-parse', 'HEAD'],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception as e:
            logger.error(f"Error getting current commit: {e}")
        return None
    
    def _get_remote_url(self) -> Optional[str]:
        """Get the remote repository URL"""
        try:
            result = subprocess.run(
                ['git', 'config', '--get', 'remote.origin.url'],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception as e:
            logger.error(f"Error getting remote URL: {e}")
        return None
    
    def _fetch_updates(self) -> bool:
        """Fetch latest changes from remote repository"""
        try:
            logger.info("Fetching updates from Field-Elevate-Hub repository...")
            result = subprocess.run(
                ['git', 'fetch', '--quiet'],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=30
            )
            return result.returncode == 0
        except Exception as e:
            logger.error(f"Error fetching updates: {e}")
            return False
    
    def _check_for_updates(self) -> bool:
        """Check if there are updates available"""
        try:
            # Get the current branch
            result = subprocess.run(
                ['git', 'branch', '--show-current'],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode != 0:
                return False
            
            current_branch = result.stdout.strip()
            
            # Check if local is behind remote
            result = subprocess.run(
                ['git', 'rev-list', '--count', f'HEAD..origin/{current_branch}'],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                commits_behind = int(result.stdout.strip())
                return commits_behind > 0
            
        except Exception as e:
            logger.error(f"Error checking for updates: {e}")
        
        return False
    
    def _create_backup(self) -> bool:
        """Create a backup before updating"""
        if not self.config.get("backup_before_update", True):
            return True
        
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_dir = self.repo_path / "backups" / f"field_elevate_backup_{timestamp}"
            backup_dir.mkdir(parents=True, exist_ok=True)
            
            # Copy all files except .git and backups
            import shutil
            for item in self.repo_path.iterdir():
                if item.name not in ['.git', 'backups', '__pycache__', '.pytest_cache', 'node_modules']:
                    if item.is_file():
                        shutil.copy2(item, backup_dir / item.name)
                    elif item.is_dir():
                        shutil.copytree(item, backup_dir / item.name, dirs_exist_ok=True)
            
            logger.info(f"Field Elevate backup created: {backup_dir}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating backup: {e}")
            return False
    
    def _pull_updates(self) -> bool:
        """Pull latest changes from remote repository"""
        try:
            logger.info("Pulling latest changes for Field-Elevate-Hub...")
            
            # Create backup if enabled
            if not self._create_backup():
                logger.warning("Backup failed, but continuing with update")
            
            result = subprocess.run(
                ['git', 'pull', '--quiet'],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                new_commit = self._get_current_commit()
                if new_commit and new_commit != self.last_commit:
                    logger.info(f"Successfully updated Field-Elevate-Hub from {self.last_commit[:8]} to {new_commit[:8]}")
                    self.last_commit = new_commit
                    
                    # Update configuration
                    self.config["last_update"] = datetime.now().isoformat()
                    self.config["update_count"] += 1
                    self.save_config()
                    
                    return True
                else:
                    logger.info("No new commits to pull")
                    return False
            else:
                logger.error(f"Git pull failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error pulling updates: {e}")
            return False
    
    def check_and_update(self) -> Dict[str, Any]:
        """
        Check for updates and pull if available
        
        Returns:
            Dict with update status information
        """
        if not self._is_git_repo():
            return {
                'success': False,
                'updated': False,
                'message': 'Not a Git repository',
                'timestamp': datetime.now().isoformat()
            }
        
        if not self.config.get("enabled", True):
            return {
                'success': True,
                'updated': False,
                'message': 'Auto-update disabled',
                'timestamp': datetime.now().isoformat()
            }
        
        self.last_check = datetime.now()
        
        # Fetch latest changes
        if not self._fetch_updates():
            return {
                'success': False,
                'updated': False,
                'message': 'Failed to fetch updates',
                'timestamp': self.last_check.isoformat()
            }
        
        # Check if updates are available
        if not self._check_for_updates():
            return {
                'success': True,
                'updated': False,
                'message': 'No updates available',
                'timestamp': self.last_check.isoformat(),
                'commit': self.last_commit
            }
        
        # Pull updates
        if self._pull_updates():
            return {
                'success': True,
                'updated': True,
                'message': 'Successfully updated Field-Elevate-Hub',
                'timestamp': self.last_check.isoformat(),
                'commit': self.last_commit
            }
        else:
            return {
                'success': False,
                'updated': False,
                'message': 'Failed to pull updates',
                'timestamp': self.last_check.isoformat()
            }
    
    def start_auto_update(self) -> None:
        """Start automatic update checking in background thread"""
        if self.update_thread and self.update_thread.is_alive():
            logger.warning("Auto-update thread already running")
            return
        
        if not self.config.get("enabled", True):
            logger.info("Auto-update is disabled in configuration")
            return
        
        self.running = True
        self.update_thread = threading.Thread(target=self._auto_update_loop, daemon=True)
        self.update_thread.start()
        logger.info(f"Field Elevate auto-update started (checking every {self.check_interval} seconds)")
    
    def stop_auto_update(self) -> None:
        """Stop automatic update checking"""
        self.running = False
        if self.update_thread:
            self.update_thread.join(timeout=5)
        logger.info("Field Elevate auto-update stopped")
    
    def _auto_update_loop(self) -> None:
        """Background loop for automatic updates"""
        while self.running:
            try:
                result = self.check_and_update()
                
                if result['success'] and result['updated']:
                    logger.info(f"Field Elevate auto-update: {result['message']}")
                    
                    # Show notification if enabled
                    if self.config.get("notify_on_update", True):
                        self._show_notification("Field Elevate Update", "Field-Elevate-Hub updated successfully!")
                    
                    # Auto-restart if enabled
                    if self.config.get("auto_restart", False):
                        logger.info("Auto-restart enabled, restarting Field Elevate application...")
                        self._restart_application()
                
                # Wait for next check
                time.sleep(self.check_interval)
                
            except Exception as e:
                logger.error(f"Error in auto-update loop: {e}")
                time.sleep(60)  # Wait 1 minute before retrying
    
    def _show_notification(self, title: str, message: str) -> None:
        """Show desktop notification"""
        try:
            if sys.platform == "win32":
                from win10toast import ToastNotifier
                toaster = ToastNotifier()
                toaster.show_toast(title, message, duration=5)
            elif sys.platform == "darwin":
                subprocess.run(['osascript', '-e', f'display notification "{message}" with title "{title}"'])
            else:
                subprocess.run(['notify-send', title, message])
        except Exception as e:
            logger.error(f"Error showing notification: {e}")
    
    def _restart_application(self) -> None:
        """Restart the application"""
        try:
            python = sys.executable
            os.execl(python, python, *sys.argv)
        except Exception as e:
            logger.error(f"Error restarting application: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current auto-update status"""
        return {
            'running': self.running,
            'enabled': self.config.get("enabled", True),
            'last_check': self.last_check.isoformat() if self.last_check else None,
            'last_update': self.config.get("last_update"),
            'update_count': self.config.get("update_count", 0),
            'last_commit': self.last_commit,
            'check_interval': self.check_interval,
            'repo_path': str(self.repo_path),
            'remote_url': self._get_remote_url(),
            'is_git_repo': self._is_git_repo(),
            'project_name': self.config.get("project_name", "Field-Elevate-Hub")
        }
    
    def update_config(self, **kwargs) -> None:
        """Update configuration settings"""
        for key, value in kwargs.items():
            if key in self.config:
                self.config[key] = value
        
        self.save_config()
        logger.info(f"Field Elevate configuration updated: {kwargs}")


def main():
    """Test the auto-updater"""
    print("🔄 Field-Elevate-Hub Auto-Updater")
    print("=" * 50)
    
    updater = FieldElevateAutoUpdater()
    
    if not updater._is_git_repo():
        print("❌ Not a Git repository")
        print("To enable auto-updates, initialize this as a Git repository:")
        print("  git init")
        print("  git remote add origin <your-repo-url>")
        return
    
    status = updater.get_status()
    print(f"📁 Repository: {status['repo_path']}")
    print(f"🔗 Remote: {status['remote_url']}")
    print(f"🔗 Current commit: {status['last_commit'][:8] if status['last_commit'] else 'Unknown'}")
    print(f"✅ Enabled: {status['enabled']}")
    print(f"📊 Update count: {status['update_count']}")
    print(f"🏗️ Project: {status['project_name']}")
    print()
    
    print("🔍 Checking for updates...")
    result = updater.check_and_update()
    
    print(f"✅ Success: {result['success']}")
    print(f"🔄 Updated: {result['updated']}")
    print(f"💬 Message: {result['message']}")
    print(f"⏰ Timestamp: {result['timestamp']}")
    
    if result['success'] and result['updated']:
        print("\n🎉 Field-Elevate-Hub updated successfully!")
        print("You may need to restart the application for changes to take effect.")
    elif result['success'] and not result['updated']:
        print("\n✅ No updates available - Field-Elevate-Hub is up to date!")
    else:
        print(f"\n❌ Update check failed: {result['message']}")
    
    print("\n📋 Configuration:")
    print(f"  Check interval: {updater.check_interval} seconds")
    print(f"  Auto-restart: {updater.config.get('auto_restart', False)}")
    print(f"  Notifications: {updater.config.get('notify_on_update', True)}")
    print(f"  Backup before update: {updater.config.get('backup_before_update', True)}")


if __name__ == "__main__":
    main() 