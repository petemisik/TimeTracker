# Volunteer Time Tracker App

A cross-platform mobile application (iOS and Android) for tracking volunteer hours and submitting them to a shared Google Spreadsheet.

## Features

- Custom splash screen with animation
- Local authentication
- Record volunteer time with organization and description
- Date and time pickers
- Online submission to Google Spreadsheet
- Offline mode with local storage for later sync
- Cross-platform (iOS and Android)

## Prerequisites

- Node.js and npm installed
- React Native CLI installed
- Xcode (for iOS development)
- Android Studio (for Android development)
- Google Cloud Platform account for API credentials

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `assets` folder in the project root and add your logo image as `logo.png`

4. Set up Google API credentials:
   - Go to the Google Cloud Console (https://console.cloud.google.com/)
   - Create a new project
   - Enable the Google Sheets API and Google Drive API
   - Create OAuth 2.0 credentials
   - Configure the OAuth consent screen
   - Create OAuth client IDs for Android and iOS
   - Update the `GOOGLE_CLIENT_ID` in App.js

5. Create a Google Spreadsheet:
   - Create a new Google Spreadsheet
   - Add the following headers in the first row:
     - Username
     - Date
     - Start Time
     - End Time
     - Hours
     - Organization
     - Description
   - Share the spreadsheet with the service account email
   - Copy the Spreadsheet ID from the URL and update the `SPREADSHEET_ID` in App.js

## Running the App

### iOS
```
npx react-native run-ios
```

### Android
```
npx react-native run-android
```

## Project Structure

- `App.js`: Main application file containing all screens and logic
- `package.json`: Project dependencies and configuration
- `assets/logo.png`: Logo image for splash screen

## How It Works

1. The app starts with a custom splash screen that displays for 2 seconds
2. Users log in with a username and password (stored locally)
3. After logging in, users can enter volunteer time details:
   - Date
   - Start and end times
   - Organization
   - Description
4. When submitting, the app:
   - Validates the input
   - Calculates hours worked
   - Attempts to submit to Google Spreadsheet if online
   - Stores data locally if offline for later sync

## Troubleshooting

- Make sure you have the correct Google API credentials
- Check that the spreadsheet is properly shared
- Ensure all required dependencies are installed
- For iOS issues, try cleaning the build folder and rebuilding
- For Android issues, check that the Google Play Services are installed on the emulator

## License

MIT