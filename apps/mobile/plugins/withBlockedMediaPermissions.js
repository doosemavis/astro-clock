// Strips the broad photo/video READ permissions that expo-media-library adds by default.
//
// MoveStar only SAVES a chart image to the gallery — lib/saveChart.ts uses the write-only
// path (MediaLibrary.requestPermissionsAsync(true) + saveToLibraryAsync) and never reads the
// user's media. Shipping READ_MEDIA_IMAGES/VIDEO triggers Google Play's "Photo and Video
// Permissions" declaration requirement for access the app doesn't actually use. Removing them
// keeps the build production-clean (no declaration needed) while saving still works.
//
// Keeps WRITE_EXTERNAL_STORAGE (the only permission saveToLibraryAsync needs, on Android <= 9).

const { AndroidConfig } = require("@expo/config-plugins");

const BLOCKED = [
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
  "android.permission.READ_EXTERNAL_STORAGE",
];

module.exports = (config) => AndroidConfig.Permissions.withBlockedPermissions(config, BLOCKED);
