#!/bin/bash
# GroupBase - Push optimized code to GitHub
# Just double-click this file to run it!

cd "$(dirname "$0")"

echo "========================================="
echo "  GroupBase - Pushing to GitHub"
echo "========================================="
echo ""

# Clean up any existing git state
rm -rf .git web/.git 2>/dev/null

# Initialize fresh git repo
git init -b main

# Stage all files
git add -A

# Commit
git commit -m "Fix all critical beta blockers: analytics, pricing, auth, extension

- Fix analytics API field names to match frontend (was causing white screen)
- Fix landing page pricing: Pro \$99->\$47, Enterprise Custom->\$97, Free 500->100 members
- Create password reset flow (reset-password + update-password pages)
- Fix 'Welcome back, !' bug with proper fallback chain
- Upgrade client Supabase to createBrowserClient (SSR cookie auth)
- Fix extension ghost group creation (block invalid names like Notifications)
- Consolidate plan limits into single source of truth from stripe.ts
- Make CSV import field matching case-insensitive"

# Add remote
git remote add origin https://github.com/jacobc10/groupbase.git

echo ""
echo "Pushing to GitHub..."
echo "(You may be prompted for your GitHub credentials)"
echo ""

# Push
git push -u origin main --force

echo ""
echo "========================================="
echo "  Done! Vercel will auto-deploy."
echo "  https://github.com/jacobc10/groupbase"
echo "========================================="
echo ""
read -p "Press Enter to close..."
