# IUT Student UI Branding Setup

The Student UI has been updated with IUT (Islamic University of Technology) branding. To complete the setup, you need to add the IUT logo and banner image.

## How to Add Branding Assets

### Step 1: Prepare Your Assets
You'll need two image files:

1. **IUT Logo** (PNG recommended)
   - Filename: `iut-logo.png`
   - Recommended size: 200x200px or larger
   - Format: PNG with transparency preferred

2. **IUT Banner/Campus Image** (JPG recommended)
   - Filename: `iut-banner.jpg`
   - Recommended size: 1200x300px minimum
   - Format: JPG or PNG

### Step 2: Place the Files
Add both image files to the `public/` folder in the student-ui directory:

```
student-ui/
├── public/
│   ├── iut-logo.png          ← Add here
│   ├── iut-banner.jpg        ← Add here
│   └── IUT_ASSETS_README.md
├── src/
│   ├── App.jsx
│   ├── index.css
│   └── components/
│       └── Login.jsx
└── package.json
```

### Step 3: Restart the Application

Once the images are in place, restart your development server or rebuild the Docker container:

```bash
# If running locally
npm run dev

# If running with Docker
docker compose up
```

## Where the Branding Appears

1. **Login Page (Before Authentication)**
   - IUT logo at the top with university name
   - Professional login card

2. **Main Header (After Authentication)**
   - IUT logo in the navigation bar
   - University name with "Cafeteria System" title
   - Makes the system feel connected to IUT

3. **Welcome Banner**
   - Full-width banner with IUT background image
   - Displays after login with welcoming message
   - Uses parallax effect for modern feel

## Design Details

- **Color Scheme**: Uses IUT's indigo/purple accent color (#6366f1 and #a855f7)
- **Responsive Design**: Images and layout adjust for mobile devices
- **Dark Mode Support**: All IUT branding elements support both light and dark themes
- **Graceful Fallback**: If images don't load, the app continues to work normally

## Getting IUT Assets

To obtain official IUT logos and images:
- Contact the IUT Communications/Marketing Office
- Check the official IUT website
- Request from your institution's brand guidelines

## File Structure

The updated Student UI includes:

### App.jsx
- Enhanced header with logo and university name
- Welcome banner with IUT background image
- Professional branding throughout

### Login.jsx
- IUT logo display on login page
- University name and system title
- Better visual hierarchy

### index.css
- `.iut-logo` - Styling for the logo image
- `.iut-banner` - Styling for the welcome banner
- Responsive media queries for mobile
- Dark mode support

## Notes

- Images are loaded from the public folder and served statically
- If images fail to load, they gracefully hide without breaking the UI
- The system is fully functional even without the images
- Cache may need to be cleared in browser if images don't update after replacing files

---

For any issues or customizations needed, refer to the component files in `student-ui/src/` directory.
