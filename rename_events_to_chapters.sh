#!/bin/bash

# Script to rename files: Event -> Chapter, event -> chapter
# Target directory: /home/belafon/Downloads/story/src

TARGET_DIR="/home/belafon/Downloads/story/src"

# Check if directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Directory $TARGET_DIR does not exist"
    exit 1
fi

echo "Starting file renaming in: $TARGET_DIR"
echo "Converting 'Event' -> 'Chapter' and 'event' -> 'chapter'"
echo "----------------------------------------"

# Counter for renamed files
renamed_count=0

# Find all files (not directories) and process them
find "$TARGET_DIR" -type f | while read -r filepath; do
    # Get directory and filename
    dir=$(dirname "$filepath")
    filename=$(basename "$filepath")
    
    # Create new filename by replacing Event/event with Chapter/chapter
    new_filename="$filename"
    new_filename="${new_filename//Event/Chapter}"
    new_filename="${new_filename//event/chapter}"
    
    # Check if filename actually changed
    if [ "$filename" != "$new_filename" ]; then
        new_filepath="$dir/$new_filename"
        
        # Check if target file already exists
        if [ -e "$new_filepath" ]; then
            echo "Warning: Target file already exists, skipping: $new_filepath"
        else
            # Rename the file
            mv "$filepath" "$new_filepath"
            if [ $? -eq 0 ]; then
                echo "Renamed: $filename -> $new_filename"
                ((renamed_count++))
            else
                echo "Error: Failed to rename $filepath"
            fi
        fi
    fi
done

echo "----------------------------------------"
echo "Renaming complete. Total files renamed: $renamed_count"