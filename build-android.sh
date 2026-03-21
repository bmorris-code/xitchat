#!/bin/bash

# XitChat Android Build & Deploy Script
# This script automates the build process for Android APK/AAB

set -e  # Exit on error

echo "🚀 XitChat Android Build Script"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Error: package.json not found. Please run this script from the project root."
    exit 1
fi

print_success "Project directory verified"

# Step 1: Clean previous builds
echo ""
echo "📦 Step 1: Cleaning previous builds..."
rm -rf dist
rm -rf android/app/build
print_success "Cleaned previous builds"

# Step 2: Install dependencies
echo ""
echo "📦 Step 2: Installing dependencies..."
if npm ci; then
    print_success "Dependencies installed"
else
    print_warning "npm ci failed, trying npm install..."
    npm install
fi

# Step 3: Build web assets
echo ""
echo "🔨 Step 3: Building web assets for mobile..."
if npm run build:mobile; then
    print_success "Web assets built successfully"
else
    print_error "Failed to build web assets"
    exit 1
fi

# Step 4: Sync with Capacitor
echo ""
echo "🔄 Step 4: Syncing with Capacitor..."
if npx cap sync android; then
    print_success "Capacitor sync completed"
else
    print_error "Failed to sync with Capacitor"
    exit 1
fi

# Step 5: Check for keystore
echo ""
echo "🔑 Step 5: Checking for release keystore..."
if [ -f "android/keystore.properties" ]; then
    print_success "Keystore configuration found"
    BUILD_TYPE="release"
else
    print_warning "No keystore found. Building debug APK instead."
    print_warning "For release builds, create android/keystore.properties"
    BUILD_TYPE="debug"
fi

# Step 6: Build APK/AAB
echo ""
echo "🏗️  Step 6: Building Android $BUILD_TYPE..."
cd android

if [ "$BUILD_TYPE" = "release" ]; then
    # Ask user what to build
    echo ""
    echo "What would you like to build?"
    echo "1) APK (for direct distribution/testing)"
    echo "2) AAB (for Google Play Store)"
    echo "3) Both"
    read -p "Enter choice (1-3): " choice
    
    case $choice in
        1)
            echo "Building release APK..."
            if ./gradlew assembleRelease; then
                print_success "Release APK built successfully!"
                node ../scripts/sync-public-apk.cjs
                echo ""
                echo "📱 APK Location:"
                echo "   android/app/build/outputs/apk/release/app-release.apk"
            else
                print_error "Failed to build release APK"
                exit 1
            fi
            ;;
        2)
            echo "Building release AAB..."
            if ./gradlew bundleRelease; then
                print_success "Release AAB built successfully!"
                echo ""
                echo "📱 AAB Location:"
                echo "   android/app/build/outputs/bundle/release/app-release.aab"
            else
                print_error "Failed to build release AAB"
                exit 1
            fi
            ;;
        3)
            echo "Building both APK and AAB..."
            if ./gradlew assembleRelease bundleRelease; then
                print_success "Both APK and AAB built successfully!"
                node ../scripts/sync-public-apk.cjs
                echo ""
                echo "📱 Build Outputs:"
                echo "   APK: android/app/build/outputs/apk/release/app-release.apk"
                echo "   AAB: android/app/build/outputs/bundle/release/app-release.aab"
            else
                print_error "Failed to build release packages"
                exit 1
            fi
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
else
    # Build debug APK
    echo "Building debug APK..."
    if ./gradlew assembleDebug; then
        print_success "Debug APK built successfully!"
        node ../scripts/sync-public-apk.cjs
        echo ""
        echo "📱 APK Location:"
        echo "   android/app/build/outputs/apk/debug/app-debug.apk"
    else
        print_error "Failed to build debug APK"
        exit 1
    fi
fi

cd ..

# Step 7: Get file sizes
echo ""
echo "📊 Build Statistics:"
if [ "$BUILD_TYPE" = "release" ]; then
    if [ -f "android/app/build/outputs/apk/release/app-release.apk" ]; then
        APK_SIZE=$(du -h "android/app/build/outputs/apk/release/app-release.apk" | cut -f1)
        echo "   APK Size: $APK_SIZE"
    fi
    if [ -f "android/app/build/outputs/bundle/release/app-release.aab" ]; then
        AAB_SIZE=$(du -h "android/app/build/outputs/bundle/release/app-release.aab" | cut -f1)
        echo "   AAB Size: $AAB_SIZE"
    fi
else
    if [ -f "android/app/build/outputs/apk/debug/app-debug.apk" ]; then
        APK_SIZE=$(du -h "android/app/build/outputs/apk/debug/app-debug.apk" | cut -f1)
        echo "   APK Size: $APK_SIZE"
    fi
fi

# Step 8: Next steps
echo ""
echo "✅ Build Complete!"
echo ""
echo "📋 Next Steps:"
if [ "$BUILD_TYPE" = "release" ]; then
    echo "   1. Test the APK on a real device"
    echo "   2. Verify all features work correctly"
    echo "   3. Upload AAB to Google Play Console"
    echo "   4. Complete store listing with screenshots"
    echo "   5. Submit for review"
else
    echo "   1. Install debug APK on device for testing"
    echo "   2. Create release keystore when ready for production"
    echo "   3. See ANDROID_RELEASE_GUIDE.md for release instructions"
fi

echo ""
echo "🎉 Happy deploying!"
