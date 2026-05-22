#!/usr/bin/env bash
# create-project.sh

TARGET_DIR="${1:-}"

if [ -z "$TARGET_DIR" ]; then
  read -p "Enter the target directory for the new project (e.g., ../my_new_project): " TARGET_DIR
fi

if [ -d "$TARGET_DIR" ]; then
  echo "Directory already exists: $TARGET_DIR"
  exit 1
fi

read -p "Enter the Project Name: " PROJECT_NAME
read -p "Enter a one-sentence Project Description: " PROJECT_DESCRIPTION
read -p "Enter the Project Characteristics (Features/Goals): " PROJECT_CHARACTERISTICS

echo "Creating project in $TARGET_DIR..."
mkdir -p "$TARGET_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copy all files except create-project scripts
# Use tar to handle hidden files (.github, .claude, etc.) safely
tar -cf - --exclude="create-project.ps1" --exclude="create-project.sh" -C "$SCRIPT_DIR" . | tar -xf - -C "$TARGET_DIR"

README_PATH="$TARGET_DIR/README.md"
README_KO_PATH="$TARGET_DIR/README_ko.md"

replace_placeholders() {
  local FILE=$1
  if [ -f "$FILE" ]; then
    # Use perl for cross-platform in-place replacement
    perl -pi -e "s/\\{\\{PROJECT_NAME\\}\\}/${PROJECT_NAME}/g" "$FILE"
    perl -pi -e "s/\\{\\{PROJECT_DESCRIPTION\\}\\}/${PROJECT_DESCRIPTION}/g" "$FILE"
    perl -pi -e "s/\\{\\{PROJECT_CHARACTERISTICS\\}\\}/${PROJECT_CHARACTERISTICS}/g" "$FILE"
  fi
}

echo "Generating README.md and README_ko.md with project details..."
replace_placeholders "$README_PATH"
replace_placeholders "$README_KO_PATH"

echo "Project successfully created at $TARGET_DIR!"
