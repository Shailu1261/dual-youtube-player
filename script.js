/* =========================================================
   DUAL YOUTUBE MULTI PLAYER

   Uses the official YouTube IFrame Player API.

   Architecture:
       Player 1 -> YouTube IFrame instance
       Player 2 -> YouTube IFrame instance

   Both players exist inside the SAME webpage/tab.
========================================================= */


/* =========================================================
   PLAYER STATE
========================================================= */

class PlayerState {

    constructor(id) {

        this.id = id;

        this.player = null;

        this.ready = false;

        this.type = null;

        this.videoId = null;

        this.playlistId = null;

        this.playlist = [];

        this.currentIndex = -1;

        this.loop = false;

        this.shuffle = false;

        this.volume = id === 1 ? 70 : 40;

        this.muted = false;

        this.timelineDragging = false;

        this.progressTimer = null;
    }
}


/* =========================================================
   CREATE TWO INDEPENDENT STATES
========================================================= */

const players = {
    1: new PlayerState(1),
    2: new PlayerState(2)
};


/* =========================================================
   YOUTUBE API READY
========================================================= */

window.onYouTubeIframeAPIReady = function () {

    createYouTubePlayer(1);
    createYouTubePlayer(2);
};


/* =========================================================
   CREATE YOUTUBE PLAYER
========================================================= */

function createYouTubePlayer(id) {

    const state = players[id];

    state.player = new YT.Player(`player${id}`, {

        width: "100%",

        height: "100%",

        playerVars: {

            // Important for JS control.
            enablejsapi: 1,

            // Avoid automatically playing without user interaction.
            autoplay: 0,

            // Keep both players inside same page.
            playsinline: 1,

            // Normal YouTube branding.
            modestbranding: 1

        },

        events: {

            onReady: () => handlePlayerReady(id),

            onStateChange: (event) =>
                handlePlayerStateChange(id, event),

            onError: (event) =>
                handlePlayerError(id, event)

        }

    });
}


/* =========================================================
   PLAYER READY
========================================================= */

function handlePlayerReady(id) {

    const state = players[id];

    state.ready = true;

    state.player.setVolume(state.volume);

    setStatus(id, "Ready");

    startProgressUpdater(id);
}


/* =========================================================
   PLAYER STATE CHANGE
========================================================= */

function handlePlayerStateChange(id, event) {

    const state = players[id];

    if (!state.player) {
        return;
    }


    switch (event.data) {

        case YT.PlayerState.PLAYING:

            setStatus(id, "Playing");

            updateCurrentVideoInfo(id);

            updatePlaylistUI(id);

            break;


        case YT.PlayerState.PAUSED:

            setStatus(id, "Paused");

            break;


        case YT.PlayerState.BUFFERING:

            setStatus(id, "Buffering...");

            break;


        case YT.PlayerState.CUED:

            setStatus(id, "Ready");

            updateCurrentVideoInfo(id);

            break;


        case YT.PlayerState.ENDED:

            handleVideoEnded(id);

            break;

    }

}


/* =========================================================
   PLAYER ERROR
========================================================= */

function handlePlayerError(id, event) {

    const messages = {

        2: "Invalid YouTube video or playlist request.",

        5: "The video cannot be played in this player.",

        100: "The requested video was not found or is private.",

        101: "The video owner does not allow embedded playback.",

        150: "The video owner does not allow embedded playback."

    };

    const message =
        messages[event.data] ||
        "YouTube could not play this content.";

    showError(id, message);

    setStatus(id, "Error");
}


/* =========================================================
   URL PARSER
========================================================= */

function parseYouTubeURL(input) {

    if (!input || !input.trim()) {

        return {
            valid: false,
            error: "Please enter a YouTube URL."
        };
    }


    let url;

    try {

        url = new URL(input.trim());

    } catch {

        return {
            valid: false,
            error: "Invalid URL."
        };
    }


    const hostname =
        url.hostname.toLowerCase().replace(/^www\./, "");


    const isYouTube =
        hostname === "youtube.com" ||
        hostname === "m.youtube.com" ||
        hostname === "youtu.be";


    if (!isYouTube) {

        return {
            valid: false,
            error: "Please enter a valid YouTube URL."
        };
    }


    const videoId = getVideoId(url);

    const playlistId =
        url.searchParams.get("list");


    /*
       If a playlist exists, treat the URL as a playlist.

       This also handles:

       youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID

       because the playlist parameter is present.
    */

    if (playlistId) {

        return {

            valid: true,

            type: "playlist",

            playlistId: playlistId,

            videoId: videoId

        };
    }


    if (videoId) {

        return {

            valid: true,

            type: "video",

            videoId: videoId

        };
    }


    return {

        valid: false,

        error: "Could not find a YouTube video ID or playlist ID."

    };
}


/* =========================================================
   EXTRACT VIDEO ID
========================================================= */

function getVideoId(url) {

    const hostname =
        url.hostname.toLowerCase().replace(/^www\./, "");


    if (hostname === "youtu.be") {

        return url.pathname.substring(1) || null;

    }


    if (
        hostname === "youtube.com" ||
        hostname === "m.youtube.com"
    ) {

        if (url.pathname === "/watch") {

            return url.searchParams.get("v");

        }


        if (url.pathname.startsWith("/shorts/")) {

            return url.pathname.split("/")[2] || null;

        }


        if (url.pathname.startsWith("/embed/")) {

            return url.pathname.split("/")[2] || null;

        }

    }


    return null;
}


/* =========================================================
   LOAD URL
========================================================= */

function loadPlayer(id) {

    const state = players[id];

    const input =
        document.getElementById(`url${id}`).value;

    clearError(id);

    const parsed = parseYouTubeURL(input);

    if (!parsed.valid) {

        showError(id, parsed.error);

        return;
    }


    if (!state.ready || !state.player) {

        showError(
            id,
            "YouTube player is not ready yet. Please wait a moment."
        );

        return;
    }


    /*
       Reset old playlist state.
    */

    state.type = parsed.type;

    state.videoId = parsed.videoId || null;

    state.playlistId = parsed.playlistId || null;

    state.playlist = [];

    state.currentIndex = -1;


    try {

        if (parsed.type === "playlist") {

            loadPlaylist(
                id,
                parsed.playlistId,
                parsed.videoId
            );

        } else {

            loadVideo(
                id,
                parsed.videoId
            );

        }

    } catch (error) {

        console.error(error);

        showError(
            id,
            "Unable to load this YouTube content."
        );
    }

}


/* =========================================================
   LOAD SINGLE VIDEO
========================================================= */

function loadVideo(id, videoId) {

    const state = players[id];

    state.type = "video";

    state.playlist = [videoId];

    state.currentIndex = 0;

    state.playlistId = null;

    state.player.loadVideoById(videoId);

    renderPlaylist(id);

    setStatus(id, "Loading...");

    updatePosition(id);
}


/* =========================================================
   LOAD PLAYLIST
========================================================= */

function loadPlaylist(
    id,
    playlistId,
    startingVideoId = null
) {

    const state = players[id];

    state.type = "playlist";

    state.playlistId = playlistId;


    /*
       Load playlist using the YouTube IFrame API.

       No page reload occurs.
    */

    if (startingVideoId) {

        state.player.loadPlaylist({

            listType: "playlist",

            list: playlistId,

            index: 0

        });

    } else {

        state.player.loadPlaylist({

            listType: "playlist",

            list: playlistId,

            index: 0

        });

    }


    /*
       Give YouTube a short amount of time to expose
       the playlist IDs through getPlaylist().
    */

    setTimeout(() => {

        refreshPlaylistFromYouTube(id);

    }, 1000);


    setStatus(id, "Loading playlist...");

    clearError(id);
}


/* =========================================================
   REFRESH PLAYLIST
========================================================= */

function refreshPlaylistFromYouTube(id) {

    const state = players[id];

    if (!state.player) {
        return;
    }


    const playlist =
        state.player.getPlaylist();


    if (!playlist || playlist.length === 0) {

        setTimeout(() => {

            const retry =
                state.player.getPlaylist();

            if (retry && retry.length > 0) {

                state.playlist = retry;

                renderPlaylist(id);

                updatePosition(id);

            } else {

                showError(
                    id,
                    "Playlist could not be loaded. Check the playlist URL or privacy settings."
                );

            }

        }, 1500);

        return;
    }


    state.playlist = playlist;

    state.currentIndex =
        state.player.getPlaylistIndex();


    renderPlaylist(id);

    updateCurrentVideoInfo(id);

    updatePosition(id);
}


/* =========================================================
   PLAY
========================================================= */

function playPlayer(id) {

    const state = players[id];

    if (!isPlayerReady(id)) {
        return;
    }

    state.player.playVideo();

    setStatus(id, "Playing");
}


/* =========================================================
   PAUSE
========================================================= */

function pausePlayer(id) {

    const state = players[id];

    if (!isPlayerReady(id)) {
        return;
    }

    state.player.pauseVideo();

    setStatus(id, "Paused");
}


/* =========================================================
   NEXT
========================================================= */

function nextPlayer(id) {

    const state = players[id];

    if (!isPlayerReady(id)) {
        return;
    }


    if (state.type === "playlist") {

        const playlist =
            state.player.getPlaylist();


        if (!playlist || playlist.length === 0) {

            showError(
                id,
                "No playlist is currently loaded."
            );

            return;
        }


        const current =
            state.player.getPlaylistIndex();


        /*
           YouTube handles playlist navigation.
        */

        if (
            current >= playlist.length - 1 &&
            !state.loop
        ) {

            setStatus(id, "End of playlist");

            return;
        }


        state.player.nextVideo();

        return;
    }


    /*
       A single video does not have a "next" video.
    */

    setStatus(id, "Single video");
}


/* =========================================================
   PREVIOUS
========================================================= */

function previousPlayer(id) {

    const state = players[id];

    if (!isPlayerReady(id)) {
        return;
    }


    if (state.type === "playlist") {

        const playlist =
            state.player.getPlaylist();


        if (!playlist || playlist.length === 0) {

            showError(
                id,
                "No playlist is currently loaded."
            );

            return;
        }


        state.player.previousVideo();

        return;
    }


    setStatus(id, "Single video");
}


/* =========================================================
   MUTE
========================================================= */

function mutePlayer(id) {

    const state = players[id];

    if (!isPlayerReady(id)) {
        return;
    }

    state.player.mute();

    state.muted = true;

    document.getElementById(`mute${id}Btn`)
        .textContent = "🔊 Unmute";
}


/* =========================================================
   UNMUTE
========================================================= */

function unmutePlayer(id) {

    const state = players[id];

    if (!isPlayerReady(id)) {
        return;
    }

    state.player.unMute();

    state.muted = false;

    document.getElementById(`mute${id}Btn`)
        .textContent = "🔇 Mute";
}


/* =========================================================
   TOGGLE MUTE
========================================================= */

function toggleMute(id) {

    const state = players[id];

    if (state.muted) {

        unmutePlayer(id);

    } else {

        mutePlayer(id);

    }
}


/* =========================================================
   SET VOLUME
========================================================= */

function setPlayerVolume(id, volume) {

    const state = players[id];

    volume = Number(volume);


    if (
        Number.isNaN(volume) ||
        volume < 0 ||
        volume > 100
    ) {

        showError(
            id,
            "Volume must be between 0 and 100."
        );

        return false;
    }


    if (!isPlayerReady(id)) {

        return false;
    }


    state.volume = volume;

    state.player.setVolume(volume);


    document.getElementById(`volume${id}`)
        .value = volume;


    document.getElementById(`volumeValue${id}`)
        .textContent = `${volume}%`;


    return true;
}


/* =========================================================
   LOOP
========================================================= */

function updateLoop(id) {

    const state = players[id];

    state.loop =
        document.getElementById(`loop${id}`).checked;


    if (!isPlayerReady(id)) {
        return;
    }


    if (state.type === "playlist") {

        /*
           YouTube API's playlist loop function.
        */

        state.player.setLoop(state.loop);

    }
}


/* =========================================================
   SHUFFLE
========================================================= */

function updateShuffle(id) {

    const state = players[id];

    state.shuffle =
        document.getElementById(`shuffle${id}`).checked;


    if (!isPlayerReady(id)) {
        return;
    }


    if (state.type === "playlist") {

        state.player.setShuffle(state.shuffle);

    }
}


/* =========================================================
   HANDLE VIDEO END
========================================================= */

function handleVideoEnded(id) {

    const state = players[id];


    if (state.type !== "playlist") {

        setStatus(id, "Finished");

        return;
    }


    const playlist =
        state.player.getPlaylist();


    if (!playlist || playlist.length === 0) {

        setStatus(id, "Finished");

        return;
    }


    const currentIndex =
        state.player.getPlaylistIndex();


    /*
       Loop enabled:
       YouTube will continue looping the playlist.
    */

    if (state.loop) {

        return;
    }


    /*
       Loop disabled:
       Stop at the final playlist item.
    */

    if (currentIndex >= playlist.length - 1) {

        setStatus(id, "Playlist finished");

        updatePosition(id);

        return;
    }


    /*
       Normally YouTube automatically advances.
       This is a safety fallback.
    */

    setTimeout(() => {

        const newIndex =
            state.player.getPlaylistIndex();

        if (newIndex === currentIndex) {

            state.player.nextVideo();

        }

    }, 300);

}


/* =========================================================
   PLAYLIST UI
========================================================= */

function renderPlaylist(id) {

    const state = players[id];

    const container =
        document.getElementById(`playlist${id}`);


    if (!state.playlist || state.playlist.length === 0) {

        container.innerHTML = `
            <div class="empty-playlist">
                No playlist loaded
            </div>
        `;

        return;
    }


    container.innerHTML = "";


    state.playlist.forEach((videoId, index) => {

        const item =
            document.createElement("div");


        item.className = "playlist-item";


        if (index === state.currentIndex) {

            item.classList.add("active");

        }


        item.dataset.index = index;


        item.innerHTML = `

            <div class="playlist-number">
                ${index + 1}
            </div>

            <div class="playlist-title">
                ${index === state.currentIndex
                    ? "▶ Now Playing"
                    : `Video ${index + 1}`
                }
            </div>

        `;


        item.addEventListener("click", () => {

            playPlaylistItem(id, index);

        });


        container.appendChild(item);

    });

}


/* =========================================================
   PLAY PLAYLIST ITEM
========================================================= */

function playPlaylistItem(id, index) {

    const state = players[id];

    if (!isPlayerReady(id)) {
        return;
    }


    if (state.type !== "playlist") {

        return;
    }


    const playlist =
        state.player.getPlaylist();


    if (
        !playlist ||
        index < 0 ||
        index >= playlist.length
    ) {

        return;
    }


    /*
       YouTube's playlist index is used directly.
    */

    state.player.playVideoAt(index);

    state.currentIndex = index;

    updatePlaylistUI(id);

}


/* =========================================================
   UPDATE PLAYLIST UI
========================================================= */

function updatePlaylistUI(id) {

    const state = players[id];

    if (!state.player) {
        return;
    }


    if (state.type === "playlist") {

        const index =
            state.player.getPlaylistIndex();


        if (index >= 0) {

            state.currentIndex = index;

        }

    }


    const items =
        document.querySelectorAll(
            `#playlist${id} .playlist-item`
        );


    items.forEach((item, index) => {

        item.classList.toggle(
            "active",
            index === state.currentIndex
        );


        const title =
            item.querySelector(".playlist-title");


        if (title) {

            title.textContent =
                index === state.currentIndex
                    ? "▶ Now Playing"
                    : `Video ${index + 1}`;

        }

    });


    updatePosition(id);
}


/* =========================================================
   CURRENT VIDEO INFO
========================================================= */

function updateCurrentVideoInfo(id) {

    const state = players[id];

    if (!isPlayerReady(id)) {
        return;
    }


    const data =
        state.player.getVideoData();


    const title =
        data && data.title
            ? data.title
            : "YouTube video";


    document.getElementById(`title${id}`)
        .textContent = title;


    updatePosition(id);
}


/* =========================================================
   POSITION
========================================================= */

function updatePosition(id) {

    const state = players[id];

    if (!isPlayerReady(id)) {
        return;
    }


    let index = 0;

    let total = 1;


    if (state.type === "playlist") {

        const playlist =
            state.player.getPlaylist();


        if (playlist && playlist.length > 0) {

            total = playlist.length;

            index =
                state.player.getPlaylistIndex();

        }

    }


    document.getElementById(`position${id}`)
        .textContent =
        `${Math.max(index + 1, 1)} / ${total}`;


    updatePlaylistUIWithoutRecursion(id);
}


/* =========================================================
   UPDATE PLAYLIST WITHOUT CALLING POSITION AGAIN
========================================================= */

function updatePlaylistUIWithoutRecursion(id) {

    const state = players[id];

    const items =
        document.querySelectorAll(
            `#playlist${id} .playlist-item`
        );


    items.forEach((item, index) => {

        const active =
            index === state.currentIndex;

        item.classList.toggle("active", active);


        const title =
            item.querySelector(".playlist-title");


        if (title) {

            title.textContent =
                active
                    ? "▶ Now Playing"
                    : `Video ${index + 1}`;

        }

    });
}


/* =========================================================
   TIMELINE UPDATER
========================================================= */

function startProgressUpdater(id) {

    const state = players[id];


    if (state.progressTimer) {

        clearInterval(state.progressTimer);

    }


    state.progressTimer =
        setInterval(() => {

            updateTimeline(id);

        }, 500);

}


/* =========================================================
   UPDATE TIMELINE
========================================================= */

function updateTimeline(id) {

    const state = players[id];

    if (
        !state.player ||
        !state.ready ||
        state.timelineDragging
    ) {

        return;
    }


    try {

        const current =
            state.player.getCurrentTime();


        const duration =
            state.player.getDuration();


        if (
            !duration ||
            duration <= 0
        ) {

            return;
        }


        const percentage =
            (current / duration) * 100;


        document.getElementById(`timeline${id}`)
            .value = percentage;


        document.getElementById(`currentTime${id}`)
            .textContent =
            formatTime(current);


        document.getElementById(`duration${id}`)
            .textContent =
            formatTime(duration);


        document.getElementById(`remainingTime${id}`)
            .textContent =
            `-${formatTime(Math.max(duration - current, 0))}`;

    } catch {

        // Player may not be fully initialized yet.
    }

}


/* =========================================================
   SEEK VIDEO
========================================================= */

function seekPlayer(id, percentage) {

    const state = players[id];

    if (!isPlayerReady(id)) {
        return;
    }


    const duration =
        state.player.getDuration();


    if (!duration || duration <= 0) {
        return;
    }


    const time =
        (Number(percentage) / 100) * duration;


    state.player.seekTo(time, true);

}


/* =========================================================
   FORMAT TIME
========================================================= */

function formatTime(seconds) {

    if (
        !seconds ||
        Number.isNaN(seconds)
    ) {

        return "00:00";
    }


    seconds = Math.floor(seconds);


    const hours =
        Math.floor(seconds / 3600);


    const minutes =
        Math.floor((seconds % 3600) / 60);


    const secs =
        seconds % 60;


    if (hours > 0) {

        return `${String(hours).padStart(2, "0")}:` +
               `${String(minutes).padStart(2, "0")}:` +
               `${String(secs).padStart(2, "0")}`;

    }


    return `${String(minutes).padStart(2, "0")}:` +
           `${String(secs).padStart(2, "0")}`;
}


/* =========================================================
   PLAYER READY CHECK
========================================================= */

function isPlayerReady(id) {

    const state = players[id];

    if (!state.ready || !state.player) {

        showError(
            id,
            "YouTube player is not ready yet."
        );

        return false;
    }


    return true;
}


/* =========================================================
   STATUS
========================================================= */

function setStatus(id, message) {

    document.getElementById(`status${id}`)
        .textContent = message;
}


/* =========================================================
   ERROR
========================================================= */

function showError(id, message) {

    document.getElementById(`error${id}`)
        .textContent = message;
}


/* =========================================================
   CLEAR ERROR
========================================================= */

function clearError(id) {

    document.getElementById(`error${id}`)
        .textContent = "";
}


/* =========================================================
   GLOBAL PLAY
========================================================= */

function playBoth() {

    playPlayer(1);
    playPlayer(2);

}


/* =========================================================
   GLOBAL PAUSE
========================================================= */

function pauseBoth() {

    pausePlayer(1);
    pausePlayer(2);

}


/* =========================================================
   GLOBAL MUTE
========================================================= */

function muteBoth() {

    mutePlayer(1);
    mutePlayer(2);

}


/* =========================================================
   GLOBAL UNMUTE
========================================================= */

function unmuteBoth() {

    unmutePlayer(1);
    unmutePlayer(2);

}


/* =========================================================
   GLOBAL NEXT
========================================================= */

function nextBoth() {

    nextPlayer(1);
    nextPlayer(2);

}


/* =========================================================
   GLOBAL PREVIOUS
========================================================= */

function previousBoth() {

    previousPlayer(1);
    previousPlayer(2);

}


/* =========================================================
   COMMAND PARSER
========================================================= */

function executeCommand() {

    const input =
        document.getElementById("commandInput")
            .value
            .trim();


    const output =
        document.getElementById("commandOutput");


    if (!input) {

        output.textContent =
            "Please enter a command.";

        return;
    }


    /*
       Ignore extra spaces.
       Make command case-insensitive.
    */

    const parts =
        input
            .toLowerCase()
            .split(/\s+/);


    const command = parts[0];

    const target = parts[1];


    /* =====================================================
       PLAY
    ====================================================== */

    if (command === "play") {

        if (target === "1") {

            playPlayer(1);

            output.textContent =
                "Player 1 playing.";

            return;
        }


        if (target === "2") {

            playPlayer(2);

            output.textContent =
                "Player 2 playing.";

            return;
        }


        if (target === "both") {

            playBoth();

            output.textContent =
                "Both players playing.";

            return;
        }


        showCommandError(
            "Use: play 1, play 2, or play both."
        );

        return;
    }


    /* =====================================================
       PAUSE
    ====================================================== */

    if (command === "pause") {

        if (target === "1") {

            pausePlayer(1);

            output.textContent =
                "Player 1 paused.";

            return;
        }


        if (target === "2") {

            pausePlayer(2);

            output.textContent =
                "Player 2 paused.";

            return;
        }


        if (target === "both") {

            pauseBoth();

            output.textContent =
                "Both players paused.";

            return;
        }


        showCommandError(
            "Use: pause 1, pause 2, or pause both."
        );

        return;
    }


    /* =====================================================
       NEXT
    ====================================================== */

    if (command === "next") {

        if (target === "1") {

            nextPlayer(1);

            output.textContent =
                "Player 1 moved to next video.";

            return;
        }


        if (target === "2") {

            nextPlayer(2);

            output.textContent =
                "Player 2 moved to next video.";

            return;
        }


        if (target === "both") {

            nextBoth();

            output.textContent =
                "Both players moved to next video.";

            return;
        }


        showCommandError(
            "Use: next 1, next 2, or next both."
        );

        return;
    }


    /* =====================================================
       PREVIOUS
    ====================================================== */

    if (
        command === "previous" ||
        command === "prev"
    ) {

        if (target === "1") {

            previousPlayer(1);

            output.textContent =
                "Player 1 moved to previous video.";

            return;
        }


        if (target === "2") {

            previousPlayer(2);

            output.textContent =
                "Player 2 moved to previous video.";

            return;
        }


        if (target === "both") {

            previousBoth();

            output.textContent =
                "Both players moved to previous video.";

            return;
        }


        showCommandError(
            "Use: previous 1, previous 2, or previous both."
        );

        return;
    }


    /* =====================================================
       MUTE
    ====================================================== */

    if (command === "mute") {

        if (target === "1") {

            mutePlayer(1);

            output.textContent =
                "Player 1 muted.";

            return;
        }


        if (target === "2") {

            mutePlayer(2);

            output.textContent =
                "Player 2 muted.";

            return;
        }


        if (target === "both") {

            muteBoth();

            output.textContent =
                "Both players muted.";

            return;
        }


        showCommandError(
            "Use: mute 1, mute 2, or mute both."
        );

        return;
    }


    /* =====================================================
       UNMUTE
    ====================================================== */

    if (command === "unmute") {

        if (target === "1") {

            unmutePlayer(1);

            output.textContent =
                "Player 1 unmuted.";

            return;
        }


        if (target === "2") {

            unmutePlayer(2);

            output.textContent =
                "Player 2 unmuted.";

            return;
        }


        if (target === "both") {

            unmuteBoth();

            output.textContent =
                "Both players unmuted.";

            return;
        }


        showCommandError(
            "Use: unmute 1, unmute 2, or unmute both."
        );

        return;
    }


    /* =====================================================
       VOLUME
    ====================================================== */

    if (command === "volume") {

        if (
            target !== "1" &&
            target !== "2"
        ) {

            showCommandError(
                "Use: volume 1 70 or volume 2 40."
            );

            return;
        }


        if (parts.length !== 3) {

            showCommandError(
                "Use: volume 1 70."
            );

            return;
        }


        const volume =
            Number(parts[2]);


        if (
            Number.isNaN(volume) ||
            volume < 0 ||
            volume > 100
        ) {

            showCommandError(
                "Volume must be between 0 and 100."
            );

            return;
        }


        const playerId =
            Number(target);


        if (
            setPlayerVolume(
                playerId,
                volume
            )
        ) {

            output.textContent =
                `Player ${playerId} volume changed to ${volume}%.`;

        }

        return;
    }


    /* =====================================================
       INVALID COMMAND
    ====================================================== */

    showCommandError(
        "Invalid command. Example: play 1, next both, volume 1 70."
    );
}


/* =========================================================
   COMMAND ERROR
========================================================= */

function showCommandError(message) {

    document.getElementById("commandOutput")
        .textContent = message;
}


/* =========================================================
   EVENT LISTENERS
========================================================= */


/* ---------- Load ---------- */

document.getElementById("load1Btn")
    .addEventListener(
        "click",
        () => loadPlayer(1)
    );


document.getElementById("load2Btn")
    .addEventListener(
        "click",
        () => loadPlayer(2)
    );


/* ---------- Player 1 ---------- */

document.getElementById("play1Btn")
    .addEventListener(
        "click",
        () => playPlayer(1)
    );


document.getElementById("pause1Btn")
    .addEventListener(
        "click",
        () => pausePlayer(1)
    );


document.getElementById("next1Btn")
    .addEventListener(
        "click",
        () => nextPlayer(1)
    );


document.getElementById("previous1Btn")
    .addEventListener(
        "click",
        () => previousPlayer(1)
    );


document.getElementById("mute1Btn")
    .addEventListener(
        "click",
        () => toggleMute(1)
    );


/* ---------- Player 2 ---------- */

document.getElementById("play2Btn")
    .addEventListener(
        "click",
        () => playPlayer(2)
    );


document.getElementById("pause2Btn")
    .addEventListener(
        "click",
        () => pausePlayer(2)
    );


document.getElementById("next2Btn")
    .addEventListener(
        "click",
        () => nextPlayer(2)
    );


document.getElementById("previous2Btn")
    .addEventListener(
        "click",
        () => previousPlayer(2)
    );


document.getElementById("mute2Btn")
    .addEventListener(
        "click",
        () => toggleMute(2)
    );


/* ---------- Volume ---------- */

document.getElementById("volume1")
    .addEventListener(
        "input",
        event => setPlayerVolume(1, event.target.value)
    );


document.getElementById("volume2")
    .addEventListener(
        "input",
        event => setPlayerVolume(2, event.target.value)
    );


/* ---------- Loop ---------- */

document.getElementById("loop1")
    .addEventListener(
        "change",
        () => updateLoop(1)
    );


document.getElementById("loop2")
    .addEventListener(
        "change",
        () => updateLoop(2)
    );


/* ---------- Shuffle ---------- */

document.getElementById("shuffle1")
    .addEventListener(
        "change",
        () => updateShuffle(1)
    );


document.getElementById("shuffle2")
    .addEventListener(
        "change",
        () => updateShuffle(2)
    );


/* ---------- Timeline ---------- */

[1, 2].forEach(id => {

    const timeline =
        document.getElementById(`timeline${id}`);


    timeline.addEventListener(
        "mousedown",
        () => {
            players[id].timelineDragging = true;
        }
    );


    timeline.addEventListener(
        "touchstart",
        () => {
            players[id].timelineDragging = true;
        }
    );


    timeline.addEventListener(
        "input",
        event => {
            seekPlayer(id, event.target.value);
        }
    );


    timeline.addEventListener(
        "change",
        event => {

            seekPlayer(id, event.target.value);

            players[id].timelineDragging = false;

        }
    );


    timeline.addEventListener(
        "mouseup",
        () => {
            players[id].timelineDragging = false;
        }
    );


    timeline.addEventListener(
        "touchend",
        () => {
            players[id].timelineDragging = false;
        }
    );

});


/* ---------- Global ---------- */

document.getElementById("playBothBtn")
    .addEventListener(
        "click",
        playBoth
    );


document.getElementById("pauseBothBtn")
    .addEventListener(
        "click",
        pauseBoth
    );


document.getElementById("muteBothBtn")
    .addEventListener(
        "click",
        muteBoth
    );


document.getElementById("unmuteBothBtn")
    .addEventListener(
        "click",
        unmuteBoth
    );


document.getElementById("nextBothBtn")
    .addEventListener(
        "click",
        nextBoth
    );


document.getElementById("previousBothBtn")
    .addEventListener(
        "click",
        previousBoth
    );


/* ---------- Command ---------- */

document.getElementById("executeCommandBtn")
    .addEventListener(
        "click",
        executeCommand
    );


/*
   Allow Enter key to execute command.
*/

document.getElementById("commandInput")
    .addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                executeCommand();

            }

        }
    );


/*
   Allow Enter key to load URL.
*/

[1, 2].forEach(id => {

    document.getElementById(`url${id}`)
        .addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    loadPlayer(id);

                }

            }
        );

});