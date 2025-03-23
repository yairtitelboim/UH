#!/bin/bash

# Download script for Houston Map Visualization GeoJSON files
# This script will download the required GeoJSON files from a specified URL

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

# Create the directory if it doesn't exist
mkdir -p remote/public

# Function to download a file
download_file() {
    local url=$1
    local filename=$2
    local filepath="remote/public/$filename"
    
    echo "Downloading $filename..."
    
    if [ -f "$filepath" ]; then
        echo "File $filename already exists. Skipping download."
        return 0
    fi
    
    if [[ $DOWNLOAD_CMD == "wget -O" ]]; then
        wget -O "$filepath" "$url"
    else
        curl -L -o "$filepath" "$url"
    fi
    
    if [ $? -eq 0 ]; then
        echo "Successfully downloaded $filename"
    else
        echo "Failed to download $filename"
        return 1
    fi
}

echo "Please enter the base URL where the GeoJSON files are hosted:"
echo "(Example: https://example.com/geojson-files/)"
read -p "> " BASE_URL

# Remove trailing slash if present
BASE_URL=${BASE_URL%/}

# List of required files
FILES=(
    "houston_buildings.geojson"
    "Pipelines.geojson"
    "Segments_-_Line.geojson"
    "Subdivision_Boundary.geojson"
    "Surface_Water.geojson"
    "Area_of_Primary_Influence.geojson"
    "2-Year_Time_of_Travel_Capture_Zone.geojson"
    "PWS_Reservoir.geojson"
    "Ground_Water_Well.geojson"
    "Waterwell_Grid.geojson"
    "COH_ZIPCODES.geojson"
    "MUD.geojson"
    "Wastewater_Outfalls.geojson"
    "houston-census-blocks.geojson"
    "harvy1.geojson"
    "harvy2.geojson"
)

# Total number of files
TOTAL_FILES=${#FILES[@]}
DOWNLOADED=0

echo ""
echo "Starting download of $TOTAL_FILES files..."
echo ""

# Download each file
for file in "${FILES[@]}"; do
    download_file "$BASE_URL/$file" "$file"
    if [ $? -eq 0 ]; then
        DOWNLOADED=$((DOWNLOADED + 1))
    fi
done

echo ""
echo "Download complete. $DOWNLOADED out of $TOTAL_FILES files downloaded successfully."
echo "The files have been saved to the remote/public directory."
echo ""

if [ $DOWNLOADED -lt $TOTAL_FILES ]; then
    echo "Some files failed to download. Please check the output above for details."
    echo "You may need to obtain these files manually."
    exit 1
fi

exit 0 