# XitChat GitHub Pages Setup

## Repository Settings

### 1. Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **Pages** section
4. Under "Build and deployment", select:
   - **Source**: Deploy from a branch
   - **Branch**: main
   - **Folder**: /root
5. Click **Save**

### 2. Repository Permissions
Ensure your repository has:
- **Actions permissions** enabled
- **Pages write access** for GitHub Actions

## Workflows Created

### 1. `pages.yml` - Simple Web Deploy
- Builds web version only
- Deploys to GitHub Pages
- No APK building

### 2. `deploy-pages.yml` - Full Deploy
- Builds web and mobile versions
- Creates APK for download
- Deploys web to GitHub Pages

## Usage

### For Web Deployment:
```bash
git add .
git commit -m "Setup GitHub Pages deployment"
git push origin main
```

### For APK Downloads:
- Web version will be deployed to GitHub Pages
- APK download will work from the deployed site
- Users can download APK from your GitHub Pages URL

## Notes

- GitHub Pages serves static files from `/dist` folder
- APK downloads will use the updated paths
- No need for external hosting

## Next Steps

1. **Push changes** to trigger workflow
2. **Check Actions tab** for workflow status
3. **Visit Pages URL** once deployed

Your GitHub Pages URL will be:
```
https://[username].github.io/[repository-name]/
```
