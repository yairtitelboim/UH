#!/bin/bash

# Houston Map Visualization Project Cleanup Script
# This script removes unnecessary files and backup files from the codebase

echo "Starting codebase cleanup..."

# Remove log files
echo "Removing log files..."
find . -name "*.log" -type f -delete

# Remove backup files with patterns like *_COPY*, *_SSS*, index_*, etc.
echo "Removing backup Map component files..."
find ./remote/src/components/Map -name "index_*.jsx" -type f -delete
find ./remote/src/components/Map -name "index\ *.jsx" -type f -delete
find ./remote/src/components/Map -name "INDEX_*.jsx" -type f -delete
find ./remote/src/components/Map -name "*_COPY_*.jsx" -type f -delete

# Remove duplicate Python files
echo "Removing duplicate Python files..."
find ./remote/public -name "*\ copy*.py" -type f -delete

# Remove duplicate or backup GeoJSON files
echo "Removing backup GeoJSON files..."
find ./remote/public -name "*\ copy*.geojson" -type f -delete

# Cleanup unnecessary commented code (optional - uncomment if needed)
# echo "Cleaning up commented code..."
# sed -i '' '/\/\/ export const handleMapClick/,/\/\/ };/d' ./remote/src/components/Map/utils.js

# Remove any temporary files
echo "Removing temporary files..."
find . -name "*.tmp" -type f -delete
find . -name "*.bak" -type f -delete
find . -name ".DS_Store" -type f -delete

echo "Cleanup complete!"
echo "You may still want to review the codebase for any remaining commented out code blocks." 