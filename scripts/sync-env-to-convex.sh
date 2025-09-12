#!/bin/bash

# Script to sync environment variables from .env.local to Convex
# Usage: ./scripts/sync-env-to-convex.sh

set -e  # Exit on any error

ENV_FILE=".env.local"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_PATH="$PROJECT_ROOT/$ENV_FILE"

echo "🔄 Syncing environment variables from $ENV_FILE to Convex..."

# Check if .env.local file exists
if [ ! -f "$ENV_PATH" ]; then
    echo "❌ Error: $ENV_FILE not found at $ENV_PATH"
    echo "Please create a .env.local file with your environment variables."
    exit 1
fi

# Check if convex is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx is not available. Please install Node.js and npm."
    exit 1
fi

# Counter for processed variables
count=0
skipped=0

echo "📁 Reading from: $ENV_PATH"
echo ""

# Read the .env.local file line by line
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Check if line contains an equals sign
    if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*(.*)[[:space:]]*$ ]]; then
        var_name="${BASH_REMATCH[1]}"
        var_value="${BASH_REMATCH[2]}"
        
        # Skip VITE_ variables (client-side only) and CONVEX_SITE_URL
        if [[ "$var_name" =~ ^VITE_ ]]; then
            echo "⏭️  Skipping VITE_ variable: $var_name (client-side only)"
            ((skipped++))
            continue
        fi
        
        if [[ "$var_name" == "CONVEX_SITE_URL" ]]; then
            echo "⏭️  Skipping CONVEX_SITE_URL (managed by Convex)"
            ((skipped++))
            continue
        fi
        
        # Remove inline comments (everything after # including the space before it)
        if [[ "$var_value" =~ ^(.*[^[:space:]])[[:space:]]*#.*$ ]]; then
            var_value="${BASH_REMATCH[1]}"
        fi
        
        # Remove surrounding quotes if present
        if [[ "$var_value" =~ ^\"(.*)\"$ ]] || [[ "$var_value" =~ ^\'(.*)\'$ ]]; then
            var_value="${BASH_REMATCH[1]}"
        fi
        
        echo "🔧 Setting $var_name..."
        
        # Set the environment variable in Convex
        if npx convex env set "$var_name=$var_value"; then
            echo "✅ Successfully set $var_name"
            ((count++))
        else
            echo "❌ Failed to set $var_name"
            exit 1
        fi
        
        echo ""
    else
        echo "⚠️  Skipping invalid line: $line"
        ((skipped++))
    fi
done < "$ENV_PATH"

echo "🎉 Sync completed!"
echo "📊 Summary:"
echo "   - Variables set: $count"
echo "   - Lines skipped: $skipped"

if [ $count -eq 0 ]; then
    echo "⚠️  No valid environment variables found in $ENV_FILE"
    echo "Make sure your .env.local file contains variables in the format: VARIABLE_NAME=value"
fi
