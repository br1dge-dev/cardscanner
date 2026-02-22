#!/bin/bash
# Wrapper for cardmarket scraper to ensure proper environment

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/Users/robert/.local/bin:$PATH"
export HOME="/Users/robert"
export USER="robert"

# Add user site-packages to Python path
export PYTHONPATH="/Users/robert/Library/Python/3.9/lib/python/site-packages:$PYTHONPATH"

# Run the scraper
cd /Users/robert/.openclaw/workspace/skills/cardmarket-tracker
/usr/bin/python3 scraper.py "$@"
