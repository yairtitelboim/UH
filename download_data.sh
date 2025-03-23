#!/bin/bash

# Download script for Houston Map Visualization GeoJSON files
# This script will download the required GeoJSON zip bundles and extract them

echo "Houston Map Visualization - Data Download Script"
echo "================================================"
echo ""
echo "This script will download the required GeoJSON files for the Houston Map Visualization project."
echo "The files will be saved to the remote/public directory."
echo ""

# Check if wget or curl is available
DOWNLOAD_CMD=""
if command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget -O"
elif command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl -L -o"
else
    echo "Error: Neither wget nor curl is available. Please install one of these tools."
    exit 1
fi

# Check if unzip is available
if ! command -v unzip &> /dev/null; then
    echo "Error: unzip is not available. Please install unzip."
    exit 1
fi

# Create the directory if it doesn't exist
mkdir -p remote/public
mkdir -p temp_downloads

# Function to download a file
download_file() {
    local url=$1
    local filename=$2
    local dest="temp_downloads/$filename"
    
    echo "Downloading $filename..."
    
    if [ -f "$dest" ]; then
        echo "File $filename already exists. Skipping download."
        return 0
    fi
    
    if [[ $DOWNLOAD_CMD == "wget -O" ]]; then
        wget -O "$dest" "$url"
    else
        curl -L -o "$dest" "$url"
    fi
    
    if [ $? -eq 0 ]; then
        echo "Successfully downloaded $filename"
        return 0
    else
        echo "Failed to download $filename"
        return 1
    fi
}

# Function to extract a zip file
extract_file() {
    local zipfile=$1
    
    echo "Extracting $zipfile to remote/public/..."
    
    unzip -o "temp_downloads/$zipfile" -d remote/public/
    
    if [ $? -eq 0 ]; then
        echo "Successfully extracted $zipfile"
        return 0
    else
        echo "Failed to extract $zipfile"
        return 1
    fi
}

echo "Please enter the base URL where the GeoJSON zip bundles are hosted:"
echo "(Example: https://example.com/houston-data/)"
read -p "> " BASE_URL

# Remove trailing slash if present
BASE_URL=${BASE_URL%/}

echo ""
echo "Available download options:"
echo "1. All GeoJSON files in one bundle (largest, ~191MB compressed)"
echo "2. Large files only (houston_buildings.geojson, Pipelines.geojson, ~129MB compressed)"
echo "3. Medium files only (segments, boundaries, surface water, etc., ~87MB compressed)"
echo "4. Small files only (points of interest, census blocks, etc., ~11MB compressed)"
echo "5. Download all three separate bundles (large, medium, small)"
echo ""
read -p "Please select an option (1-5): " OPTION

# List of zip files
case $OPTION in
    1)
        FILES=("houston_all_geojson.zip")
        ;;
    2)
        FILES=("houston_large_files.zip")
        ;;
    3)
        FILES=("houston_medium_files.zip")
        ;;
    4)
        FILES=("houston_small_files.zip")
        ;;
    5)
        FILES=("houston_large_files.zip" "houston_medium_files.zip" "houston_small_files.zip")
        ;;
    *)
        echo "Invalid option. Exiting."
        exit 1
        ;;
esac

# Total number of files
TOTAL_FILES=${#FILES[@]}
DOWNLOADED=0
EXTRACTED=0

echo ""
echo "Starting download of $TOTAL_FILES zip bundle(s)..."
echo ""

# Download and extract each file
for file in "${FILES[@]}"; do
    download_file "$BASE_URL/$file" "$file"
    if [ $? -eq 0 ]; then
        DOWNLOADED=$((DOWNLOADED + 1))
        
        extract_file "$file"
        if [ $? -eq 0 ]; then
            EXTRACTED=$((EXTRACTED + 1))
        fi
    fi
done

echo ""
echo "Download and extraction complete. $DOWNLOADED out of $TOTAL_FILES zip bundles downloaded and $EXTRACTED extracted successfully."
echo "The GeoJSON files have been saved to the remote/public directory."
echo ""

# Clean up temporary downloads
read -p "Do you want to remove the downloaded zip files to save space? (y/n): " CLEANUP
if [[ $CLEANUP == "y" || $CLEANUP == "Y" ]]; then
    rm -rf temp_downloads
    echo "Temporary files cleaned up."
fi

if [ $EXTRACTED -lt $TOTAL_FILES ]; then
    echo "Some files failed to extract. Please check the output above for details."
    echo "You may need to obtain these files manually."
    exit 1
fi

exit 0 