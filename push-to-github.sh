#!/bin/bash
# GroupBase - Push to GitHub
# Run this script from Terminal to push all code to GitHub

cd "$(dirname "$0")"

# Clean up any existing git state
rm -rf .git web/.git

# Initialize fresh git repo
git init -b main
git add -A
git commit -m "Initial commit: GroupBase MVP - Facebook Group CRM SaaS

Next.js 14 web app + Chrome Extension MV3 + Supabase backend.
Includes dashboard, member CRM, integrations, auth, and FB DOM scraping."

# Add GitHub remote and push
git remote add origin https://github.com/jacobc10/groupbase.git
git push -u origin main

echo ""
echo "Done! Code pushed to https://github.com/jacobc10/groupbase"
echo "Vercel will auto-deploy once connected."
