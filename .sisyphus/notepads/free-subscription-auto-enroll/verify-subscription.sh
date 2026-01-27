#!/bin/bash
# Verification script for free subscription auto-enrollment
# Usage: ./verify-subscription.sh <test-email>

set -e

TEST_EMAIL="$1"

if [ -z "$TEST_EMAIL" ]; then
    echo "Usage: $0 <test-email>"
    echo "Example: $0 test-autoenroll-1738000000@example.com"
    exit 1
fi

echo "========================================="
echo "Free Subscription Auto-Enrollment Verification"
echo "========================================="
echo ""
echo "Test Email: $TEST_EMAIL"
echo ""

cd "$(dirname "$0")/../../../apps/backend"

echo "Step 1: Checking Convex logs for enrollment..."
echo "-------------------------------------------"
bunx convex logs --history 100 | grep -E "(User synced|Stripe customer|Auto-enrolled)" | tail -10 || echo "No recent enrollment logs found"
echo ""

echo "Step 2: Verification complete!"
echo "-------------------------------------------"
echo ""
echo "Manual verification required:"
echo "1. Check Convex Dashboard > Data > users table"
echo "   - Find user by email: $TEST_EMAIL"
echo "   - Verify stripeCustomerId is populated (cus_xxx)"
echo ""
echo "2. Check Convex Dashboard > Data > subscriptions table"
echo "   - Find subscription for the user"
echo "   - Verify status = 'active'"
echo "   - Verify externalPriceId matches free plan"
echo ""
echo "3. Check Stripe Dashboard (test mode) > Customers"
echo "   - Find customer by email: $TEST_EMAIL"
echo "   - Verify active subscription exists"
echo ""
