const canvas = document.getElementById('scene');

if (location.hash === '#bot-preview') {
  import('./dev/botPreview.js').then((m) => m.startBotPreview(canvas));
} else {
  import('./game/app.js').then((m) => m.startApp(canvas));
}
