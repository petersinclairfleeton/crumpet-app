// The address Google sends people back to after signing in: the Mac app's
// Google client id turned around (Google's rule for Mac and iPhone apps).
function schemeFor(clientId) {
  return `com.googleusercontent.apps.${clientId.replace(/\.apps\.googleusercontent\.com$/, '')}`;
}

module.exports = { schemeFor };
