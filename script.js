/* =========================================================
   DUAL YOUTUBE PLAYER
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

        this.volume =
            id === 1 ? 70 : 40;

        this.muted = false;

        this.timelineDragging = false;

        this.progressTimer = null;
    }
}


/* =========================================================
   TWO INDEPENDENT PLAYERS
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
   CREATE PLAYER
========================================================= */

function createYouTubePlayer(id) {

    const state = players[id];


    state.player = new YT.Player(
        `player${id}`,
        {

            width: "100%",

            height: "100%",

            playerVars: {

                enablejsapi: 1,

                autoplay: 0,

                playsinline: 1,

                modestbranding: 1

            },

            events: {

                onReady: function () {

                    handlePlayerReady(id);

                },

                onStateChange: function (event) {

                    handlePlayerStateChange(
                        id,
                        event
                    );

                },

                onError: function (event) {

                    handlePlayerError(
                        id,
                        event
                    );

                }

            }

        }
    );

}


/* =========================================================
   PLAYER READY
========================================================= */

function handlePlayerReady(id) {

    const state = players[id];

    state.ready = true;

    state.player.setVolume(
        state.volume
    );

    setStatus(
        id,
        "Ready"
    );

    startProgressUpdater(id);

}


/* =========================================================
   PLAYER STATE CHANGE
========================================================= */

function handlePlayerStateChange(
    id,
    event
) {

    const state = players[id];


    if (!state.player) {
        return;
    }


    switch (event.data) {

        case YT.PlayerState.PLAYING:

            setStatus(
                id,
                "Playing"
            );

            updateCurrentVideoInfo(id);

            updatePlaylistUI(id);

            break;


        case YT.PlayerState.PAUSED:

            setStatus(
                id,
                "Paused"
            );

            break;


        case YT.PlayerState.BUFFERING:

            setStatus(
                id,
                "Buffering..."
            );

            break;


        case YT.PlayerState.CUED:

            setStatus(
                id,
                "Ready"
            );

            updateCurrentVideoInfo(id);

            break;


        case YT.PlayerState.ENDED:

            handleVideoEnded(id);

            break;

    }

}


/* =========================================================
   YOUTUBE ERROR
========================================================= */

function handlePlayerError(
    id,
    event
) {

    const messages = {

        2:
            "Invalid YouTube video or playlist request.",

        5:
            "The video cannot be played.",

        100:
            "The video was not found or is private.",

        101:
            "The video owner does not allow embedding.",

        150:
            "The video owner does not allow embedding."

    };


    const message =
        messages[event.data] ||
        "YouTube could not play this content.";


    showError(
        id,
        message
    );

    setStatus(
        id,
        "Error"
    );

}


/* =========================================================
   URL PARSER
========================================================= */

function parseYouTubeURL(input) {

    if (
        !input ||
        !input.trim()
    ) {

        return {

            valid: false,

            error:
                "Please enter a YouTube URL."

        };

    }


    let url;


    try {

        url =
            new URL(
                input.trim()
            );

    } catch {

        return {

            valid: false,

            error:
                "Invalid URL."

        };

    }


    const hostname =
        url.hostname
            .toLowerCase()
            .replace(
                /^www\./,
                ""
            );


    const isYouTube =
        hostname === "youtube.com" ||
        hostname === "m.youtube.com" ||
        hostname === "youtu.be";


    if (!isYouTube) {

        return {

            valid: false,

            error:
                "Please enter a valid YouTube URL."

        };

    }


    const videoId =
        getVideoId(url);


    const playlistId =
        url.searchParams.get(
            "list"
        );


    /*
       If list= exists,
       treat it as a playlist.
    */

    if (playlistId) {

        return {

            valid: true,

            type: "playlist",

            playlistId,

            videoId

        };

    }


    if (videoId) {

        return {

            valid: true,

            type: "video",

            videoId

        };

    }


    return {

        valid: false,

        error:
            "Could not find video or playlist ID."

    };

}


/* =========================================================
   GET VIDEO ID
========================================================= */

function getVideoId(url) {

    const hostname =
        url.hostname
            .toLowerCase()
            .replace(
                /^www\./,
                ""
            );


    if (
        hostname === "youtu.be"
    ) {

        return (
            url.pathname.substring(1) ||
            null
        );

    }


    if (
        hostname === "youtube.com" ||
        hostname === "m.youtube.com"
    ) {

        if (
            url.pathname === "/watch"
        ) {

            return url.searchParams.get(
                "v"
            );

        }


        if (
            url.pathname.startsWith(
                "/shorts/"
            )
        ) {

            return (
                url.pathname.split("/")[2] ||
                null
            );

        }


        if (
            url.pathname.startsWith(
                "/embed/"
            )
        ) {

            return (
                url.pathname.split("/")[2] ||
                null
            );

        }

    }


    return null;

}


/* =========================================================
   LOAD PLAYER
========================================================= */

function loadPlayer(id) {

    const state =
        players[id];


    const input =
        document.getElementById(
            `url${id}`
        ).value;


    clearError(id);


    const parsed =
        parseYouTubeURL(input);


    if (!parsed.valid) {

        showError(
            id,
            parsed.error
        );

        return;

    }


    if (
        !state.ready ||
        !state.player
    ) {

        showError(
            id,
            "YouTube player is not ready yet."
        );

        return;

    }


    state.type =
        parsed.type;

    state.videoId =
        parsed.videoId || null;

    state.playlistId =
        parsed.playlistId || null;

    state.playlist = [];

    state.currentIndex = -1;


    if (
        parsed.type === "playlist"
    ) {

        loadPlaylist(
            id,
            parsed.playlistId
        );

    } else {

        loadVideo(
            id,
            parsed.videoId
        );

    }

}


/* =========================================================
   LOAD SINGLE VIDEO
========================================================= */

function loadVideo(
    id,
    videoId
) {

    const state =
        players[id];


    state.type =
        "video";

    state.playlist =
        [videoId];

    state.currentIndex =
        0;

    state.playlistId =
        null;


    state.player.loadVideoById(
        videoId
    );


    renderPlaylist(id);

    setStatus(
        id,
        "Loading..."
    );

}


/* =========================================================
   LOAD PLAYLIST
========================================================= */

function loadPlaylist(
    id,
    playlistId
) {

    const state =
        players[id];


    state.type =
        "playlist";

    state.playlistId =
        playlistId;


    state.player.loadPlaylist({

        listType: "playlist",

        list: playlistId,

        index: 0

    });


    setStatus(
        id,
        "Loading playlist..."
    );


    clearError(id);


    /*
       Wait until YouTube exposes
       the playlist information.
    */

    setTimeout(
        function () {

            refreshPlaylist(
                id
            );

        },
        1200
    );

}


/* =========================================================
   REFRESH PLAYLIST
========================================================= */

function refreshPlaylist(id) {

    const state =
        players[id];


    if (!state.player) {
        return;
    }


    const playlist =
        state.player.getPlaylist();


    if (
        !playlist ||
        playlist.length === 0
    ) {

        setTimeout(
            function () {

                const retry =
                    state.player.getPlaylist();


                if (
                    retry &&
                    retry.length > 0
                ) {

                    state.playlist =
                        retry;

                    state.currentIndex =
                        state.player
                            .getPlaylistIndex();

                    renderPlaylist(id);

                    updatePosition(id);

                } else {

                    showError(
                        id,
                        "Playlist could not be loaded."
                    );

                }

            },
            1500
        );

        return;

    }


    state.playlist =
        playlist;


    state.currentIndex =
        state.player.getPlaylistIndex();


    renderPlaylist(id);

    updatePosition(id);

}


/* =========================================================
   PLAY
========================================================= */

function playPlayer(id) {

    if (!isPlayerReady(id)) {
        return;
    }


    players[id]
        .player
        .playVideo();


    setStatus(
        id,
        "Playing"
    );

}


/* =========================================================
   PAUSE
========================================================= */

function pausePlayer(id) {

    if (!isPlayerReady(id)) {
        return;
    }


    players[id]
        .player
        .pauseVideo();


    setStatus(
        id,
        "Paused"
    );

}


/* =========================================================
   NEXT
========================================================= */

function nextPlayer(id) {

    const state =
        players[id];


    if (!isPlayerReady(id)) {
        return;
    }


    if (
        state.type !== "playlist"
    ) {

        setStatus(
            id,
            "Single video"
        );

        return;

    }


    const playlist =
        state.player.getPlaylist();


    if (
        !playlist ||
        playlist.length === 0
    ) {

        showError(
            id,
            "No playlist loaded."
        );

        return;

    }


    const current =
        state.player.getPlaylistIndex();


    if (
        current >= playlist.length - 1 &&
        !state.loop
    ) {

        setStatus(
            id,
            "End of playlist"
        );

        return;

    }


    state.player.nextVideo();

}


/* =========================================================
   PREVIOUS
========================================================= */

function previousPlayer(id) {

    const state =
        players[id];


    if (!isPlayerReady(id)) {
        return;
    }


    if (
        state.type !== "playlist"
    ) {

        setStatus(
            id,
            "Single video"
        );

        return;

    }


    const playlist =
        state.player.getPlaylist();


    if (
        !playlist ||
        playlist.length === 0
    ) {

        showError(
            id,
            "No playlist loaded."
        );

        return;

    }


    state.player.previousVideo();

}


/* =========================================================
   MUTE
========================================================= */

function mutePlayer(id) {

    if (!isPlayerReady(id)) {
        return;
    }


    const state =
        players[id];


    state.player.mute();

    state.muted =
        true;


    document.getElementById(
        `mute${id}Btn`
    ).textContent =
        "🔊 Unmute";

}


/* =========================================================
   UNMUTE
========================================================= */

function unmutePlayer(id) {

    if (!isPlayerReady(id)) {
        return;
    }


    const state =
        players[id];


    state.player.unMute();

    state.muted =
        false;


    document.getElementById(
        `mute${id}Btn`
    ).textContent =
        "🔇 Mute";

}


/* =========================================================
   TOGGLE MUTE
========================================================= */

function toggleMute(id) {

    if (
        players[id].muted
    ) {

        unmutePlayer(id);

    } else {

        mutePlayer(id);

    }

}


/* =========================================================
   VOLUME
========================================================= */

function setPlayerVolume(
    id,
    volume
) {

    const state =
        players[id];


    volume =
        Number(volume);


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


    if (
        !isPlayerReady(id)
    ) {

        return false;

    }


    state.volume =
        volume;


    state.player.setVolume(
        volume
    );


    document.getElementById(
        `volume${id}`
    ).value =
        volume;


    document.getElementById(
        `volumeValue${id}`
    ).textContent =
        `${volume}%`;


    return true;

}


/* =========================================================
   LOOP
========================================================= */

function updateLoop(id) {

    const state =
        players[id];


    state.loop =
        document.getElementById(
            `loop${id}`
        ).checked;


    if (
        !isPlayerReady(id)
    ) {
        return;
    }


    if (
        state.type === "playlist"
    ) {

        state.player.setLoop(
            state.loop
        );

    }

}


/* =========================================================
   SHUFFLE
========================================================= */

function updateShuffle(id) {

    const state =
        players[id];


    state.shuffle =
        document.getElementById(
            `shuffle${id}`
        ).checked;


    if (
        !isPlayerReady(id)
    ) {
        return;
    }


    if (
        state.type === "playlist"
    ) {

        state.player.setShuffle(
            state.shuffle
        );

    }

}


/* =========================================================
   VIDEO ENDED
========================================================= */

function handleVideoEnded(id) {

    const state =
        players[id];


    if (
        state.type !== "playlist"
    ) {

        setStatus(
            id,
            "Finished"
        );

        return;

    }


    const playlist =
        state.player.getPlaylist();


    if (
        !playlist ||
        playlist.length === 0
    ) {

        setStatus(
            id,
            "Finished"
        );

        return;

    }


    const current =
        state.player.getPlaylistIndex();


    if (
        current >= playlist.length - 1 &&
        !state.loop
    ) {

        setStatus(
            id,
            "Playlist finished"
        );

    }

}


/* =========================================================
   PLAYLIST UI
========================================================= */

function renderPlaylist(id) {

    const state =
        players[id];


    const container =
        document.getElementById(
            `playlist${id}`
        );


    if (
        !state.playlist ||
        state.playlist.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-playlist">
                No playlist loaded
            </div>
        `;

        return;

    }


    container.innerHTML = "";


    state.playlist.forEach(
        function (
            videoId,
            index
        ) {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "playlist-item";


            if (
                index ===
                state.currentIndex
            ) {

                item.classList.add(
                    "active"
                );

            }


            item.innerHTML = `

                <div class="playlist-number">
                    ${index + 1}
                </div>

                <div class="playlist-title">
                    ${
                        index ===
                        state.currentIndex
                        ? "▶ Now Playing"
                        : `Video ${index + 1}`
                    }
                </div>

            `;


            item.addEventListener(
                "click",
                function () {

                    playPlaylistItem(
                        id,
                        index
                    );

                }
            );


            container.appendChild(
                item
            );

        }
    );

}


/* =========================================================
   PLAY PLAYLIST ITEM
========================================================= */

function playPlaylistItem(
    id,
    index
) {

    const state =
        players[id];


    if (!isPlayerReady(id)) {
        return;
    }


    if (
        state.type !== "playlist"
    ) {
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


    state.currentIndex =
        index;


    state.player.playVideoAt(
        index
    );


    updatePlaylistUI(id);

}


/* =========================================================
   UPDATE PLAYLIST UI
========================================================= */

function updatePlaylistUI(id) {

    const state =
        players[id];


    if (
        state.type === "playlist" &&
        state.player
    ) {

        const index =
            state.player.getPlaylistIndex();


        if (
            index >= 0
        ) {

            state.currentIndex =
                index;

        }

    }


    const items =
        document.querySelectorAll(
            `#playlist${id} .playlist-item`
        );


    items.forEach(
        function (
            item,
            index
        ) {

            const active =
                index ===
                state.currentIndex;


            item.classList.toggle(
                "active",
                active
            );


            const title =
                item.querySelector(
                    ".playlist-title"
                );


            if (title) {

                title.textContent =
                    active
                    ? "▶ Now Playing"
                    : `Video ${index + 1}`;

            }

        }
    );

}


/* =========================================================
   CURRENT VIDEO INFO
========================================================= */

function updateCurrentVideoInfo(id) {

    if (!isPlayerReady(id)) {
        return;
    }


    const state =
        players[id];


    const data =
        state.player.getVideoData();


    const title =
        data &&
        data.title
        ? data.title
        : "YouTube video";


    document.getElementById(
        `title${id}`
    ).textContent =
        title;


    updatePosition(id);

}


/* =========================================================
   POSITION
========================================================= */

function updatePosition(id) {

    const state =
        players[id];


    if (
        !state.player
    ) {
        return;
    }


    let index =
        0;


    let total =
        1;


    if (
        state.type === "playlist"
    ) {

        const playlist =
            state.player.getPlaylist();


        if (
            playlist &&
            playlist.length > 0
        ) {

            total =
                playlist.length;


            index =
                state.player
                    .getPlaylistIndex();

        }

    }


    if (
        index < 0
    ) {

        index = 0;

    }


    state.currentIndex =
        index;


    document.getElementById(
        `position${id}`
    ).textContent =
        `${index + 1} / ${total}`;


    updatePlaylistUI(id);

}


/* =========================================================
   TIMELINE UPDATER
========================================================= */

function startProgressUpdater(id) {

    const state =
        players[id];


    if (
        state.progressTimer
    ) {

        clearInterval(
            state.progressTimer
        );

    }


    state.progressTimer =
        setInterval(
            function () {

                updateTimeline(id);

            },
            500
        );

}


/* =========================================================
   UPDATE TIMELINE
========================================================= */

function updateTimeline(id) {

    const state =
        players[id];


    if (
        !state.player ||
        !state.ready ||
        state.timelineDragging
    ) {

        return;

    }


    try {

        const current =
            state.player
                .getCurrentTime();


        const duration =
            state.player
                .getDuration();


        if (
            !duration ||
            duration <= 0
        ) {

            return;

        }


        const percentage =
            (
                current /
                duration
            ) * 100;


        document.getElementById(
            `timeline${id}`
        ).value =
            percentage;


        document.getElementById(
            `currentTime${id}`
        ).textContent =
            formatTime(
                current
            );


        document.getElementById(
            `duration${id}`
        ).textContent =
            formatTime(
                duration
            );


        document.getElementById(
            `remainingTime${id}`
        ).textContent =
            `-${formatTime(
                Math.max(
                    duration - current,
                    0
                )
            )}`;

    } catch {

        // Player may not be ready yet.

    }

}


/* =========================================================
   SEEK
========================================================= */

function seekPlayer(
    id,
    percentage
) {

    if (!isPlayerReady(id)) {
        return;
    }


    const player =
        players[id].player;


    const duration =
        player.getDuration();


    if (
        !duration ||
        duration <= 0
    ) {

        return;

    }


    const time =
        (
            Number(percentage) /
            100
        ) * duration;


    player.seekTo(
        time,
        true
    );

}


/* =========================================================
   FORMAT TIME
========================================================= */

function formatTime(
    seconds
) {

    if (
        !seconds ||
        Number.isNaN(seconds)
    ) {

        return "00:00";

    }


    seconds =
        Math.floor(
            seconds
        );


    const hours =
        Math.floor(
            seconds / 3600
        );


    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );


    const secs =
        seconds % 60;


    if (
        hours > 0
    ) {

        return (
            String(hours)
                .padStart(2, "0") +

            ":" +

            String(minutes)
                .padStart(2, "0") +

            ":" +

            String(secs)
                .padStart(2, "0")
        );

    }


    return (
        String(minutes)
            .padStart(2, "0") +

        ":" +

        String(secs)
            .padStart(2, "0")
    );

}


/* =========================================================
   READY CHECK
========================================================= */

function isPlayerReady(id) {

    const state =
        players[id];


    if (
        !state.ready ||
        !state.player
    ) {

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

function setStatus(
    id,
    message
) {

    document.getElementById(
        `status${id}`
    ).textContent =
        message;

}


/* =========================================================
   ERROR
========================================================= */

function showError(
    id,
    message
) {

    document.getElementById(
        `error${id}`
    ).textContent =
        message;

}


/* =========================================================
   CLEAR ERROR
========================================================= */

function clearError(id) {

    document.getElementById(
        `error${id}`
    ).textContent =
        "";

}


/* =========================================================
   GLOBAL CONTROLS
========================================================= */

function playBoth() {

    playPlayer(1);

    playPlayer(2);

}


function pauseBoth() {

    pausePlayer(1);

    pausePlayer(2);

}


function muteBoth() {

    mutePlayer(1);

    mutePlayer(2);

}


function unmuteBoth() {

    unmutePlayer(1);

    unmutePlayer(2);

}


function nextBoth() {

    nextPlayer(1);

    nextPlayer(2);

}


function previousBoth() {

    previousPlayer(1);

    previousPlayer(2);

}


/* =========================================================
   COMMAND PARSER
========================================================= */

function executeCommand() {

    const input =
        document.getElementById(
            "commandInput"
        )
        .value
        .trim();


    const output =
        document.getElementById(
            "commandOutput"
        );


    if (!input) {

        output.textContent =
            "Please enter a command.";

        return;

    }


    const parts =
        input
            .toLowerCase()
            .split(/\s+/);


    const command =
        parts[0];


    const target =
        parts[1];


    /* =====================================================
       PLAY
    ====================================================== */

    if (
        command === "play"
    ) {

        if (
            target === "1"
        ) {

            playPlayer(1);

            output.textContent =
                "Player 1 playing.";

            return;

        }


        if (
            target === "2"
        ) {

            playPlayer(2);

            output.textContent =
                "Player 2 playing.";

            return;

        }


        if (
            target === "both"
        ) {

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

    if (
        command === "pause"
    ) {

        if (
            target === "1"
        ) {

            pausePlayer(1);

            output.textContent =
                "Player 1 paused.";

            return;

        }


        if (
            target === "2"
        ) {

            pausePlayer(2);

            output.textContent =
                "Player 2 paused.";

            return;

        }


        if (
            target === "both"
        ) {

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

    if (
        command === "next"
    ) {

        if (
            target === "1"
        ) {

            nextPlayer(1);

            output.textContent =
                "Player 1 moved to next video.";

            return;

        }


        if (
            target === "2"
        ) {

            nextPlayer(2);

            output.textContent =
                "Player 2 moved to next video.";

            return;

        }


        if (
            target === "both"
        ) {

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

        if (
            target === "1"
        ) {

            previousPlayer(1);

            output.textContent =
                "Player 1 moved to previous video.";

            return;

        }


        if (
            target === "2"
        ) {

            previousPlayer(2);

            output.textContent =
                "Player 2 moved to previous video.";

            return;

        }


        if (
            target === "both"
        ) {

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

    if (
        command === "mute"
    ) {

        if (
            target === "1"
        ) {

            mutePlayer(1);

            output.textContent =
                "Player 1 muted.";

            return;

        }


        if (
            target === "2"
        ) {

            mutePlayer(2);

            output.textContent =
                "Player 2 muted.";

            return;

        }


        if (
            target === "both"
        ) {

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

    if (
        command === "unmute"
    ) {

        if (
            target === "1"
        ) {

            unmutePlayer(1);

            output.textContent =
                "Player 1 unmuted.";

            return;

        }


        if (
            target === "2"
        ) {

            unmutePlayer(2);

            output.textContent =
                "Player 2 unmuted.";

            return;

        }


        if (
            target === "both"
        ) {

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

    if (
        command === "volume"
    ) {

        if (
            target !== "1" &&
            target !== "2"
        ) {

            showCommandError(
                "Use: volume 1 70 or volume 2 40."
            );

            return;

        }


        if (
            parts.length !== 3
        ) {

            showCommandError(
                "Use: volume 1 70."
            );

            return;

        }


        const volume =
            Number(
                parts[2]
            );


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
       INVALID
    ====================================================== */

    showCommandError(
        "Invalid command. Example: play 1, next both, volume 1 70."
    );

}


/* =========================================================
   COMMAND ERROR
========================================================= */

function showCommandError(
    message
) {

    document.getElementById(
        "commandOutput"
    ).textContent =
        message;

}


/* =========================================================
   BUTTON EVENTS
========================================================= */


/* LOAD */

document.getElementById(
    "load1Btn"
).addEventListener(
    "click",
    function () {

        loadPlayer(1);

    }
);


document.getElementById(
    "load2Btn"
).addEventListener(
    "click",
    function () {

        loadPlayer(2);

    }
);


/* PLAYER 1 */

document.getElementById(
    "play1Btn"
).addEventListener(
    "click",
    function () {

        playPlayer(1);

    }
);


document.getElementById(
    "pause1Btn"
).addEventListener(
    "click",
    function () {

        pausePlayer(1);

    }
);


document.getElementById(
    "next1Btn"
).addEventListener(
    "click",
    function () {

        nextPlayer(1);

    }
);


document.getElementById(
    "previous1Btn"
).addEventListener(
    "click",
    function () {

        previousPlayer(1);

    }
);


document.getElementById(
    "mute1Btn"
).addEventListener(
    "click",
    function () {

        toggleMute(1);

    }
);


/* PLAYER 2 */

document.getElementById(
    "play2Btn"
).addEventListener(
    "click",
    function () {

        playPlayer(2);

    }
);


document.getElementById(
    "pause2Btn"
).addEventListener(
    "click",
    function () {

        pausePlayer(2);

    }
);


document.getElementById(
    "next2Btn"
).addEventListener(
    "click",
    function () {

        nextPlayer(2);

    }
);


document.getElementById(
    "previous2Btn"
).addEventListener(
    "click",
    function () {

        previousPlayer(2);

    }
);


document.getElementById(
    "mute2Btn"
).addEventListener(
    "click",
    function () {

        toggleMute(2);

    }
);


/* VOLUME */

document.getElementById(
    "volume1"
).addEventListener(
    "input",
    function (event) {

        setPlayerVolume(
            1,
            event.target.value
        );

    }
);


document.getElementById(
    "volume2"
).addEventListener(
    "input",
    function (event) {

        setPlayerVolume(
            2,
            event.target.value
        );

    }
);


/* LOOP */

document.getElementById(
    "loop1"
).addEventListener(
    "change",
    function () {

        updateLoop(1);

    }
);


document.getElementById(
    "loop2"
).addEventListener(
    "change",
    function () {

        updateLoop(2);

    }
);


/* SHUFFLE */

document.getElementById(
    "shuffle1"
).addEventListener(
    "change",
    function () {

        updateShuffle(1);

    }
);


document.getElementById(
    "shuffle2"
).addEventListener(
    "change",
    function () {

        updateShuffle(2);

    }
);


/* TIMELINE */

[1, 2].forEach(
    function (id) {

        const timeline =
            document.getElementById(
                `timeline${id}`
            );


        timeline.addEventListener(
            "mousedown",
            function () {

                players[id]
                    .timelineDragging =
                    true;

            }
        );


        timeline.addEventListener(
            "touchstart",
            function () {

                players[id]
                    .timelineDragging =
                    true;

            }
        );


        timeline.addEventListener(
            "input",
            function (event) {

                seekPlayer(
                    id,
                    event.target.value
                );

            }
        );


        timeline.addEventListener(
            "change",
            function (event) {

                seekPlayer(
                    id,
                    event.target.value
                );


                players[id]
                    .timelineDragging =
                    false;

            }
        );


        timeline.addEventListener(
            "mouseup",
            function () {

                players[id]
                    .timelineDragging =
                    false;

            }
        );


        timeline.addEventListener(
            "touchend",
            function () {

                players[id]
                    .timelineDragging =
                    false;

            }
        );

    }
);


/* GLOBAL */

document.getElementById(
    "playBothBtn"
).addEventListener(
    "click",
    playBoth
);


document.getElementById(
    "pauseBothBtn"
).addEventListener(
    "click",
    pauseBoth
);


document.getElementById(
    "muteBothBtn"
).addEventListener(
    "click",
    muteBoth
);


document.getElementById(
    "unmuteBothBtn"
).addEventListener(
    "click",
    unmuteBoth
);


document.getElementById(
    "nextBothBtn"
).addEventListener(
    "click",
    nextBoth
);


document.getElementById(
    "previousBothBtn"
).addEventListener(
    "click",
    previousBoth
);


/* COMMAND */

document.getElementById(
    "executeCommandBtn"
).addEventListener(
    "click",
    executeCommand
);


document.getElementById(
    "commandInput"
).addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Enter"
        ) {

            executeCommand();

        }

    }
);


/* URL ENTER */

[1, 2].forEach(
    function (id) {

        document.getElementById(
            `url${id}`
        ).addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter"
                ) {

                    loadPlayer(id);

                }

            }
        );

    }
);
