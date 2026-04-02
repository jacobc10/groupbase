#!/bin/bash
cd "$(dirname "$0")"

# Clean up any existing git state
rm -rf .git web/.git

# Remove files that shouldn't be in git
rm -f groupbase.bundle push-to-github.sh PUSH_TO_GITHUB.command

# Initialize fresh git repo
git init -b main

# Add all files
git add -A

# Commit
git commit -m "Initial commit: GroupBase MVP - Facebook Group CRM SaaS

Next.js 14 web app + Chrome Extension MV3 + Supabase backend.
Includes dashboard, member CRM, integrations, auth, and FB DOM scraping."

# Add GitHub remote and push
git remote add origin https://github.com/jacobc10/groupbase.git
git push -u origin main

echo ""
echo "========================================="
echo "  SUCCESS! Code pushed to GitHub!"
echo "  https://github.com/jacobc10/groupbase"
echo "========================================="
echo ""
echo "Press any key to close..."
read -n 1
