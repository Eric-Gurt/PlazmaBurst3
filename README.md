This is only a Chromium-based Electron.js wrapper for Plazma Burst 3. It does not contain the game itself but is able to cache most of its' files once you've authenticated and the game is loaded.

It has UDP proxying support for connections which I'm considering as alternative to WebRTC not working in all cases (testing for now only).

It has hardware acceleration enabled by default so it may work for players with 2 GPUs out of the box if your Windows was defaulting to slower integrated GPU.
